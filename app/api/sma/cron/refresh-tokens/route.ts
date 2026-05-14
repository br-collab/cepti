import { type NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/sma/encryption'
import { refreshLongLivedToken } from '@/lib/sma/meta-client'
import { isPlatform, type Platform } from '@/lib/sma/platforms'

export const runtime = 'nodejs'
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = req.headers.get('authorization')
  if (header === `Bearer ${expected}`) return true
  return req.headers.get('x-cron-secret') === expected
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  const supabase = getSupabaseServiceRoleClient()
  const { data: rows, error } = await supabase
    .from('sma_tokens')
    .select('id, platform, external_account_id, access_token_ciphertext, expires_at, revoked_at')
    .is('revoked_at', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const now = Date.now()
  const REFRESH_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 7

  const results: Array<{ id: string; platform: Platform; status: 'refreshed' | 'skipped' | 'failed'; detail?: string }> = []

  for (const row of rows ?? []) {
    const platform = row.platform as Platform
    if (!isPlatform(platform)) continue
    const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : null
    if (expiresAt && expiresAt - now > REFRESH_THRESHOLD_MS) {
      results.push({ id: row.id, platform, status: 'skipped' })
      continue
    }
    try {
      const token = decrypt(row.access_token_ciphertext)
      const refreshed = await refreshLongLivedToken(platform, token)
      const newExpires = refreshed.expires_in
        ? new Date(now + refreshed.expires_in * 1000).toISOString()
        : row.expires_at
      const { error: upErr } = await supabase
        .from('sma_tokens')
        .update({
          access_token_ciphertext: encrypt(refreshed.access_token),
          expires_at: newExpires,
          last_refreshed_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      if (upErr) throw new Error(upErr.message)
      results.push({ id: row.id, platform, status: 'refreshed' })
    } catch (e) {
      results.push({ id: row.id, platform, status: 'failed', detail: (e as Error).message })
    }
  }

  return NextResponse.json({ count: results.length, results })
}
