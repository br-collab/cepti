import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { PLATFORM_GRAPH_BASE, type Platform } from './platforms'

const FB_OAUTH_BASE = 'https://www.facebook.com/v23.0/dialog/oauth'
const FB_GRAPH_BASE = 'https://graph.facebook.com/v23.0'
const TH_OAUTH_BASE = 'https://threads.net/oauth/authorize'

type TokenResponse = {
  access_token: string
  token_type?: string
  expires_in?: number
}

function appCreds() {
  const id = process.env.META_APP_ID
  const secret = process.env.META_APP_SECRET
  if (!id || !secret) throw new Error('META_APP_ID / META_APP_SECRET not configured')
  return { id, secret }
}

export function buildAuthorizeUrl(
  platform: Platform,
  redirectUri: string,
  state: string,
  scopes: string[],
): string {
  const { id } = appCreds()
  const base = platform === 'threads' ? TH_OAUTH_BASE : FB_OAUTH_BASE
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(','),
    state,
  })
  return `${base}?${params.toString()}`
}

export async function exchangeCodeForToken(
  platform: Platform,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const { id, secret } = appCreds()
  const base = platform === 'threads'
    ? 'https://graph.threads.net/oauth/access_token'
    : `${FB_GRAPH_BASE}/oauth/access_token`
  const params = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    redirect_uri: redirectUri,
    code,
  })
  const res = await fetch(`${base}?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Token exchange failed (${platform}): ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as TokenResponse
}

export async function exchangeForLongLivedToken(
  platform: Platform,
  shortLivedToken: string,
): Promise<TokenResponse> {
  const { id, secret } = appCreds()
  if (platform === 'threads') {
    const url = new URL('https://graph.threads.net/access_token')
    url.searchParams.set('grant_type', 'th_exchange_token')
    url.searchParams.set('client_secret', secret)
    url.searchParams.set('access_token', shortLivedToken)
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Threads long-lived exchange failed: ${await res.text()}`)
    return (await res.json()) as TokenResponse
  }
  const url = new URL(`${FB_GRAPH_BASE}/oauth/access_token`)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', id)
  url.searchParams.set('client_secret', secret)
  url.searchParams.set('fb_exchange_token', shortLivedToken)
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`FB long-lived exchange failed: ${await res.text()}`)
  return (await res.json()) as TokenResponse
}

export async function refreshLongLivedToken(
  platform: Platform,
  longLivedToken: string,
): Promise<TokenResponse> {
  if (platform === 'threads') {
    const url = new URL('https://graph.threads.net/refresh_access_token')
    url.searchParams.set('grant_type', 'th_refresh_token')
    url.searchParams.set('access_token', longLivedToken)
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Threads refresh failed: ${await res.text()}`)
    return (await res.json()) as TokenResponse
  }
  const base = PLATFORM_GRAPH_BASE[platform]
  const res = await fetch(`${base}/me?fields=id&access_token=${encodeURIComponent(longLivedToken)}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Token validation failed (${platform}): ${await res.text()}`)
  return { access_token: longLivedToken }
}

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false
  const { secret } = appCreds()
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
