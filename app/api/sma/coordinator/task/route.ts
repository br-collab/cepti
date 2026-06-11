import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { SMACoordinator } from '@/lib/sma/coordinator/coordinator'
import { ConsoleAuditLogger } from '@/lib/sma/coordinator/audit'
import { FacebookAgent } from '@/lib/sma/agents/facebook-agent'
import type { ContentIntent } from '@/lib/sma/coordinator/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { topic, notes } = body as { topic?: string; notes?: string }

    if (!topic || typeof topic !== 'string' || topic.trim() === '') {
      return NextResponse.json({ error: 'topic is required and must be a non-empty string' }, { status: 400 })
    }

    // Set up coordinator and agent
    const supabase = await getSupabaseServiceRoleClient()
    const auditLogger = new ConsoleAuditLogger()
    const coordinator = new SMACoordinator(supabase, auditLogger)
    const facebookAgent = new FacebookAgent()

    // Create intent
    const intent: ContentIntent = {
      intent_id: `INT-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      proposed_by: 'bill',
      proposed_at: new Date().toISOString(),
      topic: topic.trim(),
      notes: notes?.trim(),
      proposed_platforms: ['facebook'],
      scheduled_for: null,
    }

    // Full coordinator chain
    const taskId = await coordinator.issueTask(intent, ['facebook'])
    const handoffRecord = await coordinator.handoff(taskId, 'COORDINATOR', 'FACEBOOK_AGENT', intent, 'Generate draft for approval queue')
    const draftResult = await facebookAgent.draftPost(handoffRecord, intent)

    // Request approval with full context
    await coordinator.requestApproval(taskId, 'AWAITING_DRAFT_APPROVAL', {
      task_id: taskId,
      reason: 'AWAITING_DRAFT_APPROVAL',
      intent,
      draft: draftResult,
      platform: 'facebook',
      scheduled_for: null,
      related_paused_count: 0,
    })

    return NextResponse.json({ task_id: taskId })
  } catch (error) {
    console.error('POST /api/sma/coordinator/task error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
