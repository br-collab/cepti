import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Cancel a scheduled publish job. Soft-cancel (status -> 'canceled') rather
 * than a hard delete, so the history of what was planned is preserved.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params

    const supabase = getSupabaseServiceRoleClient()

    const { error: dbError } = await supabase
      .from('sma_scheduled_jobs')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'scheduled')

    if (dbError) {
      throw new Error(`Supabase error: ${dbError.message}`)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/sma/schedule/[id] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
