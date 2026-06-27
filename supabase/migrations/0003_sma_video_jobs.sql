-- supabase/migrations/0003_sma_video_jobs.sql
--
-- SMA video generation jobs (Slice 1: Grok image-to-video engine).
-- One row per video generation request submitted to the xAI Grok Imagine
-- API. The job is created with status 'pending' and a request_id; pollers
-- (the /api/sma/video/jobs read-refresh and the /api/sma/cron/poll-videos
-- backstop) update it to 'done' (with video_url) or 'failed' (with error).
--
-- RLS gated by is_sma_admin() (existing function from migration 0001).
-- Service-role key bypasses RLS for the poller's internal updates.

CREATE TABLE IF NOT EXISTS public.sma_video_jobs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        text,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'done', 'failed')),
  product_slug      text,
  source_image_url  text NOT NULL,
  prompt            text,
  duration          int NOT NULL DEFAULT 6,
  video_url         text,
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sma_video_jobs_status
  ON public.sma_video_jobs(status);

ALTER TABLE public.sma_video_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_video_jobs_admin_only
  ON public.sma_video_jobs
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

COMMENT ON TABLE public.sma_video_jobs IS
  'SMA Slice 1: image-to-video generation jobs submitted to the xAI Grok '
  'Imagine API. Created with status pending + request_id; pollers update to '
  'done (video_url) or failed (error). Foundation for the Analyzer-source '
  'and post-video-to-Facebook slices that come later.';
