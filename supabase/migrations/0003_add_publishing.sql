-- supabase/migrations/0003_add_publishing.sql
--
-- Phase 2.2: Publishing to Meta APIs
-- Adds published_at column to sma_content_lifecycles for tracking when
-- content was published to Meta platforms.

-- Add published_at column to sma_content_lifecycles
ALTER TABLE public.sma_content_lifecycles
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Create index on published_at for querying published vs unpublished content
CREATE INDEX IF NOT EXISTS idx_sma_content_lifecycles_published_at
  ON public.sma_content_lifecycles(published_at DESC NULLS LAST);

-- Comment on the new column
COMMENT ON COLUMN public.sma_content_lifecycles.published_at IS
  'Timestamp when this content lifecycle was published to Meta platforms. '
  'NULL until publishContent() succeeds.';
