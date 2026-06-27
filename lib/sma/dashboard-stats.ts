import 'server-only'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { getConnectionStatus } from './connections'
import { PLATFORM_LABEL, type Platform } from './platforms'

export type RecentPost = {
  platform: string
  platformLabel: string
  permalink: string | null
  captionSnippet: string
  publishedAt: string | null
}

export type DashboardStats = {
  funnel: {
    runs: number
    approved: number
    denied: number
    published: number
    approvalRate: number | null
  }
  cadence: {
    postsLast7Days: number
    lastPublishedAt: string | null
  }
  recentPosts: RecentPost[]
  video: {
    done: number
    failed: number
    pending: number
    estSpendUsd: number
  }
  library: {
    examplesCount: number
    connectedPlatforms: { platform: Platform; label: string }[]
  }
}

const COST_PER_SECOND = 0.08

function emptyStats(): DashboardStats {
  return {
    funnel: { runs: 0, approved: 0, denied: 0, published: 0, approvalRate: null },
    cadence: { postsLast7Days: 0, lastPublishedAt: null },
    recentPosts: [],
    video: { done: 0, failed: 0, pending: 0, estSpendUsd: 0 },
    library: { examplesCount: 0, connectedPlatforms: [] },
  }
}

async function safeCount(
  fn: () => Promise<number>,
): Promise<number> {
  try {
    return await fn()
  } catch (e) {
    console.error('dashboard-stats count error:', e)
    return 0
  }
}

function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform as Platform] ?? platform
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const stats = emptyStats()

  let supabase: ReturnType<typeof getSupabaseServiceRoleClient>
  try {
    supabase = getSupabaseServiceRoleClient()
  } catch (e) {
    console.error('dashboard-stats: service-role client unavailable:', e)
    // Connections use the anon/server client, so still try to surface those.
    try {
      const statuses = await getConnectionStatus()
      stats.library.connectedPlatforms = statuses
        .filter((s) => s.connected && !s.revoked)
        .map((s) => ({ platform: s.platform, label: PLATFORM_LABEL[s.platform] }))
    } catch (err) {
      console.error('dashboard-stats: getConnectionStatus error:', err)
    }
    return stats
  }

  // --- Funnel ---
  stats.funnel.runs = await safeCount(async () => {
    const { count, error } = await supabase
      .from('sma_coordinator_tasks')
      .select('task_id', { count: 'exact', head: true })
    if (error) throw error
    return count ?? 0
  })

  stats.funnel.approved = await safeCount(async () => {
    const { count, error } = await supabase
      .from('sma_content_lifecycles')
      .select('task_id', { count: 'exact', head: true })
      .eq('lifecycle_record->>status', 'COMPLETE')
    if (error) throw error
    return count ?? 0
  })

  stats.funnel.denied = await safeCount(async () => {
    const { count, error } = await supabase
      .from('sma_content_lifecycles')
      .select('task_id', { count: 'exact', head: true })
      .eq('lifecycle_record->>status', 'DENIED')
    if (error) throw error
    return count ?? 0
  })

  stats.funnel.published = await safeCount(async () => {
    const { count, error } = await supabase
      .from('sma_published_posts')
      .select('id', { count: 'exact', head: true })
    if (error) throw error
    return count ?? 0
  })

  const decided = stats.funnel.approved + stats.funnel.denied
  stats.funnel.approvalRate = decided > 0 ? stats.funnel.approved / decided : null

  // --- Cadence ---
  stats.cadence.postsLast7Days = await safeCount(async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count, error } = await supabase
      .from('sma_published_posts')
      .select('id', { count: 'exact', head: true })
      .gte('published_at', sevenDaysAgo)
    if (error) throw error
    return count ?? 0
  })

  try {
    const { data, error } = await supabase
      .from('sma_published_posts')
      .select('published_at')
      .order('published_at', { ascending: false })
      .limit(1)
    if (error) throw error
    stats.cadence.lastPublishedAt = data?.[0]?.published_at ?? null
  } catch (e) {
    console.error('dashboard-stats: lastPublishedAt error:', e)
  }

  // --- Recent posts ---
  try {
    const { data, error } = await supabase
      .from('sma_published_posts')
      .select('platform, permalink, caption, published_at')
      .order('published_at', { ascending: false })
      .limit(5)
    if (error) throw error
    stats.recentPosts = (data ?? []).map((row) => {
      const caption = (row.caption ?? '').toString()
      const snippet = caption.length > 80 ? `${caption.slice(0, 80).trimEnd()}…` : caption
      return {
        platform: row.platform,
        platformLabel: platformLabel(row.platform),
        permalink: row.permalink ?? null,
        captionSnippet: snippet,
        publishedAt: row.published_at ?? null,
      }
    })
  } catch (e) {
    console.error('dashboard-stats: recentPosts error:', e)
  }

  // --- Video ---
  stats.video.done = await safeCount(async () => {
    const { count, error } = await supabase
      .from('sma_video_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'done')
    if (error) throw error
    return count ?? 0
  })
  stats.video.failed = await safeCount(async () => {
    const { count, error } = await supabase
      .from('sma_video_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
    if (error) throw error
    return count ?? 0
  })
  stats.video.pending = await safeCount(async () => {
    const { count, error } = await supabase
      .from('sma_video_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    if (error) throw error
    return count ?? 0
  })

  try {
    const { data, error } = await supabase
      .from('sma_video_jobs')
      .select('duration')
      .eq('status', 'done')
    if (error) throw error
    const totalSeconds = (data ?? []).reduce(
      (sum, row) => sum + (Number(row.duration) || 0),
      0,
    )
    stats.video.estSpendUsd = totalSeconds * COST_PER_SECOND
  } catch (e) {
    console.error('dashboard-stats: video spend error:', e)
  }

  // --- Library ---
  stats.library.examplesCount = await safeCount(async () => {
    const { count, error } = await supabase
      .from('sma_examples')
      .select('id', { count: 'exact', head: true })
    if (error) throw error
    return count ?? 0
  })

  try {
    const statuses = await getConnectionStatus()
    stats.library.connectedPlatforms = statuses
      .filter((s) => s.connected && !s.revoked)
      .map((s) => ({ platform: s.platform, label: PLATFORM_LABEL[s.platform] }))
  } catch (e) {
    console.error('dashboard-stats: getConnectionStatus error:', e)
  }

  return stats
}
