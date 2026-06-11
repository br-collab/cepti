-- supabase/migrations/0003_add_scheduling.sql
--
-- Add scheduling capability to SMA content lifecycles.
-- Allows Bill/Francisco to schedule posts for future publication instead of immediate publish.

-- Add scheduled_for column to sma_content_lifecycles
ALTER TABLE public.sma_content_lifecycles
ADD COLUMN scheduled_for timestamptz;

-- Add index for efficient query of scheduled items ready to publish
CREATE INDEX IF NOT EXISTS idx_sma_content_lifecycles_scheduled_for
  ON public.sma_content_lifecycles(scheduled_for)
  WHERE scheduled_for IS NOT NULL;

-- Add index for querying items ready for publication (scheduled <= now and not published)
CREATE INDEX IF NOT EXISTS idx_sma_content_lifecycles_ready_to_publish
  ON public.sma_content_lifecycles(scheduled_for)
  WHERE scheduled_for IS NOT NULL
    AND scheduled_for <= now()
    AND (lifecycle_record->>'status' = 'COMPLETE');

COMMENT ON COLUMN public.sma_content_lifecycles.scheduled_for IS
  'ISO timestamp for when this content should be published. NULL means publish immediately after approval.';
