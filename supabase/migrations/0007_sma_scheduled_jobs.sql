-- supabase/migrations/0007_sma_scheduled_jobs.sql
--
-- Scheduling: let an admin pin an already-approved draft to a future time so a
-- cron publishes it then. Each row references a Coordinator task_id whose
-- lifecycle is already APPROVED + COMPLETE; the publish cron
-- (/api/sma/cron/publish-scheduled) reuses the same human-authorized publish
-- path as the manual "Publish to Facebook" button. This does NOT enable
-- autonomous posting — only pre-approved content is ever published.
--
-- status transitions:
--   scheduled  -> published  (cron published it; published_post_id set)
--   scheduled  -> failed     (publish errored; error set)
--   scheduled  -> canceled   (admin canceled it via DELETE before it ran)
--
-- RLS gated by is_sma_admin() (function from migration 0001), mirroring 0006.
-- The service-role key bypasses RLS for the API/cron write paths.

CREATE TABLE IF NOT EXISTS public.sma_scheduled_jobs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id            text NOT NULL,
  platform           text NOT NULL DEFAULT 'facebook',
  scheduled_for      timestamptz NOT NULL,
  status             text NOT NULL DEFAULT 'scheduled'
                       CHECK (status IN ('scheduled', 'published', 'failed', 'canceled')),
  error              text,
  published_post_id  text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sma_scheduled_jobs_status_scheduled_for
  ON public.sma_scheduled_jobs(status, scheduled_for);

ALTER TABLE public.sma_scheduled_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_scheduled_jobs_admin_only
  ON public.sma_scheduled_jobs
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

COMMENT ON TABLE public.sma_scheduled_jobs IS
  'Scheduled publish jobs for pre-approved drafts. An admin pins an approved '
  'task to a future time; the publish-scheduled cron publishes it via the same '
  'human-authorized FacebookAgent.publish path. Not autonomous posting.';
