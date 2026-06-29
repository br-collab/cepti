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

/**
 * Business hours for handoff expectations (CEPTI, confirmed 2026-06-28).
 * Mon–Fri 09:00–17:30, America/Santo_Domingo. To change days/hours, edit these
 * constants. `BUSINESS_DAYS` uses JS weekday indices (0 = Sunday).
 */
const BUSINESS_TZ = 'America/Santo_Domingo'
const BUSINESS_DAYS = [1, 2, 3, 4, 5] // Mon–Fri
const BUSINESS_START_MIN = 9 * 60 // 09:00
const BUSINESS_END_MIN = 17 * 60 + 30 // 17:30

function nowInBusinessTz(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const wd: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const day = wd[get('weekday')] ?? 0
  let hour = parseInt(get('hour'), 10)
  if (!Number.isFinite(hour) || hour === 24) hour = 0
  const minute = parseInt(get('minute'), 10) || 0
  return { day, minutes: hour * 60 + minute }
}

/** True if `now` falls within CEPTI business hours (Santo Domingo time). */
export function isWithinBusinessHours(now: Date = new Date()): boolean {
  const { day, minutes } = nowInBusinessTz(now)
  return BUSINESS_DAYS.includes(day) && minutes >= BUSINESS_START_MIN && minutes < BUSINESS_END_MIN
}

/**
 * A runtime system note telling the model the current business-hours status so
 * its handoff bridge sets an honest response-time expectation (in the customer's
 * language). Not cached — it changes through the day.
 */
function businessHoursNote(now: Date = new Date()): string {
  return isWithinBusinessHours(now)
    ? 'CONTEXTO HORARIO: estamos dentro del horario de atención. Si transfieres a una persona (handoff), indica que nuestro equipo responderá en breve. Responde en el idioma del cliente.'
    : 'CONTEXTO HORARIO: estamos fuera del horario de atención (horario: lunes a viernes, 9:00 a.m. a 5:30 p.m., hora de Santo Domingo). Si transfieres a una persona (handoff), indica con amabilidad que nuestro equipo le responderá dentro del horario de atención. Responde en el idioma del cliente.'
}

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
        // Uncached — changes through the day; tells the model how to phrase a
        // handoff's response-time expectation based on business hours.
        {
          type: 'text',
          text: businessHoursNote(),
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
