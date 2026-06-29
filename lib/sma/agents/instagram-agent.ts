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
import { buildWaLink } from '../wa-link';
import { getRelevantExamples, buildFewShotBlock } from '../examples-service';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { decrypt } from '../encryption';

const IG_GRAPH_BASE = 'https://graph.facebook.com/v23.0';
const SITE_ORIGIN = 'https://www.cepticorp.com';

export class InstagramAgent extends PlatformAgentBase {
  readonly platform: Platform = 'instagram';
  readonly role_id: AgentRole = 'INSTAGRAM_AGENT';

  async draftPost(record: HandoffRecord, intent: ContentIntent): Promise<DraftResult> {
    this.verifyHandoff(record);

    // Load expert system prompt, engagement framework, psychology triggers, power words, and Instagram-specific prompt
    const systemPath = path.join(process.cwd(), 'prompts/system-expert-seo.md');
    const frameworkPath = path.join(process.cwd(), 'prompts/engagement-framework.md');
    const triggersPath = path.join(process.cwd(), 'prompts/psychology-triggers.md');
    const powersPath = path.join(process.cwd(), 'prompts/power-words.md');
    const promptPath = path.join(process.cwd(), 'prompts/instagram/caption-v2.md');

    const expertSystem = fs.readFileSync(systemPath, 'utf-8');
    const framework = fs.readFileSync(frameworkPath, 'utf-8');
    const triggers = fs.readFileSync(triggersPath, 'utf-8');
    const powerWords = fs.readFileSync(powersPath, 'utf-8');
    const promptTemplate = fs.readFileSync(promptPath, 'utf-8');

    // Build comprehensive system prompt: expert mindset + framework + psychology + language + platform strategy
    let systemPrompt = `${expertSystem}\n\n${framework}\n\n${triggers}\n\n${powerWords}\n\n${promptTemplate}`;

    // Inject curated few-shot examples (if any) so drafts match the proven voice.
    const examples = await getRelevantExamples({ platform: this.platform, productSlug: intent.topic });
    const fewShotBlock = buildFewShotBlock(examples);
    if (fewShotBlock) {
      systemPrompt = `${systemPrompt}\n\n${fewShotBlock}`;
    }

    // Build user message
    const userMessage = `Escribe un caption de Instagram para: ${intent.topic}\n\nContexto: ${intent.notes || 'Muestra la transformación visual y emocional que hace posible este producto'}\n\nRecuerda: los primeros 125 caracteres son el preview — el gancho aspiracional va ahí. Segunda persona, activa los sentidos, sin specs técnicas. 8-12 hashtags en español al final. Solo el texto del caption, sin preámbulo.`;

    // Generate caption via LLM
    const result = await generateDetailed({
      system: systemPrompt,
      userMessage,
      maxTokens: 512,
    });

    const waLink = buildWaLink({
      message: 'Hola CEPTI, vi su publicación y me gustaría una cotización.',
      ref: { platform: 'ig', kind: 'post', id: record.task_id },
    });
    const caption = `${result.text}\n\n${waLink}`;

    // Load product images (if enabled)
    const draftId = this.makeDraftId();
    let attachedAssets: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const includePictures = (intent as any).include_pictures !== false;
    // Operator-provided media (public Storage URLs). When present, these override
    // the auto-attached product images so the post publishes with the operator's media.
    const operatorAssets = (intent.reference_assets || []).filter((a) => typeof a === 'string' && a.trim() !== '');

    if (operatorAssets.length > 0) {
      attachedAssets = operatorAssets;
    } else if (includePictures) {
      const productImages = await matchProductsInTopic(intent.topic);
      attachedAssets = productImages;
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async draftReply(record: HandoffRecord, inbound: InboundComment): Promise<DraftResult> {
    this.verifyHandoff(record);
    throw new Error('NOT_IMPLEMENTED: InstagramAgent.draftReply');
  }

  async publish(record: HandoffRecord, approvedDraft: ApprovedDraft): Promise<PublishResult> {
    this.verifyHandoff(record);
    // IMMUTABLE STOP 1 enforcement note:
    // This is the ONLY place in the SMA codebase where Instagram publish
    // APIs are called. The Coordinator never calls them directly.

    // 1. Load the stored Instagram user token (service-role, RLS-bypassing).
    const userToken = await this.loadToken();

    // 2. Resolve the Page token, then the linked IG Business account id.
    const { pageId, pageToken } = await this.resolvePage(userToken);
    const igUserId = await this.resolveIgUser(pageId, pageToken);

    // 3. Caption is the approved body verbatim (carries the wa.me ref link).
    const caption = approvedDraft.body;

    // 4. Instagram requires media — text-only is not allowed.
    const imageUrls = (approvedDraft.attached_assets || [])
      .filter((a) => /\.(jpg|jpeg|png|webp)$/i.test(a))
      .map((a) => this.toAbsoluteUrl(a));

    if (imageUrls.length === 0) {
      throw new Error(
        'Instagram requires at least one image. This draft has no image assets to publish.',
      );
    }

    // 5. Container → publish.
    let creationId: string;
    if (imageUrls.length === 1) {
      // Single-image feed post.
      const container = await this.graphPost(`${IG_GRAPH_BASE}/${igUserId}/media`, {
        image_url: imageUrls[0],
        caption,
        access_token: pageToken,
      });
      if (!container.id) {
        throw new Error(`Instagram media container returned no id: ${JSON.stringify(container)}`);
      }
      creationId = container.id;
    } else {
      // Carousel: child containers (is_carousel_item), then a CAROUSEL parent.
      const childIds: string[] = [];
      for (const url of imageUrls.slice(0, 10)) {
        const child = await this.graphPost(`${IG_GRAPH_BASE}/${igUserId}/media`, {
          image_url: url,
          is_carousel_item: 'true',
          access_token: pageToken,
        });
        if (!child.id) {
          throw new Error(`Instagram carousel child returned no id for ${url}: ${JSON.stringify(child)}`);
        }
        childIds.push(child.id);
      }
      const parent = await this.graphPost(`${IG_GRAPH_BASE}/${igUserId}/media`, {
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption,
        access_token: pageToken,
      });
      if (!parent.id) {
        throw new Error(`Instagram carousel parent returned no id: ${JSON.stringify(parent)}`);
      }
      creationId = parent.id;
    }

    const publishJson = await this.graphPost(`${IG_GRAPH_BASE}/${igUserId}/media_publish`, {
      creation_id: creationId,
      access_token: pageToken,
    });
    const mediaId = publishJson.id;
    if (!mediaId) {
      throw new Error(`Instagram media_publish returned no id: ${JSON.stringify(publishJson)}`);
    }

    // 6. Best-effort permalink lookup; fall back to the CEPTI profile.
    let permalink = 'https://www.instagram.com/cepti_rd/';
    try {
      const url =
        `${IG_GRAPH_BASE}/${encodeURIComponent(mediaId)}` +
        `?fields=permalink&access_token=${encodeURIComponent(pageToken)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as { permalink?: string };
        if (json.permalink) permalink = json.permalink;
      }
    } catch (permErr) {
      console.warn(`[InstagramAgent] permalink fetch failed for ${mediaId}:`, permErr);
    }

    return {
      platform: 'instagram',
      platform_post_id: mediaId,
      published_at: new Date().toISOString(),
      permalink,
      publish_response: publishJson,
    };
  }

  async fetchEngagement(platformPostId: string): Promise<EngagementSnapshot> {
    const userToken = await this.loadToken();
    const { pageToken } = await this.resolvePage(userToken);

    // Media node: likes + comments.
    const fields = 'like_count,comments_count';
    const url =
      `${IG_GRAPH_BASE}/${encodeURIComponent(platformPostId)}` +
      `?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Instagram engagement fetch failed (${res.status}) for ${platformPostId}: ${text}`);
    }
    const json = JSON.parse(text) as { like_count?: number; comments_count?: number };
    const likes = json.like_count ?? 0;
    const comments = json.comments_count ?? 0;

    // Best-effort reach/impressions via the insights edge (needs insights scope).
    let impressions: number | undefined;
    try {
      const insightsUrl =
        `${IG_GRAPH_BASE}/${encodeURIComponent(platformPostId)}/insights` +
        `?metric=reach&access_token=${encodeURIComponent(pageToken)}`;
      const insightsRes = await fetch(insightsUrl, { cache: 'no-store' });
      if (insightsRes.ok) {
        const insightsJson = (await insightsRes.json()) as {
          data?: { name?: string; values?: { value?: number }[] }[];
        };
        const metric = insightsJson.data?.find((m) => m.name === 'reach');
        const value = metric?.values?.[0]?.value;
        if (typeof value === 'number') impressions = value;
      }
    } catch (insightsErr) {
      console.warn(`[InstagramAgent] insights fetch failed for ${platformPostId}:`, insightsErr);
    }

    return {
      platform: 'instagram',
      platform_post_id: platformPostId,
      snapshot_at: new Date().toISOString(),
      engagement: likes,
      comments_count: comments,
      shares_count: 0,
      impressions,
    };
  }

  /** Load + decrypt the stored Instagram user token. Throws if not connected. */
  private async loadToken(): Promise<string> {
    const supabase = getSupabaseServiceRoleClient();
    const { data: tokenRow, error } = await supabase
      .from('sma_tokens')
      .select('access_token_ciphertext')
      .eq('platform', 'instagram')
      .is('revoked_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load Instagram token: ${error.message}`);
    }
    if (!tokenRow?.access_token_ciphertext) {
      throw new Error('No active Instagram token found in sma_tokens. Connect the Instagram account first.');
    }
    return decrypt(tokenRow.access_token_ciphertext);
  }

  /**
   * Resolve the CEPTI Page id + Page access token from a user token via
   * GET /me/accounts. Prefers a page whose name contains "CEPTI".
   */
  private async resolvePage(userToken: string): Promise<{ pageId: string; pageToken: string }> {
    const url = `${IG_GRAPH_BASE}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Instagram /me/accounts failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as {
      data?: { id: string; name?: string; access_token?: string }[];
    };
    const pages = json.data || [];
    if (pages.length === 0) {
      throw new Error('Instagram user token has no managed Pages (GET /me/accounts returned none).');
    }
    const ceptiPage = pages.find((p) => (p.name || '').toUpperCase().includes('CEPTI'));
    const page = ceptiPage || pages[0];
    if (!page.access_token) {
      throw new Error(`Page ${page.id} did not return an access_token for Instagram publishing.`);
    }
    return { pageId: page.id, pageToken: page.access_token };
  }

  /** Resolve the IG Business account id linked to the Page. */
  private async resolveIgUser(pageId: string, pageToken: string): Promise<string> {
    const url =
      `${IG_GRAPH_BASE}/${encodeURIComponent(pageId)}` +
      `?fields=instagram_business_account&access_token=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Failed to resolve Instagram business account: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { instagram_business_account?: { id?: string } };
    const igId = json.instagram_business_account?.id;
    if (!igId) {
      throw new Error(
        'No Instagram Business account is linked to the CEPTI Page. Link an IG Business/Creator account to the Page in Meta settings.',
      );
    }
    return igId;
  }

  /** POST to a Graph endpoint with form-encoded params; throws on non-OK. */
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
      throw new Error(`Instagram Graph error (${res.status}) at ${endpoint}: ${text}`);
    }
    return JSON.parse(text) as { id?: string } & Record<string, unknown>;
  }

  /** Convert a relative asset path to an absolute, publicly fetchable https URL. */
  private toAbsoluteUrl(asset: string): string {
    if (/^https?:\/\//i.test(asset)) return asset;
    const cleaned = asset.replace(/^public\//, '').replace(/^\/?/, '/');
    return `${SITE_ORIGIN}${cleaned}`;
  }
}
