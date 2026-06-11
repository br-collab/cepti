import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { SMACoordinator } from '@/lib/sma/coordinator/coordinator'
import { ConsoleAuditLogger } from '@/lib/sma/coordinator/audit'
import { getDecidedByName } from '@/lib/sma/admin-utils'

export const runtime = 'nodejs'

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
    const body = await req.json()
    const { decision, rationale, scheduled_for } = body as {
      decision?: string;
      rationale?: string;
      scheduled_for?: string | null;
    }

    if (!decision || !['APPROVE', 'DENY'].includes(decision)) {
      return NextResponse.json({ error: 'decision must be APPROVE or DENY' }, { status: 400 })
    }

    if (!rationale || typeof rationale !== 'string' || rationale.trim() === '') {
      return NextResponse.json({ error: 'rationale is required and must be a non-empty string' }, { status: 400 })
    }

    // Validate scheduled_for if provided
    if (scheduled_for) {
      const scheduledDate = new Date(scheduled_for)
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json({ error: 'scheduled_for must be a valid ISO timestamp' }, { status: 400 })
      }
      if (scheduledDate <= new Date()) {
        return NextResponse.json({ error: 'scheduled_for must be in the future' }, { status: 400 })
      }
    }

    // Set up coordinator
    const supabase = await getSupabaseServiceRoleClient()
    const auditLogger = new ConsoleAuditLogger()
    const coordinator = new SMACoordinator(supabase, auditLogger)

    // Resume with decision
    const result = await coordinator.resumeLifecycle(taskId, decision as 'APPROVE' | 'DENY', {
      approver_id: user.id,
      decided_by: getDecidedByName(user.id),
      rationale: rationale.trim(),
      scheduled_for: scheduled_for || null,
    })

    if (result.status === 'INVALID_APPROVAL') {
      // User already approved or missing required fields
      const message = result.missing && result.missing.length > 0
        ? result.missing[0]
        : 'Invalid approval';
      return NextResponse.json(
        { error: message },
        { status: 400 },
      )
    }

    if (result.status === 'NOT_FOUND') {
      return NextResponse.json(
        { error: `Task ${taskId} not found` },
        { status: 404 },
      )
    }

    // COMPLETE can mean either fully approved (both approved) or partially approved (pending)
    // Check lifecycle status to determine
    const lifecycleStatus = result.status === 'DENIED' ? 'DENIED' : (result.status === 'COMPLETE' && result.lifecycle ? result.lifecycle.status : 'UNKNOWN');

    return NextResponse.json({
      status: result.status,
      task_status: lifecycleStatus,
      lifecycle_status: lifecycleStatus,
    })
  } catch (error) {
    console.error('POST /api/sma/coordinator/decide/[taskId] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
