import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { publishApprovedFacebookTask } from '@/lib/sma/publish-service'

export const runtime = 'nodejs'

/**
 * Human-triggered publish of an APPROVED Facebook draft.
 *
 * Thin wrapper around publishApprovedFacebookTask() in lib/sma/publish-service.ts.
 * The shared service loads the lifecycle, verifies it was approved and not yet
 * published, gets a Coordinator-authorized handoff, and calls
 * FacebookAgent.publish(). This route only enforces admin auth and maps the
 * service outcome to a NextResponse.
 *
 * Immutable Stop 1: neither this route nor the service calls Meta directly.
 * Only FacebookAgent.publish() touches the Graph API.
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
    const result = await publishApprovedFacebookTask(taskId)

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
