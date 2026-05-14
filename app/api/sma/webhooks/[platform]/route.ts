import { type NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/sma/meta-client'
import { isPlatform } from '@/lib/sma/platforms'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  ctx: RouteContext<'/api/sma/webhooks/[platform]'>,
) {
  const { platform } = await ctx.params
  if (!isPlatform(platform)) {
    return NextResponse.json({ error: 'unknown platform' }, { status: 400 })
  }

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

export async function POST(
  req: NextRequest,
  ctx: RouteContext<'/api/sma/webhooks/[platform]'>,
) {
  const { platform } = await ctx.params
  if (!isPlatform(platform)) {
    return NextResponse.json({ error: 'unknown platform' }, { status: 400 })
  }

  const raw = await req.text()
  const signature = req.headers.get('x-hub-signature-256')
  if (!verifyWebhookSignature(raw, signature)) {
    return new NextResponse('invalid signature', { status: 401 })
  }

  // Phase 4 will parse and persist comments; Phase 1 acks and logs the platform.
  return NextResponse.json({ received: true, platform })
}
