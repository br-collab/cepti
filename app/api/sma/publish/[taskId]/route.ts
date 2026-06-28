import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { publishApprovedTask } from '@/lib/sma/publish-service'
import { isPlatform } from '@/lib/sma/platforms'

export const runtime = 'nodejs'

/**
 * Human-triggered publish of an APPROVED draft for a platform.
 *
 * Thin wrapper around publishApprovedTask() in lib/sma/publish-service.ts.
 * Platform comes from the JSON body (`{ platform }`), defaulting to 'facebook'
 * for back-compat. The shared service loads the lifecycle, verifies it was
 * approved and not yet published, gets a Coordinator-authorized handoff, and
 * calls the platform agent's publish(). This route only enforces admin auth.
 *
 * Immutable Stop 1: neither this route nor the service calls Meta directly.
 * Only the platform agent's publish() touches the Graph API.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const { taskId } = await params
    let platform = 'facebook'
    try {
      const body = await req.json()
      if (body && typeof body.platform === 'string') platform = body.platform
    } catch {
      // No/!JSON body — keep the 'facebook' default.
    }
    if (!isPlatform(platform)) {
      return NextResponse.json({ error: `unknown platform: ${platform}` }, { status: 400 })
    }

    const result = await publishApprovedTask(taskId, platform)

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      ok: true,
      permalink: result.permalink,
      platform_post_id: result.platform_post_id,
    })
  } catch (error) {
    console.error('POST /api/sma/publish/[taskId] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
