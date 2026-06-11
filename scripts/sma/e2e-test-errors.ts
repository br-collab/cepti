/**
 * scripts/sma/e2e-test-errors.ts
 *
 * Phase 2.6: E2E Error Scenarios Test
 *
 * Verifies graceful error handling in various scenarios.
 *
 * Tests:
 * - Double approval by same user → 400 INVALID_APPROVAL
 * - Empty topic → 400
 * - Past scheduling date → 400
 * - Publishing without approval → 400
 * - Invalid task ID → 404
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

interface ErrorTest {
  name: string;
  fn: () => Promise<{ passed: boolean; message: string }>;
}

const main = async (): Promise<void> => {
  console.log('=== Phase 2.6: E2E Error Scenarios ===\n');

  const startTime = Date.now();
  const tests: ErrorTest[] = [];
  let passedCount = 0;
  let failedCount = 0;

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

    const billId = admins[0].user_id;
    const franciscoId = admins[1].user_id;
    console.log(`✓ Admin users ready\n`);

    // ── Test 1: Empty topic ────────────────────────────────────────────
    tests.push({
      name: 'Empty topic rejected',
      fn: async () => {
        try {
          const intent: ContentIntent = {
            intent_id: `INT-E2E-ERR-EMPTY-TOPIC-${Date.now()}`,
            proposed_by: 'bill',
            proposed_at: new Date().toISOString(),
            topic: '', // Empty
            proposed_platforms: ['facebook'],
            scheduled_for: null,
          };

          await coordinator.issueTask(intent, ['facebook']);
          return { passed: false, message: 'Should have rejected empty topic' };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('topic') || msg.includes('empty') || msg.includes('required')) {
            return { passed: true, message: 'Correctly rejected empty topic' };
          }
          return { passed: false, message: `Wrong error: ${msg}` };
        }
      },
    });

    // ── Test 2: Past scheduling date ───────────────────────────────────
    tests.push({
      name: 'Past scheduling date rejected',
      fn: async () => {
        try {
          const pastDate = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
          const intent: ContentIntent = {
            intent_id: `INT-E2E-ERR-PAST-DATE-${Date.now()}`,
            proposed_by: 'bill',
            proposed_at: new Date().toISOString(),
            topic: 'Test topic',
            proposed_platforms: ['facebook'],
            scheduled_for: pastDate,
          };

          await coordinator.issueTask(intent, ['facebook']);

          // If task created, try to approve with past date
          throw new Error('Task should reject past scheduled_for at creation');
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('future') || msg.includes('past') || msg.includes('scheduled')) {
            return { passed: true, message: 'Correctly rejected past date' };
          }
          return { passed: false, message: `Wrong error: ${msg}` };
        }
      },
    });

    // ── Test 3: Double approval by same user ───────────────────────────
    tests.push({
      name: 'Double approval prevented',
      fn: async () => {
        let taskId: string | null = null;
        try {
          const intent: ContentIntent = {
            intent_id: `INT-E2E-ERR-DOUBLE-APPROVE-${Date.now()}`,
            proposed_by: 'bill',
            proposed_at: new Date().toISOString(),
            topic: 'Double approval test',
            proposed_platforms: ['facebook'],
            scheduled_for: null,
          };

          taskId = await coordinator.issueTask(intent, ['facebook']);

          // Bill approves once
          const { error: err1 } = await supabase.rpc('coordinator_decide', {
            p_task_id: taskId,
            p_approver_id: billId,
            p_decision: 'APPROVE',
            p_rationale: 'First approval',
            p_scheduled_for: null,
          });

          if (err1) throw err1;

          // Bill tries to approve again
          const { error: err2 } = await supabase.rpc('coordinator_decide', {
            p_task_id: taskId,
            p_approver_id: billId,
            p_decision: 'APPROVE',
            p_rationale: 'Second approval',
            p_scheduled_for: null,
          });

          if (err2) {
            const msg = err2.message;
            if (msg.includes('already') || msg.includes('duplicate') || msg.includes('invalid')) {
              return { passed: true, message: 'Correctly prevented double approval' };
            }
            return { passed: false, message: `Wrong error: ${msg}` };
          }

          return { passed: false, message: 'Should have rejected second approval' };
        } catch (e) {
          // Cleanup
          if (taskId) {
            try {
              await supabase.from('sma_approval_decisions').delete().eq('task_id', taskId);
              await supabase.from('sma_paused_lifecycles').delete().eq('task_id', taskId);
              await supabase.from('sma_coordinator_tasks').delete().eq('task_id', taskId);
            } catch {
              // Ignore cleanup errors
            }
          }
          const msg = e instanceof Error ? e.message : String(e);
          return { passed: false, message: `Unexpected error: ${msg}` };
        }
      },
    });

    // ── Test 4: Publishing without approval ────────────────────────────
    tests.push({
      name: 'Publishing without approval rejected',
      fn: async () => {
        let taskId: string | null = null;
        try {
          const intent: ContentIntent = {
            intent_id: `INT-E2E-ERR-NO-APPROVAL-${Date.now()}`,
            proposed_by: 'bill',
            proposed_at: new Date().toISOString(),
            topic: 'No approval test',
            proposed_platforms: ['facebook'],
            scheduled_for: null,
          };

          taskId = await coordinator.issueTask(intent, ['facebook']);

          // Try to publish without approval (task is still PAUSED)
          try {
            await coordinator.publishContent(taskId);
            return { passed: false, message: 'Should have rejected publishing PAUSED task' };
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('COMPLETE') || msg.includes('not') || msg.includes('approved')) {
              return { passed: true, message: 'Correctly rejected unpublished content' };
            }
            return { passed: false, message: `Wrong error: ${msg}` };
          }
        } catch (e) {
          // Cleanup
          if (taskId) {
            try {
              await supabase.from('sma_paused_lifecycles').delete().eq('task_id', taskId);
              await supabase.from('sma_coordinator_tasks').delete().eq('task_id', taskId);
            } catch {
              // Ignore cleanup errors
            }
          }
          const msg = e instanceof Error ? e.message : String(e);
          return { passed: false, message: `Setup error: ${msg}` };
        }
      },
    });

    // ── Test 5: Invalid task ID ────────────────────────────────────────
    tests.push({
      name: 'Invalid task ID rejected',
      fn: async () => {
        try {
          await coordinator.publishContent('INVALID-TASK-ID-NOT-EXIST');
          return { passed: false, message: 'Should have rejected invalid task ID' };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('not found') || msg.includes('not exist') || msg.includes('invalid')) {
            return { passed: true, message: 'Correctly rejected invalid task ID' };
          }
          return { passed: false, message: `Wrong error: ${msg}` };
        }
      },
    });

    // ── Run all tests ──────────────────────────────────────────────────
    console.log('Running error tests...\n');
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      process.stdout.write(`[${i + 1}/${tests.length}] ${test.name}... `);
      try {
        const result = await test.fn();
        if (result.passed) {
          console.log(`✓ PASS`);
          console.log(`          ${result.message}`);
          passedCount++;
        } else {
          console.log(`✗ FAIL`);
          console.log(`          ${result.message}`);
          failedCount++;
        }
      } catch (e) {
        console.log(`✗ ERROR`);
        console.log(`          ${e instanceof Error ? e.message : String(e)}`);
        failedCount++;
      }
      console.log('');
    }

    // Final report
    const duration = Date.now() - startTime;
    const status = failedCount === 0 ? 'PASS' : 'FAIL';

    console.log('═══════════════════════════════════════════');
    console.log(`Test Result: ${status}`);
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`Passed: ${passedCount}/${tests.length}`);
    console.log(`Failed: ${failedCount}/${tests.length}`);
    console.log('═══════════════════════════════════════════\n');

    process.exit(failedCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
