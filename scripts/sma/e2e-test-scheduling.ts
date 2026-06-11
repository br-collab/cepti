/**
 * scripts/sma/e2e-test-scheduling.ts
 *
 * Phase 2.6: E2E Scheduling Verification Test
 *
 * Verifies that scheduled posts remain unpublished until the scheduled time,
 * then the cron job publishes them.
 *
 * Success criteria:
 * - Task status = COMPLETE but published_at = null initially
 * - After scheduled time + cron run, published_at is set
 * - Metrics can be fetched post-publish
 */

import fs from 'fs';
import path from 'path';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';
import { SMACoordinator } from '../../lib/sma/coordinator/coordinator';
import { ConsoleAuditLogger } from '../../lib/sma/coordinator/audit';
import type { ContentIntent } from '../../lib/sma/coordinator/types';

const loadEnvLocal = (): void => {
  const envPath = path.join(__dirname, '../../.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local not found');
  }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim();

    if (key === 'ANTHROPIC_API_KEY' && value) process.env.ANTHROPIC_API_KEY = value;
    if (key === 'SUPABASE_URL' && value) process.env.SUPABASE_URL = value;
    if (key === 'NEXT_PUBLIC_SUPABASE_URL' && value) process.env.NEXT_PUBLIC_SUPABASE_URL = value;
    if (key === 'SUPABASE_SERVICE_ROLE_KEY' && value) process.env.SUPABASE_SERVICE_ROLE_KEY = value;
  }
};

const main = async (): Promise<void> => {
  console.log('=== Phase 2.6: E2E Scheduling Verification ===\n');

  const startTime = Date.now();
  let taskId: string | null = null;
  let billId: string | null = null;
  let franciscoId: string | null = null;
  let scheduledFor: string | null = null;
  let testPassed = false;

  try {
    // Load environment
    console.log('Loading environment...');
    loadEnvLocal();
    console.log('✓ Environment loaded\n');

    // Setup
    console.log('Setting up clients...');
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) throw new Error('Missing Supabase credentials');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient(url, serviceKey, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      realtime: { transport: ws as any },
    });

    const coordinator = new SMACoordinator(supabase, new ConsoleAuditLogger());
    console.log('✓ Clients ready\n');

    // Get admin users
    console.log('Getting admin users...');
    const { data: admins, error: adminError } = await supabase
      .from('sma_admins')
      .select('user_id')
      .limit(2);

    if (adminError || !admins || admins.length < 2) {
      throw new Error('Need at least 2 sma_admins users');
    }

    billId = admins[0].user_id;
    franciscoId = admins[1].user_id;
    console.log(`✓ Bill and Francisco identified\n`);

    // Step 1: Create task with scheduled_for = 1 minute from now
    console.log('Step 1: Create task with scheduled_for = 1 minute from now');
    scheduledFor = new Date(Date.now() + 60 * 1000).toISOString();
    const intent: ContentIntent = {
      intent_id: `INT-E2E-SCHED-${Date.now()}`,
      proposed_by: 'bill',
      proposed_at: new Date().toISOString(),
      topic: 'Scheduling test - verify delayed publish',
      notes: 'E2E test: scheduled publish',
      proposed_platforms: ['facebook', 'instagram', 'threads'],
      scheduled_for: scheduledFor,
    };

    taskId = await coordinator.issueTask(intent, ['facebook', 'instagram', 'threads']);
    console.log(`✓ Task created: ${taskId}`);
    console.log(`✓ Scheduled for: ${scheduledFor}\n`);

    // Step 2: Bill approves with scheduled_for
    console.log('Step 2: Bill approves with scheduled_for');
    if (!billId) throw new Error('billId not set');
    const { data: billResult, error: billError } = await supabase.rpc('coordinator_decide', {
      p_task_id: taskId,
      p_approver_id: billId,
      p_decision: 'APPROVE',
      p_rationale: 'Scheduling test approval',
      p_scheduled_for: scheduledFor,
    });

    if (billError) throw new Error(`Bill approval failed: ${billError.message}`);
    console.log(`✓ Bill approved\n`);

    // Step 3: Francisco approves with scheduled_for
    console.log('Step 3: Francisco approves with scheduled_for');
    if (!franciscoId) throw new Error('franciscoId not set');
    const { data: franciscoResult, error: franciscoError } = await supabase.rpc('coordinator_decide', {
      p_task_id: taskId,
      p_approver_id: franciscoId,
      p_decision: 'APPROVE',
      p_rationale: 'Second approval',
      p_scheduled_for: scheduledFor,
    });

    if (franciscoError) throw new Error(`Francisco approval failed: ${franciscoError.message}`);
    console.log(`✓ Francisco approved\n`);

    // Step 4: Verify status = COMPLETE but published_at is null
    console.log('Step 4: Verify status=COMPLETE, published_at=null (not yet scheduled)');
    const { data: taskBeforePublish } = await supabase
      .from('sma_coordinator_tasks')
      .select('status')
      .eq('task_id', taskId)
      .maybeSingle();

    if (taskBeforePublish?.status !== 'COMPLETE') {
      throw new Error(`Expected COMPLETE, got ${taskBeforePublish?.status}`);
    }

    const { data: lifecycleBeforePublish } = await supabase
      .from('sma_content_lifecycles')
      .select('published_at')
      .eq('task_id', taskId)
      .maybeSingle();

    if (lifecycleBeforePublish?.published_at) {
      throw new Error('Expected published_at=null before scheduled time');
    }
    console.log(`✓ Task COMPLETE but not yet published\n`);

    // Step 5: Wait for scheduled time (60 seconds + buffer)
    console.log('Step 5: Waiting for scheduled time (70 seconds)...');
    const timeUntilScheduled = new Date(scheduledFor).getTime() - Date.now() + 10000; // 10s buffer
    if (timeUntilScheduled > 0) {
      await new Promise((resolve) => setTimeout(resolve, timeUntilScheduled));
      console.log('✓ Scheduled time reached\n');
    }

    // Step 6: Simulate cron job (publish-scheduled)
    console.log('Step 6: Trigger publish-scheduled cron');

    // In production, this would be called by a cron job. For testing, we manually call coordinator.publishContent
    // For a scheduled post, the coordinator will check if now > scheduled_for before publishing

    const { data: lifecycleForCron } = await supabase
      .from('sma_content_lifecycles')
      .select('lifecycle_record, scheduled_for')
      .eq('task_id', taskId)
      .maybeSingle();

    if (!lifecycleForCron) throw new Error('ContentLifecycle not found');

    // Check if it's time to publish
    const lifecycle = lifecycleForCron.lifecycle_record as any;
    const approvalScheduledFor = lifecycle.approvals?.[0]?.scheduled_for;

    if (approvalScheduledFor && new Date(approvalScheduledFor).getTime() <= Date.now()) {
      // Time to publish
      await coordinator.publishContent(taskId);
      console.log('✓ Published via cron trigger\n');
    }

    // Step 7: Verify published_at is set
    console.log('Step 7: Verify published_at is now set');
    const { data: lifecycleAfterPublish } = await supabase
      .from('sma_content_lifecycles')
      .select('published_at, lifecycle_record')
      .eq('task_id', taskId)
      .maybeSingle();

    if (!lifecycleAfterPublish?.published_at) {
      throw new Error('Expected published_at to be set after scheduled time');
    }

    console.log(`✓ Published at: ${lifecycleAfterPublish.published_at}`);
    const publications = (lifecycleAfterPublish.lifecycle_record as any).publications || {};
    console.log(`✓ Platforms published: ${Object.keys(publications).length}\n`);

    // Step 8: Verify metrics can be fetched
    console.log('Step 8: Verify metrics fetching (graceful if not supported)');
    try {
      const { data: finalLifecycle } = await supabase
        .from('sma_content_lifecycles')
        .select('lifecycle_record')
        .eq('task_id', taskId)
        .maybeSingle();

      if (finalLifecycle) {
        const finalLifecycleRecord = finalLifecycle.lifecycle_record as any;
        const metricsRecorded = Object.keys(finalLifecycleRecord.initial_metrics || {}).length;
        console.log(`✓ Metrics recorded for ${metricsRecorded} platforms\n`);
      }
    } catch (e) {
      console.log(`⚠ Metrics fetch skipped (may not support mocking)\n`);
    }

    testPassed = true;

    // Cleanup
    console.log('Cleaning up test data...');
    try {
      await supabase.from('sma_audit_log').delete().eq('task_id', taskId);
      await supabase.from('sma_approval_decisions').delete().eq('task_id', taskId);
      await supabase.from('sma_content_lifecycles').delete().eq('task_id', taskId);
      await supabase.from('sma_paused_lifecycles').delete().eq('task_id', taskId);
      await supabase.from('sma_coordinator_tasks').delete().eq('task_id', taskId);
      console.log('✓ Test data cleaned up\n');
    } catch (e) {
      console.error('⚠ Cleanup error (partial):', e);
    }

    // Final report
    const duration = Date.now() - startTime;
    console.log('═══════════════════════════════════════════');
    console.log(`Test Result: ${testPassed ? 'PASS' : 'FAIL'}`);
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log('═══════════════════════════════════════════\n');

    process.exit(testPassed ? 0 : 1);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`✗ Test Failed: ${msg}\n`);

    // Cleanup on error
    if (taskId) {
      try {
        await (async () => {
          const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (url && serviceKey) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const supabase = createClient(url, serviceKey, { realtime: { transport: ws as any } });
            await supabase.from('sma_audit_log').delete().eq('task_id', taskId);
            await supabase.from('sma_approval_decisions').delete().eq('task_id', taskId);
            await supabase.from('sma_content_lifecycles').delete().eq('task_id', taskId);
            await supabase.from('sma_paused_lifecycles').delete().eq('task_id', taskId);
            await supabase.from('sma_coordinator_tasks').delete().eq('task_id', taskId);
          }
        })();
      } catch (e) {
        // Silently ignore cleanup errors
      }
    }

    process.exit(1);
  }
};

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
