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
} from './whatsapp-store'
import { markWhatsAppRead, sendWhatsAppText } from './whatsapp-client'

/**
 * The inbound WhatsApp Advisor — autonomous within hard guardrails.
 *
 * The brain (LLM call, prompt + KB, [HANDOFF] protocol, transcript
 * normalization, usage logging) lives in lib/sma/advisor-core.ts and is shared
 * with the Messenger / Instagram DM advisor — it is NOT forked here. This module
 * owns only the WhatsApp-specific persistence, send client, and arbitration.
 *
 * Flow per inbound text message:
 *   1. Mark read; ensure a conversation row exists.
 *   2. Record the inbound message (dedupe on message_id — Meta retries).
 *   3. Arbitration: if the conversation is handed off to a human, stay silent.
 *   4. Ask advisor-core for a reply, given the recent transcript.
 *   5. If the reply carries the [HANDOFF] tag (price/quote/complaint/uncertain/
 *      explicit human request), send the bridge message and flip the
 *      conversation to handed_off so the bot backs off and a human (in the
 *      WhatsApp Business app, via Coexistence) takes over.
 *   6. Persist the outbound message; log usage best-effort.
 *
 * Reactive only: we always reply inside the 24-hour customer-service window
 * because the customer just messaged us, which (re)opens it. No proactive or
 * template messages here — that is a v1.5 decision.
 */

const MAX_HISTORY = 20

const UNSUPPORTED_MEDIA_ES =
  'Por ahora solo puedo leer mensajes de texto. Te paso con nuestro equipo para que te atiendan. Un momento, por favor.'

/**
 * Handle one inbound TEXT message from a WhatsApp user.
 * `waId` is the customer's wa_id (also our conversation_id in v1).
 */
export async function handleInboundText(opts: {
  waId: string
  messageId: string
  text: string
}): Promise<void> {
  const { waId, messageId, text } = opts

  void markWhatsAppRead(messageId)

  const conversation = await getOrCreateConversation(waId)

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
  void logAdvisorUsage('whatsapp', llm.inputTokens, llm.outputTokens)

  const reply = llm.text.length > 0 ? llm.text : HANDOFF_FALLBACK_ES

  const sent = await sendWhatsAppText(waId, reply)

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
 * Handle a non-text inbound (image, audio, document, location, etc.). The bot
 * can't process media in v1 — acknowledge and hand off to a human.
 */
export async function handleUnsupportedMessage(opts: {
  waId: string
  messageId: string
  kind: string
}): Promise<void> {
  const { waId, messageId, kind } = opts

  void markWhatsAppRead(messageId)
  const conversation = await getOrCreateConversation(waId)

  const isNew = await recordMessage({
    messageId,
    conversationId: conversation.conversation_id,
    direction: 'inbound',
    content: `[${kind} message]`,
  })
  if (!isNew) return
  if (conversation.handed_off_to_human) return

  const sent = await sendWhatsAppText(waId, UNSUPPORTED_MEDIA_ES)
  await recordMessage({
    messageId: sent.messageId ?? `local-${messageId}-out`,
    conversationId: conversation.conversation_id,
    direction: 'outbound',
    content: UNSUPPORTED_MEDIA_ES,
    metadata: { source: 'advisor', handoff: true, reason: 'unsupported_media' },
  })
  await setHandoff(conversation.conversation_id, true, 'unsupported_media')
}

/**
 * Record a message the human teammate sent from the WhatsApp Business app
 * (delivered to us as a Coexistence "echo"). Once a human replies, the bot
 * backs off for that conversation.
 *
 * NOTE: the exact Coexistence echo payload shape must be verified against real
 * webhook deliveries — see docs/sma/whatsapp-advisor.md. This is wired
 * defensively and is safe to no-op if echoes never arrive.
 */
export async function handleHumanEcho(opts: {
  waId: string
  messageId: string
  text: string
}): Promise<void> {
  const { waId, messageId, text } = opts
  const conversation = await getOrCreateConversation(waId)
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
