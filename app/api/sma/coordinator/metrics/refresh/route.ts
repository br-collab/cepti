/**
 * app/api/sma/coordinator/metrics/refresh/route.ts
 *
 * Manual metrics refresh endpoint for the UI.
 * Allows admins to refresh engagement metrics on-demand for a published post.
 *
 * POST /api/sma/metrics/refresh
 * Body: { task_id: string }
 * Response: { status: 'success' | 'error', task_id, metrics_fetched?, message? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { SMACoordinator } from '@/lib/sma/coordinator/coordinator';
import { getPlatformAgent } from '@/lib/sma/coordinator/registry';
import type { ContentLifecycle, Platform } from '@/lib/sma/coordinator/types';

async function requireSmaAdmin(req: NextRequest): Promise<boolean> {
  // TODO: Implement actual SMA admin check via Supabase Auth
  // For now, just log that this should be checked
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    console.warn('[Metrics Refresh] No authorization header');
    return false;
  }
  // Placeholder: in production, verify JWT against sma_admins table
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // Check authorization
    const isAdmin = await requireSmaAdmin(req);
    if (!isAdmin) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Parse request
    const body = (await req.json()) as { task_id?: string };
    const taskId = body.task_id;

    if (!taskId) {
      return NextResponse.json(
        { status: 'error', message: 'Missing task_id' },
        { status: 400 }
      );
    }

    console.log(`[Metrics Refresh] Refreshing metrics for task ${taskId}`);

    const supabase = await getSupabaseServiceRoleClient();

    // Verify task exists and is published
    const { data: lifecycleRow, error: readError } = await supabase
      .from('sma_content_lifecycles')
      .select('lifecycle_record, published_at')
      .eq('task_id', taskId)
      .maybeSingle();

    if (readError || !lifecycleRow) {
      return NextResponse.json(
        { status: 'error', message: `Task ${taskId} not found` },
        { status: 404 }
      );
    }

    if (!lifecycleRow.published_at) {
      return NextResponse.json(
        { status: 'error', message: 'Task has not been published yet' },
        { status: 400 }
      );
    }

    const lifecycle = lifecycleRow.lifecycle_record as ContentLifecycle;
    const coordinator = new SMACoordinator(supabase);

    let metricsFetched = 0;
    const errors: string[] = [];

    // For each platform with a publication
    for (const platform of Object.keys(lifecycle.publications) as Platform[]) {
      const publication = lifecycle.publications[platform];
      if (!publication) continue;

      try {
        const platformPostId = publication.platform_post_id;
        console.log(
          `[Metrics Refresh] Fetching metrics for ${platform}/${platformPostId}`
        );

        // Get agent and fetch engagement
        const agent = getPlatformAgent(platform);
        const snapshot = await agent.fetchEngagement(platformPostId);

        // Record to coordinator
        await coordinator.recordEngagement(taskId, snapshot);

        metricsFetched++;
        console.log(
          `[Metrics Refresh] Successfully recorded metrics for ${platform}/${platformPostId}`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Metrics Refresh] Error fetching ${platform} metrics:`, errorMsg);
        errors.push(`${platform}: ${errorMsg}`);
      }
    }

    if (metricsFetched === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          status: 'error',
          task_id: taskId,
          message: `Failed to fetch any metrics: ${errors.join('; ')}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'success',
      task_id: taskId,
      metrics_fetched: metricsFetched,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Metrics Refresh] Unhandled error:', errorMsg);
    return NextResponse.json(
      { status: 'error', message: `Server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}
