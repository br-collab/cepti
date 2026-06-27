import 'server-only'

// Thin client for the xAI Grok Imagine image-to-video API.
// Docs: https://docs.x.ai — async generation:
//   POST https://api.x.ai/v1/videos/generations  → { request_id }
//   GET  https://api.x.ai/v1/videos/{request_id}  → { status, video: { url } }
// Pricing is $0.08/sec; keep durations small.

const XAI_BASE = 'https://api.x.ai/v1'
const XAI_MODEL = 'grok-imagine-video-1.5'

function getApiKey(): string {
  const key = process.env.XAI_API_KEY
  if (!key) {
    throw new Error('XAI_API_KEY is not configured')
  }
  return key
}

export interface StartImageToVideoArgs {
  imageUrl: string
  prompt: string
  duration: number
}

/**
 * Kick off an image-to-video generation. Returns the xAI request_id used to
 * poll for completion. Throws with status + body on a non-OK response.
 */
export async function startImageToVideo({
  imageUrl,
  prompt,
  duration,
}: StartImageToVideoArgs): Promise<{ requestId: string }> {
  const res = await fetch(`${XAI_BASE}/videos/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      prompt,
      image: { url: imageUrl },
      duration,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`xAI video generation failed (${res.status}): ${body}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any
  const requestId: string | undefined = data?.request_id
  if (!requestId) {
    throw new Error('xAI video generation response missing request_id')
  }
  return { requestId }
}

export interface VideoStatus {
  status: 'pending' | 'done' | 'failed'
  url?: string
  raw: unknown
}

/**
 * Poll a generation by request_id. Normalizes 'expired' → 'failed' and
 * extracts video.url when done. Throws with status + body on a non-OK response.
 */
export async function getVideoStatus(requestId: string): Promise<VideoStatus> {
  const res = await fetch(`${XAI_BASE}/videos/${encodeURIComponent(requestId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`xAI video status failed (${res.status}): ${body}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any
  const rawStatus: string = data?.status ?? 'pending'

  let status: VideoStatus['status']
  if (rawStatus === 'done') {
    status = 'done'
  } else if (rawStatus === 'failed' || rawStatus === 'expired') {
    status = 'failed'
  } else {
    status = 'pending'
  }

  const url: string | undefined = data?.video?.url

  return { status, url, raw: data }
}
