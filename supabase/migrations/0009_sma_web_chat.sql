-- supabase/migrations/0009_sma_web_chat.sql
--
-- Website chatbot persistence. The on-site Advisor (app/api/chat/route.ts +
-- components/ChatbotCEPTI.tsx) is a separate module from the WhatsApp / DM
-- advisors, but its conversations are now tracked so the team can review them
-- in /admin/sma/chat. One conversation per browser session (conversation_id is
-- generated client-side and echoed back by the API).
--
-- All new tables get RLS gated by is_sma_admin() (function from migration 0001).
-- The service-role key bypasses RLS for the chatbot's write path.

-- ──────────────────────────────────────────────────────────────────────
-- 1. Web chat conversations
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sma_web_chat_conversations (
  conversation_id     text PRIMARY KEY,
  lang                text,
  first_message_at    timestamptz NOT NULL,
  last_message_at     timestamptz NOT NULL,
  message_count       int NOT NULL DEFAULT 0,
  wa_clicked          boolean NOT NULL DEFAULT false,
  wa_clicked_at       timestamptz,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sma_web_chat_conv_last_message
  ON public.sma_web_chat_conversations(last_message_at DESC);

ALTER TABLE public.sma_web_chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_web_chat_conv_admin_only
  ON public.sma_web_chat_conversations
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

-- ──────────────────────────────────────────────────────────────────────
-- 2. Web chat messages
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sma_web_chat_messages (
  message_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     text NOT NULL REFERENCES public.sma_web_chat_conversations(conversation_id) ON DELETE CASCADE,
  role                text NOT NULL CHECK (role IN ('user', 'assistant')),
  content             text NOT NULL,
  ts                  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sma_web_chat_messages_conversation
  ON public.sma_web_chat_messages(conversation_id, ts);

ALTER TABLE public.sma_web_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY sma_web_chat_messages_admin_only
  ON public.sma_web_chat_messages
  FOR ALL
  USING (public.is_sma_admin())
  WITH CHECK (public.is_sma_admin());

-- ──────────────────────────────────────────────────────────────────────
-- 3. Comments for documentation
-- ──────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.sma_web_chat_conversations IS
  'SMA: website chatbot conversation tracking. One row per browser session '
  '(conversation_id generated client-side). wa_clicked flags a conversion when '
  'the visitor clicks through to WhatsApp. Written best-effort by app/api/chat.';

COMMENT ON TABLE public.sma_web_chat_messages IS
  'SMA: individual messages within a website-chatbot conversation. Assistant '
  'content is stored without the [SHOW_WA] tag. Only the newest user message and '
  'each reply are written per turn — never the whole history.';
