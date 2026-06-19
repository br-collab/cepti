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
import { buildWaLink } from '../wa-link';

export class FacebookAgent extends PlatformAgentBase {
  readonly platform: Platform = 'facebook';
  readonly role_id: AgentRole = 'FACEBOOK_AGENT';

  async draftPost(record: HandoffRecord, intent: ContentIntent): Promise<DraftResult> {
    this.verifyHandoff(record);

    // Load expert system prompt, engagement framework, psychology triggers, power words, and platform-specific prompt
    const systemPath = path.join(process.cwd(), 'prompts/system-expert-seo.md');
    const frameworkPath = path.join(process.cwd(), 'prompts/engagement-framework.md');
    const triggersPath = path.join(process.cwd(), 'prompts/psychology-triggers.md');
    const powersPath = path.join(process.cwd(), 'prompts/power-words.md');
    const promptPath = path.join(process.cwd(), 'prompts/facebook/caption-v2.md');

    const expertSystem = fs.readFileSync(systemPath, 'utf-8');
    const framework = fs.readFileSync(frameworkPath, 'utf-8');
    const triggers = fs.readFileSync(triggersPath, 'utf-8');
    const powerWords = fs.readFileSync(powersPath, 'utf-8');
    const promptTemplate = fs.readFileSync(promptPath, 'utf-8');

    // Build comprehensive system prompt: expert mindset + framework + psychology + language + platform strategy
    const systemPrompt = `${expertSystem}\n\n${framework}\n\n${triggers}\n\n${powerWords}\n\n${promptTemplate}`;

    // Build user message in Spanish — matches the Spanish-first system prompt
    const userMessage = `Escribe un caption de Facebook para: ${intent.topic}\n\nContexto: ${intent.notes || 'Promoción general del producto'}\n\nRecuerda: gancho que pare el scroll, beneficio específico en segunda persona, prueba creíble, un solo CTA al WhatsApp. Español dominicano, tono de amigo de confianza. Entre 350 y 450 caracteres.`;

    // Generate caption via LLM
    const result = await generateDetailed({
      system: systemPrompt,
      userMessage,
      maxTokens: 512,
    });

    // Generate a short video narration script — separate from the caption.
    // The caption is optimized for reading; the video script is optimized for listening.
    // 40-60 words, punchy, spoken-word rhythm, ends with WhatsApp CTA.
    const videoScript = await generateDetailed({
      system: 'Eres un guionista de video para redes sociales dominicanas. Escribes guiones cortos, emotivos y naturales en español dominicano. El guión debe sonar como una persona real hablando, no como un anuncio.',
      userMessage: `Escribe un guión de video de 40-60 palabras en español para: ${intent.topic}\n\nRequisitos:\n- Gancho emocional en la primera oración que detenga el scroll\n- Usa "tú" informal\n- Frases cortas, ritmo de palabra hablada, pausas naturales\n- Termina con: "Escríbenos por WhatsApp."\n- Solo el texto del guión — sin indicaciones de escena, sin formato, sin preámbulo`,
      maxTokens: 150,
    });

    const waLink = buildWaLink({
      message: 'Hola CEPTI, vi su publicación y me gustaría una cotización.',
      ref: { platform: 'fb', kind: 'post', id: record.task_id },
    });

    // Append wa.me link to caption body
    const finalBody = `${result.text}\n\n${waLink}`;

    // Generate draft ID
    const draftId = this.makeDraftId();

    // Load product images matching the topic (if enabled)
    let attachedAssets: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const includePictures = (intent as any).include_pictures !== false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const includeVideo = (intent as any).include_video !== false;

    console.log('[FacebookAgent] Draft generation:', {
      topic: intent.topic,
      includePictures,
      includeVideo,
    });

    // Load images if either pictures or video is requested
    if (includePictures || includeVideo) {
      const productImages = await matchProductsInTopic(intent.topic);
      console.log('[FacebookAgent] Matched product images:', {
        topic: intent.topic,
        imageCount: productImages.length,
        images: productImages,
      });

      // Attach individual images only if requested
      if (includePictures) {
        attachedAssets = productImages;
      }

      // Generate video from images if enabled
      if (includeVideo && productImages.length > 0) {
        // Filter to JPEG/WEBP only for video generation (FFmpeg concat has issues with PNG)
        const videoImages = productImages.filter((img) => /\.(jpg|jpeg|webp)$/i.test(img));
        if (videoImages.length > 0) {
          // Use the short video script for narration — optimized for listening, not reading
          const video = await generateProductVideo(videoImages, videoScript.text, draftId);
          if (video) {
            console.log('[FacebookAgent] Generated video:', video);
            attachedAssets = [video.videoPath, ...attachedAssets];
          }
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async draftReply(record: HandoffRecord, inbound: InboundComment): Promise<DraftResult> {
    this.verifyHandoff(record);
    throw new Error('NOT_IMPLEMENTED: FacebookAgent.draftReply');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async publish(record: HandoffRecord, approvedDraft: ApprovedDraft): Promise<PublishResult> {
    this.verifyHandoff(record);
    // IMMUTABLE STOP 1 enforcement note:
    // This is the ONLY place in the SMA codebase where Facebook publish
    // APIs are called. The Coordinator never calls them directly.
    throw new Error('NOT_IMPLEMENTED: FacebookAgent.publish');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchEngagement(platformPostId: string): Promise<EngagementSnapshot> {
    throw new Error('NOT_IMPLEMENTED: FacebookAgent.fetchEngagement');
  }
}
