/**
 * lib/sma/agents/platform-base.ts
 *
 * Shared interface and base class for the three platform agents
 * (Facebook, Instagram, Threads). Each platform implements this
 * interface with platform-specific prompts, API client, and
 * constraints.
 *
 * Per Immutable Stop 3, all platform agent methods that take action
 * require a HandoffRecord from the Coordinator. The base class
 * verifies the record before delegating to the subclass.
 */

import type {
  AgentRole,
  DraftResult,
  EngagementSnapshot,
  HandoffRecord,
  InboundComment,
  ContentIntent,
  PublishResult,
  Platform,
} from '../coordinator/types';
import { HandoffNotAuthorizedError } from '../coordinator/types';

// ── Approved Draft (post-approval marker) ────────────────────────────

/**
 * A DraftResult that has been approved by Bill or Francisco.
 * Created by the Coordinator after resumeLifecycle() with APPROVE.
 * Platform agents publish only ApprovedDraft, never raw DraftResult.
 */
export interface ApprovedDraft extends DraftResult {
  approval_record_id: string;
  approved_by: 'bill' | 'francisco';
  approved_at: string;
}

// ── PlatformAgent Interface ──────────────────────────────────────────

export interface PlatformAgent {
  readonly platform: Platform;
  readonly role_id: AgentRole;

  /**
   * Generate a draft post for the given intent. Returns a DraftResult.
   * Per Immutable Stop 3, the handoff record is verified before drafting.
   *
   * @param handoffRecord Coordinator-issued dispatch
   * @param intent The content intent to draft for
   */
  draftPost(
    handoffRecord: HandoffRecord,
    intent: ContentIntent,
  ): Promise<DraftResult>;

  /**
   * Generate a draft reply to an inbound comment or mention.
   *
   * @param handoffRecord Coordinator-issued dispatch
   * @param inbound The comment/mention to reply to
   */
  draftReply(
    handoffRecord: HandoffRecord,
    inbound: InboundComment,
  ): Promise<DraftResult>;

  /**
   * Publish an approved draft to the platform.
   * Per Immutable Stop 3, the handoff record is verified.
   * Per Immutable Stop 1, only this method (inside a platform agent)
   * calls Meta's publish APIs — never the Coordinator.
   *
   * @param handoffRecord Coordinator-issued dispatch
   * @param approvedDraft Draft that has been approved by Bill/Francisco
   */
  publish(
    handoffRecord: HandoffRecord,
    approvedDraft: ApprovedDraft,
  ): Promise<PublishResult>;

  /**
   * Fetch engagement metrics for a previously published post.
   * Read-only — does not require handoff record (it's not a state-changing action).
   *
   * @param platformPostId The platform-assigned ID from PublishResult
   */
  fetchEngagement(platformPostId: string): Promise<EngagementSnapshot>;
}

// ── Base Class (shared verification logic) ───────────────────────────

/**
 * Abstract base. Subclasses implement draftPost, draftReply, publish,
 * fetchEngagement. The base provides handoff verification.
 */
export abstract class PlatformAgentBase implements PlatformAgent {
  abstract readonly platform: Platform;
  abstract readonly role_id: AgentRole;

  abstract draftPost(record: HandoffRecord, intent: ContentIntent): Promise<DraftResult>;
  abstract draftReply(record: HandoffRecord, inbound: InboundComment): Promise<DraftResult>;
  abstract publish(record: HandoffRecord, approvedDraft: ApprovedDraft): Promise<PublishResult>;
  abstract fetchEngagement(platformPostId: string): Promise<EngagementSnapshot>;

  /**
   * Generate a draft ID: DFT-YYYYMMDD_xxxxxx (6-char alphanumeric suffix).
   * Shared across all platform agents — defined once here.
   */
  protected makeDraftId(): string {
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
    return `DFT-${dateStr}_${suffix}`;
  }

  /**
   * Verifies that a HandoffRecord is Coordinator-authorized and
   * targets this agent. Throws HandoffNotAuthorizedError if invalid.
   *
   * Called as the first line of every state-changing method in
   * concrete subclasses.
   */
  protected verifyHandoff(record: HandoffRecord): void {
    if (record.coordinator_authorized !== true) {
      throw new HandoffNotAuthorizedError(record.handoff_id);
    }
    if (record.to_agent !== this.role_id) {
      throw new HandoffNotAuthorizedError(record.handoff_id);
    }
    if (record.status !== 'ISSUED' && record.status !== 'ACTIVE') {
      throw new HandoffNotAuthorizedError(record.handoff_id);
    }
  }
}
