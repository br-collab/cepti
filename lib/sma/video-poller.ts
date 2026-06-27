import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getVideoStatus } from '@/lib/sma/xai-video'

export interface RefreshSummary {
  checked: number
  done: number
  failed: number
  stillPending: number
  errors: number
}

/**
 * Refresh all pending video jobs that have a request_id by polling xAI.
 * Done jobs get video_url + status 'done'; failed jobs get status 'failed'
 * with an error message. Errors talking to xAI are counted but leave the job
 * pending so the next poll can retry. Shared by the jobs read-refresh route
 * and the cron backstop poller.
 */
export async function refreshPendingVideoJobs(
  supabase: SupabaseClient,
): Promise<RefreshSummary> {
  const summary: RefreshSummary = {
    checked: 0,
    done: 0,
    failed: 0,
    stillPending: 0,
    errors: 0,
  }

  const { data: rows, error } = await supabase
    .from('sma_video_jobs')
    .select('id, request_id')
    .eq('status', 'pending')
    .not('request_id', 'is', null)

  if (error) {
    throw new Error(`Supabase error: ${error.message}`)
  }

  for (const row of rows ?? []) {
    summary.checked += 1
    try {
      const result = await getVideoStatus(row.request_id as string)
      if (result.status === 'done' && result.url) {
        await supabase
          .from('sma_video_jobs')
          .update({ status: 'done', video_url: result.url, updated_at: new Date().toISOString() })
          .eq('id', row.id)
        summary.done += 1
      } else if (result.status === 'failed') {
        await supabase
          .from('sma_video_jobs')
          .update({ status: 'failed', error: 'xAI reported failed/expired', updated_at: new Date().toISOString() })
          .eq('id', row.id)
        summary.failed += 1
      } else {
        summary.stillPending += 1
      }
    } catch (e) {
      console.error(`[video-poller] job ${row.id} poll failed:`, e)
      summary.errors += 1
    }
  }

  return summary
}
