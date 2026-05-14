import 'server-only'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { PLATFORMS, type Platform } from './platforms'

export type ConnectionStatus = {
  platform: Platform
  connected: boolean
  accountLabel: string | null
  externalAccountId: string | null
  scopes: string[]
  expiresAt: string | null
  lastRefreshedAt: string | null
  revoked: boolean
}

export async function getConnectionStatus(): Promise<ConnectionStatus[]> {
  const supabase = await getSupabaseServerClient()
  const { data } = await supabase
    .from('sma_tokens')
    .select('platform, external_account_id, account_label, scopes, expires_at, last_refreshed_at, revoked_at')

  const byPlatform = new Map<Platform, NonNullable<typeof data>[number]>()
  for (const row of data ?? []) byPlatform.set(row.platform as Platform, row)

  return PLATFORMS.map((platform) => {
    const row = byPlatform.get(platform)
    if (!row) {
      return {
        platform,
        connected: false,
        accountLabel: null,
        externalAccountId: null,
        scopes: [],
        expiresAt: null,
        lastRefreshedAt: null,
        revoked: false,
      }
    }
    return {
      platform,
      connected: !row.revoked_at,
      accountLabel: row.account_label,
      externalAccountId: row.external_account_id,
      scopes: row.scopes ?? [],
      expiresAt: row.expires_at,
      lastRefreshedAt: row.last_refreshed_at,
      revoked: Boolean(row.revoked_at),
    }
  })
}
