import 'server-only'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { decrypt } from './encryption'

/**
 * Thin Facebook Messenger send client.
 *
 * Sends to the CEPTI Page's Messenger thread via the Send API, using the Page
 * access token resolved from the stored Facebook user token (the same load +
 * decrypt + resolvePage pattern as lib/sma/agents/facebook-agent.ts). No new
 * secret is needed — it reuses the Facebook OAuth token in sma_tokens.
 *
 * Send API shape (verified against Meta's Messenger Platform Send API docs,
 * graph.facebook.com/v23.0):
 *   POST /{PAGE_ID}/messages
 *   { recipient: { id: <PSID> }, messaging_type: 'RESPONSE',
 *     message: { text } }   access_token = Page token
 *
 * Reactive scope only: messaging_type RESPONSE is for replying inside the
 * 24-hour standard messaging window the user opened by messaging us first.
 * Permission: pages_messaging.
 */

const FB_GRAPH_BASE = 'https://graph.facebook.com/v23.0'

/** Load + decrypt the stored Facebook user token. Throws if not connected. */
async function loadFacebookUserToken(): Promise<string> {
  const supabase = getSupabaseServiceRoleClient()
  const { data: tokenRow, error } = await supabase
    .from('sma_tokens')
    .select('access_token_ciphertext')
    .eq('platform', 'facebook')
    .is('revoked_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load Facebook token: ${error.message}`)
  }
  if (!tokenRow?.access_token_ciphertext) {
    throw new Error('No active Facebook token found in sma_tokens. Connect the Facebook account first.')
  }
  return decrypt(tokenRow.access_token_ciphertext)
}

/**
 * Resolve the CEPTI Page id + Page access token from a user token via
 * GET /me/accounts. Prefers a page whose name contains "CEPTI"; falls back to
 * the first page. Mirrors FacebookAgent.resolvePage.
 */
async function resolvePage(userToken: string): Promise<{ pageId: string; pageToken: string }> {
  const url = `${FB_GRAPH_BASE}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Facebook /me/accounts failed: ${res.status} ${await res.text()}`)
  }
  const json = (await res.json()) as {
    data?: { id: string; name?: string; access_token?: string }[]
  }
  const pages = json.data || []
  if (pages.length === 0) {
    throw new Error('Facebook user token has no managed Pages (GET /me/accounts returned none).')
  }
  const ceptiPage = pages.find((p) => (p.name || '').toUpperCase().includes('CEPTI'))
  const page = ceptiPage || pages[0]
  if (!page.access_token) {
    throw new Error(`Facebook Page ${page.id} did not return an access_token.`)
  }
  return { pageId: page.id, pageToken: page.access_token }
}

/**
 * Send a plain-text Messenger message to a PSID. Returns the provider message
 * id when available. Throws on a non-2xx response so the caller can log/handle.
 */
export async function sendMessengerText(
  recipientPsid: string,
  text: string,
): Promise<{ messageId: string | null }> {
  const userToken = await loadFacebookUserToken()
  const { pageId, pageToken } = await resolvePage(userToken)

  const res = await fetch(`${FB_GRAPH_BASE}/${pageId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      messaging_type: 'RESPONSE',
      message: { text },
      access_token: pageToken,
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Messenger send failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as { message_id?: string }
  return { messageId: data?.message_id ?? null }
}

/**
 * Mark the conversation as seen (read receipt). Best-effort — never throws, a
 * failed sender action must not affect reply handling.
 *
 * ASSUMPTION (verify on first live traffic): the sender_action 'mark_seen'
 * shape is per Meta's Messenger Platform Sender Actions docs. If a BSP or a
 * future API version rejects it, this no-ops harmlessly.
 */
export async function markSeen(recipientPsid: string): Promise<void> {
  try {
    const userToken = await loadFacebookUserToken()
    const { pageId, pageToken } = await resolvePage(userToken)
    await fetch(`${FB_GRAPH_BASE}/${pageId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        sender_action: 'mark_seen',
        access_token: pageToken,
      }),
      cache: 'no-store',
    })
  } catch (e) {
    console.error('markSeen failed (non-fatal):', e)
  }
}
