import { type NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { publishApprovedTask } from '@/lib/sma/publish-service'
import { isPlatform } from '@/lib/sma/platforms'

export const runtime = 'nodejs'
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = req.headers.get('authorization')
  if (header === `Bearer ${expected}`) return true
  return req.headers.get('x-cron-secret') === expected
}

/**
 * Publish due scheduled jobs.
 *
 * Selects sma_scheduled_jobs that are still 'scheduled' and whose
 * scheduled_for has passed, then publishes each via the shared
 * publishApprovedFacebookTask() — the same human-authorized path the manual
 * "Publish to Facebook" button uses. Only pre-approved content publishes; this
 * is not autonomous posting.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  const supabase = getSupabaseServiceRoleClient()
  const nowIso = new Date().toISOString()

  const { data: jobs, error } = await supabase
    .from('sma_scheduled_jobs')
    .select('id, task_id, platform, scheduled_for, status')
    .eq('status', 'scheduled')
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true })
    .limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let published = 0
  let failed = 0

  for (const job of jobs ?? []) {
    try {
      const platform = isPlatform(job.platform) ? job.platform : 'facebook'
      const result = await publishApprovedTask(job.task_id, platform)
      if (result.ok) {
        published += 1
        const { error: upErr } = await supabase
          .from('sma_scheduled_jobs')
          .update({
            status: 'published',
            published_post_id: result.platform_post_id,
            error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
        if (upErr) {
          console.error(`[publish-scheduled] job ${job.id} status update failed:`, upErr.message)
        }
      } else {
        failed += 1
        const { error: upErr } = await supabase
          .from('sma_scheduled_jobs')
          .update({
            status: 'failed',
            error: result.error,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
        if (upErr) {
          console.error(`[publish-scheduled] job ${job.id} status update failed:`, upErr.message)
        }
      }
    } catch (e) {
      failed += 1
      const message = e instanceof Error ? e.message : 'Unknown publish error'
      console.error(`[publish-scheduled] job ${job.id} threw:`, message)
      await supabase
        .from('sma_scheduled_jobs')
        .update({ status: 'failed', error: message, updated_at: new Date().toISOString() })
        .eq('id', job.id)
    }
  }

  return NextResponse.json({ processed: jobs?.length ?? 0, published, failed })
}
