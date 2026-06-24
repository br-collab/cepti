/**
 * scripts/sma/verify-approval-loop.ts
 *
 * End-to-end verification of the approval loop.
 *
 * Flow:
 * 1. Issue task
 * 2. Create handoff
 * 3. Draft post
 * 4. Request approval (full context)
 * 5. List paused lifecycles (verify one row)
 * 6. Get approver from sma_admins
 * 7. Resume with APPROVE
 * 8. Verify task COMPLETE, one ContentLifecycle row
 * 9. Print the assembled lifecycle with lineage_hash and caption
 * 10. Clean up (explicit deletes)
 */

import fs from 'fs';
import path from 'path';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';
import { SMACoordinator } from '../../lib/sma/coordinator/coordinator';
import { FacebookAgent } from '../../lib/sma/agents/facebook-agent';
import type { ContentIntent, Platform, ApprovalContext, ContentLifecycle } from '../../lib/sma/coordinator/types';

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
  console.log('=== Approval Loop End-to-End Verification ===\n');

  let taskId: string | null = null;
  let handoffId: string | null = null;

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

    // Stage 3: Issue task
    console.log('Stage 3: Issuing task...');
    const testIntent: ContentIntent = {
      intent_id: 'INT-APPROVAL-TEST',
      proposed_by: 'bill',
      proposed_at: new Date().toISOString(),
      topic: 'TEST — approval loop verification',
      notes: 'Verify full approval cycle with ContentLifecycle assembly',
      proposed_platforms: ['facebook'],
      scheduled_for: null,
    };

    taskId = await coordinator.issueTask(testIntent, ['facebook']);
    console.log(`✓ Task issued: ${taskId}\n`);

    // Stage 4: Create handoff and draft
    console.log('Stage 4: Creating handoff and drafting post...');
    const handoffRecord = await coordinator.handoff(
      taskId,
      'COORDINATOR',
      'FACEBOOK_AGENT',
      testIntent,
      'Dispatch to draft for approval verification',
    );
    handoffId = handoffRecord.handoff_id;
    console.log(`✓ Handoff created: ${handoffId}`);

    const draftResult = await agent.draftPost(handoffRecord, testIntent);
    console.log(`✓ Draft created: ${draftResult.draft_id}\n`);

    // Stage 5: Request approval with full context
    console.log('Stage 5: Requesting approval with full context...');
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

    // Stage 6: List paused lifecycles
    console.log('Stage 6: Listing paused lifecycles...');
    const paused = await coordinator.listPausedLifecycles();
    const pausedTask = paused.find((p) => p.task_id === taskId);
    if (!pausedTask) throw new Error(`Task ${taskId} not found in paused lifecycles`);
    console.log(`✓ Found paused task in list\n`);

    // Stage 7: Get approver from sma_admins
    console.log('Stage 7: Getting approver from sma_admins...');
    const { data: admins, error: adminError } = await supabase
      .from('sma_admins')
      .select('user_id')
      .limit(1);

    if (adminError || !admins || admins.length === 0) {
      throw new Error('No sma_admins user found');
    }

    const approverId = admins[0].user_id;
    console.log(`✓ Approver selected: ${approverId}\n`);

    // Stage 8: Resume with APPROVE
    console.log('Stage 8: Resuming with APPROVE decision...');
    const resumeResult = await coordinator.resumeLifecycle(taskId, 'APPROVE', {
      approver_id: approverId,
      decided_by: 'bill',
      rationale: 'Test approval for verification script',
    });

    if (resumeResult.status !== 'COMPLETE') {
      throw new Error(`Resume failed: ${resumeResult.status}`);
    }

    const lifecycle = resumeResult.lifecycle;
    console.log('✓ Resume completed\n');

    // Stage 9: Verify task status and lifecycle
    console.log('Stage 9: Verifying task status and ContentLifecycle...');
    const { data: completedTask, error: taskStatusError } = await supabase
      .from('sma_coordinator_tasks')
      .select('status')
      .eq('task_id', taskId)
      .single();

    if (taskStatusError || completedTask?.status !== 'COMPLETE') {
      throw new Error(`Task status not COMPLETE: ${completedTask?.status}`);
    }

    const { data: lifecycleRow, error: lifecycleError } = await supabase
      .from('sma_content_lifecycles')
      .select('*')
      .eq('task_id', taskId);

    if (lifecycleError || !lifecycleRow || lifecycleRow.length !== 1) {
      throw new Error(`Expected 1 ContentLifecycle row, got ${lifecycleRow?.length || 0}`);
    }

    console.log('✓ Task status is COMPLETE');
    console.log('✓ Exactly one ContentLifecycle row exists\n');

    // Stage 10: Print the assembled lifecycle
    console.log('=== ASSEMBLED CONTENT LIFECYCLE ===');
    console.log(JSON.stringify(lifecycle, null, 2));
    console.log('===================================\n');

    console.log('Lineage Hash:');
    console.log(`  ${lifecycle.lineage_hash}\n`);

    const facebookDraft = lifecycle.drafts.facebook;
    if (facebookDraft) {
      console.log('Generated Caption (from DraftResult.body):');
      console.log('---');
      console.log(facebookDraft.body);
      console.log('---\n');
    }

    // Stage 11: Clean up (explicit deletes, child-first)
    console.log('Stage 11: Cleaning up (explicit deletes, child-first)...');

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
