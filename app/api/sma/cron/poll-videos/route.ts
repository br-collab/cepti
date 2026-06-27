import { type NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { refreshPendingVideoJobs } from '@/lib/sma/video-poller'

export const runtime = 'nodejs'
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = req.headers.get('authorization')
  if (header === `Bearer ${expected}`) return true
  return req.headers.get('x-cron-secret') === expected
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  try {
    const supabase = getSupabaseServiceRoleClient()
    const summary = await refreshPendingVideoJobs(supabase)
    return NextResponse.json(summary)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
