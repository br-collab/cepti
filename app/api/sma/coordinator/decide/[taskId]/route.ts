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
    const { decision, rationale } = body as { decision?: string; rationale?: string }

    if (!decision || !['APPROVE', 'DENY'].includes(decision)) {
      return NextResponse.json({ error: 'decision must be APPROVE or DENY' }, { status: 400 })
    }

    if (!rationale || typeof rationale !== 'string' || rationale.trim() === '') {
      return NextResponse.json({ error: 'rationale is required and must be a non-empty string' }, { status: 400 })
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
    })

    if (result.status !== 'COMPLETE' && result.status !== 'DENIED') {
      return NextResponse.json(
        { error: `Resume failed: ${result.status}`, detail: result },
        { status: 400 },
      )
    }

    return NextResponse.json({ status: result.status })
  } catch (error) {
    console.error('POST /api/sma/coordinator/decide/[taskId] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
