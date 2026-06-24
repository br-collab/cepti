/**
 * lib/sma/coordinator/guardrails.ts
 *
 * The Five Immutable Stops, enforced in code rather than relying on
 * documentation alone. Every PR that touches the SMA layer should be
 * reviewable against these checks.
 *
 * These functions are pure — no side effects, no I/O. They throw
 * ImmutableStopViolation when a violation is detected. Callers (the
 * Coordinator and platform agents) invoke them at the appropriate
 * action boundaries.
 */

import type {
  AgentRole,
  ApprovalContext,
  ContentLifecycle,
  HandoffRecord,
  Platform,
} from './types';
import { ImmutableStopViolation } from './types';

// ── Stop 1: No Self-Publishing ───────────────────────────────────────

/**
 * Asserts that the caller is a platform agent (not the Coordinator)
 * before allowing a publish action.
 *
 * @throws ImmutableStopViolation if caller is COORDINATOR
 */
export function assertNotSelfPublishing(callerRole: AgentRole): void {
  if (callerRole === 'COORDINATOR') {
    throw new ImmutableStopViolation(
      1,
      'Coordinator attempted to publish directly. ' +
        'Publishing must be delegated to a platform agent.',
    );
  }
}

// ── Stop 2: No Content Authorship by Coordinator ─────────────────────

/**
 * Asserts that the caller is NOT the Coordinator before allowing
 * content generation (LLM calls for captions, replies, etc.).
 *
 * @throws ImmutableStopViolation if caller is COORDINATOR
 */
export function assertNotCoordinatorAuthorship(callerRole: AgentRole): void {
  if (callerRole === 'COORDINATOR') {
    throw new ImmutableStopViolation(
      2,
      'Coordinator attempted to generate content directly. ' +
        'Content authorship belongs to platform agents.',
    );
  }
}

// ── Stop 3: No Platform Action Without Dispatch Record ───────────────

/**
 * Asserts that the HandoffRecord is Coordinator-authorized and routes
 * to the expected receiving agent.
 *
 * @throws ImmutableStopViolation if record is invalid
 */
export function assertValidHandoff(
  record: HandoffRecord,
  expectedReceiver: AgentRole,
): void {
  if (record.coordinator_authorized !== true) {
    throw new ImmutableStopViolation(
      3,
      `HandoffRecord ${record.handoff_id} is not Coordinator-authorized.`,
    );
  }
  if (record.to_agent !== expectedReceiver) {
    throw new ImmutableStopViolation(
      3,
      `HandoffRecord ${record.handoff_id} targets ${record.to_agent}, ` +
        `but caller is ${expectedReceiver}.`,
    );
  }
}

// ── Stop 4: One Audit Record Per Content Lifecycle ───────────────────

/**
 * Asserts that the destination of a write is the curated audit table
 * (sma_content_lifecycles) and not raw telemetry. Used by the audit
 * logger before persisting.
 *
 * @param destinationTable The Supabase table being written to
 * @throws ImmutableStopViolation if writing raw telemetry to audit
 */
export function assertAuditTableOnly(destinationTable: string): void {
  const ALLOWED_AUDIT_TABLES = ['sma_content_lifecycles', 'sma_handoffs'];
  if (!ALLOWED_AUDIT_TABLES.includes(destinationTable)) {
    throw new ImmutableStopViolation(
      4,
      `Attempted to write audit-class data to ${destinationTable}. ` +
        `Allowed: ${ALLOWED_AUDIT_TABLES.join(', ')}.`,
    );
  }
}

/**
 * Asserts that the assembled ContentLifecycle is the only thing
 * pushed for a given task_id.
 */
export function assertLifecycleNotDuplicated(
  taskId: string,
  existingLifecycles: { task_id: string }[],
): void {
  const duplicate = existingLifecycles.find((l) => l.task_id === taskId);
  if (duplicate) {
    throw new ImmutableStopViolation(
      4,
      `ContentLifecycle for task ${taskId} already exists; refusing duplicate.`,
    );
  }
}

// ── Stop 5: No Approval Request Without Full Context ─────────────────

/**
 * Asserts that an ApprovalContext bundle contains all required fields
 * before surfacing to the dashboard.
 *
 * @throws ImmutableStopViolation if context is missing critical fields
 */
export function assertApprovalContextComplete(context: ApprovalContext): void {
  const missing: string[] = [];
  if (!context.task_id) missing.push('task_id');
  if (!context.intent) missing.push('intent');
  if (!context.draft) missing.push('draft');
  if (!context.platform) missing.push('platform');
  if (!context.reason) missing.push('reason');

  if (missing.length > 0) {
    throw new ImmutableStopViolation(
      5,
      `ApprovalContext missing required fields: ${missing.join(', ')}. ` +
        'Approval requests must bundle complete context.',
    );
  }
}
