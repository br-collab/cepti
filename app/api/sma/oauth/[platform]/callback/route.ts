import { type NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/sma/auth'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/sma/encryption'
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
} from '@/lib/sma/meta-client'
import {
  PLATFORM_GRAPH_BASE,
  PLATFORM_SCOPES,
  isPlatform,
  type Platform,
} from '@/lib/sma/platforms'

export const runtime = 'nodejs'

const STATE_COOKIE_PREFIX = 'sma_oauth_state_'

type AccountInfo = { externalId: string; label: string | null }

async function fetchAccountInfo(platform: Platform, accessToken: string): Promise<AccountInfo> {
  const base = PLATFORM_GRAPH_BASE[platform]
  const fields = platform === 'threads' ? 'id,username' : 'id,name'
  const res = await fetch(`${base}/me?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Account lookup failed (${platform}): ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { id: string; name?: string; username?: string }
  return { externalId: data.id, label: data.name ?? data.username ?? null }
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<'/api/sma/oauth/[platform]/callback'>,
) {
  const { platform } = await ctx.params
  if (!isPlatform(platform)) {
    return NextResponse.json({ error: 'unknown platform' }, { status: 400 })
  }

  const user = await getAdminUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const incomingState = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const cookieName = `${STATE_COOKIE_PREFIX}${platform}`
  const cookieValue = req.cookies.get(cookieName)?.value ?? null

  const [storedState, lang] = (cookieValue ?? '').split('.')
  const safeLang = lang === 'en' ? 'en' : 'es'
  const back = (qs: string) =>
    NextResponse.redirect(new URL(`/${safeLang}/admin/sma?${qs}`, url.origin))

  const clear = (res: NextResponse) => {
    res.cookies.set(cookieName, '', { path: '/', maxAge: 0 })
    return res
  }

  if (error) return clear(back(`oauth_error=${encodeURIComponent(error)}`))
  if (!code || !incomingState || !storedState || incomingState !== storedState) {
    return clear(back('oauth_error=state_mismatch'))
  }

  const redirectUri = `${url.origin}/api/sma/oauth/${platform}/callback`
  let shortLived
  try {
    shortLived = await exchangeCodeForToken(platform, code, redirectUri)
  } catch (e) {
    return clear(back(`oauth_error=${encodeURIComponent((e as Error).message)}`))
  }

  let longLived = shortLived
  try {
    longLived = await exchangeForLongLivedToken(platform, shortLived.access_token)
  } catch {
    // Some platforms or scopes return already-long-lived tokens; fall through with the short-lived.
  }

  let account: AccountInfo
  try {
    account = await fetchAccountInfo(platform, longLived.access_token)
  } catch (e) {
    return clear(back(`oauth_error=${encodeURIComponent((e as Error).message)}`))
  }

  const expiresAt = longLived.expires_in
    ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
    : null

  const supabase = await getSupabaseServerClient()
  const { error: upsertError } = await supabase
    .from('sma_tokens')
    .upsert(
      {
        platform,
        external_account_id: account.externalId,
        account_label: account.label,
        access_token_ciphertext: encrypt(longLived.access_token),
        scopes: PLATFORM_SCOPES[platform],
        expires_at: expiresAt,
        last_refreshed_at: new Date().toISOString(),
        revoked_at: null,
      },
      { onConflict: 'platform,external_account_id' },
    )

  if (upsertError) {
    return clear(back(`oauth_error=${encodeURIComponent(upsertError.message)}`))
  }

  return clear(back(`connected=${platform}`))
}
