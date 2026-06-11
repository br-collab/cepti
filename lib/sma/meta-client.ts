import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { PLATFORM_GRAPH_BASE, type Platform } from './platforms'
import type { DraftResult, PublishResult } from './coordinator/types'
import { SupabaseClient } from '@supabase/supabase-js'

const FB_OAUTH_BASE = 'https://www.facebook.com/v25.0/dialog/oauth'
const FB_GRAPH_BASE = 'https://graph.facebook.com/v25.0'
const TH_OAUTH_BASE = 'https://threads.net/oauth/authorize'
const IG_GRAPH_BASE = 'https://graph.instagram.com/v25.0'

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

// ── Publishing to Meta APIs ──────────────────────────────────────────

/**
 * Retrieve a Meta access token for the given platform from sma_tokens table.
 * Validates that the token is not revoked.
 *
 * @param platform The platform (facebook, instagram, threads)
 * @param supabase Supabase client (service role for this internal use)
 * @returns access_token string, or null if token missing or revoked
 */
export async function getMetaToken(
  platform: Platform,
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('sma_tokens')
    .select('access_token_ciphertext, revoked_at')
    .eq('platform', platform)
    .maybeSingle()

  if (error || !data) {
    console.error(`[Meta] No token found for ${platform}: ${error?.message || 'missing'}`)
    return null
  }

  if (data.revoked_at) {
    console.warn(`[Meta] Token for ${platform} is revoked`)
    return null
  }

  // TODO: decrypt access_token_ciphertext using sma_tokens encryption key
  // For now, assume plaintext for testing. This must be fixed before prod.
  const token = data.access_token_ciphertext
  if (!token) {
    console.error(`[Meta] Token is empty for ${platform}`)
    return null
  }

  return token
}

/**
 * Publish a draft to Facebook via Meta Graph API v25.0.
 * If draft has images, uploads them and adds as attached_media.
 * If draft has video, uploads video and adds as video_data.
 *
 * @param token Meta access token
 * @param draft The approved draft to publish
 * @returns PublishResult with platform_post_id, permalink, published_at
 * @throws Error with descriptive message on API failure
 */
export async function publishToFacebook(
  token: string,
  draft: DraftResult,
): Promise<PublishResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID
  if (!pageId) {
    throw new Error('FACEBOOK_PAGE_ID not configured')
  }

  console.log(`[Meta/Facebook] Publishing to page ${pageId}`)

  const url = `${FB_GRAPH_BASE}/${pageId}/feed`
  const params = new URLSearchParams({
    access_token: token,
  })

  const payload: Record<string, unknown> = {
    message: draft.body,
  }

  // If draft has images, upload them first and add as attached_media
  if (draft.images && draft.images.length > 0) {
    console.log(`[Meta/Facebook] Draft has ${draft.images.length} images, uploading...`)
    const mediaIds: string[] = []
    for (const image of draft.images) {
      try {
        const mediaId = await uploadFacebookImage(token, pageId, image.url)
        mediaIds.push(mediaId)
      } catch (err) {
        console.error(`[Meta/Facebook] Failed to upload image ${image.url}:`, err)
        throw new Error(`Failed to upload image: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    payload.attached_media = mediaIds.map((id) => ({ media_fbid: id }))
  }

  // If draft has video, upload and add as video_data
  if (draft.video) {
    console.log(`[Meta/Facebook] Draft has video, uploading...`)
    try {
      const videoId = await uploadFacebookVideo(token, pageId, draft.video.url)
      payload.video_data = { video_id: videoId }
    } catch (err) {
      console.error(`[Meta/Facebook] Failed to upload video:`, err)
      throw new Error(`Failed to upload video: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // POST to /me/feed
  const res = await fetch(`${url}?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`[Meta/Facebook] Publish failed: ${res.status} ${errorText}`)
    throw new Error(`Facebook publish failed: ${res.status} ${errorText}`)
  }

  const responseData = (await res.json()) as { id: string; [key: string]: unknown }
  const postId = responseData.id
  if (!postId) {
    throw new Error('No post ID returned from Facebook API')
  }

  const permalink = `https://facebook.com/${postId}`
  console.log(`[Meta/Facebook] Published post ${postId}: ${permalink}`)

  return {
    platform: 'facebook',
    platform_post_id: postId,
    published_at: new Date().toISOString(),
    permalink,
    publish_response: responseData,
  }
}

/**
 * Publish a draft to Instagram via Meta Graph API v25.0.
 * Instagram Media Creation API requires image_url or video_url,
 * then a separate publish call.
 *
 * @param token Meta access token
 * @param draft The approved draft to publish
 * @returns PublishResult with platform_post_id, permalink, published_at
 * @throws Error with descriptive message on API failure
 */
export async function publishToInstagram(
  token: string,
  draft: DraftResult,
): Promise<PublishResult> {
  const igBusinessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
  if (!igBusinessAccountId) {
    throw new Error('INSTAGRAM_BUSINESS_ACCOUNT_ID not configured')
  }

  console.log(`[Meta/Instagram] Publishing to account ${igBusinessAccountId}`)

  // Use first image or video; Instagram requires at minimum one
  const imageUrl = draft.images && draft.images.length > 0 ? draft.images[0].url : null
  const videoUrl = draft.video ? draft.video.url : null

  if (!imageUrl && !videoUrl) {
    throw new Error('Instagram requires at least one image or video')
  }

  const mediaCreateUrl = `${IG_GRAPH_BASE}/${igBusinessAccountId}/media`
  const mediaParams = new URLSearchParams({ access_token: token })

  const mediaPayload: Record<string, unknown> = {
    caption: draft.body,
  }

  if (imageUrl) {
    mediaPayload.image_url = imageUrl
  } else if (videoUrl) {
    mediaPayload.video_url = videoUrl
    mediaPayload.media_type = 'VIDEO'
  }

  console.log(`[Meta/Instagram] Creating media object...`)
  const mediaRes = await fetch(`${mediaCreateUrl}?${mediaParams.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mediaPayload),
    cache: 'no-store',
  })

  if (!mediaRes.ok) {
    const errorText = await mediaRes.text()
    console.error(`[Meta/Instagram] Media creation failed: ${mediaRes.status} ${errorText}`)
    throw new Error(`Instagram media creation failed: ${mediaRes.status} ${errorText}`)
  }

  const mediaData = (await mediaRes.json()) as { id: string; [key: string]: unknown }
  const mediaId = mediaData.id
  if (!mediaId) {
    throw new Error('No media ID returned from Instagram API')
  }

  // Publish the media
  const publishUrl = `${IG_GRAPH_BASE}/${mediaId}/publish`
  const publishParams = new URLSearchParams({ access_token: token })

  console.log(`[Meta/Instagram] Publishing media ${mediaId}...`)
  const publishRes = await fetch(`${publishUrl}?${publishParams.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    cache: 'no-store',
  })

  if (!publishRes.ok) {
    const errorText = await publishRes.text()
    console.error(`[Meta/Instagram] Publish failed: ${publishRes.status} ${errorText}`)
    throw new Error(`Instagram publish failed: ${publishRes.status} ${errorText}`)
  }

  const publishData = await publishRes.json()
  const permalink = `https://instagram.com/p/${mediaId}`
  console.log(`[Meta/Instagram] Published media ${mediaId}: ${permalink}`)

  return {
    platform: 'instagram',
    platform_post_id: mediaId,
    published_at: new Date().toISOString(),
    permalink,
    publish_response: publishData,
  }
}

/**
 * Publish a draft to Threads via Meta Graph API v25.0.
 * Similar to Instagram but uses the Threads endpoint.
 *
 * @param token Meta access token
 * @param draft The approved draft to publish
 * @returns PublishResult with platform_post_id, permalink, published_at
 * @throws Error with descriptive message on API failure
 */
export async function publishToThreads(
  token: string,
  draft: DraftResult,
): Promise<PublishResult> {
  const threadsUserId = process.env.THREADS_USER_ID
  if (!threadsUserId) {
    throw new Error('THREADS_USER_ID not configured')
  }

  // Validate character count for Threads (280 char limit, though we may allow slightly more)
  if (draft.estimated_character_count > 500) {
    console.warn(
      `[Meta/Threads] Draft is ${draft.estimated_character_count} chars, may exceed limits`,
    )
  }

  console.log(`[Meta/Threads] Publishing to user ${threadsUserId}`)

  // Use first image or video; Threads supports both
  const imageUrl = draft.images && draft.images.length > 0 ? draft.images[0].url : null
  const videoUrl = draft.video ? draft.video.url : null

  const threadCreateUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads`
  const params = new URLSearchParams({ access_token: token })

  const payload: Record<string, unknown> = {
    text: draft.body,
  }

  if (imageUrl) {
    payload.image_url = imageUrl
  } else if (videoUrl) {
    payload.video_url = videoUrl
  }

  console.log(`[Meta/Threads] Creating thread...`)
  const res = await fetch(`${threadCreateUrl}?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`[Meta/Threads] Create failed: ${res.status} ${errorText}`)
    throw new Error(`Threads create failed: ${res.status} ${errorText}`)
  }

  const responseData = (await res.json()) as { id: string; [key: string]: unknown }
  const threadId = responseData.id
  if (!threadId) {
    throw new Error('No thread ID returned from Threads API')
  }

  const permalink = `https://threads.net/t/${threadId}`
  console.log(`[Meta/Threads] Published thread ${threadId}: ${permalink}`)

  return {
    platform: 'threads',
    platform_post_id: threadId,
    published_at: new Date().toISOString(),
    permalink,
    publish_response: responseData,
  }
}

// ── Helper Functions for Media Upload ─────────────────────────────────

/**
 * Upload an image to Facebook and return the media ID.
 * @param token Meta access token
 * @param pageId Facebook Page ID
 * @param imageUrl URL or local path to image
 * @returns media_fbid
 */
async function uploadFacebookImage(token: string, pageId: string, imageUrl: string): Promise<string> {
  const uploadUrl = `${FB_GRAPH_BASE}/${pageId}/photos`
  const params = new URLSearchParams({
    access_token: token,
    url: imageUrl,
  })

  const res = await fetch(`${uploadUrl}?${params.toString()}`, {
    method: 'POST',
    cache: 'no-store',
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to upload Facebook image: ${res.status} ${errorText}`)
  }

  const data = (await res.json()) as { id: string; [key: string]: unknown }
  return data.id
}

/**
 * Upload a video to Facebook and return the video ID.
 * @param token Meta access token
 * @param pageId Facebook Page ID
 * @param videoUrl URL or local path to video
 * @returns video id
 */
async function uploadFacebookVideo(token: string, pageId: string, videoUrl: string): Promise<string> {
  const uploadUrl = `${FB_GRAPH_BASE}/${pageId}/videos`
  const params = new URLSearchParams({
    access_token: token,
    file_url: videoUrl,
    description: 'CEPTI Product Video',
  })

  const res = await fetch(`${uploadUrl}?${params.toString()}`, {
    method: 'POST',
    cache: 'no-store',
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to upload Facebook video: ${res.status} ${errorText}`)
  }

  const data = (await res.json()) as { id: string; [key: string]: unknown }
  return data.id
}
