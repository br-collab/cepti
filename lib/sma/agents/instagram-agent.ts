/**
 * lib/sma/agents/instagram-agent.ts
 *
 * Instagram platform agent. Drafts captions and reply text for
 * @cepti_rd, publishes approved content via Graph API v25.0
 * (through the IG sub-app, App ID 1361461932563029).
 *
 * Platform constraints (per architecture-v2.md Section 5):
 *   - 2,200 character caption limit
 *   - Hashtag-heavy convention (up to 30)
 *   - First 125 characters are the preview cutoff
 *   - Audience: 1,300 followers (May 2026) — primary CEPTI audience
 *   - Tone: visual-first, aspirational, hashtag-rich
 *
 * Out of scope for this agent (per CLAUDE.md):
 *   - DM handling (instagram_business_manage_messages was removed
 *     during App rebuild on 2026-05-24)
 *
 * Meta permissions used:
 *   - instagram_business_basic
 *   - instagram_business_content_publish
 *   - instagram_business_manage_comments
 *   - instagram_business_manage_insights
 *   - instagram_manage_comments (kept for write access to replies)
 *
 * Prompt directory: prompts/instagram/
 *   - caption.md
 *   - reply.md
 *   - carousel-caption.md
 *   - reel-caption.md
 */

import type {
  AgentRole,
  DraftResult,
  EngagementSnapshot,
  HandoffRecord,
  InboundComment,
  ContentIntent,
  Platform,
  PublishResult,
} from '../coordinator/types';
import { PlatformAgentBase, ApprovedDraft } from './platform-base';

export class InstagramAgent extends PlatformAgentBase {
  readonly platform: Platform = 'instagram';
  readonly role_id: AgentRole = 'INSTAGRAM_AGENT';

  async draftPost(record: HandoffRecord, intent: ContentIntent): Promise<DraftResult> {
    this.verifyHandoff(record);
    throw new Error('NOT_IMPLEMENTED: InstagramAgent.draftPost');
  }

  async draftReply(record: HandoffRecord, inbound: InboundComment): Promise<DraftResult> {
    this.verifyHandoff(record);
    throw new Error('NOT_IMPLEMENTED: InstagramAgent.draftReply');
  }

  async publish(record: HandoffRecord, approvedDraft: ApprovedDraft): Promise<PublishResult> {
    this.verifyHandoff(record);
    // IMMUTABLE STOP 1 enforcement note:
    // This is the ONLY place in the SMA codebase where Instagram publish
    // APIs are called. The Coordinator never calls them directly.
    throw new Error('NOT_IMPLEMENTED: InstagramAgent.publish');
  }

  async fetchEngagement(platformPostId: string): Promise<EngagementSnapshot> {
    throw new Error('NOT_IMPLEMENTED: InstagramAgent.fetchEngagement');
  }
}
