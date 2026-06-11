import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  // Check authentication
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const { taskId } = await params
    const supabase = await getSupabaseServiceRoleClient()

    // Get all approval decisions for this task
    const { data: approvals, error } = await supabase
      .from('sma_approval_decisions')
      .select('*')
      .eq('task_id', taskId)
      .order('decided_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: `Failed to get approvals: ${error.message}` },
        { status: 500 },
      )
    }

    // Process approvals into summary
    const approvedBy: string[] = []
    const deniedBy: string[] = []

    if (Array.isArray(approvals)) {
      approvals.forEach((approval: any) => {
        if (approval.decision === 'APPROVE') {
          approvedBy.push(approval.decided_by)
        } else if (approval.decision === 'DENY') {
          deniedBy.push(approval.decided_by)
        }
      })
    }

    // Determine overall status
    let status: 'PENDING' | 'APPROVED' | 'DENIED' = 'PENDING'
    if (deniedBy.length > 0) {
      status = 'DENIED'
    } else if (approvedBy.length === 2) {
      status = 'APPROVED'
    }

    return NextResponse.json({
      approved_by: approvedBy,
      denied_by: deniedBy,
      status,
      all_approvals: approvals || [],
    })
  } catch (error) {
    console.error('GET /api/sma/coordinator/approval-status/[taskId] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
