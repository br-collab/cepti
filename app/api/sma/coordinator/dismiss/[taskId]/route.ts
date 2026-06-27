import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const { taskId } = await params

    const supabase = await getSupabaseServiceRoleClient()

    // Deleting the coordinator task cascades to sma_paused_lifecycles and
    // sma_content_lifecycles (both FK ON DELETE CASCADE).
    const { error: dbError } = await supabase
      .from('sma_coordinator_tasks')
      .delete()
      .eq('task_id', taskId)

    if (dbError) {
      throw new Error(`Supabase error: ${dbError.message}`)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/sma/coordinator/dismiss/[taskId] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
