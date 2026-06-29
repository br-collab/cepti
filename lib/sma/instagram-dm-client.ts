import 'server-only'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { decrypt } from './encryption'

/**
 * Thin Instagram Direct send client.
 *
 * Sends IG Direct messages via the Messenger Platform's Instagram messaging
 * path, using the Page access token resolved from the stored Instagram user
 * token (the same load + decrypt + resolvePage + resolveIgUser pattern as
 * lib/sma/agents/instagram-agent.ts). No new secret is needed — it reuses the
 * Instagram OAuth token in sma_tokens (platform 'instagram').
 *
 * Send shape (verified against Meta's Instagram Messaging / Messenger Platform
 * "Send a Message" docs, graph.facebook.com/v23.0):
 *   POST /{IG_ID}/messages
 *   { recipient: { id: <IGSID> }, message: { text } }   access_token = Page token
 * where IG_ID is the Page's linked instagram_business_account id. This mirrors
 * the repo's existing Page-token Graph approach (graph.facebook.com), rather
 * than the alternate graph.instagram.com host used with IG-login user tokens.
 *
 * Reactive scope only: IG allows a reply inside the 24-hour standard messaging
 * window the user opened by messaging us first.
 * Permissions: instagram_manage_messages / instagram_business_manage_messages.
 */

const IG_GRAPH_BASE = 'https://graph.facebook.com/v23.0'

/** Load + decrypt the stored Instagram user token. Throws if not connected. */
async function loadInstagramUserToken(): Promise<string> {
  const supabase = getSupabaseServiceRoleClient()
  const { data: tokenRow, error } = await supabase
    .from('sma_tokens')
    .select('access_token_ciphertext')
    .eq('platform', 'instagram')
    .is('revoked_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load Instagram token: ${error.message}`)
  }
  if (!tokenRow?.access_token_ciphertext) {
    throw new Error('No active Instagram token found in sma_tokens. Connect the Instagram account first.')
  }
  return decrypt(tokenRow.access_token_ciphertext)
}

/**
 * Resolve the CEPTI Page id + Page access token from a user token via
 * GET /me/accounts. Mirrors InstagramAgent.resolvePage.
 */
async function resolvePage(userToken: string): Promise<{ pageId: string; pageToken: string }> {
  const url = `${IG_GRAPH_BASE}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Instagram /me/accounts failed: ${res.status} ${await res.text()}`)
  }
  const json = (await res.json()) as {
    data?: { id: string; name?: string; access_token?: string }[]
  }
  const pages = json.data || []
  if (pages.length === 0) {
    throw new Error('Instagram user token has no managed Pages (GET /me/accounts returned none).')
  }
  const ceptiPage = pages.find((p) => (p.name || '').toUpperCase().includes('CEPTI'))
  const page = ceptiPage || pages[0]
  if (!page.access_token) {
    throw new Error(`Page ${page.id} did not return an access_token for Instagram messaging.`)
  }
  return { pageId: page.id, pageToken: page.access_token }
}

/** Resolve the IG Business account id linked to the Page. Mirrors InstagramAgent.resolveIgUser. */
async function resolveIgUser(pageId: string, pageToken: string): Promise<string> {
  const url =
    `${IG_GRAPH_BASE}/${encodeURIComponent(pageId)}` +
    `?fields=instagram_business_account&access_token=${encodeURIComponent(pageToken)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to resolve Instagram business account: ${res.status} ${await res.text()}`)
  }
  const json = (await res.json()) as { instagram_business_account?: { id?: string } }
  const igId = json.instagram_business_account?.id
  if (!igId) {
    throw new Error(
      'No Instagram Business account is linked to the CEPTI Page. Link an IG Business/Creator account to the Page in Meta settings.',
    )
  }
  return igId
}

/**
 * Send a plain-text Instagram Direct message to an IGSID. Returns the provider
 * message id when available. Throws on a non-2xx response.
 */
export async function sendInstagramDmText(
  recipientIgsid: string,
  text: string,
): Promise<{ messageId: string | null }> {
  const userToken = await loadInstagramUserToken()
  const { pageId, pageToken } = await resolvePage(userToken)
  const igUserId = await resolveIgUser(pageId, pageToken)

  const res = await fetch(`${IG_GRAPH_BASE}/${igUserId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientIgsid },
      message: { text },
      access_token: pageToken,
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Instagram DM send failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as { message_id?: string }
  return { messageId: data?.message_id ?? null }
}
