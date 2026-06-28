import { type NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/sma/meta-client'
import {
  handleInboundText,
  handleUnsupportedMessage,
  handleHumanEcho,
} from '@/lib/sma/whatsapp-advisor'

export const runtime = 'nodejs'

/**
 * WhatsApp Cloud API webhook (separate from the social `[platform]` webhook —
 * WhatsApp is not a Coordinator social platform). Reuses the same Meta
 * verify-token handshake and X-Hub-Signature-256 app-secret signature scheme.
 *
 * Register this URL in the Meta App dashboard and subscribe the `messages`
 * field on the WhatsApp Business Account:
 *   https://cepti-nu.vercel.app/api/sma/whatsapp/webhook
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

// ---- Cloud API payload shapes (subset we use) ----

interface WaTextMessage {
  from: string
  id: string
  timestamp?: string
  type: string
  text?: { body?: string }
}

interface WaChangeValue {
  messaging_product?: string
  metadata?: { phone_number_id?: string; display_phone_number?: string }
  contacts?: { profile?: { name?: string }; wa_id?: string }[]
  messages?: WaTextMessage[]
  statuses?: unknown[]
  // Coexistence echoes of messages a human sent from the Business app. Shape
  // is wired defensively — verify against real deliveries before relying on it.
  message_echoes?: WaTextMessage[]
}

interface WaWebhookPayload {
  object?: string
  entry?: { id?: string; changes?: { field?: string; value?: WaChangeValue }[] }[]
}

async function processPayload(payload: WaWebhookPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      const value = change.value
      if (!value) continue

      // Human replies mirrored from the Business app (Coexistence). Best-effort.
      for (const echo of value.message_echoes ?? []) {
        if (!echo?.id) continue
        const waId = echo.from
        if (!waId) continue
        try {
          await handleHumanEcho({
            waId,
            messageId: echo.id,
            text: echo.text?.body ?? '[message]',
          })
        } catch (e) {
          console.error('whatsapp echo handling failed:', e)
        }
      }

      for (const msg of value.messages ?? []) {
        if (!msg?.id || !msg.from) continue
        try {
          if (msg.type === 'text' && msg.text?.body) {
            await handleInboundText({
              waId: msg.from,
              messageId: msg.id,
              text: msg.text.body,
            })
          } else {
            await handleUnsupportedMessage({
              waId: msg.from,
              messageId: msg.id,
              kind: msg.type || 'unknown',
            })
          }
        } catch (e) {
          console.error('whatsapp message handling failed:', e)
        }
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

  let payload: WaWebhookPayload
  try {
    payload = JSON.parse(raw) as WaWebhookPayload
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // Ack fast, process best-effort. WhatsApp retries on non-2xx, so we always
  // return 200 once the signature is valid — errors are logged, not surfaced.
  try {
    await processPayload(payload)
  } catch (e) {
    console.error('whatsapp webhook processing error:', e)
  }

  return NextResponse.json({ received: true })
}
