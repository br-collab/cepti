/**
 * lib/sma/publish-service.ts
 *
 * Shared publish core: takes an APPROVED Facebook task and publishes it via
 * FacebookAgent.publish(), recording the result. Extracted from
 * app/api/sma/publish/[taskId]/route.ts so both the human-triggered publish
 * route and the scheduled-publish cron run the exact same path.
 *
 * Immutable Stop 1: this module never calls Meta directly. Only
 * FacebookAgent.publish() touches the Graph API. Publishing is only ever done
 * for content that was already APPROVED — neither caller generates new text.
 */

import 'server-only'
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

export type PublishOutcome =
  | { ok: true; permalink: string; platform_post_id: string }
  | { ok: false; error: string; status: number }

/**
 * Publish the most recent APPROVED Facebook draft for a task.
 *
 * Mirrors the original route behavior exactly:
 *  - 404 if no lifecycle exists for the task
 *  - 500 if the lifecycle read fails
 *  - 400 if the task is not APPROVED/COMPLETE or has no Facebook draft
 *  - 409 if it was already published to Facebook
 *  - 500 if the Facebook publish call throws
 *  - ok on success
 *
 * sma_published_posts insert / lifecycle update failures are logged but do not
 * fail the call once the post is live (same as the original route).
 */
export async function publishApprovedFacebookTask(taskId: string): Promise<PublishOutcome> {
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
    return { ok: false, error: `Failed to load lifecycle: ${readError.message}`, status: 500 }
  }
  if (!row) {
    return { ok: false, error: `No lifecycle found for task ${taskId}`, status: 404 }
  }

  const lifecycle = row.lifecycle_record as ContentLifecycle

  // 2. Ensure it was APPROVED.
  const approval: ApprovalRecord | undefined = (lifecycle.approvals || []).find(
    (a) => a.decision === 'APPROVE',
  )
  if (lifecycle.status !== 'COMPLETE' || !approval) {
    return {
      ok: false,
      error: `Task ${taskId} is not in an approved state — cannot publish.`,
      status: 400,
    }
  }

  // 3. There must be a Facebook draft.
  const fbDraft = lifecycle.drafts?.facebook as DraftResult | undefined
  if (!fbDraft) {
    return { ok: false, error: `Task ${taskId} has no Facebook draft to publish.`, status: 400 }
  }

  // 4. Refuse double-publish.
  const existingPublication = lifecycle.publications?.facebook
  if (existingPublication) {
    return {
      ok: false,
      error: `Task ${taskId} has already been published to Facebook (post ${existingPublication.platform_post_id}).`,
      status: 409,
    }
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
    'Human-authorized publish of approved Facebook draft',
  )

  // 7. Publish (Immutable Stop 1: only the agent calls Meta).
  let result: PublishResult
  try {
    result = await new FacebookAgent().publish(handoff, approvedDraft)
  } catch (publishErr) {
    const message = publishErr instanceof Error ? publishErr.message : 'Facebook publish failed'
    console.error(`publishApprovedFacebookTask(${taskId}) publish error:`, publishErr)
    return { ok: false, error: message, status: 500 }
  }

  // 8. Record what shipped in sma_published_posts.
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
    // The post is live on Facebook; surface the recording failure but do not
    // pretend it failed to publish.
    console.error(`publishApprovedFacebookTask(${taskId}) record error:`, insertError)
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
    console.error(`publishApprovedFacebookTask(${taskId}) lifecycle update error:`, updateError)
  }

  return {
    ok: true,
    permalink: result.permalink,
    platform_post_id: result.platform_post_id,
  }
}
