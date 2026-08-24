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
 * How far past its scheduled_for a job may still publish.
 *
 * Without this bound, any outage longer than the gap between cron runs turns
 * into a burst on recovery: the query below finds every overdue job at once and
 * publishes days-old content — backdated and out of context — to a live Page.
 * A Supabase free-tier auto-pause in Aug 2026 set up exactly that scenario.
 *
 * Two hours is deliberately generous: it absorbs a short deploy or provider
 * blip (the case we DO want to publish through) while still catching anything
 * that has drifted far enough to need a human's eyes.
 */
const STALE_AFTER_MS = 1000 * 60 * 60 * 2

/**
 * Publish due scheduled jobs.
 *
 * Selects sma_scheduled_jobs that are still 'scheduled' and whose
 * scheduled_for has passed, then publishes each via the shared
 * publishApprovedFacebookTask() — the same human-authorized path the manual
 * "Publish to Facebook" button uses. Only pre-approved content publishes; this
 * is not autonomous posting.
 *
 * Jobs more than STALE_AFTER_MS past due are retired to 'failed' with a reason
 * instead of being published. They are retired rather than merely filtered out
 * of the query: a filtered row would keep status 'scheduled' forever, invisible
 * to this cron but still sitting in the dashboard's scheduled list. Marking
 * them failed removes them from the working set, surfaces the reason to the
 * operator, and leaves rescheduling an explicit human decision.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  const supabase = getSupabaseServiceRoleClient()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()

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
  let stale = 0

  for (const job of jobs ?? []) {
    // Retire anything too far past due before it can reach the publish path.
    const scheduledFor = new Date(job.scheduled_for).getTime()
    const readable = Number.isFinite(scheduledFor)
    if (!readable || now - scheduledFor > STALE_AFTER_MS) {
      stale += 1
      const detail = readable
        ? `${Math.round((now - scheduledFor) / 3_600_000)}h past its scheduled time`
        : 'unreadable scheduled_for'
      const { error: upErr } = await supabase
        .from('sma_scheduled_jobs')
        .update({
          status: 'failed',
          error: `Not published — ${detail} (limit ${STALE_AFTER_MS / 3_600_000}h). Reschedule if this should still go out.`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      if (upErr) {
        console.error(`[publish-scheduled] job ${job.id} stale update failed:`, upErr.message)
      }
      continue
    }

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

  return NextResponse.json({ processed: jobs?.length ?? 0, published, failed, stale })
}
