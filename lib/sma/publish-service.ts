/**
 * lib/sma/publish-service.ts
 *
 * Shared publish core: takes an APPROVED task and publishes it on a given
 * platform via that platform's agent, recording the result. Used by both the
 * human-triggered publish route and the scheduled-publish cron so they run the
 * exact same path.
 *
 * Immutable Stop 1: this module never calls Meta directly. Only the platform
 * agent's publish() touches the Graph API. Publishing is only ever done for
 * content that was already APPROVED — neither caller generates new text.
 */

import 'server-only'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { SMACoordinator } from '@/lib/sma/coordinator/coordinator'
import { ConsoleAuditLogger } from '@/lib/sma/coordinator/audit'
import { getPlatformAgent, PLATFORM_TO_ROLE } from '@/lib/sma/coordinator/registry'
import { parseWaRef } from '@/lib/sma/wa-link'
import { PLATFORM_LABEL, type Platform } from '@/lib/sma/platforms'
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
 * Back-compat wrapper. Facebook behavior is unchanged — it delegates to the
 * generalized publishApprovedTask() with platform 'facebook'.
 */
export async function publishApprovedFacebookTask(taskId: string): Promise<PublishOutcome> {
  return publishApprovedTask(taskId, 'facebook')
}

/**
 * Publish the most recent APPROVED draft for a task on the given platform.
 *
 *  - 404 if no lifecycle exists for the task
 *  - 500 if the lifecycle read fails
 *  - 400 if the task is not APPROVED/COMPLETE or has no draft for the platform
 *  - 409 if it was already published to the platform
 *  - 500 if the platform publish call throws
 *  - ok on success
 *
 * sma_published_posts insert / lifecycle update failures are logged but do not
 * fail the call once the post is live.
 */
export async function publishApprovedTask(
  taskId: string,
  platform: Platform,
): Promise<PublishOutcome> {
  const supabase = getSupabaseServiceRoleClient()
  const label = PLATFORM_LABEL[platform]

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

  // 3. There must be a draft for this platform.
  const draft = lifecycle.drafts?.[platform] as DraftResult | undefined
  if (!draft) {
    return { ok: false, error: `Task ${taskId} has no ${label} draft to publish.`, status: 400 }
  }

  // 4. Refuse double-publish.
  const existingPublication = lifecycle.publications?.[platform]
  if (existingPublication) {
    return {
      ok: false,
      error: `Task ${taskId} has already been published to ${label} (post ${existingPublication.platform_post_id}).`,
      status: 409,
    }
  }

  // 5. Build the ApprovedDraft from the draft + approval info.
  const approvedDraft: ApprovedDraft = {
    ...draft,
    approval_record_id: `APR-${taskId}`,
    approved_by: approval.decided_by,
    approved_at: approval.decided_at,
  }

  // 6. Get a Coordinator-authorized handoff to the platform's agent.
  const auditLogger = new ConsoleAuditLogger()
  const coordinator = new SMACoordinator(supabase, auditLogger)
  const handoff = await coordinator.handoff(
    taskId,
    'COORDINATOR',
    PLATFORM_TO_ROLE[platform],
    approvedDraft,
    `Human-authorized publish of approved ${label} draft`,
  )

  // 7. Publish (Immutable Stop 1: only the agent calls Meta).
  let result: PublishResult
  try {
    result = await getPlatformAgent(platform).publish(handoff, approvedDraft)
  } catch (publishErr) {
    const message = publishErr instanceof Error ? publishErr.message : `${label} publish failed`
    console.error(`publishApprovedTask(${taskId}, ${platform}) publish error:`, publishErr)
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
      platform,
      external_post_id: result.platform_post_id,
      permalink: result.permalink,
      published_at: result.published_at,
      caption: approvedDraft.body,
      hashtags: approvedDraft.hashtags || [],
    })

  if (insertError) {
    // The post is live; surface the recording failure but do not pretend it failed.
    console.error(`publishApprovedTask(${taskId}, ${platform}) record error:`, insertError)
  }

  // 9. Update the lifecycle_record's publications with the PublishResult.
  const updatedLifecycle: ContentLifecycle = {
    ...lifecycle,
    publications: { ...(lifecycle.publications || {}), [platform]: result },
  }
  const { error: updateError } = await supabase
    .from('sma_content_lifecycles')
    .update({ lifecycle_record: updatedLifecycle })
    .eq('task_id', taskId)

  if (updateError) {
    console.error(`publishApprovedTask(${taskId}, ${platform}) lifecycle update error:`, updateError)
  }

  return {
    ok: true,
    permalink: result.permalink,
    platform_post_id: result.platform_post_id,
  }
}
