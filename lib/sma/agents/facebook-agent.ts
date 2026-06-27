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
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { decrypt } from '../encryption';

const FB_GRAPH_BASE = 'https://graph.facebook.com/v23.0';
const SITE_ORIGIN = 'https://www.cepticorp.com';

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

  async publish(record: HandoffRecord, approvedDraft: ApprovedDraft): Promise<PublishResult> {
    this.verifyHandoff(record);
    // IMMUTABLE STOP 1 enforcement note:
    // This is the ONLY place in the SMA codebase where Facebook publish
    // APIs are called. The Coordinator never calls them directly.

    // 1. Load the stored Facebook USER token (service-role, RLS-bypassing).
    const supabase = getSupabaseServiceRoleClient();
    const { data: tokenRow, error: tokenError } = await supabase
      .from('sma_tokens')
      .select('access_token_ciphertext')
      .eq('platform', 'facebook')
      .is('revoked_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError) {
      throw new Error(`Failed to load Facebook token: ${tokenError.message}`);
    }
    if (!tokenRow?.access_token_ciphertext) {
      throw new Error('No active Facebook token found in sma_tokens. Connect the Facebook account first.');
    }

    const userToken = decrypt(tokenRow.access_token_ciphertext);

    // 2. Resolve the Page id + Page access token from the user token.
    const { pageId, pageToken } = await this.resolvePage(userToken);

    // 3. Build the post body verbatim (it contains the wa.me ref link).
    const message = approvedDraft.body;

    // 4. Filter attached assets to images only (jpg/jpeg/png/webp). Videos deferred.
    const imageUrls = (approvedDraft.attached_assets || [])
      .filter((a) => /\.(jpg|jpeg|png|webp)$/i.test(a))
      .map((a) => this.toAbsoluteUrl(a));

    // 5. Publish.
    let feedJson: { id?: string } & Record<string, unknown>;

    if (imageUrls.length === 0) {
      // Text-only post to the page feed.
      feedJson = await this.graphPost(`${FB_GRAPH_BASE}/${pageId}/feed`, {
        message,
        access_token: pageToken,
      });
    } else {
      // Upload each photo unpublished, collect media fbids, then attach to a feed post.
      const attachedMedia: { media_fbid: string }[] = [];
      for (const url of imageUrls) {
        const photoJson = await this.graphPost(`${FB_GRAPH_BASE}/${pageId}/photos`, {
          url,
          published: 'false',
          access_token: pageToken,
        });
        if (!photoJson.id) {
          throw new Error(`Facebook photo upload returned no id for ${url}: ${JSON.stringify(photoJson)}`);
        }
        attachedMedia.push({ media_fbid: photoJson.id });
      }

      feedJson = await this.graphPost(`${FB_GRAPH_BASE}/${pageId}/feed`, {
        message,
        attached_media: JSON.stringify(attachedMedia),
        access_token: pageToken,
      });
    }

    const platformPostId = feedJson.id;
    if (!platformPostId) {
      throw new Error(`Facebook feed publish returned no post id: ${JSON.stringify(feedJson)}`);
    }

    return {
      platform: 'facebook',
      platform_post_id: platformPostId,
      published_at: new Date().toISOString(),
      permalink: `https://www.facebook.com/${platformPostId}`,
      publish_response: feedJson,
    };
  }

  /**
   * Resolve the CEPTI Page id + page access token from a user token via
   * GET /me/accounts. Prefers a page whose name contains "CEPTI";
   * falls back to the first page.
   */
  private async resolvePage(userToken: string): Promise<{ pageId: string; pageToken: string }> {
    const url = `${FB_GRAPH_BASE}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Facebook /me/accounts failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as {
      data?: { id: string; name?: string; access_token?: string }[];
    };
    const pages = json.data || [];
    if (pages.length === 0) {
      throw new Error('Facebook user token has no managed Pages (GET /me/accounts returned none).');
    }
    const ceptiPage = pages.find((p) => (p.name || '').toUpperCase().includes('CEPTI'));
    const page = ceptiPage || pages[0];
    if (!page.access_token) {
      throw new Error(`Facebook Page ${page.id} did not return an access_token.`);
    }
    return { pageId: page.id, pageToken: page.access_token };
  }

  /**
   * POST to a Graph endpoint with form-encoded params. Throws with the
   * status + body text on any non-OK response so the route can surface it.
   */
  private async graphPost(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<{ id?: string } & Record<string, unknown>> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
      cache: 'no-store',
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Facebook Graph error (${res.status}) at ${endpoint}: ${text}`);
    }
    return JSON.parse(text) as { id?: string } & Record<string, unknown>;
  }

  /**
   * Convert a relative asset path to an absolute, publicly fetchable URL.
   * Graph photo upload by `url` requires a public https URL. Strips an
   * optional leading `public/` and ensures a leading slash.
   */
  private toAbsoluteUrl(asset: string): string {
    if (/^https?:\/\//i.test(asset)) return asset;
    const cleaned = asset.replace(/^public\//, '').replace(/^\/?/, '/');
    return `${SITE_ORIGIN}${cleaned}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchEngagement(platformPostId: string): Promise<EngagementSnapshot> {
    throw new Error('NOT_IMPLEMENTED: FacebookAgent.fetchEngagement');
  }
}
