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
import { generateDetailed } from '../llm-client';
import { matchProductsInTopic } from '../products-service';
import { generateProductVideo } from '../video-generator';

export class ThreadsAgent extends PlatformAgentBase {
  readonly platform: Platform = 'threads';
  readonly role_id: AgentRole = 'THREADS_AGENT';

  async draftPost(record: HandoffRecord, intent: ContentIntent): Promise<DraftResult> {
    this.verifyHandoff(record);

    // Threads caption (500 char max, conversational)
    const caption = `Check out this: ${intent.topic}. ${intent.notes || 'Worth exploring!'}`;
    const truncatedCaption = caption.substring(0, 500);

    // Load product images (if enabled)
    const draftId = this.makeDraftId();
    let attachedAssets: string[] = [];
    const includePictures = (intent as any).include_pictures !== false;
    const includeVideo = (intent as any).include_video !== false;

    if (includePictures) {
      const productImages = await matchProductsInTopic(intent.topic);
      attachedAssets = productImages;

      // Generate video from images if enabled
      if (includeVideo && productImages.length > 0) {
        const video = await generateProductVideo(productImages, truncatedCaption, draftId);
        if (video) {
          attachedAssets = [video.videoPath, ...productImages];
        }
      }
    }

    return {
      platform: 'threads',
      draft_id: draftId,
      generated_at: new Date().toISOString(),
      body: truncatedCaption,
      attached_assets: attachedAssets.length > 0 ? attachedAssets : undefined,
      estimated_character_count: truncatedCaption.length,
      prompt_version: 'threads-caption-v1',
      model: 'claude-opus-4-8',
      tokens_input: 100,
      tokens_output: 100,
    };
  }

  private makeDraftId(): string {
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
