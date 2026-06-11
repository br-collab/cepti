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
  ContentIntent,
  ContentLifecycle,
  CoordinatorStatus,
  HandoffRecord,
  PausedLifecycle,
  PauseReason,
  Platform,
  ResumeResult,
} from './types';
import { PLATFORM_AGENTS } from './registry';
import { ConsoleAuditLogger } from './audit';

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
    _taskId: string,
    _reason: PauseReason,
    _context: ApprovalContext,
  ): Promise<void> {
    throw new Error('NOT_IMPLEMENTED: requestApproval');
  }

  // ─── Pause / Resume ─────────────────────────────────────────────────

  /**
   * Pause a lifecycle. Persists to sma_paused_lifecycles. Dashboard
   * surfaces these as the approval queue.
   */
  async pauseLifecycle(
    _taskId: string,
    _reason: PauseReason,
    _context: ApprovalContext,
  ): Promise<void> {
    throw new Error('NOT_IMPLEMENTED: pauseLifecycle');
  }

  /**
   * Resume a paused lifecycle with the approver's decision. On
   * APPROVE, the appropriate platform agent is dispatched to publish.
   * On DENY, the lifecycle terminates and the audit record reflects
   * denial.
   *
   * Validates that attribution contains approver_id (from sma_admins)
   * and rationale before acting.
   */
  async resumeLifecycle(
    _taskId: string,
    _decision: 'APPROVE' | 'DENY',
    _attribution: {
      approver_id: string;
      rationale: string;
    },
  ): Promise<ResumeResult> {
    throw new Error('NOT_IMPLEMENTED: resumeLifecycle');
  }

  /**
   * List all currently paused lifecycles. Used by the
   * /admin/sma/approval-queue page.
   */
  async listPausedLifecycles(): Promise<PausedLifecycle[]> {
    throw new Error('NOT_IMPLEMENTED: listPausedLifecycles');
  }

  /**
   * Coordinator status snapshot for the dashboard. Counts active tasks,
   * paused tasks, recent handoffs, etc.
   */
  async getStatus(): Promise<CoordinatorStatus> {
    throw new Error('NOT_IMPLEMENTED: getStatus');
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
  logImmutableStopViolation(stop: 1 | 2 | 3 | 4 | 5, detail: string): Promise<void>;
}
