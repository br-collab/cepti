/**
 * lib/sma/coordinator/coordinator.ts
 *
 * SMACoordinator — the master agent that sequences and governs all
 * platform agent activity. Adapted from Aureon's ThifurC2 pattern,
 * stripped of financial-regulatory machinery and right-sized for
 * CEPTI's risk profile.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║ FIVE IMMUTABLE STOPS — enforced in code, reviewed in every PR    ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║ 1. NO SELF-PUBLISHING                                            ║
 * ║    The Coordinator dispatches to platform agents. The            ║
 * ║    Coordinator NEVER calls Meta's publish APIs directly.         ║
 * ║                                                                  ║
 * ║ 2. NO CONTENT AUTHORSHIP                                         ║
 * ║    The Coordinator handles timing, dispatch, lineage. It does    ║
 * ║    NOT write captions, replies, or copy.                         ║
 * ║                                                                  ║
 * ║ 3. NO PLATFORM ACTION WITHOUT DISPATCH RECORD                    ║
 * ║    Every platform agent checks for a valid HandoffRecord         ║
 * ║    before acting. Direct invocation is rejected.                 ║
 * ║                                                                  ║
 * ║ 4. ONE AUDIT RECORD PER CONTENT LIFECYCLE                        ║
 * ║    Raw agent telemetry never goes to audit. Only the curated     ║
 * ║    ContentLifecycle reaches sma_content_lifecycles.              ║
 * ║                                                                  ║
 * ║ 5. NO APPROVAL REQUEST WITHOUT FULL CONTEXT                      ║
 * ║    Approval requests bundle intent + draft + platform + time +   ║
 * ║    relevant metrics in one view. Never piecemeal.                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Implementation budget: 300-500 lines. If this file exceeds 800 lines,
 * we're over-engineering and must cut. Aureon's ThifurC2 is 1,766 lines
 * because of regulatory machinery (BCBS 239 P3, RTS6, OFAC screening,
 * convergence governance). CEPTI has none of that.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  AgentRole,
  AgentTelemetry,
  ApprovalContext,
  ApprovalRecord,
  ApprovalSummary,
  ContentIntent,
  ContentLifecycle,
  CoordinatorStatus,
  DraftResult,
  EngagementSnapshot,
  HandoffRecord,
  PausedLifecycle,
  PauseReason,
  Platform,
  PublishResult,
  ResumeResult,
  TaskStatus,
} from './types';
import { PLATFORM_AGENTS, getPlatformAgent } from './registry';
import { ConsoleAuditLogger } from './audit';
import { assertApprovalContextComplete } from './guardrails';
import type { ApprovedDraft } from '../agents/platform-base';

// ── Configuration ────────────────────────────────────────────────────

export const COORDINATOR_VERSION = '2.0.0';
export const MAX_HANDOFF_LOG_RETAIN = 500;
export const APPROVAL_SLA_HOURS = 48; // After this, items expire (configurable)

// ── Class Shell ──────────────────────────────────────────────────────

export class SMACoordinator {
  private readonly supabase: SupabaseClient;
  private readonly auditLogger: AuditLogger;

  constructor(supabase: SupabaseClient, auditLogger?: AuditLogger) {
    this.supabase = supabase;
    this.auditLogger = auditLogger || this.getDefaultAuditLogger();
  }

  private getDefaultAuditLogger(): AuditLogger {
    return new ConsoleAuditLogger();
  }

  // ─── Mandate 1: Dispatch ────────────────────────────────────────────

  /**
   * Issue a new task for the given content intent. Creates a
   * sma_coordinator_tasks row and returns the task_id.
   *
   * IMMUTABLE STOP 1: This method does not publish anything itself.
   * It records the intent and prepares to dispatch to platform agents.
   *
   * @param intent The originating content intent from Bill or Francisco
   * @param platforms Which platforms to dispatch to (subset of intent.proposed_platforms)
   * @returns task_id (task_YYYYMMDD_xxxxxx)
   * @throws Error if platforms are invalid or intent is missing required fields
   */
  async issueTask(intent: ContentIntent, platforms: Platform[]): Promise<string> {
    this.validateIntent(intent);
    this.validatePlatforms(platforms);

    const taskId = this.makeTaskId();
    const { error } = await this.supabase
      .from('sma_coordinator_tasks')
      .insert({
        task_id: taskId,
        intent,
        platforms,
        status: 'ACTIVE',
      });

    if (error) {
      throw new Error(`Failed to insert task ${taskId}: ${error.message}`);
    }

    await this.auditLogger.logTaskIssued(taskId, intent, platforms);
    return taskId;
  }

  private validateIntent(intent: ContentIntent): void {
    if (!intent.topic || intent.topic.trim() === '') {
      throw new Error('ContentIntent.topic is required and cannot be empty');
    }
    if (!intent.proposed_by || !['bill', 'francisco'].includes(intent.proposed_by)) {
      throw new Error('ContentIntent.proposed_by must be "bill" or "francisco"');
    }
  }

  private validatePlatforms(platforms: Platform[]): void {
    if (!platforms || platforms.length === 0) {
      throw new Error('At least one platform must be specified');
    }
    const validPlatforms = Object.keys(PLATFORM_AGENTS);
    for (const platform of platforms) {
      if (!validPlatforms.includes(platform)) {
        throw new Error(`Unknown platform: ${platform}. Valid platforms: ${validPlatforms.join(', ')}`);
      }
    }
  }

  // ─── Mandate 2: Handoff Governance ──────────────────────────────────

  /**
   * Record a handoff from one agent to another. Returns the
   * HandoffRecord the receiving agent must present before acting.
   *
   * IMMUTABLE STOP 3: This is the enforcement point. Platform agents
   * MUST call confirmHandoff() with the returned record before any
   * action; otherwise their action is rejected.
   *
   * @param taskId The task this handoff belongs to
   * @param fromAgent The agent releasing the lifecycle object
   * @param toAgent The agent receiving it
   * @param payload The lifecycle object being handed off
   * @param handoffReason Human-readable reason for audit log
   */
  async handoff(
    taskId: string,
    fromAgent: AgentRole,
    toAgent: AgentRole,
    payload: unknown,
    handoffReason: string,
  ): Promise<HandoffRecord> {
    const handoffId = this.makeHandoffId(taskId, fromAgent, toAgent);
    const ts = new Date().toISOString();

    const record: HandoffRecord = {
      handoff_id: handoffId,
      task_id: taskId,
      ts,
      from_agent: fromAgent,
      to_agent: toAgent,
      payload,
      handoff_reason: handoffReason,
      status: 'ISSUED',
      coordinator_authorized: true,
    };

    const { error } = await this.supabase
      .from('sma_handoffs')
      .insert({
        handoff_id: record.handoff_id,
        task_id: record.task_id,
        from_agent: record.from_agent,
        to_agent: record.to_agent,
        payload: record.payload,
        handoff_reason: record.handoff_reason,
        status: record.status,
      });

    if (error) {
      throw new Error(`Failed to insert handoff ${handoffId}: ${error.message}`);
    }

    await this.auditLogger.logHandoff(record);
    return record;
  }

  /**
   * Called by a receiving agent to confirm it acknowledges the
   * handoff and is taking ownership of the lifecycle object.
   * Updates the HandoffRecord status from ISSUED to ACTIVE.
   *
   * @returns true if the handoff is valid and Coordinator-authorized
   */
  async confirmHandoff(_record: HandoffRecord): Promise<boolean> {
    throw new Error('NOT_IMPLEMENTED: confirmHandoff');
  }

  // ─── Mandate 3: Unified Lineage ─────────────────────────────────────

  /**
   * Record telemetry from a completing agent. Internal state only —
   * NOT pushed to audit per Immutable Stop 4.
   *
   * @param taskId The task the agent was working on
   * @param agent Which agent returned telemetry
   * @param telemetry Agent-specific data payload
   */
  async recordTelemetry(
    _taskId: string,
    _agent: AgentRole,
    _telemetry: AgentTelemetry,
  ): Promise<void> {
    throw new Error('NOT_IMPLEMENTED: recordTelemetry');
  }

  /**
   * Assemble (if ready) and return the unified ContentLifecycle for
   * a task. This is the single audit record per lifecycle (Immutable
   * Stop 4).
   *
   * Returns null if the lifecycle is not yet complete.
   */
  async getContentLifecycle(_taskId: string): Promise<ContentLifecycle | null> {
    throw new Error('NOT_IMPLEMENTED: getContentLifecycle');
  }

  // ─── Mandate 4: Escalation (Approval Routing) ───────────────────────

  /**
   * Pause a lifecycle and surface it for human approval. Per Immutable
   * Stop 5, the ApprovalContext must include all information the
   * approver needs to decide without going hunting for context.
   *
   * @param taskId The task to pause
   * @param reason Why approval is needed
   * @param context Full bundled context for the approver
   */
  async requestApproval(
    taskId: string,
    reason: PauseReason,
    context: ApprovalContext,
  ): Promise<void> {
    // Per Immutable Stop 5: assert context is complete
    assertApprovalContextComplete(context);

    // Pause the lifecycle
    await this.pauseLifecycle(taskId, reason, context);

    // Audit log the approval request
    await this.auditLogger.logApprovalRequested(taskId, reason);
  }

  // ─── Pause / Resume ─────────────────────────────────────────────────

  /**
   * Pause a lifecycle. Persists to sma_paused_lifecycles. Dashboard
   * surfaces these as the approval queue.
   */
  async pauseLifecycle(
    taskId: string,
    reason: PauseReason,
    context: ApprovalContext,
  ): Promise<void> {
    // Update task status to PAUSED
    const { error: updateError } = await this.supabase
      .from('sma_coordinator_tasks')
      .update({ status: 'PAUSED' })
      .eq('task_id', taskId);

    if (updateError) {
      throw new Error(`Failed to pause task ${taskId}: ${updateError.message}`);
    }

    // Insert pause record with full context
    const { error: insertError } = await this.supabase
      .from('sma_paused_lifecycles')
      .insert({
        task_id: taskId,
        pause_reason: reason,
        context,
      });

    if (insertError) {
      throw new Error(`Failed to insert pause record for ${taskId}: ${insertError.message}`);
    }
  }

  /**
   * Resume a paused lifecycle with the approver's decision.
   *
   * PHASE 2.4: Multi-User Approvals
   * - Appends this approval to sma_approval_decisions
   * - Prevents same user from approving twice (returns error if found)
   * - Checks combined approval status:
   *   - If any DENY: return DENIED (no second approval needed)
   *   - If both APPROVE: return COMPLETE (ready to publish)
   *   - Otherwise: return PENDING (waiting for other approver)
   *
   * @param scheduled_for Optional ISO timestamp for future publication. If provided,
   *                       must be a valid future datetime. Null = publish immediately.
   */
  async resumeLifecycle(
    taskId: string,
    decision: 'APPROVE' | 'DENY',
    attribution: {
      approver_id: string;
      decided_by: 'bill' | 'francisco';
      rationale: string;
      scheduled_for?: string | null;
    },
  ): Promise<ResumeResult> {
    // Validate attribution
    const missing: string[] = [];
    if (!attribution.approver_id) missing.push('approver_id');
    if (!attribution.decided_by) missing.push('decided_by');
    if (!attribution.rationale) missing.push('rationale');

    if (missing.length > 0) {
      return { status: 'INVALID_APPROVAL', task_id: taskId, missing };
    }

    // Validate scheduled_for if provided
    if (attribution.scheduled_for) {
      const scheduledDate = new Date(attribution.scheduled_for);
      if (isNaN(scheduledDate.getTime())) {
        return { status: 'INVALID_APPROVAL', task_id: taskId, missing: ['scheduled_for: invalid ISO timestamp'] };
      }
      if (scheduledDate <= new Date()) {
        return { status: 'INVALID_APPROVAL', task_id: taskId, missing: ['scheduled_for: must be in the future'] };
      }
    }

    // Check if user already approved/denied
    const alreadyApproved = await this.hasUserApproved(taskId, attribution.decided_by);
    if (alreadyApproved) {
      return {
        status: 'INVALID_APPROVAL',
        task_id: taskId,
        missing: [`${attribution.decided_by} has already approved or denied this task`],
      };
    }

    // Read paused lifecycle row
    const { data: pausedRow, error: readError } = await this.supabase
      .from('sma_paused_lifecycles')
      .select('*')
      .eq('task_id', taskId)
      .single();

    if (readError || !pausedRow) {
      return { status: 'NOT_FOUND', task_id: taskId };
    }

    // Read task row for intent
    const { data: taskRow, error: taskError } = await this.supabase
      .from('sma_coordinator_tasks')
      .select('intent')
      .eq('task_id', taskId)
      .single();

    if (taskError || !taskRow) {
      return { status: 'NOT_FOUND', task_id: taskId };
    }

    const intent = taskRow.intent as ContentIntent;
    const context = pausedRow.context as ApprovalContext;
    const draft = context.draft as DraftResult;

    // Insert approval decision into sma_approval_decisions
    const { error: insertApprovalError } = await this.supabase
      .from('sma_approval_decisions')
      .insert({
        task_id: taskId,
        decided_by: attribution.decided_by,
        decision,
        rationale: attribution.rationale,
        decided_at: new Date().toISOString(),
        approver_id: attribution.approver_id,
        scheduled_for: attribution.scheduled_for || null,
      });

    if (insertApprovalError) {
      throw new Error(
        `Failed to insert approval decision for ${taskId}: ${insertApprovalError.message}`,
      );
    }

    // Get updated approval summary
    const approvalSummary = await this.getApprovalSummary(taskId);

    // If any DENY, the entire task is DENIED regardless of other approvals
    if (approvalSummary.status === 'DENIED') {
      // Update task status to DENIED
      const { error: updateTaskError } = await this.supabase
        .from('sma_coordinator_tasks')
        .update({ status: 'DENIED' })
        .eq('task_id', taskId);

      if (updateTaskError) {
        throw new Error(`Failed to update task status for ${taskId}: ${updateTaskError.message}`);
      }

      // Create denial lifecycle
      const denialLifecycle: ContentLifecycle = {
        task_id: taskId,
        intent,
        drafts: { [context.platform]: draft },
        approvals: approvalSummary.all_approvals,
        publications: {},
        initial_metrics: {},
        assembled_at: new Date().toISOString(),
        status: 'DENIED',
        lineage_hash: '', // Will be computed below
      };

      // Compute lineage hash
      const { createHash } = await import('crypto');
      const lifecycleJson = JSON.stringify(
        { ...denialLifecycle, lineage_hash: '' },
        null,
        0,
      );
      const lineageHash = createHash('sha256').update(lifecycleJson).digest('hex');
      denialLifecycle.lineage_hash = lineageHash;

      // Insert denial lifecycle
      const { error: insertLifecycleError } = await this.supabase
        .from('sma_content_lifecycles')
        .insert({
          task_id: taskId,
          lifecycle_record: denialLifecycle,
          lineage_hash: lineageHash,
        });

      if (insertLifecycleError) {
        throw new Error(
          `Failed to insert denial lifecycle for ${taskId}: ${insertLifecycleError.message}`,
        );
      }

      // Audit log
      await this.auditLogger.logApprovalDecision(taskId, {
        task_id: taskId,
        decision,
        decided_by: attribution.decided_by,
        decided_at: new Date().toISOString(),
        rationale: attribution.rationale,
        scheduled_for: attribution.scheduled_for || null,
      });

      return { status: 'DENIED', task_id: taskId, rationale: attribution.rationale };
    }

    // If both approved, task is COMPLETE
    if (approvalSummary.status === 'APPROVED') {
      // Create complete lifecycle with all approvals
      const completeLifecycle: ContentLifecycle = {
        task_id: taskId,
        intent,
        drafts: { [context.platform]: draft },
        approvals: approvalSummary.all_approvals,
        publications: {},
        initial_metrics: {},
        assembled_at: new Date().toISOString(),
        status: 'COMPLETE',
        lineage_hash: '', // Will be computed below
      };

      // Compute lineage hash
      const { createHash } = await import('crypto');
      const lifecycleJson = JSON.stringify(
        { ...completeLifecycle, lineage_hash: '' },
        null,
        0,
      );
      const lineageHash = createHash('sha256').update(lifecycleJson).digest('hex');
      completeLifecycle.lineage_hash = lineageHash;

      // Insert complete lifecycle
      const { error: insertLifecycleError } = await this.supabase
        .from('sma_content_lifecycles')
        .insert({
          task_id: taskId,
          lifecycle_record: completeLifecycle,
          lineage_hash: lineageHash,
          scheduled_for: attribution.scheduled_for || null,
        });

      if (insertLifecycleError) {
        throw new Error(
          `Failed to insert complete lifecycle for ${taskId}: ${insertLifecycleError.message}`,
        );
      }

      // Update task status to COMPLETE
      const { error: updateTaskError } = await this.supabase
        .from('sma_coordinator_tasks')
        .update({ status: 'COMPLETE' })
        .eq('task_id', taskId);

      if (updateTaskError) {
        throw new Error(`Failed to update task status for ${taskId}: ${updateTaskError.message}`);
      }

      // Audit log
      await this.auditLogger.logApprovalDecision(taskId, {
        task_id: taskId,
        decision,
        decided_by: attribution.decided_by,
        decided_at: new Date().toISOString(),
        rationale: attribution.rationale,
        scheduled_for: attribution.scheduled_for || null,
      });
      await this.auditLogger.logLifecycleAssembled(completeLifecycle);

      return { status: 'COMPLETE', task_id: taskId, lifecycle: completeLifecycle };
    }

    // Otherwise PENDING: waiting for the other approver
    // Don't update task status; keep it PAUSED
    await this.auditLogger.logApprovalDecision(taskId, {
      task_id: taskId,
      decision,
      decided_by: attribution.decided_by,
      decided_at: new Date().toISOString(),
      rationale: attribution.rationale,
      scheduled_for: attribution.scheduled_for || null,
    });

    return {
      status: 'COMPLETE',
      task_id: taskId,
      lifecycle: {
        task_id: taskId,
        intent,
        drafts: { [context.platform]: draft },
        approvals: approvalSummary.all_approvals,
        publications: {},
        initial_metrics: {},
        assembled_at: new Date().toISOString(),
        status: 'PAUSED',
        lineage_hash: 'pending',
      },
    };
  }

  /**
   * List all currently paused lifecycles. Used by the
   * /admin/sma/approval-queue page.
   */
  async listPausedLifecycles(): Promise<PausedLifecycle[]> {
    const { data, error } = await this.supabase
      .from('sma_paused_lifecycles')
      .select('*')
      .is('resumed_at', null)
      .order('paused_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list paused lifecycles: ${error.message}`);
    }

    return data as PausedLifecycle[];
  }

  /**
   * Check if a user has already approved or denied a task.
   * Used to prevent double-approval by the same person.
   *
   * @param taskId The task to check
   * @param decidedBy 'bill' or 'francisco'
   * @returns true if user already has an approval/denial record
   */
  private async hasUserApproved(taskId: string, decidedBy: 'bill' | 'francisco'): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('sma_approval_decisions')
      .select('id')
      .eq('task_id', taskId)
      .eq('decided_by', decidedBy)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check approval status: ${error.message}`);
    }

    return !!data;
  }

  /**
   * Get the combined approval summary for a task.
   * Returns who approved/denied and the overall status.
   *
   * Status logic:
   * - DENIED: if any person denied (one deny blocks all)
   * - APPROVED: if both bill and francisco approved
   * - PENDING: otherwise (waiting for other approver)
   *
   * @param taskId The task to summarize
   * @returns ApprovalSummary with approved_by, denied_by, status, and all_approvals
   */
  private async getApprovalSummary(taskId: string): Promise<ApprovalSummary> {
    const { data: approvals, error } = await this.supabase
      .from('sma_approval_decisions')
      .select('*')
      .eq('task_id', taskId)
      .order('decided_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get approval summary: ${error.message}`);
    }

    const approvedBy: Array<'bill' | 'francisco'> = [];
    const deniedBy: Array<'bill' | 'francisco'> = [];

    (approvals || []).forEach((approval: {
      decided_by: string;
      decision: string;
      task_id: string;
      rationale: string;
      decided_at: string;
      scheduled_for?: string | null;
    }) => {
      if (approval.decision === 'APPROVE') {
        approvedBy.push(approval.decided_by as 'bill' | 'francisco');
      } else if (approval.decision === 'DENY') {
        deniedBy.push(approval.decided_by as 'bill' | 'francisco');
      }
    });

    // Determine overall status
    let status: 'PENDING' | 'APPROVED' | 'DENIED' = 'PENDING';
    if (deniedBy.length > 0) {
      status = 'DENIED';
    } else if (approvedBy.length === 2) {
      status = 'APPROVED';
    }

    // Convert approval rows to ApprovalRecord format
    const allApprovals: ApprovalRecord[] = (approvals || []).map((a: {
      decided_by: string;
      decision: string;
      task_id: string;
      rationale: string;
      decided_at: string;
      scheduled_for?: string | null;
    }) => ({
      task_id: a.task_id,
      decision: a.decision as 'APPROVE' | 'DENY',
      decided_by: a.decided_by as 'bill' | 'francisco',
      decided_at: a.decided_at,
      rationale: a.rationale,
      scheduled_for: a.scheduled_for || null,
    }));

    return {
      approved_by: approvedBy,
      denied_by: deniedBy,
      status,
      all_approvals: allApprovals,
    };
  }

  /**
   * Coordinator status snapshot for the dashboard. Counts active tasks,
   * paused tasks, recent handoffs, etc.
   */
  async getStatus(): Promise<CoordinatorStatus> {
    throw new Error('NOT_IMPLEMENTED: getStatus');
  }

  /**
   * Publish a scheduled content lifecycle to Meta platforms.
   * Dispatches to appropriate platform agents and updates published_at.
   *
   * IMMUTABLE STOP 1: This method dispatches to platform agents;
   * the Coordinator never publishes directly to Meta APIs.
   *
   * @param taskId The task to publish
   * @throws Error if task not found or publication fails
   */
  async publishContent(taskId: string): Promise<void> {
    console.log(`[Coordinator] Publishing content for task ${taskId}`);

    // Read the content lifecycle record
    const { data: lifecycleRow, error: readError } = await this.supabase
      .from('sma_content_lifecycles')
      .select('lifecycle_record')
      .eq('task_id', taskId)
      .maybeSingle();

    if (readError || !lifecycleRow) {
      throw new Error(`Task ${taskId} not found in content_lifecycles`);
    }

    const lifecycle = lifecycleRow.lifecycle_record as ContentLifecycle;

    // Check status is COMPLETE (approved)
    if (lifecycle.status !== 'COMPLETE') {
      throw new Error(`Task ${taskId} has status ${lifecycle.status}, expected COMPLETE`);
    }

    // Check not already published
    if (lifecycle.publications && Object.keys(lifecycle.publications).length > 0) {
      console.warn(`[Coordinator] Task ${taskId} already has publications, skipping`);
      return;
    }

    const publications: Partial<Record<Platform, PublishResult>> = {};
    const publishedPlatforms: Platform[] = [];
    const errors: Array<{ platform: Platform; error: string }> = [];

    // For each draft in the lifecycle, dispatch to the appropriate agent
    for (const platform of Object.keys(lifecycle.drafts) as Platform[]) {
      const draft = lifecycle.drafts[platform];
      if (!draft) continue;

      try {
        console.log(`[Coordinator] Dispatching publish to ${platform} agent for task ${taskId}`);

        // Create handoff record per Immutable Stop 3
        const handoffRecord = await this.handoff(
          taskId,
          'COORDINATOR',
          platform === 'facebook'
            ? 'FACEBOOK_AGENT'
            : platform === 'instagram'
              ? 'INSTAGRAM_AGENT'
              : 'THREADS_AGENT',
          draft,
          `Publish approved draft to ${platform}`,
        );

        // Get platform agent and call publish
        const agent = getPlatformAgent(platform);

        // Build ApprovedDraft from draft + approval info
        const approval = lifecycle.approvals[0];
        if (!approval) {
          throw new Error(`No approval record found for task ${taskId}`);
        }

        const approvedDraft: ApprovedDraft = {
          ...draft,
          approval_record_id: `${taskId}-approval-0`,
          approved_by: approval.decided_by,
          approved_at: approval.decided_at,
        };

        // Call agent's publish method
        const result = await agent.publish(handoffRecord, approvedDraft);
        publications[platform] = result;
        publishedPlatforms.push(platform);

        console.log(`[Coordinator] Successfully published to ${platform}: ${result.permalink}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[Coordinator] Failed to publish to ${platform}:`, errorMessage);
        errors.push({ platform, error: errorMessage });
      }
    }

    // Update the lifecycle record with published_at and publications
    const updatedLifecycle: ContentLifecycle = {
      ...lifecycle,
      publications: { ...lifecycle.publications, ...publications },
    };

    const now = new Date().toISOString();
    const { error: updateError } = await this.supabase
      .from('sma_content_lifecycles')
      .update({
        lifecycle_record: updatedLifecycle,
        published_at: now,
      })
      .eq('task_id', taskId);

    if (updateError) {
      console.error(`[Coordinator] Failed to update lifecycle for ${taskId}:`, updateError);
      throw new Error(
        `Failed to persist publications for ${taskId}: ${updateError.message}`,
      );
    }

    // Audit log the publication
    await this.auditLogger.logPublished(taskId, publishedPlatforms);

    // If there were errors, log them but don't fail if at least one platform succeeded
    if (errors.length > 0) {
      console.warn(
        `[Coordinator] ${errors.length} platform(s) failed for task ${taskId}:`,
        errors,
      );
      if (publishedPlatforms.length === 0) {
        // All platforms failed
        throw new Error(
          `All platforms failed for task ${taskId}: ${errors.map((e) => `${e.platform}: ${e.error}`).join('; ')}`,
        );
      }
    }

    console.log(
      `[Coordinator] Publish complete for task ${taskId}: ${publishedPlatforms.length} platform(s)`,
    );
  }

  /**
   * Record engagement metrics for a published post.
   * Updates the sma_content_lifecycles row with initial_metrics[platform].
   *
   * @param taskId The task whose content lifecycle we're updating
   * @param snapshot The engagement snapshot to record
   * @throws Error if task or lifecycle not found
   */
  async recordEngagement(taskId: string, snapshot: EngagementSnapshot): Promise<void> {
    console.log(
      `[Coordinator] Recording engagement metrics for task ${taskId}, platform ${snapshot.platform}`,
    );

    // Read the content lifecycle record
    const { data: lifecycleRow, error: readError } = await this.supabase
      .from('sma_content_lifecycles')
      .select('lifecycle_record')
      .eq('task_id', taskId)
      .maybeSingle();

    if (readError || !lifecycleRow) {
      throw new Error(`Task ${taskId} not found in content_lifecycles`);
    }

    const lifecycle = lifecycleRow.lifecycle_record as ContentLifecycle;

    // Update initial_metrics for this platform
    const updatedLifecycle: ContentLifecycle = {
      ...lifecycle,
      initial_metrics: {
        ...lifecycle.initial_metrics,
        [snapshot.platform]: snapshot,
      },
    };

    // Update the lifecycle record in database
    const { error: updateError } = await this.supabase
      .from('sma_content_lifecycles')
      .update({
        lifecycle_record: updatedLifecycle,
      })
      .eq('task_id', taskId);

    if (updateError) {
      throw new Error(
        `Failed to update lifecycle metrics for ${taskId}: ${updateError.message}`,
      );
    }

    // Audit log the engagement recording
    await this.auditLogger.logEngagementRecorded(taskId, snapshot.platform, snapshot);

    console.log(
      `[Coordinator] Successfully recorded metrics for task ${taskId}, platform ${snapshot.platform}`,
    );
  }

  // ─── Private helpers ────────────────────────────────────────────────

  /**
   * Generate a task_id: task_YYYYMMDD_xxxxxx (6-char alphanumeric suffix).
   */
  private makeTaskId(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `task_${dateStr}_${suffix}`;
  }

  /**
   * Generate a handoff_id: HO-YYYYMMDD_xxxxxx (6-char alphanumeric suffix).
   */
  private makeHandoffId(_taskId: string, _fromAgent: AgentRole, _toAgent: AgentRole): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `HO-${dateStr}_${suffix}`;
  }

  /**
   * Compute SHA-256 lineage hash over the assembled ContentLifecycle.
   * Used for audit tamper-evidence (nice to have, not gating).
   */
  private makeLineageHash(_lifecycle: Omit<ContentLifecycle, 'lineage_hash'>): string {
    throw new Error('NOT_IMPLEMENTED: makeLineageHash');
  }

  /**
   * Check whether all platforms in the task have returned telemetry.
   * If so, the lifecycle is ready for assembly.
   */
  private async isLifecycleReady(_taskId: string): Promise<boolean> {
    throw new Error('NOT_IMPLEMENTED: isLifecycleReady');
  }

  /**
   * Assemble the ContentLifecycle from accumulated telemetry,
   * approvals, and publish results. Persists to
   * sma_content_lifecycles.
   */
  private async assembleLifecycle(_taskId: string): Promise<ContentLifecycle> {
    throw new Error('NOT_IMPLEMENTED: assembleLifecycle');
  }

  // ─── Analytics Queries (Phase 2.5) ──────────────────────────────────

  /**
   * Get aggregated analytics data for a date range.
   * Used by the analytics dashboard to display summary metrics.
   */
  async getAnalyticsData(startDate: Date, endDate: Date) {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    // Query all published content lifecycles in the date range
    const { data: lifecycles, error } = await this.supabase
      .from('sma_content_lifecycles')
      .select('*')
      .gte('assembled_at', start)
      .lte('assembled_at', end);

    if (error) {
      throw new Error(`Failed to fetch analytics data: ${error.message}`);
    }

    const posts = (lifecycles || []).map((row: any) => {
      const lifecycle = row.lifecycle_record as ContentLifecycle;
      return {
        taskId: lifecycle.task_id,
        platform: Object.keys(lifecycle.publications || {})[0] as Platform | undefined,
        platforms: Object.keys(lifecycle.publications || {}) as Platform[],
        publishedAt: lifecycle.publications && Object.values(lifecycle.publications)[0]
          ? (Object.values(lifecycle.publications)[0] as PublishResult).published_at
          : null,
        metrics: lifecycle.initial_metrics || {},
        draft: lifecycle.drafts || {},
      };
    });

    return { posts, count: posts.length };
  }

  /**
   * Get daily engagement trend data for charting.
   * Returns daily aggregates of impressions, reach, engagement.
   */
  async getEngagementTrend(startDate: Date, endDate: Date) {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    const { data: lifecycles, error } = await this.supabase
      .from('sma_content_lifecycles')
      .select('*')
      .gte('assembled_at', start)
      .lte('assembled_at', end);

    if (error) {
      throw new Error(`Failed to fetch engagement trend: ${error.message}`);
    }

    // Aggregate by date
    const trendMap = new Map<string, {
      impressions: number;
      reach: number;
      engagement: number;
      platformSplit: Record<Platform, number>;
    }>();

    (lifecycles || []).forEach((row: any) => {
      const lifecycle = row.lifecycle_record as ContentLifecycle;
      if (!lifecycle.publications) return;

      Object.entries(lifecycle.publications).forEach(([platform, pub]) => {
        const publishResult = pub as PublishResult;
        const date = new Date(publishResult.published_at).toISOString().split('T')[0];

        const snapshot = lifecycle.initial_metrics?.[platform as Platform];
        if (!snapshot) return;

        if (!trendMap.has(date)) {
          trendMap.set(date, {
            impressions: 0,
            reach: 0,
            engagement: 0,
            platformSplit: { facebook: 0, instagram: 0, threads: 0 },
          });
        }

        const trend = trendMap.get(date)!;
        trend.impressions += snapshot.impressions || 0;
        trend.reach += snapshot.reach || 0;
        trend.engagement += snapshot.engagement || 0;
        trend.platformSplit[platform as Platform] =
          (trend.platformSplit[platform as Platform] || 0) + 1;
      });
    });

    return Array.from(trendMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Get top products by engagement.
   * Extracts product name from draft topic field.
   */
  async getTopProducts(startDate: Date, endDate: Date, limit = 5) {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    const { data: lifecycles, error } = await this.supabase
      .from('sma_content_lifecycles')
      .select('*')
      .gte('assembled_at', start)
      .lte('assembled_at', end);

    if (error) {
      throw new Error(`Failed to fetch top products: ${error.message}`);
    }

    // Parse products from lifecycle intent.topic field
    const productMap = new Map<string, {
      posts_count: number;
      total_engagement: number;
      total_impressions: number;
    }>();

    (lifecycles || []).forEach((row: any) => {
      const lifecycle = row.lifecycle_record as ContentLifecycle;
      const topic = lifecycle.intent?.topic || '';

      // Simple extraction: assume first capitalized word or known product name
      const productMatch = topic.match(/\b([A-Z][a-z]+(?:flex|flow|care|care\+)?)/);
      const product = productMatch ? productMatch[1] : 'Other';

      if (!productMap.has(product)) {
        productMap.set(product, {
          posts_count: 0,
          total_engagement: 0,
          total_impressions: 0,
        });
      }

      const stats = productMap.get(product)!;
      stats.posts_count += 1;

      Object.values(lifecycle.initial_metrics || {}).forEach((snapshot: any) => {
        stats.total_engagement += snapshot.engagement || 0;
        stats.total_impressions += snapshot.impressions || 0;
      });
    });

    return Array.from(productMap.entries())
      .map(([product, stats]) => ({
        product,
        ...stats,
        avg_engagement:
          stats.posts_count > 0 ? Math.round(stats.total_engagement / stats.posts_count) : 0,
      }))
      .sort((a, b) => b.avg_engagement - a.avg_engagement)
      .slice(0, limit);
  }

  /**
   * Get posting patterns: best times to post by hour of day.
   * Returns engagement data grouped by hour (0-23).
   */
  async getPostingPatterns(startDate: Date, endDate: Date) {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    const { data: lifecycles, error } = await this.supabase
      .from('sma_content_lifecycles')
      .select('*')
      .gte('assembled_at', start)
      .lte('assembled_at', end);

    if (error) {
      throw new Error(`Failed to fetch posting patterns: ${error.message}`);
    }

    // Group by hour of day
    const hourMap = new Map<number, { post_count: number; total_engagement: number }>();

    for (let h = 0; h < 24; h++) {
      hourMap.set(h, { post_count: 0, total_engagement: 0 });
    }

    (lifecycles || []).forEach((row: any) => {
      const lifecycle = row.lifecycle_record as ContentLifecycle;
      if (!lifecycle.publications) return;

      Object.entries(lifecycle.publications).forEach(([platform, pub]) => {
        const publishResult = pub as PublishResult;
        const hour = new Date(publishResult.published_at).getUTCHours();
        const stats = hourMap.get(hour);
        if (!stats) return;

        stats.post_count += 1;

        const snapshot = lifecycle.initial_metrics?.[platform as Platform];
        if (snapshot) {
          stats.total_engagement += snapshot.engagement || 0;
        }
      });
    });

    return Array.from(hourMap.entries())
      .map(([hour, stats]) => ({
        hour,
        post_count: stats.post_count,
        avg_engagement: stats.post_count > 0 ? Math.round(stats.total_engagement / stats.post_count) : 0,
      }));
  }

  /**
   * Get platform breakdown: count of posts by platform.
   */
  async getPlatformBreakdown(startDate: Date, endDate: Date) {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    const { data: lifecycles, error } = await this.supabase
      .from('sma_content_lifecycles')
      .select('*')
      .gte('assembled_at', start)
      .lte('assembled_at', end);

    if (error) {
      throw new Error(`Failed to fetch platform breakdown: ${error.message}`);
    }

    const platformCounts: Record<Platform, number> = {
      facebook: 0,
      instagram: 0,
      threads: 0,
    };

    (lifecycles || []).forEach((row: any) => {
      const lifecycle = row.lifecycle_record as ContentLifecycle;
      Object.keys(lifecycle.publications || {}).forEach((p) => {
        platformCounts[p as Platform] = (platformCounts[p as Platform] || 0) + 1;
      });
    });

    return Object.entries(platformCounts).map(([platform, count]) => ({
      platform: platform as Platform,
      count,
    }));
  }

  /**
   * Get WhatsApp inquiry data from engagement snapshots with wa_link_clicks.
   */
  async getWhatsappInquiries(startDate: Date, endDate: Date) {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    const { data: lifecycles, error } = await this.supabase
      .from('sma_content_lifecycles')
      .select('*')
      .gte('assembled_at', start)
      .lte('assembled_at', end);

    if (error) {
      throw new Error(`Failed to fetch whatsapp inquiries: ${error.message}`);
    }

    let totalClicks = 0;
    let totalImpressions = 0;

    (lifecycles || []).forEach((row: any) => {
      const lifecycle = row.lifecycle_record as ContentLifecycle;
      Object.values(lifecycle.initial_metrics || {}).forEach((snapshot: any) => {
        totalClicks += snapshot.wa_link_clicks || 0;
        totalImpressions += snapshot.impressions || 0;
      });
    });

    return {
      total_clicks: totalClicks,
      total_impressions: totalImpressions,
      conversion_rate: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0',
    };
  }
}

// ── Audit Logger Interface (separate concern) ────────────────────────

/**
 * Lightweight audit-logging interface. Implementation lives in
 * lib/sma/coordinator/audit.ts. Decoupled here so the Coordinator
 * can be tested with a mock logger.
 */
export interface AuditLogger {
  logTaskIssued(taskId: string, intent: ContentIntent, platforms: Platform[]): Promise<void>;
  logHandoff(record: HandoffRecord): Promise<void>;
  logApprovalRequested(taskId: string, reason: PauseReason): Promise<void>;
  logApprovalDecision(taskId: string, approval: ApprovalRecord): Promise<void>;
  logLifecycleAssembled(lifecycle: ContentLifecycle): Promise<void>;
  logPublished(taskId: string, platforms: Platform[]): Promise<void>;
  logEngagementRecorded(taskId: string, platform: Platform, snapshot: EngagementSnapshot): Promise<void>;
  logImmutableStopViolation(stop: 1 | 2 | 3 | 4 | 5, detail: string): Promise<void>;
}
