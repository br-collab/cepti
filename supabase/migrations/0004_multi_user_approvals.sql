-- supabase/migrations/0004_multi_user_approvals.sql
--
-- Multi-User Simultaneous Approvals (Phase 2.4)
--
-- Purpose: Enable both Bill and Francisco to independently approve/deny
-- the same draft. This migration:
-- 1. Adds a new sma_approval_decisions table to track individual approvals
-- 2. Adds helper functions to get approval status and summary
-- 3. Maintains backward compatibility with existing sma_paused_lifecycles
--
-- The sma_approval_decisions table stores individual approval decisions,
-- allowing multiple approvers to decide on the same task. The approval
-- status is computed based on configuration (all must approve, or any denies).

-- ──────────────────────────────────────────────────────────────────────
-- 1. New Table: Approval Decisions (Multi-User Approvals)
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sma_approval_decisions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id                text NOT NULL REFERENCES public.sma_coordinator_tasks(task_id) ON DELETE CASCADE,
  decided_by             text NOT NULL,  -- 'bill' or 'francisco'
  decision               text NOT NULL CHECK (decision IN ('APPROVE', 'DENY')),
  rationale              text NOT NULL,
  decided_at             timestamptz NOT NULL DEFAULT now(),
  approver_id            uuid REFERENCES public.sma_admins(user_id),
  scheduled_for          timestamptz,     -- ISO timestamp for future publication
  created_at             timestamptz DEFAULT now(),
  -- Prevent same user from approving twice per task
  UNIQUE(task_id, decided_by)
);

CREATE INDEX IF NOT EXISTS idx_sma_approval_decisions_task_id
  ON public.sma_approval_decisions(task_id);

CREATE INDEX IF NOT EXISTS idx_sma_approval_decisions_decided_by
  ON public.sma_approval_decisions(task_id, decided_by);

CREATE INDEX IF NOT EXISTS idx_sma_approval_decisions_created_at
  ON public.sma_approval_decisions(created_at DESC);

ALTER TABLE public.sma_approval_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_approval_decisions_admin_only
  ON public.sma_approval_decisions
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

-- ──────────────────────────────────────────────────────────────────────
-- 2. Update sma_content_lifecycles to add published_at if not exists
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.sma_content_lifecycles
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- ──────────────────────────────────────────────────────────────────────
-- 3. SQL Function: Get Approval Status for a Task
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_approval_status(p_task_id text)
RETURNS jsonb AS $$
DECLARE
  v_approved_by text[];
  v_denied_by text[];
  v_status text;
  v_all_approvals jsonb;
BEGIN
  -- Get all approval decisions for this task
  SELECT
    ARRAY_AGG(DISTINCT CASE WHEN decision = 'APPROVE' THEN decided_by END) FILTER (WHERE decision = 'APPROVE'),
    ARRAY_AGG(DISTINCT CASE WHEN decision = 'DENY' THEN decided_by END) FILTER (WHERE decision = 'DENY'),
    JSON_AGG(ROW_TO_JSON(ad.*) ORDER BY decided_at DESC)
  INTO v_approved_by, v_denied_by, v_all_approvals
  FROM public.sma_approval_decisions ad
  WHERE ad.task_id = p_task_id;

  -- Determine overall status
  IF v_denied_by IS NOT NULL AND ARRAY_LENGTH(v_denied_by, 1) > 0 THEN
    v_status := 'DENIED';
  ELSIF v_approved_by IS NOT NULL AND ARRAY_LENGTH(v_approved_by, 1) = 2 THEN
    -- Both bill and francisco approved
    v_status := 'APPROVED';
  ELSE
    v_status := 'PENDING';
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'approved_by', COALESCE(v_approved_by, ARRAY[]::text[]),
    'denied_by', COALESCE(v_denied_by, ARRAY[]::text[]),
    'status', v_status,
    'all_approvals', COALESCE(v_all_approvals, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ──────────────────────────────────────────────────────────────────────
-- 4. SQL Function: Check if User Already Approved
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_user_approved(p_task_id text, p_decided_by text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1
    FROM public.sma_approval_decisions
    WHERE task_id = p_task_id AND decided_by = p_decided_by
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ──────────────────────────────────────────────────────────────────────
-- 5. Documentation Comments
-- ──────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.sma_approval_decisions IS
  'SMA Phase 2.4: Individual approval decisions from Bill and Francisco. '
  'Multiple rows per task_id allowed (one per approver). '
  'UNIQUE(task_id, decided_by) prevents same user from approving twice. '
  'Replaces single-decision model from Phases 1-2.3.';

COMMENT ON FUNCTION public.get_approval_status(text) IS
  'Returns approval summary: approved_by [], denied_by [], status, all_approvals []. '
  'Status is DENIED if any deny, APPROVED if both approve, PENDING otherwise.';

COMMENT ON FUNCTION public.has_user_approved(text, text) IS
  'Returns true if the given user (bill/francisco) has already approved/denied the task. '
  'Used by API to prevent double-approval.';
