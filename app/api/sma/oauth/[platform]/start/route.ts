import { randomBytes } from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/sma/auth'
import { buildAuthorizeUrl } from '@/lib/sma/meta-client'
import { PLATFORM_SCOPES, isPlatform } from '@/lib/sma/platforms'

export const runtime = 'nodejs'

const STATE_COOKIE_PREFIX = 'sma_oauth_state_'

export async function GET(
  req: NextRequest,
  ctx: RouteContext<'/api/sma/oauth/[platform]/start'>,
) {
  const { platform } = await ctx.params
  if (!isPlatform(platform)) {
    return NextResponse.json({ error: 'unknown platform' }, { status: 400 })
  }

  const user = await getAdminUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es'
  const redirectUri = `${url.origin}/api/sma/oauth/${platform}/callback`
  const state = randomBytes(24).toString('base64url')
  const authorizeUrl = buildAuthorizeUrl(platform, redirectUri, state, PLATFORM_SCOPES[platform])

  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set(`${STATE_COOKIE_PREFIX}${platform}`, `${state}.${lang}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    path: '/',
    maxAge: 60 * 10,
  })
  return res
}
