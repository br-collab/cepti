/**
 * lib/sma/agents/threads-agent.ts
 *
 * Threads platform agent. Drafts posts and reply text for CEPTI's
 * Threads presence, publishes via the Threads API (separate base URL
 * from graph.facebook.com).
 *
 * Platform constraints (per architecture-v2.md Section 5):
 *   - 500 character post limit
 *   - Thread chaining supported (multi-post sequences)
 *   - Audience: small but engaged Threads user base
 *   - Tone: conversational, opinion-friendly, less polished than IG
 *
 * Meta permissions used (Threads sub-app, App ID 993854629684330):
 *   - threads_basic
 *   - threads_content_publish
 *   - threads_keyword_search
 *   - threads_manage_insights
 *   - threads_manage_mentions
 *   - threads_manage_replies
 *   - threads_profile_discovery
 *   - threads_read_replies
 *
 * Prompt directory: prompts/threads/
 *   - post.md
 *   - reply.md
 *   - thread-chain.md
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

export class ThreadsAgent extends PlatformAgentBase {
  readonly platform: Platform = 'threads';
  readonly role_id: AgentRole = 'THREADS_AGENT';

  async draftPost(record: HandoffRecord, intent: ContentIntent): Promise<DraftResult> {
    this.verifyHandoff(record);
    throw new Error('NOT_IMPLEMENTED: ThreadsAgent.draftPost');
  }

  async draftReply(record: HandoffRecord, inbound: InboundComment): Promise<DraftResult> {
    this.verifyHandoff(record);
    throw new Error('NOT_IMPLEMENTED: ThreadsAgent.draftReply');
  }

  async publish(record: HandoffRecord, approvedDraft: ApprovedDraft): Promise<PublishResult> {
    this.verifyHandoff(record);
    // IMMUTABLE STOP 1 enforcement note:
    // This is the ONLY place in the SMA codebase where Threads publish
    // APIs are called. The Coordinator never calls them directly.
    throw new Error('NOT_IMPLEMENTED: ThreadsAgent.publish');
  }

  async fetchEngagement(platformPostId: string): Promise<EngagementSnapshot> {
    throw new Error('NOT_IMPLEMENTED: ThreadsAgent.fetchEngagement');
  }
}
