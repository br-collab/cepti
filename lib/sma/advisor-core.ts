import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import { estLlmCostUsd } from '@/lib/sma/ai-usage'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

/**
 * advisor-core — the channel-agnostic brain shared by every CEPTI inbound
 * conversational advisor (WhatsApp, Facebook Messenger, Instagram Direct).
 *
 * It owns ONLY the parts that must never fork between channels:
 *   - the system prompt + product knowledge base (loaded + cached in module scope),
 *   - the LLM call (claude-sonnet-4-6, direct fetch with prompt caching),
 *   - the [HANDOFF] protocol (tag detection + strip + boolean),
 *   - the transcript normalization (alternating turns, leading-user),
 *   - best-effort FinOps usage logging into sma_ai_usage.
 *
 * Channel adapters (whatsapp-advisor, dm-advisor) own persistence, the send
 * client, and arbitration — they call generateAdvisorReply() for the words.
 */

export const ADVISOR_MODEL = 'claude-sonnet-4-6'
export const HANDOFF_TAG = '[HANDOFF]'

/**
 * Fallback bridge text used when the model emits the [HANDOFF] tag with no
 * usable message body before it. Spanish default (mirror the customer's
 * language is handled by the model; this is only the empty-body safety net).
 */
export const HANDOFF_FALLBACK_ES =
  'Con gusto te paso con un miembro de nuestro equipo para ayudarte mejor. Un momento, por favor.'

let cachedPrompt: string | null = null

/**
 * Load the channel-neutral system prompt and append the product knowledge base.
 * Cached in module scope so the ~10k-token KB is read from disk once per worker.
 * The KB is small enough to live in the prompt (no RAG); cache_control keeps it
 * from being re-billed on every turn.
 */
function loadSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt
  const base = fs.readFileSync(
    path.join(process.cwd(), 'prompts/advisor/system.md'),
    'utf8',
  )
  // Reuse the WhatsApp Advisor's KB verbatim — same fichas técnicas, same data.
  let kb = ''
  try {
    kb = fs.readFileSync(path.join(process.cwd(), 'prompts/whatsapp/kb.md'), 'utf8')
  } catch (e) {
    console.error('advisor-core: kb.md not found, continuing without it:', e)
  }
  cachedPrompt = kb
    ? `${base}\n\n---\n\n# BASE DE CONOCIMIENTO (fichas técnicas — usa estos datos)\n\n${kb}`
    : base
  return cachedPrompt
}

export type Turn = { role: 'user' | 'assistant'; content: string }

/** Minimal shape advisor-core needs from a stored message to build turns. */
export interface HistoryMessage {
  direction: 'inbound' | 'outbound'
  content: string
}

/**
 * Map stored history to strictly alternating turns starting with `user`.
 * Anthropic requires alternation and a leading user turn; we merge consecutive
 * same-direction messages and drop any leading assistant turns.
 */
export function toTurns(history: HistoryMessage[]): Turn[] {
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

export interface AdvisorReply {
  text: string
  handoff: boolean
  inputTokens: number
  outputTokens: number
}

/**
 * Ask Sonnet for one reply given the recent transcript. Returns the cleaned
 * text (with the [HANDOFF] tag stripped), the handoff boolean, and token
 * counts for FinOps. Throws on a non-2xx Anthropic response or missing key —
 * the caller decides how to degrade (the WhatsApp path lets it bubble).
 */
export async function generateAdvisorReply(
  turns: Turn[],
  opts?: { maxTokens?: number },
): Promise<AdvisorReply> {
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
      max_tokens: opts?.maxTokens ?? 512,
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
  const raw = (data.content ?? [])
    .filter((b) => b?.type === 'text')
    .map((b) => b?.text ?? '')
    .join('')
    .trim()

  const handoff = raw.includes(HANDOFF_TAG)
  const cleaned = raw.split(HANDOFF_TAG).join('').trim()
  const text = cleaned.length > 0 ? cleaned : HANDOFF_FALLBACK_ES

  return {
    text,
    handoff,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  }
}

/**
 * Best-effort FinOps logging for one advisor turn. NEVER throws — a logging
 * failure must not affect reply handling. `kind` is free-text (the sma_ai_usage
 * column is free-text); pass the channel, e.g. 'whatsapp' | 'messenger' |
 * 'instagram_dm'.
 */
export async function logAdvisorUsage(
  kind: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  try {
    const supabase = getSupabaseServiceRoleClient()
    const estCost = estLlmCostUsd(ADVISOR_MODEL, inputTokens, outputTokens)
    await supabase.from('sma_ai_usage').insert({
      kind,
      model: ADVISOR_MODEL,
      input_tokens: Math.max(0, Math.round(inputTokens || 0)),
      output_tokens: Math.max(0, Math.round(outputTokens || 0)),
      est_cost_usd: Number(estCost.toFixed(5)),
    })
  } catch (e) {
    console.error('advisor-core: usage log failed (non-fatal):', e)
  }
}
