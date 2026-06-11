import { NextRequest, NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { SMACoordinator } from '@/lib/sma/coordinator/coordinator'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json() as { task_id?: string; force?: boolean }
    const { task_id: taskId } = body

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid task_id in request body' },
        { status: 400 },
      )
    }

    const supabase = await getSupabaseServiceRoleClient()

    // Verify task exists
    const { data: taskRow, error: taskError } = await supabase
      .from('sma_coordinator_tasks')
      .select('status')
      .eq('task_id', taskId)
      .maybeSingle()

    if (taskError || !taskRow) {
      return NextResponse.json({ error: `Task ${taskId} not found` }, { status: 404 })
    }

    if (taskRow.status !== 'COMPLETE') {
      return NextResponse.json(
        {
          error: `Task ${taskId} has status ${taskRow.status}, expected COMPLETE`,
        },
        { status: 400 },
      )
    }

    // Verify not already published
    const { data: lifecycleRow } = await supabase
      .from('sma_content_lifecycles')
      .select('published_at, lifecycle_record')
      .eq('task_id', taskId)
      .maybeSingle()

    if (lifecycleRow?.published_at) {
      return NextResponse.json(
        { error: `Task ${taskId} already published at ${lifecycleRow.published_at}` },
        { status: 400 },
      )
    }

    // Publish content
    const coordinator = new SMACoordinator(supabase)
    await coordinator.publishContent(taskId)

    // Read back the updated lifecycle to return published info
    const { data: updatedLifecycle } = await supabase
      .from('sma_content_lifecycles')
      .select('lifecycle_record')
      .eq('task_id', taskId)
      .maybeSingle()

    const lifecycle = updatedLifecycle?.lifecycle_record
    const publications = lifecycle?.publications || {}
    const publishedPlatforms = Object.keys(publications)
    const links: Record<string, string> = {}

    for (const [platform, pubResult] of Object.entries(publications)) {
      if (pubResult && typeof pubResult === 'object' && 'permalink' in pubResult) {
        links[platform] = (pubResult as { permalink: string }).permalink
      }
    }

    return NextResponse.json({
      status: 'success',
      task_id: taskId,
      published_platforms: publishedPlatforms,
      links,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('POST /api/sma/coordinator/publish error:', error)
    return NextResponse.json({ error: message, status: 'error' }, { status: 500 })
  }
}
