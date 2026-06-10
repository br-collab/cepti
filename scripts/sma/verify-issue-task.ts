/**
 * scripts/sma/verify-issue-task.ts
 *
 * End-to-end verification of issueTask() implementation.
 *
 * Flow:
 * 1. Load .env.local
 * 2. Create Coordinator instance with service-role client
 * 3. Call issueTask with test ContentIntent
 * 4. Read task row back from database
 * 5. Verify all fields match
 * 6. Delete the test row (cleanup)
 * 7. Report each stage
 */

import fs from 'fs';
import path from 'path';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';
import { SMACoordinator } from '../../lib/sma/coordinator/coordinator';
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
  console.log('=== SMA Coordinator: issueTask() End-to-End Verification ===\n');

  try {
    // Stage 1: Load environment
    console.log('Stage 1: Loading .env.local...');
    loadEnvLocal();
    console.log('✓ Environment loaded\n');

    // Stage 2: Create Coordinator
    console.log('Stage 2: Creating Coordinator with service-role client...');
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) {
      throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL not set');
    }
    if (!serviceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
    }

    const supabase = createClient(url, serviceKey, {
      realtime: { transport: ws as any },
    });
    const coordinator = new SMACoordinator(supabase);
    console.log('✓ Coordinator instance created\n');

    // Stage 3: Issue test task
    console.log('Stage 3: Calling issueTask() with test ContentIntent...');
    const testIntent: ContentIntent = {
      intent_id: 'INT-TEST-001',
      proposed_by: 'bill',
      proposed_at: new Date().toISOString(),
      topic: 'TEST — pipeline verification',
      notes: 'Automated test task for issueTask verification',
      proposed_platforms: ['facebook'],
      scheduled_for: null,
    };
    const testPlatforms: Platform[] = ['facebook'];

    const taskId = await coordinator.issueTask(testIntent, testPlatforms);
    console.log(`✓ Task issued successfully`);
    console.log(`  Task ID: ${taskId}\n`);

    // Stage 4: Read task row back
    console.log('Stage 4: Reading task row from database...');
    const { data: taskRow, error: readError } = await supabase
      .from('sma_coordinator_tasks')
      .select('*')
      .eq('task_id', taskId)
      .single();

    if (readError) {
      throw new Error(`Failed to read task row: ${readError.message}`);
    }

    console.log('✓ Task row retrieved');
    console.log(`  task_id: ${taskRow.task_id}`);
    console.log(`  status: ${taskRow.status}`);
    console.log(`  platforms: ${taskRow.platforms.join(', ')}`);
    console.log(`  intent.topic: ${taskRow.intent.topic}`);
    console.log(`  intent.proposed_by: ${taskRow.intent.proposed_by}`);
    console.log(`  created_at: ${taskRow.created_at}\n`);

    // Stage 5: Verify fields
    console.log('Stage 5: Verifying field integrity...');
    const errors: string[] = [];

    if (taskRow.task_id !== taskId) {
      errors.push(`task_id mismatch: ${taskRow.task_id} !== ${taskId}`);
    }
    if (taskRow.status !== 'ACTIVE') {
      errors.push(`status mismatch: expected ACTIVE, got ${taskRow.status}`);
    }
    if (JSON.stringify(taskRow.platforms) !== JSON.stringify(testPlatforms)) {
      errors.push(`platforms mismatch: expected [facebook], got ${taskRow.platforms}`);
    }
    if (taskRow.intent.topic !== testIntent.topic) {
      errors.push(`intent.topic mismatch: ${taskRow.intent.topic} !== ${testIntent.topic}`);
    }
    if (taskRow.intent.proposed_by !== testIntent.proposed_by) {
      errors.push(
        `intent.proposed_by mismatch: ${taskRow.intent.proposed_by} !== ${testIntent.proposed_by}`,
      );
    }

    if (errors.length > 0) {
      throw new Error(`Verification failed:\n${errors.join('\n')}`);
    }

    console.log('✓ All fields verified correctly\n');

    // Stage 6: Delete test row
    console.log('Stage 6: Cleaning up test row...');
    const { error: deleteError } = await supabase
      .from('sma_coordinator_tasks')
      .delete()
      .eq('task_id', taskId);

    if (deleteError) {
      throw new Error(`Failed to delete test row: ${deleteError.message}`);
    }

    console.log(`✓ Test row deleted (task_id: ${taskId})\n`);

    // Success
    console.log('=== VERIFICATION PASSED ===');
  } catch (error) {
    console.error('\n✗ Verification failed:', error);
    process.exit(1);
  }
};

main();
