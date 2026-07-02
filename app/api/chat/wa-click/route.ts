import { NextResponse } from 'next/server'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Mark a website-chat conversation as converted when the visitor clicks through
 * to WhatsApp. Best-effort: fired from the chatbot's WhatsApp button with
 * keepalive, so a failure here never blocks the outbound navigation.
 * Body: { conversationId: string }
 */
export async function POST(req: Request) {
  let body: { conversationId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const conversationId =
    typeof body.conversationId === 'string' ? body.conversationId.trim() : ''
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
  }

  try {
    const supabase = getSupabaseServiceRoleClient()
    await supabase
      .from('sma_web_chat_conversations')
      .update({ wa_clicked: true, wa_clicked_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
  } catch (e) {
    console.error('chat/wa-click: update failed (non-fatal):', e)
  }

  return NextResponse.json({ ok: true })
}
