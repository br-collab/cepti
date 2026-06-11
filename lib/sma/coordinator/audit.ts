/**
 * lib/sma/coordinator/audit.ts
 *
 * AuditLogger implementation: ConsoleAuditLogger.
 *
 * Per Immutable Stop 4, audit logging outputs structured JSON lines to console only.
 * No database writes from this layer. The Coordinator's assembleLifecycle() method
 * writes the curated ContentLifecycle to sma_content_lifecycles once per task,
 * not incremental event rows.
 *
 * This enables swapping a DB-backed implementation later without changing issueTask().
 */

import type {
  ApprovalRecord,
  ContentIntent,
  ContentLifecycle,
  HandoffRecord,
  Platform,
  PauseReason,
} from './types';
import type { AuditLogger } from './coordinator';

export class ConsoleAuditLogger implements AuditLogger {
  private logJSON(event: string, payload: Record<string, unknown>): void {
    const entry = {
      ts: new Date().toISOString(),
      event,
      ...payload,
    };
    console.log(JSON.stringify(entry));
  }

  async logTaskIssued(taskId: string, intent: ContentIntent, platforms: Platform[]): Promise<void> {
    this.logJSON('TASK_ISSUED', {
      taskId,
      intentId: intent.intent_id,
      proposedBy: intent.proposed_by,
      topic: intent.topic,
      platforms,
    });
  }

  async logHandoff(record: HandoffRecord): Promise<void> {
    this.logJSON('HANDOFF_RECORDED', {
      handoffId: record.handoff_id,
      taskId: record.task_id,
      fromAgent: record.from_agent,
      toAgent: record.to_agent,
      status: record.status,
      handoffReason: record.handoff_reason,
    });
  }

  async logApprovalRequested(taskId: string, reason: PauseReason): Promise<void> {
    this.logJSON('APPROVAL_REQUESTED', {
      taskId,
      reason,
    });
  }

  async logApprovalDecision(taskId: string, approval: ApprovalRecord): Promise<void> {
    this.logJSON('APPROVAL_DECISION', {
      taskId,
      decidedBy: approval.decided_by,
      decision: approval.decision,
      rationale: approval.rationale,
    });
  }

  async logLifecycleAssembled(lifecycle: ContentLifecycle): Promise<void> {
    this.logJSON('LIFECYCLE_ASSEMBLED', {
      taskId: lifecycle.task_id,
      status: lifecycle.status,
      draftCount: Object.keys(lifecycle.drafts).length,
      publicationCount: Object.keys(lifecycle.publications).length,
      approvalCount: lifecycle.approvals.length,
      lineageHash: lifecycle.lineage_hash,
    });
  }

  async logPublished(taskId: string, platforms: Platform[]): Promise<void> {
    this.logJSON('CONTENT_PUBLISHED', {
      taskId,
      platforms,
      platformCount: platforms.length,
    });
  }

  async logImmutableStopViolation(
    stop: 1 | 2 | 3 | 4 | 5,
    detail: string,
  ): Promise<void> {
    this.logJSON('IMMUTABLE_STOP_VIOLATION', {
      stopNumber: stop,
      detail,
    });
  }
}
