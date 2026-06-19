import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { commentId } = await params

  try {
    const body = await req.json()
    const { reply_draft_id, action, edited_body } = body as {
      reply_draft_id: string
      action: 'approve' | 'reject'
      edited_body?: string
    }

    if (!reply_draft_id || !action) {
      return NextResponse.json({ error: 'reply_draft_id and action are required' }, { status: 400 })
    }

    const supabase = await getSupabaseServiceRoleClient()

    const updatePayload =
      action === 'approve'
        ? {
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            ...(edited_body ? { edited_body } : {}),
          }
        : { status: 'rejected' }

    const { error } = await supabase
      .from('sma_reply_drafts')
      .update(updatePayload)
      .eq('id', reply_draft_id)
      .eq('comment_id', commentId)

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(`POST /api/sma/inbox/${commentId} error:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
