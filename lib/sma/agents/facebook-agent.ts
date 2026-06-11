/**
 * lib/sma/agents/facebook-agent.ts
 *
 * Facebook platform agent. Drafts posts and reply text for the CEPTI
 * Facebook Page, publishes approved content via Graph API v25.0.
 *
 * Platform constraints (per architecture-v2.md Section 5):
 *   - Long-form posts work well (no hard character limit issue)
 *   - Link previews auto-generated; external links freely usable
 *   - Audience: 12 followers (May 2026), Spanish-speaking
 *   - Tone: professional, descriptive, slightly formal
 *
 * Meta permissions used (from CEPTI SMA v2 App):
 *   - pages_manage_posts
 *   - pages_read_engagement
 *   - pages_read_user_content
 *   - pages_manage_metadata
 *   - pages_show_list
 *   - business_management (kept per 2026-05-24 decision)
 *
 * Prompt directory: prompts/facebook/
 *   - caption.md
 *   - reply.md
 *   - product-feature.md
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

export class FacebookAgent extends PlatformAgentBase {
  readonly platform: Platform = 'facebook';
  readonly role_id: AgentRole = 'FACEBOOK_AGENT';

  async draftPost(record: HandoffRecord, intent: ContentIntent): Promise<DraftResult> {
    this.verifyHandoff(record);

    // Load engagement framework and platform-specific prompt
    const frameworkPath = path.join(process.cwd(), 'prompts/engagement-framework.md');
    const promptPath = path.join(process.cwd(), 'prompts/facebook/caption-v2.md');

    const framework = fs.readFileSync(frameworkPath, 'utf-8');
    const promptTemplate = fs.readFileSync(promptPath, 'utf-8');

    // Build comprehensive system prompt with framework + platform strategy
    const systemPrompt = `You are an expert social media marketer with 10+ years of experience in creating engaging, conversion-focused content.\n\n${framework}\n\n${promptTemplate}`;

    // Build user message from template placeholders
    const userMessage = `Write a compelling Facebook caption using the engagement framework (Hook → Benefit → Social Proof → CTA):\n\nProduct: ${intent.topic}\nContext: ${intent.notes || 'General product promotion'}\n\nRemember: Hook first, build trust, make it conversational and warm.`;

    // Generate caption via LLM
    const result = await generateDetailed({
      system: systemPrompt,
      userMessage,
      maxTokens: 512,
    });

    // Build wa.me link with task_id attribution
    // Per CLAUDE.md: WhatsApp number is +1 (829) 449-1104, stored as 18294491104
    const inquiryText = `Hola CEPTI, vi su publicación y me gustaría una cotización.`;
    const refTag = ` [ref:fb-post-${record.task_id}]`;
    const encodedMessage = encodeURIComponent(`${inquiryText}${refTag}`);
    const waLink = `https://wa.me/18294491104?text=${encodedMessage}`;

    // Append wa.me link to caption body
    const finalBody = `${result.text}\n\n${waLink}`;

    // Generate draft ID
    const draftId = this.makeDraftId();

    // Load product images matching the topic (if enabled)
    let attachedAssets: string[] = [];
    const includePictures = (intent as any).include_pictures !== false;
    const includeVideo = (intent as any).include_video !== false;

    console.log('[FacebookAgent] Draft generation:', {
      topic: intent.topic,
      includePictures,
      includeVideo,
    });

    if (includePictures) {
      const productImages = await matchProductsInTopic(intent.topic);
      console.log('[FacebookAgent] Matched product images:', {
        topic: intent.topic,
        imageCount: productImages.length,
        images: productImages,
      });
      attachedAssets = productImages;

      // Generate video from images if enabled
      if (includeVideo && productImages.length > 0) {
        const video = await generateProductVideo(productImages, result.text, draftId);
        if (video) {
          console.log('[FacebookAgent] Generated video:', video);
          attachedAssets = [video.videoPath, ...productImages];
        }
      }
    }

    console.log('[FacebookAgent] Final attached assets:', {
      taskId: draftId,
      assetCount: attachedAssets.length,
      assets: attachedAssets,
    });

    return {
      platform: 'facebook',
      draft_id: draftId,
      generated_at: new Date().toISOString(),
      body: finalBody,
      attached_assets: attachedAssets.length > 0 ? attachedAssets : undefined,
      estimated_character_count: finalBody.length,
      prompt_version: 'fb-caption-v1',
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
    throw new Error('NOT_IMPLEMENTED: FacebookAgent.draftReply');
  }

  async publish(record: HandoffRecord, approvedDraft: ApprovedDraft): Promise<PublishResult> {
    this.verifyHandoff(record);
    // IMMUTABLE STOP 1 enforcement note:
    // This is the ONLY place in the SMA codebase where Facebook publish
    // APIs are called. The Coordinator never calls them directly.
    throw new Error('NOT_IMPLEMENTED: FacebookAgent.publish');
  }

  async fetchEngagement(platformPostId: string): Promise<EngagementSnapshot> {
    throw new Error('NOT_IMPLEMENTED: FacebookAgent.fetchEngagement');
  }
}
