/**
 * lib/sma/agents/instagram-agent.ts
 *
 * Instagram platform agent. Drafts posts for CEPTI's Instagram Page.
 * Instagram favors visual content with lifestyle/aspirational tone.
 */

import fs from 'fs'
import path from 'path'
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
} from '../coordinator/types'
import { PlatformAgentBase, ApprovedDraft } from './platform-base'
import { generateDetailed } from '../llm-client'
import { matchProductsInTopic } from '../products-service'
import { generateProductVideo } from '../video-generator'

export class InstagramAgent extends PlatformAgentBase {
  readonly platform: Platform = 'instagram'
  readonly role_id: AgentRole = 'INSTAGRAM_AGENT'

  async draftPost(record: HandoffRecord, intent: ContentIntent): Promise<DraftResult> {
    this.verifyHandoff(record)

    // Load caption prompt template
    const promptPath = path.join(process.cwd(), 'prompts/instagram/caption.md')
    const promptTemplate = fs.readFileSync(promptPath, 'utf-8')

    // Extract system prompt
    const parts = promptTemplate.split('---')
    const systemPrompt = parts[2].trim()

    // Build user message from template
    const userMessage = systemPrompt
      .split('\n')
      .slice(-2)
      .join('\n')
      .replace('{topic}', intent.topic)
      .replace('{notes}', intent.notes || '')

    // Generate caption via LLM
    const result = await generateDetailed({
      system: systemPrompt.substring(0, systemPrompt.lastIndexOf('# User')).trim(),
      userMessage,
      maxTokens: 256,
    })

    // Generate draft ID
    const draftId = this.makeDraftId()

    // Match products in topic and collect images
    let images: DraftImage[] = []
    try {
      const matchedProducts = matchProductsInTopic(intent.topic)
      for (const product of matchedProducts) {
        for (let i = 0; i < Math.min(product.images.length, 3); i++) {
          images.push({
            url: product.images[i],
            productName: product.name,
          })
        }
      }
    } catch (error) {
      console.warn('Failed to match product images:', error)
    }

    // Generate video if images available
    let videoData
    try {
      if (images.length > 0) {
        const videoImages = images.map((img) => img.url)
        const videoResult = await generateProductVideo(videoImages, intent.topic, draftId)
        videoData = {
          url: videoResult.videoPath,
          duration: videoResult.duration,
          thumbnail: videoResult.thumbnailPath,
        }
      }
    } catch (error) {
      console.warn('Failed to generate video:', error)
    }

    const draftResult: DraftResult = {
      platform: 'instagram',
      draft_id: draftId,
      generated_at: new Date().toISOString(),
      body: result.text,
      images: images.length > 0 ? images : undefined,
      video: videoData,
      estimated_character_count: result.text.length,
      prompt_version: 'ig-caption-v1',
      model: result.model,
      tokens_input: result.inputTokens,
      tokens_output: result.outputTokens,
    }

    return draftResult
  }

  private makeDraftId(): string {
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const day = String(now.getUTCDate()).padStart(2, '0')
    const dateStr = `${year}${month}${day}`

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let suffix = ''
    for (let i = 0; i < 6; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    return `DFT-${dateStr}_${suffix}`
  }

  async draftReply(record: HandoffRecord, inbound: InboundComment): Promise<DraftResult> {
    this.verifyHandoff(record)
    throw new Error('NOT_IMPLEMENTED: InstagramAgent.draftReply')
  }

  async publish(record: HandoffRecord, approvedDraft: ApprovedDraft): Promise<PublishResult> {
    this.verifyHandoff(record)
    throw new Error('NOT_IMPLEMENTED: InstagramAgent.publish')
  }

  async fetchEngagement(platformPostId: string): Promise<EngagementSnapshot> {
    throw new Error('NOT_IMPLEMENTED: InstagramAgent.fetchEngagement')
  }
}
