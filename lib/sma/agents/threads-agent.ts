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

    // Load expert system prompt, engagement framework, psychology triggers, power words, and Threads-specific prompt
    const systemPath = path.join(process.cwd(), 'prompts/system-expert-seo.md');
    const frameworkPath = path.join(process.cwd(), 'prompts/engagement-framework.md');
    const triggersPath = path.join(process.cwd(), 'prompts/psychology-triggers.md');
    const powersPath = path.join(process.cwd(), 'prompts/power-words.md');
    const promptPath = path.join(process.cwd(), 'prompts/threads/caption-v2.md');

    const expertSystem = fs.readFileSync(systemPath, 'utf-8');
    const framework = fs.readFileSync(frameworkPath, 'utf-8');
    const triggers = fs.readFileSync(triggersPath, 'utf-8');
    const powerWords = fs.readFileSync(powersPath, 'utf-8');
    const promptTemplate = fs.readFileSync(promptPath, 'utf-8');

    // Build comprehensive system prompt: expert mindset + framework + psychology + language + platform strategy
    const systemPrompt = `${expertSystem}\n\n${framework}\n\n${triggers}\n\n${powerWords}\n\n${promptTemplate}`;

    // Build user message
    const userMessage = `Write a compelling Threads post for: ${intent.topic}\n\nContext: ${intent.notes || 'Share insider insight about this product'}\n\nApproach:\n1. Start with contrarian take or insider knowledge\n2. Use action/power words (revolutionize, unleash, unlock, transform, etc.)\n3. Add psychology trigger (authority, curiosity gap, or reciprocity)\n4. Be conversational, authentic, and opinionated\n5. End with a genuine question that invites replies\n6. Keep under 280 characters\n\nRemember: Threads is real talk. No hashtags. Encourage discussion.`;

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const includePictures = (intent as any).include_pictures !== false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const includeVideo = (intent as any).include_video !== false;

    // Load images if either pictures or video is requested
    if (includePictures || includeVideo) {
      const productImages = await matchProductsInTopic(intent.topic);

      // Attach individual images only if requested
      if (includePictures) {
        attachedAssets = productImages;
      }

      // Generate video from images if enabled
      if (includeVideo && productImages.length > 0) {
        const video = await generateProductVideo(productImages, caption, draftId);
        if (video) {
          attachedAssets = [video.videoPath, ...attachedAssets];
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async draftReply(record: HandoffRecord, inbound: InboundComment): Promise<DraftResult> {
    this.verifyHandoff(record);
    throw new Error('NOT_IMPLEMENTED: ThreadsAgent.draftReply');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async publish(record: HandoffRecord, approvedDraft: ApprovedDraft): Promise<PublishResult> {
    this.verifyHandoff(record);
    // IMMUTABLE STOP 1 enforcement note:
    // This is the ONLY place in the SMA codebase where Threads publish
    // APIs are called. The Coordinator never calls them directly.
    throw new Error('NOT_IMPLEMENTED: ThreadsAgent.publish');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchEngagement(platformPostId: string): Promise<EngagementSnapshot> {
    throw new Error('NOT_IMPLEMENTED: ThreadsAgent.fetchEngagement');
  }
}
