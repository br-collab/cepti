/**
 * scripts/sma/verify-multi-user-approval.ts
 *
 * End-to-end verification of Phase 2.4: Multi-User Simultaneous Approvals
 *
 * Flow:
 * 1. Issue task
 * 2. Create handoff and draft post
 * 3. Request approval (full context)
 * 4. Bill approves (first approval, should be PENDING)
 * 5. Verify task still PAUSED, no ContentLifecycle yet
 * 6. Francisco approves (second approval, should be COMPLETE)
 * 7. Verify task COMPLETE, ContentLifecycle created with both approvals
 * 8. Test error: Bill tries to approve again (should fail)
 * 9. Clean up
 */

import fs from 'fs';
import path from 'path';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';
import { SMACoordinator } from '../../lib/sma/coordinator/coordinator';
import { FacebookAgent } from '../../lib/sma/agents/facebook-agent';
import type { ContentIntent, ApprovalContext } from '../../lib/sma/coordinator/types';

const loadEnvLocal = (): void => {
  const envPath = path.join(__dirname, '../../.env.local');
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
  console.log('=== Phase 2.4: Multi-User Approval Verification ===\n');

  let taskId: string | null = null;
  let handoffId: string | null = null;
  let billId: string | null = null;
  let franciscoId: string | null = null;

  try {
    // Load environment
    console.log('Stage 1: Loading environment...');
    loadEnvLocal();
    console.log('✓ Environment loaded\n');

    // Setup
    console.log('Stage 2: Creating clients...');
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) throw new Error('Missing Supabase credentials');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient(url, serviceKey, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      realtime: { transport: ws as any },
    });

    const coordinator = new SMACoordinator(supabase);
    const agent = new FacebookAgent();
    console.log('✓ Clients created\n');

    // Get admin users
    console.log('Stage 3: Getting admin users...');
    const { data: admins, error: adminError } = await supabase
      .from('sma_admins')
      .select('user_id, name')
      .limit(2);

    if (adminError || !admins || admins.length < 2) {
      throw new Error('Need at least 2 sma_admins users for this test');
    }

    billId = admins[0].user_id;
    franciscoId = admins[1].user_id;
    if (!billId || !franciscoId) {
      throw new Error('Failed to get admin IDs');
    }
    console.log(`✓ Bill ID: ${billId}`);
    console.log(`✓ Francisco ID: ${franciscoId}\n`);

    // Stage 4: Issue task
    console.log('Stage 4: Issuing task...');
    const testIntent: ContentIntent = {
      intent_id: 'INT-MULTI-APPROVAL-TEST',
      proposed_by: 'bill',
      proposed_at: new Date().toISOString(),
      topic: 'TEST — multi-user approval flow',
      notes: 'Verify Bill and Francisco can both approve independently',
      proposed_platforms: ['facebook'],
      scheduled_for: null,
    };

    taskId = await coordinator.issueTask(testIntent, ['facebook']);
    if (!taskId) {
      throw new Error('Failed to issue task');
    }
    console.log(`✓ Task issued: ${taskId}\n`);

    // Stage 5: Create handoff and draft
    console.log('Stage 5: Creating handoff and drafting post...');
    const handoffRecord = await coordinator.handoff(
      taskId,
      'COORDINATOR',
      'FACEBOOK_AGENT',
      testIntent,
      'Dispatch to draft for multi-user approval verification',
    );
    handoffId = handoffRecord.handoff_id;
    console.log(`✓ Handoff created: ${handoffId}`);

    const draftResult = await agent.draftPost(handoffRecord, testIntent);
    console.log(`✓ Draft created: ${draftResult.draft_id}\n`);

    // Stage 6: Request approval with full context
    console.log('Stage 6: Requesting approval with full context...');
    const approvalContext: ApprovalContext = {
      task_id: taskId,
      reason: 'AWAITING_DRAFT_APPROVAL',
      intent: testIntent,
      draft: draftResult,
      platform: 'facebook',
      scheduled_for: null,
      related_paused_count: 0,
    };

    await coordinator.requestApproval(taskId, 'AWAITING_DRAFT_APPROVAL', approvalContext);
    console.log('✓ Approval requested\n');

    // Stage 7: Bill approves
    console.log('Stage 7: Bill approves...');
    const billApprovalResult = await coordinator.resumeLifecycle(taskId, 'APPROVE', {
      approver_id: billId,
      decided_by: 'bill',
      rationale: 'Looks good, approved by Bill',
      scheduled_for: null,
    });

    if (billApprovalResult.status !== 'COMPLETE') {
      throw new Error(`Expected COMPLETE, got ${billApprovalResult.status}`);
    }

    // Check that status is PAUSED (pending second approval)
    const billLifecycle = billApprovalResult.lifecycle;
    console.log(`✓ Bill approved`);
    console.log(`  Lifecycle status after Bill approval: ${billLifecycle.status}`);
    console.log(`  Approvals count: ${billLifecycle.approvals.length}`);
    if (billLifecycle.status !== 'PAUSED') {
      throw new Error(`Expected PAUSED after first approval, got ${billLifecycle.status}`);
    }
    console.log('✓ Status is PAUSED (waiting for Francisco)\n');

    // Stage 8: Verify no ContentLifecycle yet
    console.log('Stage 8: Verifying task is still PAUSED...');
    const { data: taskRow, error: taskError } = await supabase
      .from('sma_coordinator_tasks')
      .select('status')
      .eq('task_id', taskId)
      .single();

    if (taskError || taskRow?.status !== 'PAUSED') {
      throw new Error(`Expected task status PAUSED, got ${taskRow?.status}`);
    }
    console.log('✓ Task status is PAUSED\n');

    // Stage 9: Francisco approves
    console.log('Stage 9: Francisco approves...');
    const franciscoApprovalResult = await coordinator.resumeLifecycle(taskId, 'APPROVE', {
      approver_id: franciscoId,
      decided_by: 'francisco',
      rationale: 'Approved by Francisco',
      scheduled_for: null,
    });

    if (franciscoApprovalResult.status !== 'COMPLETE') {
      throw new Error(`Expected COMPLETE, got ${franciscoApprovalResult.status}`);
    }

    const finalLifecycle = franciscoApprovalResult.lifecycle;
    console.log(`✓ Francisco approved`);
    console.log(`  Lifecycle status after both approvals: ${finalLifecycle.status}`);
    console.log(`  Approvals count: ${finalLifecycle.approvals.length}`);
    if (finalLifecycle.status !== 'COMPLETE') {
      throw new Error(`Expected COMPLETE after both approvals, got ${finalLifecycle.status}`);
    }
    if (finalLifecycle.approvals.length !== 2) {
      throw new Error(`Expected 2 approvals, got ${finalLifecycle.approvals.length}`);
    }
    console.log('✓ Status is COMPLETE with both approvals\n');

    // Stage 10: Verify task status updated
    console.log('Stage 10: Verifying task status updated to COMPLETE...');
    const { data: completedTask, error: completedError } = await supabase
      .from('sma_coordinator_tasks')
      .select('status')
      .eq('task_id', taskId)
      .single();

    if (completedError || completedTask?.status !== 'COMPLETE') {
      throw new Error(`Expected task status COMPLETE, got ${completedTask?.status}`);
    }
    console.log('✓ Task status is COMPLETE\n');

    // Stage 11: Test double-approval prevention
    console.log('Stage 11: Testing double-approval prevention...');
    const doubleApprovalResult = await coordinator.resumeLifecycle(taskId, 'APPROVE', {
      approver_id: billId,
      decided_by: 'bill',
      rationale: 'Bill tries to approve again',
      scheduled_for: null,
    });

    if (doubleApprovalResult.status !== 'INVALID_APPROVAL') {
      throw new Error(`Expected INVALID_APPROVAL for double-approval, got ${doubleApprovalResult.status}`);
    }
    console.log(`✓ Double-approval prevented: ${doubleApprovalResult.missing?.[0]}\n`);

    // Stage 12: Print final lifecycle
    console.log('=== FINAL CONTENT LIFECYCLE ===');
    console.log(JSON.stringify(finalLifecycle, null, 2));
    console.log('===================================\n');

    console.log('Approvals:');
    finalLifecycle.approvals.forEach((approval, idx) => {
      console.log(
        `  [${idx + 1}] ${approval.decided_by} - ${approval.decision} at ${approval.decided_at}`,
      );
      console.log(`      Rationale: ${approval.rationale}`);
    });
    console.log();

    // Stage 13: Clean up (explicit deletes, child-first)
    console.log('Stage 13: Cleaning up (explicit deletes, child-first)...');

    // Delete from sma_approval_decisions
    const { error: deleteApprovalsError } = await supabase
      .from('sma_approval_decisions')
      .delete()
      .eq('task_id', taskId);
    if (deleteApprovalsError) throw new Error(`Delete approvals failed: ${deleteApprovalsError.message}`);

    // Delete from sma_content_lifecycles
    const { error: deleteLifecycleError } = await supabase
      .from('sma_content_lifecycles')
      .delete()
      .eq('task_id', taskId);
    if (deleteLifecycleError) throw new Error(`Delete lifecycle failed: ${deleteLifecycleError.message}`);

    // Delete from sma_paused_lifecycles
    const { error: deletePausedError } = await supabase
      .from('sma_paused_lifecycles')
      .delete()
      .eq('task_id', taskId);
    if (deletePausedError) throw new Error(`Delete paused failed: ${deletePausedError.message}`);

    // Delete from sma_handoffs
    if (handoffId) {
      const { error: deleteHandoffError } = await supabase
        .from('sma_handoffs')
        .delete()
        .eq('handoff_id', handoffId);
      if (deleteHandoffError) throw new Error(`Delete handoff failed: ${deleteHandoffError.message}`);
    }

    // Delete from sma_coordinator_tasks
    const { error: deleteTaskError } = await supabase
      .from('sma_coordinator_tasks')
      .delete()
      .eq('task_id', taskId);
    if (deleteTaskError) throw new Error(`Delete task failed: ${deleteTaskError.message}`);

    console.log('✓ All rows deleted\n');
    console.log('=== VERIFICATION PASSED ===');
  } catch (error) {
    console.error('\n✗ Verification failed:', error);

    // Attempt cleanup
    if (taskId || handoffId) {
      console.log('\nAttempting cleanup after error...');
      try {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (url && serviceKey) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const supabase = createClient(url, serviceKey, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            realtime: { transport: ws as any },
          });

          if (taskId) {
            await supabase.from('sma_approval_decisions').delete().eq('task_id', taskId);
            await supabase.from('sma_content_lifecycles').delete().eq('task_id', taskId);
            await supabase.from('sma_paused_lifecycles').delete().eq('task_id', taskId);
            await supabase.from('sma_coordinator_tasks').delete().eq('task_id', taskId);
          }
          if (handoffId) {
            await supabase.from('sma_handoffs').delete().eq('handoff_id', handoffId);
          }

          console.log('✓ Cleanup completed');
        }
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
    }

    process.exit(1);
  }
};

main();
