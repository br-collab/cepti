import 'server-only'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

/**
 * AI FinOps helpers for the SMA dashboard.
 *
 * Cost figures here are APPROXIMATE. The price map is a best-effort estimate of
 * Anthropic per-million-token rates keyed by a substring of the model name. It
 * is meant for at-a-glance spend visibility on the admin dashboard, not for
 * accounting. Update the rates if Anthropic pricing changes.
 */

type Price = { in: number; out: number }

// USD per 1,000,000 tokens. Approximate — for dashboard estimation only.
const PRICE_PER_MILLION: { match: string; price: Price }[] = [
  { match: 'opus', price: { in: 15, out: 75 } },
  { match: 'sonnet', price: { in: 3, out: 15 } },
  { match: 'haiku', price: { in: 0.8, out: 4 } },
]

const DEFAULT_PRICE: Price = { in: 3, out: 15 }

function priceFor(model: string): Price {
  const m = (model || '').toLowerCase()
  for (const { match, price } of PRICE_PER_MILLION) {
    if (m.includes(match)) return price
  }
  return DEFAULT_PRICE
}

/**
 * Estimated USD cost of one LLM call, from token counts and the approximate
 * price map. Returns 0 on bad input.
 */
export function estLlmCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = priceFor(model)
  const inTok = Number.isFinite(inputTokens) ? Math.max(0, inputTokens) : 0
  const outTok = Number.isFinite(outputTokens) ? Math.max(0, outputTokens) : 0
  return (inTok / 1_000_000) * price.in + (outTok / 1_000_000) * price.out
}

/**
 * Best-effort: record one caption/script LLM call in sma_ai_usage. NEVER
 * throws — a logging failure must not break caption generation.
 */
export async function logCaptionUsage(opts: {
  model: string
  inputTokens: number
  outputTokens: number
}): Promise<void> {
  try {
    const supabase = getSupabaseServiceRoleClient()
    const estCost = estLlmCostUsd(opts.model, opts.inputTokens, opts.outputTokens)
    const { error } = await supabase.from('sma_ai_usage').insert({
      kind: 'caption',
      model: opts.model,
      input_tokens: Math.max(0, Math.round(opts.inputTokens || 0)),
      output_tokens: Math.max(0, Math.round(opts.outputTokens || 0)),
      est_cost_usd: Number(estCost.toFixed(5)),
    })
    if (error) throw error
  } catch (e) {
    console.error('ai-usage: logCaptionUsage failed (non-fatal):', e)
  }
}
