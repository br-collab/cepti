-- supabase/migrations/0004_sma_examples.sql
--
-- Curated few-shot EXAMPLES library for the SMA caption agents.
--
-- Admins save a small, hand-picked set of their best captions. The platform
-- agents (Facebook/Instagram/Threads) inject the most relevant ones into the
-- caption-generation prompt so drafts match the proven CEPTI voice. This is a
-- curated reference set, not a junk drawer — keep it small and high-signal.
--
-- RLS gated by is_sma_admin() (function from migration 0001), mirroring 0002.
-- The service-role key bypasses RLS for the agents' read path.

CREATE TABLE IF NOT EXISTS public.sma_examples (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform           text
                       CHECK (platform IS NULL OR platform IN ('facebook', 'instagram', 'threads')),
  product_slug       text,
  caption            text NOT NULL,
  performance_label  text
                       CHECK (performance_label IS NULL OR performance_label IN ('top', 'good', 'reference')),
  source_note        text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sma_examples_platform_product
  ON public.sma_examples(platform, product_slug);

ALTER TABLE public.sma_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_examples_admin_only
  ON public.sma_examples
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

COMMENT ON TABLE public.sma_examples IS
  'Curated few-shot caption examples injected into SMA caption generation. '
  'platform/product_slug NULL = applies to all. Kept small and high-signal; '
  'getRelevantExamples() ranks by platform+product match then performance_label.';
