-- supabase/migrations/0002_sma_v2_schema.sql
--
-- SMA v2 schema additions. Adds Coordinator tasks, handoff records,
-- paused lifecycles, content lifecycles (audit), and WhatsApp Advisor
-- conversation tracking.
--
-- All new tables get RLS gated by is_sma_admin() (existing function
-- from migration 0001). Service-role key bypasses RLS for the
-- Coordinator's internal operations.

-- ──────────────────────────────────────────────────────────────────────
-- 1. Coordinator Tasks
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sma_coordinator_tasks (
  task_id          text PRIMARY KEY,
  intent           jsonb NOT NULL,
  platforms        text[] NOT NULL,
  status           text NOT NULL DEFAULT 'ACTIVE'
                     CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETE', 'DENIED', 'FAILED')),
  created_at       timestamptz DEFAULT now(),
  completed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sma_coordinator_tasks_status
  ON public.sma_coordinator_tasks(status);
CREATE INDEX IF NOT EXISTS idx_sma_coordinator_tasks_created_at
  ON public.sma_coordinator_tasks(created_at DESC);

ALTER TABLE public.sma_coordinator_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_coordinator_tasks_admin_only
  ON public.sma_coordinator_tasks
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

-- ──────────────────────────────────────────────────────────────────────
-- 2. Handoff Records
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sma_handoffs (
  handoff_id       text PRIMARY KEY,
  task_id          text NOT NULL REFERENCES public.sma_coordinator_tasks(task_id) ON DELETE CASCADE,
  from_agent       text NOT NULL,
  to_agent         text NOT NULL,
  payload          jsonb,
  handoff_reason   text,
  status           text NOT NULL DEFAULT 'ISSUED'
                     CHECK (status IN ('ISSUED', 'ACTIVE', 'COMPLETE', 'ESCALATED', 'FAILED')),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sma_handoffs_task_id
  ON public.sma_handoffs(task_id);
CREATE INDEX IF NOT EXISTS idx_sma_handoffs_status
  ON public.sma_handoffs(status);

ALTER TABLE public.sma_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_handoffs_admin_only
  ON public.sma_handoffs
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

-- ──────────────────────────────────────────────────────────────────────
-- 3. Paused Lifecycles (Approval Queue)
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sma_paused_lifecycles (
  task_id              text PRIMARY KEY REFERENCES public.sma_coordinator_tasks(task_id) ON DELETE CASCADE,
  pause_reason         text NOT NULL,
  context              jsonb NOT NULL,
  paused_at            timestamptz DEFAULT now(),
  resumed_at           timestamptz,
  approver_id          uuid REFERENCES public.sma_admins(id),
  approval_decision    text CHECK (approval_decision IN ('APPROVE', 'DENY')),
  approval_rationale   text
);

CREATE INDEX IF NOT EXISTS idx_sma_paused_lifecycles_resumed_at
  ON public.sma_paused_lifecycles(resumed_at NULLS FIRST, paused_at);

ALTER TABLE public.sma_paused_lifecycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_paused_lifecycles_admin_only
  ON public.sma_paused_lifecycles
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

-- ──────────────────────────────────────────────────────────────────────
-- 4. Content Lifecycles (the single audit record per task)
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sma_content_lifecycles (
  task_id             text PRIMARY KEY REFERENCES public.sma_coordinator_tasks(task_id) ON DELETE CASCADE,
  lifecycle_record    jsonb NOT NULL,
  lineage_hash        text NOT NULL,
  assembled_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sma_content_lifecycles_assembled_at
  ON public.sma_content_lifecycles(assembled_at DESC);

ALTER TABLE public.sma_content_lifecycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_content_lifecycles_admin_only
  ON public.sma_content_lifecycles
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

-- ──────────────────────────────────────────────────────────────────────
-- 5. WhatsApp Advisor Conversations
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sma_whatsapp_conversations (
  conversation_id        text PRIMARY KEY,
  whatsapp_user_id       text NOT NULL,
  first_message_at       timestamptz NOT NULL,
  last_message_at        timestamptz NOT NULL,
  handed_off_to_human    boolean DEFAULT false,
  handoff_reason         text,
  created_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sma_whatsapp_conv_user
  ON public.sma_whatsapp_conversations(whatsapp_user_id);
CREATE INDEX IF NOT EXISTS idx_sma_whatsapp_conv_last_message
  ON public.sma_whatsapp_conversations(last_message_at DESC);

ALTER TABLE public.sma_whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_whatsapp_conv_admin_only
  ON public.sma_whatsapp_conversations
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

-- ──────────────────────────────────────────────────────────────────────
-- 6. WhatsApp Advisor Messages
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sma_whatsapp_messages (
  message_id              text PRIMARY KEY,
  conversation_id         text NOT NULL REFERENCES public.sma_whatsapp_conversations(conversation_id) ON DELETE CASCADE,
  direction               text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content                 text NOT NULL,
  ts                      timestamptz DEFAULT now(),
  llm_response_metadata   jsonb
);

CREATE INDEX IF NOT EXISTS idx_sma_whatsapp_messages_conversation
  ON public.sma_whatsapp_messages(conversation_id, ts);

ALTER TABLE public.sma_whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_whatsapp_messages_admin_only
  ON public.sma_whatsapp_messages
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

-- ──────────────────────────────────────────────────────────────────────
-- 7. Triggers for updated_at columns
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sma_handoffs_updated_at
  BEFORE UPDATE ON public.sma_handoffs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────
-- 8. Comments for documentation
-- ──────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.sma_coordinator_tasks IS
  'SMA v2: One row per content lifecycle issued by the Coordinator. '
  'Created by issueTask(). Status transitions ACTIVE → PAUSED → COMPLETE/DENIED/FAILED.';

COMMENT ON TABLE public.sma_handoffs IS
  'SMA v2: Records every transfer of a lifecycle object between agents. '
  'Per Immutable Stop 3, platform agents check for a valid handoff before acting.';

COMMENT ON TABLE public.sma_paused_lifecycles IS
  'SMA v2: Lifecycles awaiting Bill/Francisco approval. Surfaced as the '
  '/admin/sma/approval-queue. Context column contains ApprovalContext per '
  'Immutable Stop 5 (full context bundled, never piecemeal).';

COMMENT ON TABLE public.sma_content_lifecycles IS
  'SMA v2: The single curated audit record per lifecycle, per Immutable Stop 4. '
  'Raw agent telemetry never goes here. Only the Coordinator''s assembleLifecycle() '
  'inserts into this table.';

COMMENT ON TABLE public.sma_whatsapp_conversations IS
  'SMA v2: WhatsApp Advisor conversation tracking. Separate from the '
  'Coordinator''s task model — WhatsApp is reactive 1:1, not proactive broadcast.';

COMMENT ON TABLE public.sma_whatsapp_messages IS
  'SMA v2: Individual messages within a WhatsApp Advisor conversation. '
  'llm_response_metadata captures model, tokens, KB sources used for outbound.';
