import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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

    const { error: dbError } = await supabase.from('sma_leads').delete().eq('id', id)

    if (dbError) {
      throw new Error(`Supabase error: ${dbError.message}`)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/sma/leads/[id] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
