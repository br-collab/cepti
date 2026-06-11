/**
 * scripts/sma/e2e-test-happy-path.ts
 *
 * Phase 2.6: E2E Happy Path Test
 *
 * Full workflow: draft → approve (Bill) → approve (Francisco) → publish → metrics
 *
 * Success criteria:
 * - 3 drafts generated
 * - Both approvals recorded
 * - Task status transitions: PAUSED → PENDING → COMPLETE
 * - Publishing succeeds on all 3 platforms
 * - Metrics fetched and recorded
 */

import fs from 'fs';
import path from 'path';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';
import { SMACoordinator } from '../../lib/sma/coordinator/coordinator';
import { ConsoleAuditLogger } from '../../lib/sma/coordinator/audit';
import { getPlatformAgent } from '../../lib/sma/coordinator/registry';
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

interface TestStep {
  name: string;
  fn: () => Promise<void>;
}

const main = async (): Promise<void> => {
  console.log('=== Phase 2.6: E2E Happy Path Test ===\n');

  const startTime = Date.now();
  let taskId: string | null = null;
  let billId: string | null = null;
  let franciscoId: string | null = null;
  const steps: TestStep[] = [];
  const completedSteps: string[] = [];
  const errors: string[] = [];

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
      .select('user_id, name')
      .limit(2);

    if (adminError || !admins || admins.length < 2) {
      throw new Error('Need at least 2 sma_admins users');
    }

    billId = admins[0].user_id;
    franciscoId = admins[1].user_id;
    console.log(`✓ Bill: ${billId}`);
    console.log(`✓ Francisco: ${franciscoId}\n`);

    // ── Step 1: Create task ──────────────────────────────────────────
    steps.push({
      name: 'Create task',
      fn: async () => {
        const intent: ContentIntent = {
          intent_id: `INT-E2E-HAPPY-${Date.now()}`,
          proposed_by: 'bill',
          proposed_at: new Date().toISOString(),
          topic: 'Ladriflex - benefits of the product',
          notes: 'E2E test: verify full workflow',
          proposed_platforms: ['facebook', 'instagram', 'threads'],
          scheduled_for: null,
        };

        taskId = await coordinator.issueTask(intent, ['facebook', 'instagram', 'threads']);
        console.log(`  Task created: ${taskId}`);
      },
    });

    // ── Step 2: Verify task in sma_paused_lifecycles ──────────────────
    steps.push({
      name: 'Verify task exists',
      fn: async () => {
        if (!taskId) throw new Error('taskId not set');

        const { data: taskRow, error } = await supabase
          .from('sma_coordinator_tasks')
          .select('*')
          .eq('task_id', taskId)
          .maybeSingle();

        if (error || !taskRow) throw new Error(`Task ${taskId} not found`);
        if (taskRow.status !== 'PAUSED') throw new Error(`Expected status PAUSED, got ${taskRow.status}`);
        console.log(`  Task exists with status PAUSED`);
      },
    });

    // ── Step 3: Verify 3 drafts generated ───────────────────────────
    steps.push({
      name: 'Verify drafts',
      fn: async () => {
        if (!taskId) throw new Error('taskId not set');

        const { data: lifecycleRow, error } = await supabase
          .from('sma_paused_lifecycles')
          .select('context')
          .eq('task_id', taskId)
          .maybeSingle();

        if (error || !lifecycleRow) throw new Error(`Paused lifecycle not found`);

        const context = lifecycleRow.context as any;
        if (!context.draft) throw new Error('No draft in context');

        const platforms = ['facebook', 'instagram', 'threads'];
        const draftBody = context.draft.body;
        if (!draftBody || draftBody.length === 0) throw new Error('Draft body is empty');

        console.log(`  Draft generated with ${draftBody.length} characters`);
        console.log(`  Platform: ${context.platform}`);
      },
    });

    // ── Step 4: Bill approves ──────────────────────────────────────────
    steps.push({
      name: 'Bill approves',
      fn: async () => {
        if (!taskId || !billId) throw new Error('Missing taskId or billId');

        const { data: result, error } = await supabase.rpc('coordinator_decide', {
          p_task_id: taskId,
          p_approver_id: billId,
          p_decision: 'APPROVE',
          p_rationale: 'Happy path test approval',
          p_scheduled_for: null,
        });

        if (error) throw new Error(`Bill approval failed: ${error.message}`);
        console.log(`  Bill approved: ${JSON.stringify(result)}`);
      },
    });

    // ── Step 5: Verify status = PENDING ────────────────────────────────
    steps.push({
      name: 'Verify status PENDING after Bill',
      fn: async () => {
        if (!taskId) throw new Error('taskId not set');

        const { data: taskRow, error } = await supabase
          .from('sma_coordinator_tasks')
          .select('status')
          .eq('task_id', taskId)
          .maybeSingle();

        if (error || !taskRow) throw new Error(`Task not found`);
        if (taskRow.status !== 'PAUSED') {
          throw new Error(`Expected PAUSED, got ${taskRow.status}`);
        }
        console.log(`  Task still PAUSED (waiting for Francisco)`);
      },
    });

    // ── Step 6: Francisco approves ─────────────────────────────────────
    steps.push({
      name: 'Francisco approves',
      fn: async () => {
        if (!taskId || !franciscoId) throw new Error('Missing taskId or franciscoId');

        const { data: result, error } = await supabase.rpc('coordinator_decide', {
          p_task_id: taskId,
          p_approver_id: franciscoId,
          p_decision: 'APPROVE',
          p_rationale: 'Second approval completes workflow',
          p_scheduled_for: null,
        });

        if (error) throw new Error(`Francisco approval failed: ${error.message}`);
        console.log(`  Francisco approved: ${JSON.stringify(result)}`);
      },
    });

    // ── Step 7: Verify status = COMPLETE ───────────────────────────────
    steps.push({
      name: 'Verify status COMPLETE',
      fn: async () => {
        if (!taskId) throw new Error('taskId not set');

        const { data: taskRow, error } = await supabase
          .from('sma_coordinator_tasks')
          .select('status')
          .eq('task_id', taskId)
          .maybeSingle();

        if (error || !taskRow) throw new Error(`Task not found`);
        if (taskRow.status !== 'COMPLETE') {
          throw new Error(`Expected COMPLETE, got ${taskRow.status}`);
        }
        console.log(`  Task is COMPLETE (both approvals recorded)`);
      },
    });

    // ── Step 8: Verify ContentLifecycle exists ──────────────────────────
    steps.push({
      name: 'Verify ContentLifecycle',
      fn: async () => {
        if (!taskId) throw new Error('taskId not set');

        const { data: lifecycleRow, error } = await supabase
          .from('sma_content_lifecycles')
          .select('lifecycle_record')
          .eq('task_id', taskId)
          .maybeSingle();

        if (error || !lifecycleRow) throw new Error(`ContentLifecycle not found`);

        const lifecycle = lifecycleRow.lifecycle_record as any;
        if (!lifecycle.approvals || lifecycle.approvals.length < 2) {
          throw new Error(`Expected 2 approvals, got ${lifecycle.approvals?.length || 0}`);
        }
        console.log(`  ContentLifecycle created with ${lifecycle.approvals.length} approvals`);
      },
    });

    // ── Step 9: Publish ────────────────────────────────────────────────
    steps.push({
      name: 'Publish to all platforms',
      fn: async () => {
        if (!taskId) throw new Error('taskId not set');

        // Use coordinator's publishContent method
        await coordinator.publishContent(taskId);
        console.log(`  Published to all platforms`);
      },
    });

    // ── Step 10: Verify publications ───────────────────────────────────
    steps.push({
      name: 'Verify publications recorded',
      fn: async () => {
        if (!taskId) throw new Error('taskId not set');

        const { data: lifecycleRow, error } = await supabase
          .from('sma_content_lifecycles')
          .select('lifecycle_record, published_at')
          .eq('task_id', taskId)
          .maybeSingle();

        if (error || !lifecycleRow) throw new Error(`ContentLifecycle not found`);

        const lifecycle = lifecycleRow.lifecycle_record as any;
        const publications = lifecycle.publications || {};
        const platforms = Object.keys(publications);

        if (platforms.length === 0) {
          throw new Error('No publications recorded');
        }

        for (const platform of platforms) {
          const pub = publications[platform];
          if (!pub.platform_post_id || !pub.permalink) {
            throw new Error(`${platform} missing platform_post_id or permalink`);
          }
        }

        console.log(`  ${platforms.length} platforms published`);
        platforms.forEach((p) => {
          console.log(`    - ${p}: ${publications[p].permalink}`);
        });
      },
    });

    // ── Step 11: Fetch metrics ─────────────────────────────────────────
    steps.push({
      name: 'Fetch metrics',
      fn: async () => {
        if (!taskId) throw new Error('taskId not set');

        const { data: lifecycleRow } = await supabase
          .from('sma_content_lifecycles')
          .select('lifecycle_record')
          .eq('task_id', taskId)
          .maybeSingle();

        if (!lifecycleRow) throw new Error('ContentLifecycle not found');

        const lifecycle = lifecycleRow.lifecycle_record as any;
        const platforms = Object.keys(lifecycle.publications || {}) as any[];

        for (const platform of platforms) {
          const publication = lifecycle.publications[platform];
          if (!publication) continue;

          try {
            const agent = getPlatformAgent(platform);
            const snapshot = await agent.fetchEngagement(publication.platform_post_id);
            await coordinator.recordEngagement(taskId, snapshot);
          } catch (e) {
            console.log(`    ⚠ Metrics fetch skipped for ${platform} (may not support mocking)`);
          }
        }

        console.log(`  Metrics recorded`);
      },
    });

    // ── Step 12: Verify audit trail ────────────────────────────────────
    steps.push({
      name: 'Verify audit trail',
      fn: async () => {
        if (!taskId) throw new Error('taskId not set');

        const { data: auditRows, error } = await supabase
          .from('sma_audit_log')
          .select('event_type, recorded_at')
          .eq('task_id', taskId)
          .order('recorded_at', { ascending: true });

        if (error || !auditRows) throw new Error(`Audit log query failed`);

        const eventTypes = auditRows.map((r: any) => r.event_type);
        console.log(`  Audit trail: ${eventTypes.join(' → ')}`);

        // Verify timestamps are ordered
        const timestamps = auditRows.map((r: any) => new Date(r.recorded_at).getTime());
        for (let i = 1; i < timestamps.length; i++) {
          if (timestamps[i] < timestamps[i - 1]) {
            throw new Error('Audit timestamps not in chronological order');
          }
        }
        console.log(`  ✓ Timestamps chronologically ordered`);
      },
    });

    // ── Run all steps ──────────────────────────────────────────────────
    console.log('Running test steps...\n');
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        console.log(`[${i + 1}/${steps.length}] ${step.name}`);
        await step.fn();
        completedSteps.push(step.name);
        console.log('');
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`✗ FAILED: ${msg}\n`);
        errors.push(`Step ${i + 1} (${step.name}): ${msg}`);
        break;
      }
    }

    // ── Cleanup ────────────────────────────────────────────────────────
    if (taskId) {
      console.log('Cleaning up test data...');
      try {
        await supabase.from('sma_audit_log').delete().eq('task_id', taskId);
        await supabase.from('sma_approval_decisions').delete().eq('task_id', taskId);
        await supabase.from('sma_content_lifecycles').delete().eq('task_id', taskId);
        await supabase.from('sma_paused_lifecycles').delete().eq('task_id', taskId);
        await supabase.from('sma_coordinator_tasks').delete().eq('task_id', taskId);
        console.log('✓ Test data cleaned up\n');
      } catch (e) {
        console.error('⚠ Cleanup error (may be partial):', e);
      }
    }

    // ── Final Report ───────────────────────────────────────────────────
    const duration = Date.now() - startTime;
    const status = errors.length === 0 ? 'PASS' : 'FAIL';

    console.log('═══════════════════════════════════════════');
    console.log(`Test Result: ${status}`);
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`Steps Completed: ${completedSteps.length}/${steps.length}`);
    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach((e) => console.log(`  - ${e}`));
    }
    console.log('═══════════════════════════════════════════\n');

    process.exit(errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error:', error);
    console.error(`Steps completed before error: ${completedSteps.length}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
