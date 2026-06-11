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
  DraftImage,
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

    // Load caption prompt template
    const promptPath = path.join(process.cwd(), 'prompts/facebook/caption.md');
    const promptTemplate = fs.readFileSync(promptPath, 'utf-8');

    // Extract system prompt (between --- markers) and user template
    const parts = promptTemplate.split('---');
    const systemPrompt = parts[2].trim();

    // Build user message from template
    const userMessage = systemPrompt
      .split('\n')
      .slice(-2)
      .join('\n')
      .replace('{topic}', intent.topic)
      .replace('{notes}', intent.notes || '');

    // Generate caption via LLM
    const result = await generateDetailed({
      system: systemPrompt.substring(0, systemPrompt.lastIndexOf('# User')).trim(),
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

    // Match products in topic and collect images
    let images: DraftImage[] = [];
    try {
      const matchedProducts = matchProductsInTopic(intent.topic);
      for (const product of matchedProducts) {
        // Use first 3 images per product
        for (let i = 0; i < Math.min(product.images.length, 3); i++) {
          images.push({
            url: product.images[i],
            productName: product.name,
          });
        }
      }
    } catch (error) {
      // Log but don't fail on image matching error
      console.warn('Failed to match product images:', error);
    }

    // Generate video if images are available
    let videoData;
    try {
      if (images.length > 0) {
        const videoImages = images.map((img) => img.url);
        const videoResult = await generateProductVideo(videoImages, intent.topic, draftId);
        videoData = {
          url: videoResult.videoPath,
          duration: videoResult.duration,
          thumbnail: videoResult.thumbnailPath,
        };
      }
    } catch (error) {
      // Log but don't fail on video generation error
      console.warn('Failed to generate video:', error);
    }

    const draftResult: DraftResult = {
      platform: 'facebook',
      draft_id: draftId,
      generated_at: new Date().toISOString(),
      body: finalBody,
      images: images.length > 0 ? images : undefined,
      video: videoData,
      estimated_character_count: finalBody.length,
      prompt_version: 'fb-caption-v1',
      model: result.model,
      tokens_input: result.inputTokens,
      tokens_output: result.outputTokens,
    };

    return draftResult;
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
