-- supabase/migrations/0008_sma_dm.sql
--
-- Inbound Messenger / Instagram Direct advisor schema. Mirrors the WhatsApp
-- Advisor tables (migration 0002) but channel-aware: one conversation per
-- (channel, external user). The conversational brain, guardrails, and KB are
-- shared with the WhatsApp Advisor via lib/sma/advisor-core.ts.
--
-- All new tables get RLS gated by is_sma_admin() (function from migration 0001).
-- The service-role key bypasses RLS for the advisor's read/write path.

-- ──────────────────────────────────────────────────────────────────────
-- 1. DM Conversations (Messenger + Instagram Direct)
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sma_dm_conversations (
  conversation_id        text PRIMARY KEY,
  channel                text NOT NULL CHECK (channel IN ('messenger', 'instagram')),
  external_user_id       text NOT NULL,
  first_message_at       timestamptz NOT NULL,
  last_message_at        timestamptz NOT NULL,
  handed_off_to_human    boolean DEFAULT false,
  handoff_reason         text,
  created_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sma_dm_conv_channel
  ON public.sma_dm_conversations(channel);
CREATE INDEX IF NOT EXISTS idx_sma_dm_conv_external_user
  ON public.sma_dm_conversations(external_user_id);
CREATE INDEX IF NOT EXISTS idx_sma_dm_conv_last_message
  ON public.sma_dm_conversations(last_message_at DESC);

ALTER TABLE public.sma_dm_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_dm_conv_admin_only
  ON public.sma_dm_conversations
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

-- ──────────────────────────────────────────────────────────────────────
-- 2. DM Messages
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sma_dm_messages (
  message_id              text PRIMARY KEY,
  conversation_id         text NOT NULL REFERENCES public.sma_dm_conversations(conversation_id) ON DELETE CASCADE,
  direction               text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content                 text NOT NULL,
  ts                      timestamptz DEFAULT now(),
  llm_response_metadata   jsonb
);

CREATE INDEX IF NOT EXISTS idx_sma_dm_messages_conversation
  ON public.sma_dm_messages(conversation_id, ts);

ALTER TABLE public.sma_dm_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_dm_messages_admin_only
  ON public.sma_dm_messages
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

-- ──────────────────────────────────────────────────────────────────────
-- 3. Comments for documentation
-- ──────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.sma_dm_conversations IS
  'SMA: Messenger / Instagram Direct advisor conversation tracking. One row per '
  '(channel, external user); conversation_id = channel:external_user_id. Reactive '
  '1:1, not proactive broadcast — mirrors sma_whatsapp_conversations.';

COMMENT ON TABLE public.sma_dm_messages IS
  'SMA: Individual messages within a Messenger / Instagram Direct conversation. '
  'llm_response_metadata captures model, tokens, and handoff flag for outbound.';
