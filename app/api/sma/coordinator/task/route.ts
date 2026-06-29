import { type NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { SMACoordinator } from '@/lib/sma/coordinator/coordinator'
import { ConsoleAuditLogger } from '@/lib/sma/coordinator/audit'
import { FacebookAgent } from '@/lib/sma/agents/facebook-agent'
import { InstagramAgent } from '@/lib/sma/agents/instagram-agent'
import { ThreadsAgent } from '@/lib/sma/agents/threads-agent'
import type { AgentRole, ContentIntent, Platform } from '@/lib/sma/coordinator/types'

export const runtime = 'nodejs'

const AGENT_MAP: Record<Platform, { agent: () => InstanceType<typeof FacebookAgent | typeof InstagramAgent | typeof ThreadsAgent>; role: AgentRole }> = {
  facebook: { agent: () => new FacebookAgent(), role: 'FACEBOOK_AGENT' },
  instagram: { agent: () => new InstagramAgent(), role: 'INSTAGRAM_AGENT' },
  threads: { agent: () => new ThreadsAgent(), role: 'THREADS_AGENT' },
}

export async function POST(req: NextRequest) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { topic, notes, includePictures, includeVideo, platforms, attachments } = body as {
      topic?: string
      notes?: string
      includePictures?: boolean
      includeVideo?: boolean
      platforms?: Platform[]
      attachments?: string[]
    }

    if (!topic || typeof topic !== 'string' || topic.trim() === '') {
      return NextResponse.json({ error: 'topic is required and must be a non-empty string' }, { status: 400 })
    }

    const selectedPlatforms: Platform[] = (platforms && platforms.length > 0)
      ? platforms
      : ['facebook', 'instagram', 'threads']

    const supabase = await getSupabaseServiceRoleClient()
    const auditLogger = new ConsoleAuditLogger()
    const coordinator = new SMACoordinator(supabase, auditLogger)

    // Operator-uploaded media (public Storage URLs). When present, the platform
    // agents use these as the draft's attached_assets and skip the auto-attach
    // (matchProductsInTopic) path. Carried on the typed reference_assets field.
    const operatorAttachments = Array.isArray(attachments)
      ? attachments.filter((a): a is string => typeof a === 'string' && a.trim() !== '')
      : undefined

    const intent: ContentIntent & { include_pictures?: boolean; include_video?: boolean } = {
      intent_id: `INT-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      proposed_by: 'bill',
      proposed_at: new Date().toISOString(),
      topic: topic.trim(),
      notes: notes?.trim(),
      proposed_platforms: selectedPlatforms,
      scheduled_for: null,
      reference_assets: operatorAttachments && operatorAttachments.length > 0 ? operatorAttachments : undefined,
      include_pictures: includePictures !== false,
      include_video: includeVideo !== false,
    }

    const tasks: { task_id: string; platform: Platform }[] = []
    const errors: { platform: Platform; error: string }[] = []

    for (const platform of selectedPlatforms) {
      try {
        const { agent: makeAgent, role } = AGENT_MAP[platform]
        const taskId = await coordinator.issueTask(intent, [platform])
        const handoffRecord = await coordinator.handoff(taskId, 'COORDINATOR', role, intent, `Generate ${platform} draft for approval queue`)
        const draftResult = await makeAgent().draftPost(handoffRecord, intent)
        await coordinator.requestApproval(taskId, 'AWAITING_DRAFT_APPROVAL', {
          task_id: taskId,
          reason: 'AWAITING_DRAFT_APPROVAL',
          intent,
          draft: draftResult,
          platform,
          scheduled_for: null,
          related_paused_count: 0,
        })
        tasks.push({ task_id: taskId, platform })
      } catch (platformErr) {
        console.error(`[task/route] ${platform} draft failed:`, platformErr)
        errors.push({ platform, error: platformErr instanceof Error ? platformErr.message : 'Unknown error' })
      }
    }

    if (tasks.length === 0) {
      return NextResponse.json({ error: 'All platform drafts failed', errors }, { status: 500 })
    }

    return NextResponse.json({ tasks, ...(errors.length > 0 ? { errors } : {}) })
  } catch (error) {
    console.error('POST /api/sma/coordinator/task error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
