/**
 * app/api/sma/cron/fetch-metrics.ts
 *
 * Cron job to fetch engagement metrics for recently published posts.
 * Runs daily (or every 6 hours) to collect impressions, reach, engagement, etc.
 *
 * Per Phase 2.3, this fetches from Meta APIs and records snapshots to sma_content_lifecycles.
 * Skips posts that already have recent metrics (< 24h old) to avoid API spam.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { SMACoordinator } from '@/lib/sma/coordinator/coordinator';
import { getPlatformAgent } from '@/lib/sma/coordinator/registry';
import type { ContentLifecycle, Platform } from '@/lib/sma/coordinator/types';

const VERCEL_CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  // Verify Vercel cron authorization
  if (!VERCEL_CRON_SECRET) {
    console.error('[Fetch Metrics Cron] CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${VERCEL_CRON_SECRET}`) {
    console.warn('[Fetch Metrics Cron] Unauthorized cron request');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[Fetch Metrics Cron] Starting engagement metrics fetch job');

  try {
    const supabase = await getSupabaseServiceRoleClient();
    const coordinator = new SMACoordinator(supabase);

    // Query: SELECT task_id, lifecycle_record, platforms FROM sma_content_lifecycles
    // WHERE published_at IS NOT NULL AND published_at > (now() - interval '90 days')
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const { data: lifecycles, error: queryError } = await supabase
      .from('sma_content_lifecycles')
      .select('task_id, lifecycle_record')
      .not('published_at', 'is', null)
      .gte('published_at', ninetyDaysAgo.toISOString());

    if (queryError) {
      console.error('[Fetch Metrics Cron] Database query failed:', queryError);
      return NextResponse.json(
        { error: `Query failed: ${queryError.message}` },
        { status: 500 }
      );
    }

    if (!lifecycles || lifecycles.length === 0) {
      console.log('[Fetch Metrics Cron] No recently published content found');
      return NextResponse.json({
        status: 'success',
        processed: 0,
        errors: 0,
        platforms_fetched: 0,
        message: 'No recently published content found',
      });
    }

    console.log(`[Fetch Metrics Cron] Found ${lifecycles.length} published content items`);

    let processedCount = 0;
    let errorCount = 0;
    let platformsFetched = 0;

    // For each published lifecycle
    for (const row of lifecycles) {
      const taskId = row.task_id as string;
      const lifecycle = row.lifecycle_record as ContentLifecycle;

      // For each platform that has a publication
      for (const platform of Object.keys(lifecycle.publications) as Platform[]) {
        const publication = lifecycle.publications[platform];
        if (!publication) continue;

        try {
          const platformPostId = publication.platform_post_id;

          // Check if we already have recent metrics (< 24h old)
          const existingMetric = lifecycle.initial_metrics[platform];
          if (existingMetric) {
            const snapshotTime = new Date(existingMetric.snapshot_at).getTime();
            const hoursSince = (now.getTime() - snapshotTime) / (1000 * 60 * 60);

            if (hoursSince < 24) {
              console.log(
                `[Fetch Metrics Cron] Skipping ${platform} post ${platformPostId} for task ${taskId} (metrics ${hoursSince.toFixed(1)}h old)`
              );
              continue;
            }
          }

          console.log(
            `[Fetch Metrics Cron] Fetching metrics for ${platform}/${platformPostId} (task ${taskId})`
          );

          // Get agent for platform
          const agent = getPlatformAgent(platform);

          // Fetch engagement
          const snapshot = await agent.fetchEngagement(platformPostId);

          // Record to coordinator
          await coordinator.recordEngagement(taskId, snapshot);

          platformsFetched++;
          console.log(
            `[Fetch Metrics Cron] Successfully recorded metrics for ${platform}/${platformPostId}`
          );
        } catch (error) {
          errorCount++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(
            `[Fetch Metrics Cron] Error fetching metrics for ${platform} post in task ${taskId}:`,
            errorMsg
          );
          // Continue with next platform instead of failing entire job
        }
      }

      processedCount++;
    }

    console.log(
      `[Fetch Metrics Cron] Job complete: processed=${processedCount}, fetched=${platformsFetched}, errors=${errorCount}`
    );

    return NextResponse.json({
      status: 'success',
      processed: processedCount,
      errors: errorCount,
      platforms_fetched: platformsFetched,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Fetch Metrics Cron] Unhandled error:', errorMsg);
    return NextResponse.json(
      { error: `Unhandled error: ${errorMsg}` },
      { status: 500 }
    );
  }
}
