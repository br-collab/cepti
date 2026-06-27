import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { SMACoordinator } from '@/lib/sma/coordinator/coordinator'
import { ConsoleAuditLogger } from '@/lib/sma/coordinator/audit'
import { FacebookAgent } from '@/lib/sma/agents/facebook-agent'
import { parseWaRef } from '@/lib/sma/wa-link'
import type { ApprovedDraft } from '@/lib/sma/agents/platform-base'
import type {
  ApprovalRecord,
  ContentLifecycle,
  DraftResult,
  PublishResult,
} from '@/lib/sma/coordinator/types'

export const runtime = 'nodejs'

/**
 * Human-triggered publish of an APPROVED Facebook draft.
 *
 * Flow: a draft is approved (resumeLifecycle → ContentLifecycle, status
 * COMPLETE) → a human clicks "Publish to Facebook" → this route loads the
 * lifecycle, verifies it was approved and not yet published, gets a
 * Coordinator-authorized handoff, and calls FacebookAgent.publish().
 *
 * Immutable Stop 1: this route never calls Meta directly. Only
 * FacebookAgent.publish() touches the Graph API.
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
    const supabase = getSupabaseServiceRoleClient()

    // 1. Load the most recent lifecycle for this task.
    const { data: row, error: readError } = await supabase
      .from('sma_content_lifecycles')
      .select('*')
      .eq('task_id', taskId)
      .order('assembled_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (readError) {
      return NextResponse.json({ error: `Failed to load lifecycle: ${readError.message}` }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: `No lifecycle found for task ${taskId}` }, { status: 404 })
    }

    const lifecycle = row.lifecycle_record as ContentLifecycle

    // 2. Ensure it was APPROVED.
    const approval: ApprovalRecord | undefined = (lifecycle.approvals || []).find(
      (a) => a.decision === 'APPROVE',
    )
    if (lifecycle.status !== 'COMPLETE' || !approval) {
      return NextResponse.json(
        { error: `Task ${taskId} is not in an approved state — cannot publish.` },
        { status: 400 },
      )
    }

    // 3. There must be a Facebook draft.
    const fbDraft = lifecycle.drafts?.facebook as DraftResult | undefined
    if (!fbDraft) {
      return NextResponse.json(
        { error: `Task ${taskId} has no Facebook draft to publish.` },
        { status: 400 },
      )
    }

    // 4. Refuse double-publish.
    const existingPublication = lifecycle.publications?.facebook
    if (existingPublication) {
      return NextResponse.json(
        {
          error: `Task ${taskId} has already been published to Facebook (post ${existingPublication.platform_post_id}).`,
          permalink: existingPublication.permalink,
        },
        { status: 409 },
      )
    }

    // 5. Build the ApprovedDraft from the draft + approval info.
    const approvedDraft: ApprovedDraft = {
      ...fbDraft,
      approval_record_id: `APR-${taskId}`,
      approved_by: approval.decided_by,
      approved_at: approval.decided_at,
    }

    // 6. Get a Coordinator-authorized handoff to FACEBOOK_AGENT.
    const auditLogger = new ConsoleAuditLogger()
    const coordinator = new SMACoordinator(supabase, auditLogger)
    const handoff = await coordinator.handoff(
      taskId,
      'COORDINATOR',
      'FACEBOOK_AGENT',
      approvedDraft,
      'Human-triggered publish of approved Facebook draft',
    )

    // 7. Publish (Immutable Stop 1: only the agent calls Meta).
    let result: PublishResult
    try {
      result = await new FacebookAgent().publish(handoff, approvedDraft)
    } catch (publishErr) {
      const message = publishErr instanceof Error ? publishErr.message : 'Facebook publish failed'
      console.error(`POST /api/sma/publish/${taskId} publish error:`, publishErr)
      return NextResponse.json({ error: message }, { status: 500 })
    }

    // 8. Record what shipped in sma_published_posts. The schema has no raw
    // response or ref column, so the full body (which embeds the wa.me ref
    // tag parsed below for the audit log) is stored as the caption.
    const waRef = parseWaRef(approvedDraft.body)
    if (waRef) {
      console.log(`[publish] task ${taskId} attribution ref:`, waRef)
    }
    const { error: insertError } = await supabase
      .from('sma_published_posts')
      .insert({
        platform: 'facebook',
        external_post_id: result.platform_post_id,
        permalink: result.permalink,
        published_at: result.published_at,
        caption: approvedDraft.body,
        hashtags: approvedDraft.hashtags || [],
      })

    if (insertError) {
      // The post is live on Facebook; surface the recording failure but do
      // not pretend it failed to publish.
      console.error(`POST /api/sma/publish/${taskId} record error:`, insertError)
    }

    // 9. Update the lifecycle_record's publications with the PublishResult.
    const updatedLifecycle: ContentLifecycle = {
      ...lifecycle,
      publications: { ...(lifecycle.publications || {}), facebook: result },
    }
    const { error: updateError } = await supabase
      .from('sma_content_lifecycles')
      .update({ lifecycle_record: updatedLifecycle })
      .eq('task_id', taskId)

    if (updateError) {
      console.error(`POST /api/sma/publish/${taskId} lifecycle update error:`, updateError)
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
