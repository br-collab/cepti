/**
 * scripts/sma/e2e-test-db-integrity.ts
 *
 * Phase 2.6: E2E Database Integrity Test
 *
 * Verifies no orphaned rows and no data corruption.
 *
 * Checks:
 * - All task_ids have corresponding lifecycle rows
 * - All approvals reference existing users
 * - No null required fields
 * - Timestamps are valid ISO 8601
 * - Status enums are valid
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

interface IntegrityIssue {
  type: string;
  description: string;
  severity: 'ERROR' | 'WARNING';
}

const main = async (): Promise<void> => {
  console.log('=== Phase 2.6: E2E Database Integrity Test ===\n');

  const startTime = Date.now();
  const issues: IntegrityIssue[] = [];
  let taskId: string | null = null;

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
    const { data: admins, error: adminError } = await supabase
      .from('sma_admins')
      .select('user_id')
      .limit(2);

    if (adminError || !admins || admins.length < 2) {
      throw new Error('Need at least 2 sma_admins users');
    }

    const billId = admins[0].user_id;
    const franciscoId = admins[1].user_id;

    // Create a test task for verification
    console.log('Creating test data...');
    const intent: ContentIntent = {
      intent_id: `INT-E2E-INTEGRITY-${Date.now()}`,
      proposed_by: 'bill',
      proposed_at: new Date().toISOString(),
      topic: 'Integrity test - verify database consistency',
      proposed_platforms: ['facebook'],
      scheduled_for: null,
    };

    taskId = await coordinator.issueTask(intent, ['facebook']);

    // Approve to create ContentLifecycle
    if (!billId || !franciscoId) throw new Error('Missing admin IDs');
    await supabase.rpc('coordinator_decide', {
      p_task_id: taskId,
      p_approver_id: billId,
      p_decision: 'APPROVE',
      p_rationale: 'Integrity test',
      p_scheduled_for: null,
    });
    await supabase.rpc('coordinator_decide', {
      p_task_id: taskId,
      p_approver_id: franciscoId,
      p_decision: 'APPROVE',
      p_rationale: 'Integrity test',
      p_scheduled_for: null,
    });

    await coordinator.publishContent(taskId);
    console.log(`✓ Test data created\n`);

    // ── Check 1: Referential Integrity ─────────────────────────────────
    console.log('Check 1: Referential integrity');

    const { data: tasks } = await supabase.from('sma_coordinator_tasks').select('task_id').limit(10);

    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        // Each task should have a lifecycle record
        const { data: lifecycles } = await supabase
          .from('sma_content_lifecycles')
          .select('task_id')
          .eq('task_id', task.task_id);

        if (!lifecycles || lifecycles.length === 0) {
          const { data: pausedLc } = await supabase
            .from('sma_paused_lifecycles')
            .select('task_id')
            .eq('task_id', task.task_id);

          if (!pausedLc || pausedLc.length === 0) {
            issues.push({
              type: 'ORPHANED_TASK',
              description: `Task ${task.task_id} has no lifecycle record`,
              severity: 'ERROR',
            });
          }
        }
      }
    }

    if (issues.length === 0) {
      console.log('✓ All tasks have lifecycle records\n');
    }

    // ── Check 2: Valid Timestamps ──────────────────────────────────────
    console.log('Check 2: Valid timestamps');

    const { data: contentLifecycles } = await supabase
      .from('sma_content_lifecycles')
      .select('task_id, lifecycle_record')
      .limit(10);

    if (contentLifecycles && contentLifecycles.length > 0) {
      for (const lc of contentLifecycles) {
        const record = lc.lifecycle_record as any;

        // Check intent timestamp
        if (record.intent?.proposed_at) {
          try {
            new Date(record.intent.proposed_at).toISOString();
          } catch (e) {
            issues.push({
              type: 'INVALID_TIMESTAMP',
              description: `Task ${lc.task_id} has invalid proposed_at`,
              severity: 'ERROR',
            });
          }
        }

        // Check approval timestamps
        if (record.approvals && Array.isArray(record.approvals)) {
          for (const approval of record.approvals) {
            if (approval.decided_at) {
              try {
                new Date(approval.decided_at).toISOString();
              } catch (e) {
                issues.push({
                  type: 'INVALID_TIMESTAMP',
                  description: `Task ${lc.task_id} has invalid approval decided_at`,
                  severity: 'ERROR',
                });
              }
            }
          }
        }
      }
    }

    if (issues.filter((i) => i.type === 'INVALID_TIMESTAMP').length === 0) {
      console.log('✓ All timestamps are valid ISO 8601\n');
    }

    // ── Check 3: Required Fields ────────────────────────────────────────
    console.log('Check 3: Required fields');

    if (contentLifecycles && contentLifecycles.length > 0) {
      for (const lc of contentLifecycles) {
        const record = lc.lifecycle_record as any;

        // Check required fields
        if (!record.task_id) {
          issues.push({
            type: 'MISSING_FIELD',
            description: `Lifecycle missing task_id`,
            severity: 'ERROR',
          });
        }
        if (!record.status) {
          issues.push({
            type: 'MISSING_FIELD',
            description: `Task ${lc.task_id} lifecycle missing status`,
            severity: 'ERROR',
          });
        }
        if (!record.intent) {
          issues.push({
            type: 'MISSING_FIELD',
            description: `Task ${lc.task_id} lifecycle missing intent`,
            severity: 'ERROR',
          });
        }
      }
    }

    if (issues.filter((i) => i.type === 'MISSING_FIELD').length === 0) {
      console.log('✓ All required fields present\n');
    }

    // ── Check 4: Valid Status Enums ────────────────────────────────────
    console.log('Check 4: Valid status enums');

    const validStatuses = ['ACTIVE', 'PAUSED', 'COMPLETE', 'DENIED', 'FAILED'];

    if (contentLifecycles && contentLifecycles.length > 0) {
      for (const lc of contentLifecycles) {
        const record = lc.lifecycle_record as any;
        if (record.status && !validStatuses.includes(record.status)) {
          issues.push({
            type: 'INVALID_STATUS',
            description: `Task ${lc.task_id} has invalid status: ${record.status}`,
            severity: 'ERROR',
          });
        }
      }
    }

    if (issues.filter((i) => i.type === 'INVALID_STATUS').length === 0) {
      console.log('✓ All status values are valid\n');
    }

    // ── Check 5: Approval User Validity ────────────────────────────────
    console.log('Check 5: Approval user validity');

    const { data: approvalDecisions } = await supabase
      .from('sma_approval_decisions')
      .select('approver_id, task_id')
      .limit(10);

    if (approvalDecisions && approvalDecisions.length > 0) {
      const { data: validAdminIds } = await supabase.from('sma_admins').select('user_id');
      const adminIdSet = new Set(validAdminIds?.map((a: any) => a.user_id) || []);

      for (const decision of approvalDecisions) {
        if (decision.approver_id && !adminIdSet.has(decision.approver_id)) {
          issues.push({
            type: 'INVALID_APPROVER',
            description: `Task ${decision.task_id} has approval from non-existent user ${decision.approver_id}`,
            severity: 'ERROR',
          });
        }
      }
    }

    if (issues.filter((i) => i.type === 'INVALID_APPROVER').length === 0) {
      console.log('✓ All approvers are valid users\n');
    }

    // ── Summary ────────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════');

    if (issues.length === 0) {
      console.log('Database Integrity: PASS');
      console.log('No issues found');
    } else {
      const errors = issues.filter((i) => i.severity === 'ERROR');
      const warnings = issues.filter((i) => i.severity === 'WARNING');

      console.log(`Database Integrity: ${errors.length > 0 ? 'FAIL' : 'WARN'}`);
      console.log(`Errors: ${errors.length}`);
      console.log(`Warnings: ${warnings.length}`);

      if (errors.length > 0) {
        console.log('\nErrors:');
        errors.forEach((e) => {
          console.log(`  [${e.type}] ${e.description}`);
        });
      }

      if (warnings.length > 0) {
        console.log('\nWarnings:');
        warnings.forEach((w) => {
          console.log(`  [${w.type}] ${w.description}`);
        });
      }
    }

    console.log('═══════════════════════════════════════════\n');

    // Cleanup
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
        console.error('⚠ Cleanup error:', e);
      }
    }

    const duration = Date.now() - startTime;
    const errorCount = issues.filter((i) => i.severity === 'ERROR').length;

    process.exit(errorCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error:', error);

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
