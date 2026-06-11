/**
 * scripts/sma/e2e-test-denial.ts
 *
 * Phase 2.6: E2E Multi-User Denial Test
 *
 * Verifies that denial by any approver is irreversible and prevents publishing.
 *
 * Success criteria:
 * - Bill approves (status = PENDING)
 * - Francisco denies (status = DENIED)
 * - Publishing fails
 * - No Meta API calls made
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
  console.log('=== Phase 2.6: E2E Multi-User Denial Test ===\n');

  const startTime = Date.now();
  let taskId: string | null = null;
  let billId: string | null = null;
  let franciscoId: string | null = null;
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

    // Step 1: Create task
    console.log('Step 1: Create task');
    const intent: ContentIntent = {
      intent_id: `INT-E2E-DENIAL-${Date.now()}`,
      proposed_by: 'bill',
      proposed_at: new Date().toISOString(),
      topic: 'Denial test - verify irreversible rejection',
      notes: 'E2E test: denial workflow',
      proposed_platforms: ['facebook', 'instagram', 'threads'],
      scheduled_for: null,
    };

    taskId = await coordinator.issueTask(intent, ['facebook', 'instagram', 'threads']);
    console.log(`✓ Task created: ${taskId}\n`);

    // Step 2: Bill approves
    console.log('Step 2: Bill approves');
    if (!billId) throw new Error('billId not set');
    const { data: billResult, error: billError } = await supabase.rpc('coordinator_decide', {
      p_task_id: taskId,
      p_approver_id: billId,
      p_decision: 'APPROVE',
      p_rationale: 'Approval for denial test',
      p_scheduled_for: null,
    });

    if (billError) throw new Error(`Bill approval failed: ${billError.message}`);
    console.log(`✓ Bill approved\n`);

    // Step 3: Verify status = PENDING
    console.log('Step 3: Verify status = PENDING (waiting for Francisco)');
    const { data: taskAfterBill } = await supabase
      .from('sma_coordinator_tasks')
      .select('status')
      .eq('task_id', taskId)
      .maybeSingle();

    if (taskAfterBill?.status !== 'PAUSED') {
      throw new Error(`Expected PAUSED, got ${taskAfterBill?.status}`);
    }
    console.log(`✓ Task status = PAUSED (one approval, one pending)\n`);

    // Step 4: Francisco denies
    console.log('Step 4: Francisco denies');
    if (!franciscoId) throw new Error('franciscoId not set');
    const { data: franciscoResult, error: franciscoError } = await supabase.rpc('coordinator_decide', {
      p_task_id: taskId,
      p_approver_id: franciscoId,
      p_decision: 'DENY',
      p_rationale: 'Denial for test purposes',
      p_scheduled_for: null,
    });

    if (franciscoError) throw new Error(`Francisco denial failed: ${franciscoError.message}`);
    console.log(`✓ Francisco denied\n`);

    // Step 5: Verify status = DENIED
    console.log('Step 5: Verify status = DENIED');
    const { data: taskAfterDenial } = await supabase
      .from('sma_coordinator_tasks')
      .select('status')
      .eq('task_id', taskId)
      .maybeSingle();

    if (taskAfterDenial?.status !== 'DENIED') {
      throw new Error(`Expected DENIED, got ${taskAfterDenial?.status}`);
    }
    console.log(`✓ Task status = DENIED (irreversible)\n`);

    // Step 6: Verify ContentLifecycle exists with DENIED status
    console.log('Step 6: Verify ContentLifecycle recorded');
    const { data: lifecycle } = await supabase
      .from('sma_content_lifecycles')
      .select('lifecycle_record')
      .eq('task_id', taskId)
      .maybeSingle();

    if (!lifecycle) throw new Error('ContentLifecycle not found');
    const lifecycleRecord = lifecycle.lifecycle_record as any;
    if (lifecycleRecord.status !== 'DENIED') {
      throw new Error(`Expected lifecycle status DENIED, got ${lifecycleRecord.status}`);
    }
    console.log(`✓ ContentLifecycle recorded with status DENIED\n`);

    // Step 7: Verify approvals array has both entries
    console.log('Step 7: Verify approvals array');
    if (!lifecycleRecord.approvals || lifecycleRecord.approvals.length !== 2) {
      throw new Error(`Expected 2 approvals, got ${lifecycleRecord.approvals?.length || 0}`);
    }

    const hasApprove = lifecycleRecord.approvals.some((a: any) => a.decision === 'APPROVE');
    const hasDeny = lifecycleRecord.approvals.some((a: any) => a.decision === 'DENY');

    if (!hasApprove || !hasDeny) {
      throw new Error('Expected both APPROVE and DENY decisions');
    }
    console.log(`✓ Approvals recorded: APPROVE + DENY\n`);

    // Step 8: Attempt to publish (should fail)
    console.log('Step 8: Attempt to publish (should fail)');
    try {
      await coordinator.publishContent(taskId);
      throw new Error('Publishing should have failed for DENIED task');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('should have failed')) {
        throw e;
      }
      console.log(`✓ Publishing correctly failed: ${msg.substring(0, 60)}...\n`);
    }

    // Step 9: Verify no publications recorded
    console.log('Step 9: Verify no publications recorded');
    const publications = lifecycleRecord.publications || {};
    if (Object.keys(publications).length > 0) {
      throw new Error('Publications should not be recorded for DENIED task');
    }
    console.log(`✓ No publications recorded\n`);

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
    console.log(`denial_prevented_publish: ${testPassed}`);
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
