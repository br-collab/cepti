import { NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { refreshPendingVideoJobs } from '@/lib/sma/video-poller'

export const runtime = 'nodejs'

export async function GET() {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const supabase = getSupabaseServiceRoleClient()

    // Read-refresh: poll pending jobs so the UI shows "ready" without waiting
    // for the cron backstop. Best-effort — a poll failure must not block the
    // list below.
    try {
      await refreshPendingVideoJobs(supabase)
    } catch (e) {
      console.error('GET /api/sma/video/jobs refresh error:', e)
    }

    const { data: jobs, error: dbError } = await supabase
      .from('sma_video_jobs')
      .select(
        'id, request_id, status, product_slug, source_image_url, prompt, duration, video_url, error, created_at, updated_at',
      )
      .order('created_at', { ascending: false })
      .limit(20)

    if (dbError) {
      throw new Error(`Supabase error: ${dbError.message}`)
    }

    return NextResponse.json(jobs || [])
  } catch (error) {
    console.error('GET /api/sma/video/jobs error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
