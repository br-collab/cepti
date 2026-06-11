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

import fs from 'fs';
import path from 'path';
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

    // Load engagement framework and Instagram-specific prompt
    const frameworkPath = path.join(process.cwd(), 'prompts/engagement-framework.md');
    const promptPath = path.join(process.cwd(), 'prompts/instagram/caption-v2.md');

    const framework = fs.readFileSync(frameworkPath, 'utf-8');
    const promptTemplate = fs.readFileSync(promptPath, 'utf-8');

    // Build comprehensive system prompt
    const systemPrompt = `You are an expert Instagram content strategist with 10+ years of experience creating viral, aspirational content.\n\n${framework}\n\n${promptTemplate}`;

    // Build user message
    const userMessage = `Write a compelling Instagram caption using the engagement framework:\n\nProduct: ${intent.topic}\nContext: ${intent.notes || 'Showcase the transformation this product enables'}\n\nRemember: Aspirational, visual-first storytelling. Include strategic hashtags.`;

    // Generate caption via LLM
    const result = await generateDetailed({
      system: systemPrompt,
      userMessage,
      maxTokens: 512,
    });

    const caption = result.text;

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
        const video = await generateProductVideo(productImages, caption, draftId);
        if (video) {
          attachedAssets = [video.videoPath, ...productImages];
        }
      }
    }

    return {
      platform: 'instagram',
      draft_id: draftId,
      generated_at: new Date().toISOString(),
      body: caption,
      attached_assets: attachedAssets.length > 0 ? attachedAssets : undefined,
      estimated_character_count: caption.length,
      prompt_version: 'ig-caption-v2',
      model: result.model,
      tokens_input: result.inputTokens,
      tokens_output: result.outputTokens,
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
