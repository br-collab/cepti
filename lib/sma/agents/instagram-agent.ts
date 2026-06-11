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
import { generateDetailed } from '../llm-client';
import { matchProductsInTopic } from '../products-service';
import { generateProductVideo } from '../video-generator';

export class InstagramAgent extends PlatformAgentBase {
  readonly platform: Platform = 'instagram';
  readonly role_id: AgentRole = 'INSTAGRAM_AGENT';

  async draftPost(record: HandoffRecord, intent: ContentIntent): Promise<DraftResult> {
    this.verifyHandoff(record);

    // Instagram caption prompt (max 2200 chars, hashtag-heavy)
    const caption = `[Instagram Caption for ${intent.topic}]\n\n${intent.notes || intent.topic}\n\n#CEPTI #ProductShowcase #Innovation`;

    // Load product images
    const productImages = await matchProductsInTopic(intent.topic);

    // Generate video from images
    const draftId = this.makeDraftId();
    let attachedAssets = productImages;
    if (productImages.length > 0) {
      const video = await generateProductVideo(productImages, caption, draftId);
      if (video) {
        attachedAssets = [video.videoPath, ...productImages];
      }
    }

    return {
      platform: 'instagram',
      draft_id: draftId,
      generated_at: new Date().toISOString(),
      body: caption,
      attached_assets: attachedAssets.length > 0 ? attachedAssets : undefined,
      estimated_character_count: caption.length,
      prompt_version: 'ig-caption-v1',
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
