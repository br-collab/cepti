import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Scheduled publish jobs for pre-approved drafts.
 *
 * GET  — list the ~50 most recent jobs, ordered by scheduled_for desc.
 * POST — schedule an approved task: { taskId, scheduledFor (ISO), platform? }.
 *        Inserts a sma_scheduled_jobs row with status 'scheduled'. The
 *        publish-scheduled cron later runs the same human-authorized publish
 *        path. This is NOT autonomous posting — only approved content runs.
 */
export async function GET() {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const supabase = getSupabaseServiceRoleClient()

    const { data, error: dbError } = await supabase
      .from('sma_scheduled_jobs')
      .select('id, task_id, platform, scheduled_for, status, error, published_post_id, created_at, updated_at')
      .order('scheduled_for', { ascending: false })
      .limit(50)

    if (dbError) {
      throw new Error(`Supabase error: ${dbError.message}`)
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('GET /api/sma/schedule error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const body = (await req.json()) as {
      taskId?: unknown
      scheduledFor?: unknown
      platform?: unknown
    }

    const taskId =
      typeof body.taskId === 'string' && body.taskId.trim() ? body.taskId.trim() : null
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    const scheduledForRaw =
      typeof body.scheduledFor === 'string' && body.scheduledFor.trim()
        ? body.scheduledFor.trim()
        : null
    if (!scheduledForRaw) {
      return NextResponse.json({ error: 'scheduledFor is required' }, { status: 400 })
    }

    const scheduledForMs = Date.parse(scheduledForRaw)
    if (Number.isNaN(scheduledForMs)) {
      return NextResponse.json(
        { error: 'scheduledFor must be a valid ISO timestamp' },
        { status: 400 },
      )
    }

    // Must be in the future (allow a small 60s grace for clock skew / "now").
    if (scheduledForMs < Date.now() - 60_000) {
      return NextResponse.json(
        { error: 'scheduledFor must be in the future' },
        { status: 400 },
      )
    }

    const platform =
      typeof body.platform === 'string' && body.platform.trim()
        ? body.platform.trim()
        : 'facebook'

    const supabase = getSupabaseServiceRoleClient()

    const { data, error: dbError } = await supabase
      .from('sma_scheduled_jobs')
      .insert({
        task_id: taskId,
        platform,
        scheduled_for: new Date(scheduledForMs).toISOString(),
        status: 'scheduled',
      })
      .select('id, task_id, platform, scheduled_for, status, error, published_post_id, created_at, updated_at')
      .single()

    if (dbError) {
      throw new Error(`Supabase error: ${dbError.message}`)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/sma/schedule error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
