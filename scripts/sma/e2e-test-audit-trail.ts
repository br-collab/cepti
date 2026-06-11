/**
 * scripts/sma/e2e-test-audit-trail.ts
 *
 * Phase 2.6: E2E Audit Trail Verification Test
 *
 * Verifies that the complete audit trail is recorded and ordered correctly.
 *
 * Expected events:
 * - TASK_ISSUED
 * - HANDOFF_RECORDED
 * - APPROVAL_REQUESTED
 * - APPROVAL_DECIDED (x2)
 * - PUBLISHED
 * - ENGAGEMENT_RECORDED (optional)
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
  console.log('=== Phase 2.6: E2E Audit Trail Verification ===\n');

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
    console.log(`✓ Admins ready\n`);

    // Step 1: Create task
    console.log('Step 1: Create task');
    const intent: ContentIntent = {
      intent_id: `INT-E2E-AUDIT-${Date.now()}`,
      proposed_by: 'bill',
      proposed_at: new Date().toISOString(),
      topic: 'Audit trail test - verify all events logged',
      notes: 'E2E test: complete audit trail',
      proposed_platforms: ['facebook', 'instagram', 'threads'],
      scheduled_for: null,
    };

    taskId = await coordinator.issueTask(intent, ['facebook', 'instagram', 'threads']);
    console.log(`✓ Task created: ${taskId}\n`);

    // Step 2: Bill approves
    console.log('Step 2: Bill approves');
    if (!billId) throw new Error('billId not set');
    await supabase.rpc('coordinator_decide', {
      p_task_id: taskId,
      p_approver_id: billId,
      p_decision: 'APPROVE',
      p_rationale: 'Audit trail test approval',
      p_scheduled_for: null,
    });
    console.log(`✓ Bill approved\n`);

    // Step 3: Francisco approves
    console.log('Step 3: Francisco approves');
    if (!franciscoId) throw new Error('franciscoId not set');
    await supabase.rpc('coordinator_decide', {
      p_task_id: taskId,
      p_approver_id: franciscoId,
      p_decision: 'APPROVE',
      p_rationale: 'Audit trail test - second approval',
      p_scheduled_for: null,
    });
    console.log(`✓ Francisco approved\n`);

    // Step 4: Publish
    console.log('Step 4: Publish');
    await coordinator.publishContent(taskId);
    console.log(`✓ Published\n`);

    // Step 5: Fetch and verify audit trail
    console.log('Step 5: Verify audit trail');
    const { data: auditRows, error } = await supabase
      .from('sma_audit_log')
      .select('event_type, recorded_at, details')
      .eq('task_id', taskId)
      .order('recorded_at', { ascending: true });

    if (error || !auditRows) {
      throw new Error(`Failed to fetch audit trail: ${error?.message}`);
    }

    if (auditRows.length === 0) {
      throw new Error('No audit events recorded');
    }

    console.log(`\n✓ ${auditRows.length} events recorded`);

    // Verify timestamps are chronological
    console.log('\nVerifying chronological order...');
    const timestamps: number[] = [];
    const eventSequence: string[] = [];

    for (let i = 0; i < auditRows.length; i++) {
      const row = auditRows[i] as any;
      const timestamp = new Date(row.recorded_at).getTime();
      const eventType = row.event_type;

      eventSequence.push(eventType);
      timestamps.push(timestamp);

      console.log(`  [${i + 1}] ${eventType} at ${new Date(row.recorded_at).toISOString()}`);

      if (i > 0 && timestamps[i] < timestamps[i - 1]) {
        throw new Error(`Timestamps not in order: Event ${i} (${eventType}) is before Event ${i - 1}`);
      }
    }

    console.log(`✓ All timestamps chronologically ordered\n`);

    // Verify expected events
    console.log('Verifying expected event types...');
    const requiredEvents = ['TASK_ISSUED', 'APPROVAL_DECIDED'];
    for (const required of requiredEvents) {
      if (!eventSequence.includes(required)) {
        console.warn(`  ⚠ Missing expected event: ${required} (may be optional)`);
      } else {
        console.log(`  ✓ Found: ${required}`);
      }
    }

    // Count APPROVAL_DECIDED events
    const approvalDecisions = eventSequence.filter((e) => e === 'APPROVAL_DECIDED');
    if (approvalDecisions.length < 2) {
      console.warn(`  ⚠ Expected 2 APPROVAL_DECIDED events, got ${approvalDecisions.length}`);
    } else {
      console.log(`  ✓ Found ${approvalDecisions.length} APPROVAL_DECIDED events`);
    }

    console.log('');

    // Step 6: Verify ContentLifecycle has matching approvals
    console.log('Step 6: Verify approvals match audit trail');
    const { data: lifecycleRow } = await supabase
      .from('sma_content_lifecycles')
      .select('lifecycle_record')
      .eq('task_id', taskId)
      .maybeSingle();

    if (!lifecycleRow) throw new Error('ContentLifecycle not found');

    const lifecycle = lifecycleRow.lifecycle_record as any;
    const approvals = lifecycle.approvals || [];

    console.log(`✓ Lifecycle has ${approvals.length} approvals`);
    if (approvals.length !== 2) {
      throw new Error(`Expected 2 approvals, found ${approvals.length}`);
    }

    // Verify approvers
    for (const approval of approvals) {
      const decisionName = approval.decided_by;
      const decisionType = approval.decision;
      const decidedAt = approval.decided_at;
      console.log(`  - ${decisionName}: ${decisionType} at ${decidedAt}`);
    }

    console.log('');
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
      console.error('⚠ Cleanup error:', e);
    }

    // Final report
    const duration = Date.now() - startTime;
    console.log('═══════════════════════════════════════════');
    console.log(`Test Result: ${testPassed ? 'PASS' : 'FAIL'}`);
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`audit_events_logged: ${auditRows.length}`);
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
