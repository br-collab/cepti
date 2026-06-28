import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import { estLlmCostUsd } from '@/lib/sma/ai-usage'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import {
  getOrCreateConversation,
  getRecentHistory,
  recordMessage,
  setHandoff,
  type WaMessage,
} from './whatsapp-store'
import { markWhatsAppRead, sendWhatsAppText } from './whatsapp-client'

/**
 * The inbound WhatsApp Advisor — autonomous within hard guardrails.
 *
 * Flow per inbound text message:
 *   1. Mark read; ensure a conversation row exists.
 *   2. Record the inbound message (dedupe on message_id — Meta retries).
 *   3. Arbitration: if the conversation is handed off to a human, stay silent.
 *   4. Ask Sonnet for a reply, given the recent transcript + guardrail prompt.
 *   5. If the reply carries the [HANDOFF] tag (price/quote/complaint/uncertain/
 *      explicit human request), strip it, send the bridge message, and flip the
 *      conversation to handed_off so the bot backs off and a human (in the
 *      WhatsApp Business app, via Coexistence) takes over.
 *   6. Persist the outbound message; log usage best-effort.
 *
 * Reactive only: we always reply inside the 24-hour customer-service window
 * because the customer just messaged us, which (re)opens it. No proactive or
 * template messages here — that is a v1.5 decision.
 */

const ADVISOR_MODEL = 'claude-sonnet-4-6'
const HANDOFF_TAG = '[HANDOFF]'
const MAX_HISTORY = 20

const HANDOFF_FALLBACK_ES =
  'Con gusto te paso con un miembro de nuestro equipo para ayudarte mejor. Un momento, por favor.'
const UNSUPPORTED_MEDIA_ES =
  'Por ahora solo puedo leer mensajes de texto. Te paso con nuestro equipo para que te atiendan. Un momento, por favor.'

let cachedPrompt: string | null = null
function loadSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt
  cachedPrompt = fs.readFileSync(
    path.join(process.cwd(), 'prompts/whatsapp/advisor.md'),
    'utf8',
  )
  return cachedPrompt
}

type Turn = { role: 'user' | 'assistant'; content: string }

/**
 * Map stored history to strictly alternating turns starting with `user`.
 * Anthropic requires alternation and a leading user turn; we merge consecutive
 * same-direction messages and drop any leading assistant turns.
 */
function toTurns(history: WaMessage[]): Turn[] {
  const mapped: Turn[] = history.map((m) => ({
    role: m.direction === 'inbound' ? 'user' : 'assistant',
    content: m.content,
  }))

  const merged: Turn[] = []
  for (const turn of mapped) {
    const last = merged[merged.length - 1]
    if (last && last.role === turn.role) {
      last.content = `${last.content}\n${turn.content}`
    } else {
      merged.push({ ...turn })
    }
  }
  while (merged.length > 0 && merged[0].role === 'assistant') {
    merged.shift()
  }
  return merged
}

interface LlmReply {
  text: string
  inputTokens: number
  outputTokens: number
}

async function callAdvisorLlm(turns: Turn[]): Promise<LlmReply> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ADVISOR_MODEL,
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: loadSystemPrompt(),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: turns,
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Anthropic API error (${res.status}): ${await res.text()}`)
  }

  const data = (await res.json()) as {
    content?: { type?: string; text?: string }[]
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  const text = (data.content ?? [])
    .filter((b) => b?.type === 'text')
    .map((b) => b?.text ?? '')
    .join('')
    .trim()

  return {
    text,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  }
}

/** Best-effort FinOps logging for advisor turns. Never throws. */
async function logAdvisorUsage(inputTokens: number, outputTokens: number): Promise<void> {
  try {
    const supabase = getSupabaseServiceRoleClient()
    const estCost = estLlmCostUsd(ADVISOR_MODEL, inputTokens, outputTokens)
    await supabase.from('sma_ai_usage').insert({
      kind: 'whatsapp',
      model: ADVISOR_MODEL,
      input_tokens: Math.max(0, Math.round(inputTokens || 0)),
      output_tokens: Math.max(0, Math.round(outputTokens || 0)),
      est_cost_usd: Number(estCost.toFixed(5)),
    })
  } catch (e) {
    console.error('whatsapp-advisor: usage log failed (non-fatal):', e)
  }
}

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

  const llm = await callAdvisorLlm(turns)
  void logAdvisorUsage(llm.inputTokens, llm.outputTokens)

  const wantsHandoff = llm.text.includes(HANDOFF_TAG)
  const cleaned = llm.text.split(HANDOFF_TAG).join('').trim()
  const reply = cleaned.length > 0 ? cleaned : HANDOFF_FALLBACK_ES

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
      handoff: wantsHandoff,
      source: 'advisor',
    },
  })

  if (wantsHandoff) {
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
