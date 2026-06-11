import { type NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { SMACoordinator } from '@/lib/sma/coordinator/coordinator'
import { ConsoleAuditLogger } from '@/lib/sma/coordinator/audit'

export const runtime = 'nodejs'

/**
 * Cron endpoint to publish scheduled content.
 * Called by Vercel cron at regular intervals (configured in vercel.json).
 *
 * Verifies authorization via Authorization header (Vercel cron secret).
 * Queries for content lifecycles with scheduled_for <= now() that haven't been published.
 * Calls coordinator.publishContent() for each (will be implemented in Phase 2.2).
 */
export default async function POST(req: NextRequest) {
  // Verify request is from Vercel cron
  const authHeader = req.headers.get('Authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await getSupabaseServiceRoleClient()
  const auditLogger = new ConsoleAuditLogger()
  const coordinator = new SMACoordinator(supabase, auditLogger)

  let processed = 0
  let errors = 0

  try {
    // Query for content ready to publish
    // Status must be COMPLETE (approved) and scheduled_for must be in the past
    const { data: readyItems, error: queryError } = await supabase
      .from('sma_content_lifecycles')
      .select('task_id, lifecycle_record, scheduled_for')
      .lte('scheduled_for', new Date().toISOString())
      .is('published_at', null)
      .order('scheduled_for', { ascending: true })

    if (queryError) {
      console.error('Failed to query scheduled content:', queryError)
      return NextResponse.json(
        { error: 'Failed to query scheduled content', processed, errors: 1 },
        { status: 500 },
      )
    }

    if (!readyItems || readyItems.length === 0) {
      console.log('No scheduled content ready for publishing')
      return NextResponse.json({ processed: 0, errors: 0 })
    }

    console.log(`Found ${readyItems.length} items ready for publishing`)

    // Process each item
    for (const item of readyItems) {
      try {
        const taskId = item.task_id
        console.log(`Publishing scheduled content: ${taskId}`)

        // Call coordinator.publishContent() - will be implemented in Phase 2.2
        // For now, this is a skeleton that assumes the method exists
        await coordinator.publishContent(taskId)

        processed++
      } catch (itemError) {
        console.error(`Failed to publish ${item.task_id}:`, itemError)
        errors++
        // Continue processing other items instead of failing the entire cron job
      }
    }

    return NextResponse.json({ processed, errors })
  } catch (error) {
    console.error('Cron publish-scheduled error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error', processed, errors: errors + 1 },
      { status: 500 },
    )
  }
}
