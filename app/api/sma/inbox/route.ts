import { NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const supabase = await getSupabaseServiceRoleClient()

    const { data: comments, error } = await supabase
      .from('sma_comments')
      .select(`
        *,
        reply_drafts:sma_reply_drafts(*)
      `)
      .order('observed_at', { ascending: false })
      .limit(50)

    if (error) throw new Error(error.message)

    return NextResponse.json({ comments: comments || [] })
  } catch (error) {
    console.error('GET /api/sma/inbox error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
