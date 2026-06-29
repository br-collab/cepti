import { NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { listConversations, setHandoff, type DmChannel } from '@/lib/sma/dm-store'

export const runtime = 'nodejs'

function parseChannel(value: string | null): DmChannel | undefined {
  if (value === 'messenger' || value === 'instagram') return value
  return undefined
}

/**
 * List Messenger / Instagram Direct conversations for the admin dashboard.
 * Optional `?channel=messenger|instagram` filter.
 */
export async function GET(req: Request) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const channel = parseChannel(url.searchParams.get('channel'))
    const conversations = await listConversations(channel, 100)
    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('GET /api/sma/messages/conversations error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * Toggle a conversation's handoff flag. Setting it false hands the thread back
 * to the bot; setting it true takes it over for a human.
 * Body: { conversation_id: string, handed_off_to_human: boolean, reason?: string }
 */
export async function PATCH(req: Request) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { conversation_id?: string; handed_off_to_human?: boolean; reason?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.conversation_id || typeof body.handed_off_to_human !== 'boolean') {
    return NextResponse.json(
      { error: 'conversation_id and handed_off_to_human are required' },
      { status: 400 },
    )
  }

  try {
    await setHandoff(
      body.conversation_id,
      body.handed_off_to_human,
      body.handed_off_to_human ? body.reason ?? 'manual' : null,
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/sma/messages/conversations error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
