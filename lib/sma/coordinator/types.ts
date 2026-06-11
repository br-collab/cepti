/**
 * lib/sma/coordinator/types.ts
 *
 * Shared TypeScript types for the SMA Coordinator and platform agents.
 * Derived from architecture-v2.md Section 4.
 *
 * Conventions:
 *   - All timestamps are ISO 8601 strings in UTC.
 *   - All IDs are prefixed with their type (TSK-, HO-, PLF-, INT-).
 *   - Status string unions use SCREAMING_SNAKE_CASE.
 *   - Records destined for Supabase use snake_case field names to match
 *     the SQL schema. Internal-only types use camelCase.
 */

// ── Platforms and Agents ─────────────────────────────────────────────

export type Platform = 'facebook' | 'instagram' | 'threads';

export type AgentRole =
  | 'COORDINATOR'
  | 'FACEBOOK_AGENT'
  | 'INSTAGRAM_AGENT'
  | 'THREADS_AGENT';

export const PLATFORM_TO_AGENT: Record<Platform, AgentRole> = {
  facebook: 'FACEBOOK_AGENT',
  instagram: 'INSTAGRAM_AGENT',
  threads: 'THREADS_AGENT',
};

// ── Lifecycle Status ─────────────────────────────────────────────────

export type TaskStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETE' | 'DENIED' | 'FAILED';

export type HandoffStatus =
  | 'ISSUED'      // Coordinator dispatched, agent has not acknowledged
  | 'ACTIVE'      // Agent acknowledged and is working
  | 'COMPLETE'    // Agent returned telemetry, handoff closed
  | 'ESCALATED'   // Agent triggered escalation
  | 'FAILED';     // Agent failed, fallback or suspend

export type PauseReason =
  | 'AWAITING_DRAFT_APPROVAL'    // Bill/Francisco must approve draft before publish
  | 'AWAITING_TOPIC_APPROVAL'    // Bill/Francisco must approve a proposed topic
  | 'AWAITING_REPLY_APPROVAL'    // Bill/Francisco must approve a comment reply
  | 'GUARDRAIL_TRIGGERED'        // Five Immutable Stops violation candidate
  | 'PLATFORM_ERROR';            // Platform API failed, need human decision

// ── Content Intent ───────────────────────────────────────────────────

/**
 * Originating intent for a content lifecycle. Created by Bill or Francisco
 * via the /admin/sma dashboard, optionally with an attached image asset.
 */
export interface ContentIntent {
  intent_id: string;                   // INT-XXXX
  proposed_by: 'bill' | 'francisco';
  proposed_at: string;                 // ISO timestamp
  topic: string;                       // Short description of the content idea
  notes?: string;                      // Additional context for the platform agents
  proposed_platforms: Platform[];      // Which platforms to draft for
  scheduled_for?: string | null;       // ISO timestamp; null = ASAP after approval
  reference_assets?: string[];         // Supabase storage paths to images
}

// ── Handoff Records ──────────────────────────────────────────────────

/**
 * Records the transfer of a lifecycle object between agents. Every
 * platform agent action requires a valid HandoffRecord per Immutable
 * Stop 3.
 */
export interface HandoffRecord {
  handoff_id: string;                  // HO-XXXXXXXXXX
  task_id: string;                     // TSK-XXXXXXXXXXXX
  ts: string;                          // ISO timestamp
  from_agent: AgentRole;
  to_agent: AgentRole;
  payload: unknown;                    // Type depends on from/to combination
  handoff_reason: string;              // Human-readable for audit log
  status: HandoffStatus;
  coordinator_authorized: true;        // Always true; type literal enforces it
}

// ── Agent Telemetry ──────────────────────────────────────────────────

/**
 * Output from a platform agent after completing a task. Recorded by the
 * Coordinator via recordTelemetry(). Raw telemetry never goes to audit
 * (Immutable Stop 4); only the assembled ContentLifecycle does.
 */
export interface AgentTelemetry {
  agent: AgentRole;
  received_at: string;                 // ISO timestamp
  duration_ms: number;
  data: unknown;                       // Agent-specific payload
}

// ── Draft and Publish Results ────────────────────────────────────────

export interface DraftImage {
  url: string;                         // Relative path from /public or full URL
  productName: string;                 // Product being featured
  caption?: string;                    // Optional image-specific caption
}

export interface DraftVideo {
  url: string;                         // Relative path from /public or full URL
  duration: number;                    // Duration in seconds
  thumbnail: string;                   // Thumbnail image URL
}

export interface DraftResult {
  platform: Platform;
  draft_id: string;                    // DFT-XXXX
  generated_at: string;
  body: string;                        // Caption / post text
  hashtags?: string[];
  images?: DraftImage[];               // Product images to accompany the post
  video?: DraftVideo;                  // Generated video (optional)
  attached_assets?: string[];          // Storage paths
  estimated_character_count: number;
  prompt_version: string;              // Which prompt template was used
  model: string;                       // e.g. "claude-sonnet-4-7"
  tokens_input: number;
  tokens_output: number;
}

export interface PublishResult {
  platform: Platform;
  platform_post_id: string;            // Meta-assigned ID after publish
  published_at: string;
  permalink: string;                   // URL to the published post
  publish_response: unknown;           // Raw API response from Meta
}

export interface EngagementSnapshot {
  platform: Platform;
  platform_post_id: string;
  snapshot_at: string;                 // 24h after publish, typically
  impressions?: number;
  reach?: number;
  engagement?: number;
  comments_count?: number;
  shares_count?: number;
  saves_count?: number;
  wa_link_clicks?: number;             // From wa-link.ts attribution
}

// ── Approval Records ─────────────────────────────────────────────────

export type ApprovalDecision = 'APPROVE' | 'DENY';

export interface ApprovalRecord {
  task_id: string;
  decision: ApprovalDecision;
  decided_by: 'bill' | 'francisco';
  decided_at: string;                  // ISO timestamp
  rationale: string;                   // Required: short note from the approver
}

// ── Content Lifecycle (the Audit Record) ─────────────────────────────

/**
 * The single curated record per content lifecycle. Assembled by the
 * Coordinator from agent telemetry, approvals, and publish results.
 * Per Immutable Stop 4, this is the only thing that goes to the audit
 * log — never raw agent telemetry.
 */
export interface ContentLifecycle {
  task_id: string;
  intent: ContentIntent;
  drafts: Partial<Record<Platform, DraftResult>>;
  approvals: ApprovalRecord[];
  publications: Partial<Record<Platform, PublishResult>>;
  initial_metrics: Partial<Record<Platform, EngagementSnapshot>>;
  lineage_hash: string;                // SHA-256 over the lifecycle content
  assembled_at: string;
  status: TaskStatus;
}

// ── Approval Context (for Immutable Stop 5) ──────────────────────────

/**
 * Bundled context surfaced to Bill/Francisco when the Coordinator
 * requests approval. Per Immutable Stop 5, approval requests never
 * arrive without all needed context.
 */
export interface ApprovalContext {
  task_id: string;
  reason: PauseReason;
  intent: ContentIntent;
  draft: DraftResult;                  // The draft awaiting approval
  platform: Platform;
  scheduled_for: string | null;
  prior_metrics_for_platform?: EngagementSnapshot[];  // Recent posts for context
  related_paused_count: number;        // How many other items also paused
}

// ── Coordinator Status (for Dashboard) ───────────────────────────────

export interface CoordinatorStatus {
  active_tasks: number;
  paused_tasks: number;
  completed_tasks_24h: number;
  pending_approvals: number;
  handoffs_24h: number;
  escalations_24h: number;
  oldest_pending_approval_age_minutes?: number;
}

// ── Inbound Content (for Reply Drafts) ───────────────────────────────

/**
 * Inbound comment, mention, or interaction that triggers a reply draft.
 * Sourced from platform webhook payloads.
 */
export interface InboundComment {
  platform: Platform;
  platform_comment_id: string;
  platform_post_id: string;            // Which post is being commented on
  commenter_name?: string;
  commenter_username?: string;
  body: string;
  received_at: string;
  sentiment_hint?: 'positive' | 'neutral' | 'negative' | 'question';
}

// ── Pause-Resume Payload ─────────────────────────────────────────────

export interface PausedLifecycle {
  task_id: string;
  pause_reason: PauseReason;
  paused_at: string;
  context: ApprovalContext;
  resumed_at?: string;
  approver_id?: string;                // Supabase Auth user_id from sma_admins
  approval_decision?: ApprovalDecision;
  approval_rationale?: string;
}

// ── Result From resumeLifecycle() ────────────────────────────────────

export type ResumeResult =
  | { status: 'COMPLETE'; task_id: string; lifecycle: ContentLifecycle }
  | { status: 'DENIED'; task_id: string; rationale: string }
  | { status: 'NOT_FOUND'; task_id: string }
  | { status: 'INVALID_APPROVAL'; task_id: string; missing: string[] };

// ── Errors ───────────────────────────────────────────────────────────

export class ImmutableStopViolation extends Error {
  constructor(
    public readonly stop_number: 1 | 2 | 3 | 4 | 5,
    public readonly violation_detail: string,
  ) {
    super(`Immutable Stop ${stop_number} violation: ${violation_detail}`);
    this.name = 'ImmutableStopViolation';
  }
}

export class HandoffNotAuthorizedError extends Error {
  constructor(public readonly handoff_id: string) {
    super(`Handoff ${handoff_id} is not Coordinator-authorized — rejected.`);
    this.name = 'HandoffNotAuthorizedError';
  }
}

export class TaskNotFoundError extends Error {
  constructor(public readonly task_id: string) {
    super(`Task ${task_id} not found in Coordinator registry.`);
    this.name = 'TaskNotFoundError';
  }
}
