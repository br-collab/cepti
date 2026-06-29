import { type NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/sma/meta-client'
import { handleInboundDm, handleHumanEcho } from '@/lib/sma/dm-advisor'
import type { DmChannel } from '@/lib/sma/dm-store'

export const runtime = 'nodejs'

/**
 * Dedicated webhook for Facebook Messenger + Instagram Direct inbound DMs
 * (separate from the WhatsApp webhook and the social `[platform]` comment
 * webhook). Reuses the Meta verify-token handshake and the X-Hub-Signature-256
 * app-secret signature scheme.
 *
 * Register this URL in the Meta App dashboard and subscribe the `messages`
 * field on both the Page (Messenger) and the Instagram product:
 *   https://cepti-nu.vercel.app/api/sma/messaging/webhook
 *
 * Channel discrimination (verified against Meta's Messenger Platform +
 * Instagram Messaging webhook docs): the top-level `object` field is "page"
 * for Messenger and "instagram" for Instagram Direct. Both deliver inbound
 * events under entry[].messaging[] with sender.id / recipient.id and a
 * message object carrying mid + text (+ is_echo on business-side echoes).
 */

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN

  if (!verifyToken) {
    return NextResponse.json({ error: 'verify token not configured' }, { status: 500 })
  }
  if (mode !== 'subscribe' || token !== verifyToken || !challenge) {
    return new NextResponse('forbidden', { status: 403 })
  }
  return new NextResponse(challenge, { status: 200 })
}

// ---- Messenger / Instagram messaging payload shapes (subset we use) ----

interface MessagingEvent {
  sender?: { id?: string }
  recipient?: { id?: string }
  timestamp?: number
  message?: {
    mid?: string
    text?: string
    is_echo?: boolean
    // Non-text payloads (images, stickers, etc.) arrive under `attachments`.
    attachments?: unknown[]
  }
}

interface WebhookEntry {
  id?: string
  time?: number
  messaging?: MessagingEvent[]
}

interface MessagingWebhookPayload {
  object?: string
  entry?: WebhookEntry[]
}

/** Map the webhook `object` field to our DM channel, or null if unsupported. */
function channelFromObject(object: string | undefined): DmChannel | null {
  if (object === 'page') return 'messenger'
  if (object === 'instagram') return 'instagram'
  return null
}

async function processPayload(payload: MessagingWebhookPayload): Promise<void> {
  const channel = channelFromObject(payload.object)
  if (!channel) return

  for (const entry of payload.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const message = event.message
      if (!message?.mid) continue

      // Business-side echo: a human (or our own bot) sent a message. When a
      // human replies from the inbox, back off. The sender is the Page/IG
      // account; the customer is the recipient. Echoes the bot itself sent are
      // deduped by message_id in handleHumanEcho, so they don't re-flip state.
      if (message.is_echo) {
        const customerId = event.recipient?.id
        if (!customerId) continue
        try {
          await handleHumanEcho({
            channel,
            externalUserId: customerId,
            messageId: message.mid,
            text: message.text ?? '[message]',
          })
        } catch (e) {
          console.error('messaging echo handling failed:', e)
        }
        continue
      }

      // Inbound from the customer: sender is the customer (PSID / IGSID).
      const customerId = event.sender?.id
      if (!customerId) continue
      try {
        await handleInboundDm({
          channel,
          externalUserId: customerId,
          messageId: message.mid,
          // Empty/undefined text (attachment-only) -> dm-advisor escalates.
          text: message.text,
        })
      } catch (e) {
        console.error('messaging message handling failed:', e)
      }
    }
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  const signature = req.headers.get('x-hub-signature-256')
  if (!verifyWebhookSignature(raw, signature)) {
    return new NextResponse('invalid signature', { status: 401 })
  }

  let payload: MessagingWebhookPayload
  try {
    payload = JSON.parse(raw) as MessagingWebhookPayload
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // Ack fast, process best-effort. Meta retries on non-2xx, so we always
  // return 200 once the signature is valid — errors are logged, not surfaced.
  try {
    await processPayload(payload)
  } catch (e) {
    console.error('messaging webhook processing error:', e)
  }

  return NextResponse.json({ received: true })
}
