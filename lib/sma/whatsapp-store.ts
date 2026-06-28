import 'server-only'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

/**
 * Persistence layer for the inbound WhatsApp Advisor.
 *
 * Backed by the `sma_whatsapp_conversations` and `sma_whatsapp_messages`
 * tables created in migration 0002. Both tables are RLS admin-only, so every
 * call here uses the service-role client (it bypasses RLS) — this module is
 * `server-only` and must never be imported into client code.
 *
 * v1 model: one conversation per WhatsApp user. `conversation_id` is set to
 * the user's `wa_id` for simplicity. If you later need multiple sessions per
 * user, switch to generated ids + a (whatsapp_user_id, session) index.
 */

export type WaDirection = 'inbound' | 'outbound'

export interface WaConversation {
  conversation_id: string
  whatsapp_user_id: string
  first_message_at: string
  last_message_at: string
  handed_off_to_human: boolean
  handoff_reason: string | null
  created_at: string
}

export interface WaMessage {
  message_id: string
  conversation_id: string
  direction: WaDirection
  content: string
  ts: string
  llm_response_metadata: Record<string, unknown> | null
}

/**
 * Return the conversation for a WhatsApp user, creating it if absent.
 * Idempotent: concurrent webhook deliveries cannot create duplicates because
 * `conversation_id` is the primary key and the insert ignores conflicts.
 */
export async function getOrCreateConversation(waId: string): Promise<WaConversation> {
  const supabase = getSupabaseServiceRoleClient()
  const nowIso = new Date().toISOString()

  // Insert-if-absent. ignoreDuplicates means a pre-existing row is left alone.
  await supabase
    .from('sma_whatsapp_conversations')
    .upsert(
      {
        conversation_id: waId,
        whatsapp_user_id: waId,
        first_message_at: nowIso,
        last_message_at: nowIso,
        handed_off_to_human: false,
      },
      { onConflict: 'conversation_id', ignoreDuplicates: true },
    )

  const { data, error } = await supabase
    .from('sma_whatsapp_conversations')
    .select('*')
    .eq('conversation_id', waId)
    .single()

  if (error || !data) {
    throw new Error(`getOrCreateConversation failed for ${waId}: ${error?.message ?? 'no row'}`)
  }
  return data as WaConversation
}

/**
 * Record one message. Returns `true` if it was newly inserted, `false` if the
 * `message_id` already existed (Meta retries webhook deliveries, so inbound
 * dedupe matters — a `false` result means "already processed, skip").
 */
export async function recordMessage(opts: {
  messageId: string
  conversationId: string
  direction: WaDirection
  content: string
  metadata?: Record<string, unknown> | null
}): Promise<boolean> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from('sma_whatsapp_messages')
    .upsert(
      {
        message_id: opts.messageId,
        conversation_id: opts.conversationId,
        direction: opts.direction,
        content: opts.content,
        llm_response_metadata: opts.metadata ?? null,
      },
      { onConflict: 'message_id', ignoreDuplicates: true },
    )
    .select('message_id')

  if (error) {
    throw new Error(`recordMessage failed (${opts.messageId}): ${error.message}`)
  }

  const isNew = Array.isArray(data) && data.length > 0

  // Touch the conversation's last_message_at so the admin list sorts correctly.
  await supabase
    .from('sma_whatsapp_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('conversation_id', opts.conversationId)

  return isNew
}

/**
 * Most recent messages for a conversation, oldest-first (chronological).
 */
export async function getRecentHistory(
  conversationId: string,
  limit = 20,
): Promise<WaMessage[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from('sma_whatsapp_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('ts', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`getRecentHistory failed (${conversationId}): ${error.message}`)
  }
  const rows = (data ?? []) as WaMessage[]
  return rows.reverse()
}

/**
 * Flip a conversation's handoff flag. When `handed_off_to_human` is true the
 * Advisor stays silent for that conversation — a human owns the thread (which,
 * under WhatsApp Coexistence, they answer from the WhatsApp Business app).
 */
export async function setHandoff(
  conversationId: string,
  handedOff: boolean,
  reason: string | null = null,
): Promise<void> {
  const supabase = getSupabaseServiceRoleClient()
  const { error } = await supabase
    .from('sma_whatsapp_conversations')
    .update({
      handed_off_to_human: handedOff,
      handoff_reason: handedOff ? reason : null,
    })
    .eq('conversation_id', conversationId)

  if (error) {
    throw new Error(`setHandoff failed (${conversationId}): ${error.message}`)
  }
}

/**
 * Admin list: conversations newest-first with a short preview of the last
 * message. Service-role only; called from the admin API route.
 */
export async function listConversations(limit = 100): Promise<
  (WaConversation & { last_message_preview: string | null })[]
> {
  const supabase = getSupabaseServiceRoleClient()
  const { data: convos, error } = await supabase
    .from('sma_whatsapp_conversations')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`listConversations failed: ${error.message}`)
  }

  const rows = (convos ?? []) as WaConversation[]
  const out: (WaConversation & { last_message_preview: string | null })[] = []

  for (const c of rows) {
    const { data: last } = await supabase
      .from('sma_whatsapp_messages')
      .select('content')
      .eq('conversation_id', c.conversation_id)
      .order('ts', { ascending: false })
      .limit(1)
      .maybeSingle()
    const preview = (last as { content?: string } | null)?.content ?? null
    out.push({ ...c, last_message_preview: preview ? preview.slice(0, 140) : null })
  }

  return out
}
