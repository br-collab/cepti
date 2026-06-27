import { NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { FacebookAgent } from '@/lib/sma/agents/facebook-agent'

export const runtime = 'nodejs'

/**
 * Human-triggered refresh of Facebook engagement for recent published posts.
 *
 * Loads the most recent ~25 Facebook posts from sma_published_posts, pulls
 * live engagement for each via FacebookAgent.fetchEngagement() (each in its
 * own try/catch so one failure does not abort the batch), and upserts the
 * result into sma_post_engagement keyed on external_post_id.
 *
 * Returns { refreshed, errors } counts. With 0 published posts this is a
 * no-op that returns zeros.
 */
export async function POST() {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const supabase = getSupabaseServiceRoleClient()

    const { data: posts, error: readError } = await supabase
      .from('sma_published_posts')
      .select('external_post_id, platform, published_at')
      .eq('platform', 'facebook')
      .order('published_at', { ascending: false })
      .limit(25)

    if (readError) {
      return NextResponse.json(
        { error: `Failed to load published posts: ${readError.message}` },
        { status: 500 },
      )
    }

    let refreshed = 0
    const errors: { external_post_id: string; error: string }[] = []
    const agent = new FacebookAgent()

    for (const post of posts ?? []) {
      const externalPostId = (post as { external_post_id?: string }).external_post_id
      if (!externalPostId) continue

      try {
        const snapshot = await agent.fetchEngagement(externalPostId)

        const { error: upsertError } = await supabase
          .from('sma_post_engagement')
          .upsert(
            {
              external_post_id: externalPostId,
              platform: 'facebook',
              reactions: snapshot.engagement ?? 0,
              comments: snapshot.comments_count ?? 0,
              shares: snapshot.shares_count ?? 0,
              impressions: snapshot.impressions ?? null,
              captured_at: snapshot.snapshot_at,
            },
            { onConflict: 'external_post_id' },
          )

        if (upsertError) {
          throw new Error(`upsert failed: ${upsertError.message}`)
        }
        refreshed += 1
      } catch (err) {
        const message = err instanceof Error ? err.message : 'fetchEngagement failed'
        console.error(`[engagement/refresh] ${externalPostId}:`, err)
        errors.push({ external_post_id: externalPostId, error: message })
      }
    }

    return NextResponse.json({ refreshed, errors })
  } catch (error) {
    console.error('POST /api/sma/engagement/refresh error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
