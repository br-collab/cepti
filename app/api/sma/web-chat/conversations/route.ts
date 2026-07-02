import { NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * List website-chat conversations for the admin dashboard, or return a single
 * conversation's transcript when ?conversationId=... is supplied. Mirrors the
 * WhatsApp conversations route: requireSmaAdmin for auth, then service-role
 * reads (RLS is admin-only on these tables).
 */
export async function GET(req: Request) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const conversationId = new URL(req.url).searchParams.get('conversationId')

  try {
    const supabase = getSupabaseServiceRoleClient()

    if (conversationId) {
      const { data: messages, error } = await supabase
        .from('sma_web_chat_messages')
        .select('message_id, role, content, ts')
        .eq('conversation_id', conversationId)
        .order('ts', { ascending: true })
      if (error) throw new Error(error.message)
      return NextResponse.json({ messages: messages ?? [] })
    }

    const { data: conversations, error } = await supabase
      .from('sma_web_chat_conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(100)
    if (error) throw new Error(error.message)
    return NextResponse.json({ conversations: conversations ?? [] })
  } catch (error) {
    console.error('GET /api/sma/web-chat/conversations error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
