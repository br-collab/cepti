# Phase 2.6: End-to-End Integration Testing
## CEPTI SMA System E2E Test Plan

**Version:** 2.6.0  
**Date:** 2026-06-11  
**Status:** Implementation Complete

---

## 1. Overview

This document specifies the comprehensive end-to-end testing strategy for the CEPTI SMA (Social Media Automation) system. The complete SMA system has been implemented across Phases 1-5:

- **Phase 1:** Coordinator lifecycle management (task dispatch, handoff, approval)
- **Phase 2.1:** Advanced scheduling with `scheduled_for` field
- **Phase 2.2:** Content publishing to Facebook, Instagram, Threads
- **Phase 2.3:** Metrics collection and engagement tracking
- **Phase 2.4:** Multi-user approval (Bill and Francisco independent approvals)
- **Phase 2.5:** Analytics dashboard (parallel track)
- **Phase 2.6:** End-to-End integration testing (this phase)

The E2E test suite verifies that all components work together seamlessly from draft creation through publication and analytics.

---

## 2. Test Workflows

### 2.1 Happy Path (Basic Workflow)

**Objective:** Verify the complete workflow succeeds with real data and no errors.

**Steps:**
1. Create content intent: "Ladriflex - benefits of the product"
2. Issue task via `POST /api/sma/coordinator/task`
3. Verify 3 drafts generated (Facebook, Instagram, Threads)
4. Verify images matched and video generated
5. Bill approves via `POST /api/sma/coordinator/decide/[taskId]`
6. Verify status transitions to PENDING (waiting for Francisco)
7. Francisco approves via `POST /api/sma/coordinator/decide/[taskId]`
8. Verify status transitions to COMPLETE
9. Manually publish via `POST /api/sma/coordinator/publish`
10. Verify all 3 platforms have post IDs and permalinks
11. Fetch metrics via `POST /api/sma/coordinator/metrics/refresh`
12. Verify metrics populated in database
13. Check analytics dashboard data

**Success Criteria:**
- All steps complete without error
- Status transitions are correct (PAUSED → PENDING → COMPLETE → PUBLISHED)
- All 3 platforms published successfully
- Metrics appear in database
- Timestamps are chronologically ordered
- No null required fields

**Error Handling:**
- If draft generation fails: log error and abort
- If approval fails: check for validation errors
- If publishing fails: verify permissions and Meta token validity

---

### 2.2 Scheduling Verification

**Objective:** Verify scheduled posts publish at the correct time.

**Steps:**
1. Create draft with `scheduled_for = now + 1 minute`
2. Bill approves with same `scheduled_for`
3. Francisco approves with same `scheduled_for`
4. Verify task status = COMPLETE but `published_at` is null
5. Wait 70 seconds
6. Trigger cron: `POST /api/sma/cron/publish-scheduled`
7. Verify `published_at` is set
8. Verify metrics auto-fetched (or gracefully handle if not yet)

**Success Criteria:**
- Task remains unpublished until scheduled time
- Cron job executes without errors
- Post publishes at scheduled time (±5 seconds tolerance)
- Metrics fetch handles new posts gracefully

**Performance Target:** < 30 seconds for batch publish of 10 posts

---

### 2.3 Multi-User Denial Scenario

**Objective:** Verify that denial by any approver blocks all further action.

**Steps:**
1. Create draft
2. Bill approves: `{ decision: 'APPROVE', ... }`
3. Verify status = PENDING (waiting for Francisco)
4. Francisco denies: `{ decision: 'DENY', ... }`
5. Verify status = DENIED (final, no further approvals)
6. Verify task moved to `sma_content_lifecycles` with DENIED status
7. Attempt to publish: should fail
8. Verify no Meta API calls made

**Success Criteria:**
- Denial is irreversible
- No publishing happens
- Approval array shows both entries
- Task locked in DENIED state

---

### 2.4 Error Scenarios

**Objective:** Verify graceful handling of error cases.

#### 2.4.1 Double Approval by Same User
- Bill approves twice → expect 400 INVALID_APPROVAL
- Error message: "User already approved"

#### 2.4.2 Missing Meta Token
- Simulate missing platform token
- Publishing should fail with: "Platform not connected"

#### 2.4.3 Bad Scheduling Date (Past)
- Client validation prevents submission
- Server-side validation: return 400 if `scheduled_for < now`

#### 2.4.4 Publishing Without Approval
- Try to publish PAUSED task → expect 400
- Error message: "Task must be COMPLETE before publishing"

#### 2.4.5 Empty Topic
- `POST /api/sma/coordinator/task` with `topic=''`
- Expect 400: "topic is required and must be a non-empty string"

#### 2.4.6 Invalid Task ID
- `POST /api/sma/coordinator/publish` with non-existent task_id
- Expect 404: "Task not found"

**Success Criteria:**
- All error scenarios return appropriate HTTP status codes
- Error messages are descriptive
- No crashes or unhandled exceptions
- Database remains clean after errors

---

## 3. Performance Benchmarks

All benchmarks measured on representative hardware (standard Node.js environment).

| Operation | Target | Notes |
|-----------|--------|-------|
| Draft generation (3 platforms) | < 15 seconds | Includes LLM calls, product matching, video gen |
| Publishing all 3 platforms | < 5 sec/platform | Parallel Meta API calls |
| Dashboard load time | < 2 seconds | Analytics page render |
| Metrics fetch (single platform) | < 2 seconds | Includes Meta API call + DB write |
| Cron batch publish (10 posts) | < 30 seconds | Parallel execution recommended |

---

## 4. Audit Trail Verification

**Objective:** Verify complete audit trail is recorded for every lifecycle.

**Events Expected:**
- TASK_ISSUED: when task created
- HANDOFF_RECORDED: when coordinator hands off to platform agent
- APPROVAL_REQUESTED: when approval context bundled
- APPROVAL_DECIDED: when Bill or Francisco approves/denies
- PUBLISHED: when content published to platform
- ENGAGEMENT_RECORDED: when metrics fetched

**Verification Checks:**
- All events present in `sma_audit_log`
- Timestamps in chronological order
- All approver_ids and user_ids correct
- lineage_hash consistent for same lifecycle
- No orphaned audit records

---

## 5. Database Integrity Checks

**Objective:** Verify no data corruption or orphaned records.

### 5.1 Referential Integrity
- All `task_id` values have corresponding `sma_coordinator_tasks` row
- All `sma_coordinator_tasks` rows have corresponding `sma_paused_lifecycles` or `sma_content_lifecycles`
- All approvals reference existing `sma_admins` users
- All handoff records reference valid `sma_coordinator_tasks`

### 5.2 Data Correctness
- `published_at` is never in the future
- `scheduled_for > published_at` or `scheduled_for < published_at` never occurs for same task
- All timestamps are valid ISO 8601 format
- No null required fields in `sma_content_lifecycles`
- Status enums are valid (PAUSED, COMPLETE, DENIED, etc.)

### 5.3 Engagement Metrics
- No negative engagement counts
- Metrics only present for published posts
- `snapshot_at` is near `published_at + 24h` (or when manually fetched)

---

## 6. Cleanup and Idempotency

**Test Data Lifecycle:**

1. **Creation:** Tests create a unique task with prefix "TEST-E2E-" + timestamp
2. **Isolation:** Each test run uses a dedicated task_id (no shared state)
3. **Cleanup:** After each test, DELETE all test rows from:
   - `sma_coordinator_tasks` (WHERE task_id LIKE 'TEST-E2E-%')
   - `sma_paused_lifecycles` (WHERE task_id LIKE 'TEST-E2E-%')
   - `sma_content_lifecycles` (WHERE task_id LIKE 'TEST-E2E-%')
   - `sma_approval_decisions` (WHERE task_id LIKE 'TEST-E2E-%')
   - `sma_audit_log` (WHERE task_id LIKE 'TEST-E2E-%')

**Idempotency:**
- Tests can run multiple times without side effects
- Database returned to clean state after each run
- No shared test data between test runs

---

## 7. Running the Tests

### 7.1 Prerequisites
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Ensure database is migrated
# (run schema migrations if needed)
```

### 7.2 Run All Tests
```bash
bash scripts/sma/run-all-e2e-tests.sh
```

### 7.3 Run Individual Test
```bash
npx tsx scripts/sma/e2e-test-happy-path.ts
npx tsx scripts/sma/e2e-test-scheduling.ts
npx tsx scripts/sma/e2e-test-denial.ts
npx tsx scripts/sma/e2e-test-errors.ts
npx tsx scripts/sma/e2e-test-performance.ts
npx tsx scripts/sma/e2e-test-audit-trail.ts
npx tsx scripts/sma/e2e-test-db-integrity.ts
```

### 7.4 Test Output
Each test produces:
- Console logs with step-by-step progress
- JSON summary at the end: `{ status: 'PASS'|'FAIL', ... }`
- Timestamped logs in `/tmp/sma-e2e-tests/`

### 7.5 Summary Report
After all tests:
```json
{
  "run_timestamp": "2026-06-11T12:34:56Z",
  "total_tests": 7,
  "passed": 7,
  "failed": 0,
  "duration_ms": 45000,
  "results": [
    { "test": "happy-path", "status": "PASS", "duration_ms": 12000 },
    { "test": "scheduling", "status": "PASS", "duration_ms": 80000 },
    ...
  ]
}
```

---

## 8. Exit Criteria — All Must Pass

### Core Functionality
- ✓ Happy path completes without errors
- ✓ Draft generation completes in < 15 seconds
- ✓ Bill and Francisco can independently approve
- ✓ Scheduling works (post publishes at scheduled time)
- ✓ Publishing to all 3 platforms succeeds
- ✓ Metrics fetching succeeds for new posts

### Multi-Approval Flow
- ✓ First approval transitions task to PENDING
- ✓ Second approval transitions task to COMPLETE
- ✓ Denial by either approver prevents further action
- ✓ Double-approval by same user returns 400

### Data Integrity
- ✓ Audit trail complete and chronologically ordered
- ✓ Database has no orphaned rows
- ✓ No data corruption found
- ✓ All required fields populated

### Error Handling
- ✓ Empty topic rejected with 400
- ✓ Past scheduling date rejected with 400
- ✓ Publishing without approval rejected with 400
- ✓ Missing platform token handled gracefully

### Build and Tests
- ✓ `npx tsc --noEmit` passes (0 errors)
- ✓ `npm run build` succeeds
- ✓ All test scripts run without errors
- ✓ Test summary report shows all PASS

---

## 9. Known Limitations (Phase 2.6)

1. **Meta API Mocking:** Tests use real Meta tokens and live accounts for now. In production, use mocks to avoid publishing to live accounts.
2. **Analytics Dashboard:** Phase 2.5 (parallel track) may not be complete when Phase 2.6 runs. If so, skip analytics checks and re-run once 2.5 is merged.
3. **Performance Benchmarks:** Targets are aspirational. If actual numbers exceed targets by < 20%, still acceptable pending infrastructure review.
4. **Video Generation:** If video-gen service is unavailable, tests skip video validation and continue with image validation.

---

## 10. Post-Testing Deployment Steps

After all tests pass:

1. **Code Review:** Review all E2E test scripts for correctness and coverage
2. **Merge:** Merge Phase 2.6 branch to main
3. **Deploy:** Deploy to staging, run E2E suite once more, then production
4. **Monitor:** Watch error logs for the first 24h post-deployment
5. **Documentation:** Update CLAUDE.md with final system status

---

## Appendix: Test Data Reference

**Test Topic:**
```
"Ladriflex - benefits of the product"
```

**Test User IDs:**
- Bill: `sma_admins` row 1
- Francisco: `sma_admins` row 2

**Test Environment:**
- Database: Same Supabase project as development
- Meta API: Production Meta account (test app)
- Images: Use test image URLs from public/ directory
- Videos: Use existing test video files

---

**End of Phase 2.6 E2E Test Plan**
