import 'server-only'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

/**
 * lib/sma/examples-service.ts
 *
 * Curated few-shot EXAMPLES library. Admins save a small set of their best
 * captions (see sma_examples, migration 0004). Caption agents fetch the most
 * relevant ones and inject them into the generation prompt so drafts match
 * the proven CEPTI voice.
 */

export interface Example {
  id: string
  platform: 'facebook' | 'instagram' | 'threads' | null
  product_slug: string | null
  caption: string
  performance_label: 'top' | 'good' | 'reference' | null
  source_note: string | null
  created_at: string
}

export interface GetRelevantExamplesArgs {
  platform: 'facebook' | 'instagram' | 'threads'
  productSlug?: string | null
  limit?: number
}

// Lower number = higher priority. We prefer the most specific match first
// (platform AND product), then platform-only, then product-only, then general.
function specificityRank(row: Example, platform: string, productSlug?: string | null): number {
  const platformMatch = row.platform === platform
  const productMatch = !!productSlug && row.product_slug === productSlug
  if (platformMatch && productMatch) return 0
  if (platformMatch && row.product_slug === null) return 1
  if (row.platform === null && productMatch) return 2
  if (row.platform === null && row.product_slug === null) return 3
  return 4
}

// Lower number = higher priority. 'top' beats 'good' beats 'reference'/none.
function performanceRank(label: Example['performance_label']): number {
  if (label === 'top') return 0
  if (label === 'good') return 1
  return 2
}

/**
 * Select the most relevant curated examples for a given platform + product.
 * Prefers platform+product matches, then platform-only, then product-only,
 * then general; within a tier, higher performance_label comes first. Caps at
 * `limit`. Uses the service-role client so the agents' read path bypasses RLS.
 */
export async function getRelevantExamples({
  platform,
  productSlug,
  limit = 4,
}: GetRelevantExamplesArgs): Promise<Example[]> {
  const supabase = getSupabaseServiceRoleClient()

  // Pull candidate rows: anything matching the platform (or platform-agnostic).
  // Product filtering and ranking happen in memory so the priority tiers stay
  // readable and the candidate set is always small (curated library).
  const { data, error } = await supabase
    .from('sma_examples')
    .select('id, platform, product_slug, caption, performance_label, source_note, created_at')
    .or(`platform.eq.${platform},platform.is.null`)

  if (error) {
    console.error('getRelevantExamples error:', error.message)
    return []
  }

  const rows = (data || []) as Example[]

  const relevant = rows.filter((row) => {
    // Keep rows that match the product or are product-agnostic.
    return row.product_slug === null || (!!productSlug && row.product_slug === productSlug)
  })

  relevant.sort((a, b) => {
    const sa = specificityRank(a, platform, productSlug)
    const sb = specificityRank(b, platform, productSlug)
    if (sa !== sb) return sa - sb
    const pa = performanceRank(a.performance_label)
    const pb = performanceRank(b.performance_label)
    if (pa !== pb) return pa - pb
    // Newest first as a stable tiebreaker.
    return b.created_at.localeCompare(a.created_at)
  })

  return relevant.slice(0, Math.max(0, limit))
}

/**
 * Render a prompt-injection block of curated examples. Returns '' if none, so
 * agent behavior is unchanged when the library is empty.
 */
export function buildFewShotBlock(examples: Example[]): string {
  if (!examples || examples.length === 0) return ''

  const numbered = examples
    .map((ex, i) => `${i + 1}. "${ex.caption.trim()}"`)
    .join('\n')

  return (
    'EJEMPLOS DE CAPTIONS DE ALTO RENDIMIENTO DE CEPTI ' +
    '(imita este tono, estructura y longitud; NO los copies literalmente):\n\n' +
    numbered
  )
}
