-- supabase/migrations/0006_sma_measurement.sql
--
-- The measurement loop: make published posts measurable.
--
-- sma_post_engagement holds the latest engagement snapshot per published
-- Facebook post (reactions / comments / shares, plus impressions when the
-- insights permission is granted). Rows are upserted on external_post_id by
-- POST /api/sma/engagement/refresh, which pulls live numbers from the Graph
-- API. There are 0 agent-published posts today, so this stays empty/zero
-- until the first real post ships.
--
-- sma_leads is a manual WhatsApp-lead ledger: a human logs a conversion
-- against a post (via task_id or the [ref:fb-post-…] tag from the caption)
-- from the dashboard. Full automatic attribution still needs the WhatsApp
-- Business API; this table is the honest stopgap.
--
-- RLS gated by is_sma_admin() (function from migration 0001), mirroring 0005.
-- The service-role key bypasses RLS for the API write path.

CREATE TABLE IF NOT EXISTS public.sma_post_engagement (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_post_id  text NOT NULL UNIQUE,
  platform          text,
  reactions         int NOT NULL DEFAULT 0,
  comments          int NOT NULL DEFAULT 0,
  shares            int NOT NULL DEFAULT 0,
  impressions       int,
  captured_at       timestamptz NOT NULL DEFAULT now()
);

-- The UNIQUE constraint on external_post_id already provides an index;
-- no separate index needed for lookups/upserts on that column.

ALTER TABLE public.sma_post_engagement ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_post_engagement_admin_only
  ON public.sma_post_engagement
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

COMMENT ON TABLE public.sma_post_engagement IS
  'Latest engagement snapshot per published post (reactions, comments, shares, '
  'optional impressions), upserted on external_post_id from the Graph API by '
  'the engagement refresh route. Empty until the first agent post ships.';

CREATE TABLE IF NOT EXISTS public.sma_leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     text,
  ref_text    text,
  platform    text,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sma_leads_task_id
  ON public.sma_leads(task_id);

ALTER TABLE public.sma_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_leads_admin_only
  ON public.sma_leads
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

COMMENT ON TABLE public.sma_leads IS
  'Manual WhatsApp-lead ledger. A human logs a conversion against a post '
  '(task_id and/or [ref:fb-post-…] tag) from the dashboard. Stopgap until '
  'the WhatsApp Business API enables automatic attribution.';
