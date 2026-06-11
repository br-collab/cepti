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

export class ThreadsAgent extends PlatformAgentBase {
  readonly platform: Platform = 'threads';
  readonly role_id: AgentRole = 'THREADS_AGENT';

  async draftPost(record: HandoffRecord, intent: ContentIntent): Promise<DraftResult> {
    this.verifyHandoff(record);

    // Load engagement framework and Threads-specific prompt
    const frameworkPath = path.join(process.cwd(), 'prompts/engagement-framework.md');
    const promptPath = path.join(process.cwd(), 'prompts/threads/caption-v2.md');

    const framework = fs.readFileSync(frameworkPath, 'utf-8');
    const promptTemplate = fs.readFileSync(promptPath, 'utf-8');

    // Build comprehensive system prompt
    const systemPrompt = `You are an expert Threads strategist with 10+ years of social media experience. You write conversational, insider-knowledge content that sparks discussion.\n\n${framework}\n\n${promptTemplate}`;

    // Build user message
    const userMessage = `Write a compelling Threads post using the engagement framework:\n\nProduct: ${intent.topic}\nContext: ${intent.notes || 'Share insider insight about this product'}\n\nRemember: Conversational, authentic, opinionated. Encourage replies.`;

    // Generate caption via LLM
    const result = await generateDetailed({
      system: systemPrompt,
      userMessage,
      maxTokens: 512,
    });

    const caption = result.text.substring(0, 500); // Threads 500 char limit

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
      platform: 'threads',
      draft_id: draftId,
      generated_at: new Date().toISOString(),
      body: caption,
      attached_assets: attachedAssets.length > 0 ? attachedAssets : undefined,
      estimated_character_count: caption.length,
      prompt_version: 'threads-caption-v2',
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
