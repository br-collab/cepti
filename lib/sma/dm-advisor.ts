import 'server-only'
import {
  ADVISOR_MODEL,
  HANDOFF_FALLBACK_ES,
  generateAdvisorReply,
  logAdvisorUsage,
  toTurns,
} from './advisor-core'
import {
  getOrCreateConversation,
  getRecentHistory,
  recordMessage,
  setHandoff,
  type DmChannel,
} from './dm-store'
import { sendMessengerText } from './messenger-client'
import { sendInstagramDmText } from './instagram-dm-client'

/**
 * The inbound Messenger / Instagram Direct advisor — autonomous within hard
 * guardrails. Channel-aware mirror of lib/sma/whatsapp-advisor.ts.
 *
 * The brain (LLM call, prompt + KB, [HANDOFF] protocol, transcript
 * normalization, usage logging) is shared via lib/sma/advisor-core.ts — it is
 * NOT forked here. This module owns persistence (dm-store), the per-channel
 * send client, and arbitration.
 *
 * Flow per inbound text message:
 *   1. Ensure a conversation row exists for (channel, externalUserId).
 *   2. Record the inbound message (dedupe on message_id — Meta retries).
 *   3. Arbitration: if the conversation is handed off to a human, stay silent.
 *   4. Ask advisor-core for a reply, given the recent transcript.
 *   5. If the reply carries [HANDOFF], send the bridge and flip handed_off so
 *      the bot backs off and a human takes over in the Business Suite inbox.
 *   6. Persist the outbound message; log usage best-effort.
 *
 * Reactive only: we reply inside the 24-hour standard messaging window the
 * customer opened by messaging us first. No proactive / outside-window sends.
 */

const MAX_HISTORY = 20

const UNSUPPORTED_MEDIA_ES =
  'Por ahora solo puedo leer mensajes de texto. Te paso con nuestro equipo para que te atiendan. Un momento, por favor.'

/** Map a channel to its plain-text send client; returns the provider message id. */
async function sendText(
  channel: DmChannel,
  externalUserId: string,
  text: string,
): Promise<{ messageId: string | null }> {
  if (channel === 'messenger') {
    return sendMessengerText(externalUserId, text)
  }
  return sendInstagramDmText(externalUserId, text)
}

/** Free-text sma_ai_usage kind per channel. */
function usageKind(channel: DmChannel): string {
  return channel === 'messenger' ? 'messenger' : 'instagram_dm'
}

/**
 * Handle one inbound DM. `text` empty/undefined means a non-text attachment
 * (image, sticker, etc.) the bot can't process — escalate to a human.
 */
export async function handleInboundDm(opts: {
  channel: DmChannel
  externalUserId: string
  messageId: string
  text?: string | null
}): Promise<void> {
  const { channel, externalUserId, messageId, text } = opts

  const conversation = await getOrCreateConversation(channel, externalUserId)

  // Non-text inbound: acknowledge and hand off (bot can't read media in v1).
  if (!text || text.trim().length === 0) {
    const isNew = await recordMessage({
      messageId,
      conversationId: conversation.conversation_id,
      direction: 'inbound',
      content: '[non-text message]',
    })
    if (!isNew) return
    if (conversation.handed_off_to_human) return

    const sent = await sendText(channel, externalUserId, UNSUPPORTED_MEDIA_ES)
    await recordMessage({
      messageId: sent.messageId ?? `local-${messageId}-out`,
      conversationId: conversation.conversation_id,
      direction: 'outbound',
      content: UNSUPPORTED_MEDIA_ES,
      metadata: { source: 'advisor', handoff: true, reason: 'unsupported_media' },
    })
    await setHandoff(conversation.conversation_id, true, 'unsupported_media')
    return
  }

  const isNew = await recordMessage({
    messageId,
    conversationId: conversation.conversation_id,
    direction: 'inbound',
    content: text,
  })
  // Duplicate webhook delivery — already processed this message.
  if (!isNew) return

  // Arbitration: a human owns this thread, stay silent.
  if (conversation.handed_off_to_human) return

  const history = await getRecentHistory(conversation.conversation_id, MAX_HISTORY)
  const turns = toTurns(history)
  if (turns.length === 0) {
    // Shouldn't happen (we just recorded the inbound), but guard anyway.
    turns.push({ role: 'user', content: text })
  }

  const llm = await generateAdvisorReply(turns)
  void logAdvisorUsage(usageKind(channel), llm.inputTokens, llm.outputTokens)

  const reply = llm.text.length > 0 ? llm.text : HANDOFF_FALLBACK_ES

  const sent = await sendText(channel, externalUserId, reply)

  await recordMessage({
    messageId: sent.messageId ?? `local-${messageId}-out`,
    conversationId: conversation.conversation_id,
    direction: 'outbound',
    content: reply,
    metadata: {
      model: ADVISOR_MODEL,
      input_tokens: llm.inputTokens,
      output_tokens: llm.outputTokens,
      handoff: llm.handoff,
      source: 'advisor',
    },
  })

  if (llm.handoff) {
    await setHandoff(conversation.conversation_id, true, 'advisor_escalation')
  }
}

/**
 * Record a message the business sent (delivered as an `is_echo` event when a
 * human replies from the Business Suite inbox / Page). Once a human replies,
 * the bot backs off for that conversation.
 *
 * NOTE: the `is_echo` payload carries the message under the SAME `message`
 * object, but `sender.id` is the Page/IG account and `recipient.id` is the
 * customer — so the customer's external id is the RECIPIENT here. The caller
 * (webhook route) is responsible for passing the customer's id as
 * `externalUserId`. This is wired defensively per Meta's webhook docs and is
 * safe to no-op for echoes the bot itself sent (deduped by message_id).
 */
export async function handleHumanEcho(opts: {
  channel: DmChannel
  externalUserId: string
  messageId: string
  text: string
}): Promise<void> {
  const { channel, externalUserId, messageId, text } = opts
  const conversation = await getOrCreateConversation(channel, externalUserId)
  const isNew = await recordMessage({
    messageId,
    conversationId: conversation.conversation_id,
    direction: 'outbound',
    content: text,
    metadata: { source: 'human_echo' },
  })
  if (!isNew) return
  if (!conversation.handed_off_to_human) {
    await setHandoff(conversation.conversation_id, true, 'human_replied')
  }
}
