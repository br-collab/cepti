/**
 * scripts/sma/verify-draft-post.ts
 *
 * End-to-end verification of FacebookAgent.draftPost() implementation.
 *
 * Flow:
 * 1. Load .env.local
 * 2. Create Coordinator instance with service-role client
 * 3. Issue task with real CEPTI intent (Ladriflex)
 * 4. Create handoff from COORDINATOR to FACEBOOK_AGENT
 * 5. Call FacebookAgent.draftPost()
 * 6. Print caption verbatim with token counts
 * 7. Verify:
 *    - Final caption contains wa.me/18294491104
 *    - LLM portion contains no wa.me and no phone-number patterns
 *    - '917' appears nowhere in any part
 * 8. Clean up task and handoff rows
 */

import fs from 'fs';
import path from 'path';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';
import { SMACoordinator } from '../../lib/sma/coordinator/coordinator';
import { FacebookAgent } from '../../lib/sma/agents/facebook-agent';
import type { ContentIntent, Platform } from '../../lib/sma/coordinator/types';

const loadEnvLocal = (): void => {
  const envPath = path.join(__dirname, '../../.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env.local not found at ${envPath}`);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim();

    if (key === 'ANTHROPIC_API_KEY' && value) {
      process.env.ANTHROPIC_API_KEY = value;
    }
    if (key === 'SUPABASE_URL' && value) {
      process.env.SUPABASE_URL = value;
    }
    if (key === 'NEXT_PUBLIC_SUPABASE_URL' && value) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = value;
    }
    if (key === 'SUPABASE_SERVICE_ROLE_KEY' && value) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = value;
    }
  }
};

const main = async (): Promise<void> => {
  console.log('=== Facebook Agent: draftPost() End-to-End Verification ===\n');

  let taskId: string | null = null;
  let handoffId: string | null = null;

  try {
    // Stage 1: Load environment
    console.log('Stage 1: Loading .env.local...');
    loadEnvLocal();
    console.log('✓ Environment loaded\n');

    // Stage 2: Create Coordinator and agent
    console.log('Stage 2: Creating Coordinator and FacebookAgent...');
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) {
      throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL not set');
    }
    if (!serviceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
    }

    const supabase = createClient(url, serviceKey, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      realtime: { transport: ws as any },
    });
    const coordinator = new SMACoordinator(supabase);
    const agent = new FacebookAgent();
    console.log('✓ Coordinator and agent created\n');

    // Stage 3: Issue task
    console.log('Stage 3: Issuing task with Ladriflex intent...');
    const testIntent: ContentIntent = {
      intent_id: 'INT-VERIFY-FB-001',
      proposed_by: 'bill',
      proposed_at: new Date().toISOString(),
      topic: 'Ladriflex — ventajas del ladrillo flexible para fachadas',
      notes: 'Enfatizar durabilidad, flexibilidad, y aplicación en fachadas modernas',
      proposed_platforms: ['facebook'],
      scheduled_for: null,
    };
    const testPlatforms: Platform[] = ['facebook'];

    taskId = await coordinator.issueTask(testIntent, testPlatforms);
    console.log(`✓ Task issued: ${taskId}\n`);

    // Stage 4: Create handoff
    console.log('Stage 4: Creating handoff to FACEBOOK_AGENT...');
    const handoffRecord = await coordinator.handoff(
      taskId,
      'COORDINATOR',
      'FACEBOOK_AGENT',
      testIntent,
      'Dispatch to draft Ladriflex caption',
    );
    handoffId = handoffRecord.handoff_id;
    console.log(`✓ Handoff created: ${handoffId}\n`);

    // Stage 5: Draft post
    console.log('Stage 5: Calling FacebookAgent.draftPost()...');
    const draftResult = await agent.draftPost(handoffRecord, testIntent);
    console.log('✓ Draft generated\n');

    // Stage 6: Print caption and metadata
    console.log('=== GENERATED CAPTION ===');
    console.log(draftResult.body);
    console.log('========================\n');

    console.log('Token usage:');
    console.log(`  Input: ${draftResult.tokens_input}`);
    console.log(`  Output: ${draftResult.tokens_output}\n`);

    // Stage 7: Verify constraints
    console.log('Stage 6: Verifying constraints...');
    const errors: string[] = [];

    // Check: Final caption contains wa.me/18294491104
    if (!draftResult.body.includes('wa.me/18294491104')) {
      errors.push('Final caption missing wa.me/18294491104');
    } else {
      console.log('✓ Final caption contains wa.me/18294491104');
    }

    // Extract LLM-generated portion (everything before the wa.me link)
    const waLinkIndex = draftResult.body.indexOf('https://wa.me/');
    const llmPortion = waLinkIndex > 0 ? draftResult.body.substring(0, waLinkIndex) : draftResult.body;

    // Check: LLM portion contains no wa.me
    if (llmPortion.toLowerCase().includes('wa.me')) {
      errors.push('LLM-generated portion incorrectly contains "wa.me"');
    } else {
      console.log('✓ LLM portion contains no "wa.me"');
    }

    // Check: LLM portion contains no phone-number-like sequences
    const phonePattern = /\b\d{3}[.-]?\d{3}[.-]?\d{4}\b|\b\d{10}\b|\(\d{3}\)/;
    if (phonePattern.test(llmPortion)) {
      errors.push('LLM portion contains phone-number-like sequence');
    } else {
      console.log('✓ LLM portion contains no phone-number patterns');
    }

    // Check: '917' appears nowhere
    if (draftResult.body.includes('917')) {
      errors.push('"917" appears in caption (banned number sequence)');
    } else {
      console.log('✓ "917" does not appear anywhere');
    }

    if (errors.length > 0) {
      throw new Error(`Verification failed:\n${errors.join('\n')}`);
    }

    console.log('\n✓ All verification checks passed\n');

    // Stage 8: Cleanup
    console.log('Stage 7: Cleaning up (deleting task and handoff rows)...');

    const { error: deleteHandoffError } = await supabase
      .from('sma_handoffs')
      .delete()
      .eq('handoff_id', handoffId);

    if (deleteHandoffError) {
      throw new Error(`Failed to delete handoff: ${deleteHandoffError.message}`);
    }

    const { error: deleteTaskError } = await supabase
      .from('sma_coordinator_tasks')
      .delete()
      .eq('task_id', taskId);

    if (deleteTaskError) {
      throw new Error(`Failed to delete task: ${deleteTaskError.message}`);
    }

    console.log(`✓ Task and handoff deleted\n`);
    console.log('=== VERIFICATION PASSED ===');
  } catch (error) {
    console.error('\n✗ Verification failed:', error);

    // Attempt cleanup even on error
    if (taskId || handoffId) {
      console.log('\nAttempting cleanup after error...');
      try {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (url && serviceKey) {
          const supabase = createClient(url, serviceKey, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            realtime: { transport: ws as any },
          });

          if (handoffId) {
            await supabase.from('sma_handoffs').delete().eq('handoff_id', handoffId);
          }
          if (taskId) {
            await supabase.from('sma_coordinator_tasks').delete().eq('task_id', taskId);
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
