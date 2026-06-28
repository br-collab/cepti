import 'server-only'

/**
 * Thin WhatsApp send client.
 *
 * Talks to the Meta WhatsApp Cloud API by default. The base URL is read from
 * `WHATSAPP_API_BASE` so a BSP (e.g. 360dialog) can be swapped in without code
 * changes — BSPs accept the same Cloud API JSON body, only the host and auth
 * header differ. If you move to a BSP, set `WHATSAPP_API_BASE` to its base and
 * `WHATSAPP_ACCESS_TOKEN` to the BSP token (or adjust the auth header here).
 *
 * Reactive scope only: this client sends free-form text, which is allowed (and
 * free) inside the 24-hour customer-service window opened by the user's inbound
 * message. It does NOT send template messages — proactive/outside-window
 * messaging is a deliberate v1.5 decision (templates need Meta approval).
 */

const DEFAULT_API_BASE = 'https://graph.facebook.com/v23.0'

function creds() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !token) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN not configured')
  }
  const base = process.env.WHATSAPP_API_BASE || DEFAULT_API_BASE
  return { phoneNumberId, token, base }
}

/**
 * Send a plain-text WhatsApp message. Returns the provider message id (wamid)
 * when available. Throws on a non-2xx response so the caller can log/handle it.
 */
export async function sendWhatsAppText(
  to: string,
  body: string,
): Promise<{ messageId: string | null }> {
  const { phoneNumberId, token, base } = creds()
  const res = await fetch(`${base}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body, preview_url: false },
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`WhatsApp send failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as { messages?: { id?: string }[] }
  return { messageId: data?.messages?.[0]?.id ?? null }
}

/**
 * Mark an inbound message as read (blue ticks). Best-effort — never throws, a
 * failed read receipt must not affect reply handling.
 */
export async function markWhatsAppRead(messageId: string): Promise<void> {
  try {
    const { phoneNumberId, token, base } = creds()
    await fetch(`${base}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
      cache: 'no-store',
    })
  } catch (e) {
    console.error('markWhatsAppRead failed (non-fatal):', e)
  }
}
