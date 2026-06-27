-- supabase/migrations/0005_sma_ai_usage.sql
--
-- AI usage / cost ledger for the SMA FinOps view on the admin dashboard.
--
-- Every successful LLM caption/script generation logs one row here (kind
-- 'caption') with the model and token counts, plus an estimated USD cost
-- derived from an approximate per-million-token price map (lib/sma/ai-usage.ts).
-- Inserts are best-effort: a failed log must never break caption generation.
-- Grok video spend is NOT stored here — it is computed on the fly from
-- sma_video_jobs (duration × $0.08/sec) in the dashboard stats.
--
-- RLS gated by is_sma_admin() (function from migration 0001), mirroring 0004.
-- The service-role key bypasses RLS for the agents' write path.

CREATE TABLE IF NOT EXISTS public.sma_ai_usage (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           text NOT NULL,
  model          text,
  input_tokens   int NOT NULL DEFAULT 0,
  output_tokens  int NOT NULL DEFAULT 0,
  est_cost_usd   numeric(10,5) NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sma_ai_usage_created_at
  ON public.sma_ai_usage(created_at);

ALTER TABLE public.sma_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_ai_usage_admin_only
  ON public.sma_ai_usage
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

COMMENT ON TABLE public.sma_ai_usage IS
  'AI cost/usage ledger for SMA FinOps. One row per LLM caption/script call '
  '(kind, model, token counts, est_cost_usd from an approximate price map). '
  'Best-effort logging — never blocks generation. Grok video spend is computed '
  'from sma_video_jobs, not stored here.';
