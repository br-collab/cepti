# WhatsApp Advisor — setup & operations

The WhatsApp Advisor is an **inbound, reactive** customer-service bot on CEPTI's
WhatsApp Business number `+1 (829) 449-1104`. It answers autonomously **within
hard guardrails** and hands off to a human for anything sensitive. It is a
separate concern from the SMA Coordinator (which posts to IG/FB/Threads) — it
shares only the LLM client, FinOps logging, and the admin shell.

> **Behavior follows the canonical answer policy** — "Bot-first, human-override,
> price-safe" — in `docs/sma/advisor-policy.md` (the single source of truth,
> shared across WhatsApp, Messenger, Instagram Direct, and the website chatbot).

Greenlit 2026-06-28 (see `architecture-v2.md` §6). Product knowledge comes from
`prompts/whatsapp/kb.md` — a cleaned, structured KB extracted from CEPTI's
fichas técnicas (Ladriflex, Papelex, Pintura de Piedra) + the Papelex install
guide. At ~10k tokens the whole corpus is loaded into the cached system prompt;
no vector DB / RAG is used because the corpus fits in context. Regenerate
`kb.md` if the source fichas in `docs/sma/inputs/chatbot-kb/` change.

## What it does (and refuses to do)

- **Autonomous within guardrails.** Answers product questions in the customer's
  language (Spanish default), 2–4 sentences, one product per turn.
- **Quotes from the official price list.** It answers pricing/quote requests using
  CEPTI's official price list (`prompts/advisor/pricing.md`) and runs a quote flow
  (greet; ask where + how many m²; for paints ask lisa/rugosa and 1/2 manos; for
  Papelex/Ladriflex ask interior/exterior; give the per-m² rate and, if given m²,
  the total). It **never** invents, negotiates, or discounts a price.
- **Hard handoff triggers** (bot sends a short bridge message, flips the
  conversation to "human", then stays silent):
  - complaints or upset customers
  - questions it can't answer confidently, or a price it can't derive from the
    official list (unknown spec, catalog code, dimension; a request to negotiate)
  - explicit request for a person
  - any non-text message (image/audio/doc) — v1 reads text only
- **Never** quotes a price not on the official list, invents specs, claims to be
  human, or sends proactive / template messages (reactive only, inside the free
  24-hour service window).

## Architecture

```
WhatsApp user → Meta Cloud API → POST /api/sma/whatsapp/webhook
                                      │ verify signature (META_APP_SECRET)
                                      ▼
                          lib/sma/whatsapp-advisor.ts
                            • dedupe + persist (whatsapp-store.ts)
                            • arbitration (handed_off? human echo?)
                            • Sonnet reply (guardrail prompt)
                            • [HANDOFF] → bridge + flip to human
                            • send via whatsapp-client.ts
                                      │
                                      ▼
                     sma_whatsapp_conversations / _messages (0002)
                                      │
                     /admin/sma/whatsapp  ← human take-over / return-to-bot
```

Files: `app/api/sma/whatsapp/webhook/route.ts`, `lib/sma/whatsapp-advisor.ts`,
`lib/sma/whatsapp-client.ts`, `lib/sma/whatsapp-store.ts`,
`prompts/advisor/system.md`, `prompts/advisor/pricing.md` (official price list),
`app/[lang]/admin/(gated)/sma/whatsapp/page.tsx`,
`app/api/sma/whatsapp/conversations/route.ts`.

Model: `claude-sonnet-4-6` (cheaper/faster than the SMA Opus default; inbound
service-window messages are free on Meta, so cost is LLM only). Usage is logged
to `sma_ai_usage` with `kind: 'whatsapp'`.

## Database

Uses the existing migration-0002 tables — **no new migration required**:
`sma_whatsapp_conversations` (one row per user, `conversation_id = wa_id`,
`handed_off_to_human`, `handoff_reason`) and `sma_whatsapp_messages`
(`direction`, `content`, `llm_response_metadata`). Both are RLS admin-only, so
all webhook reads/writes use the service-role client.

## Environment variables

Reused: `ANTHROPIC_API_KEY`, `SUPABASE_*`, `META_APP_SECRET` (signature),
`META_WEBHOOK_VERIFY_TOKEN` (handshake). New (see `.env.example`):

- `WHATSAPP_PHONE_NUMBER_ID` — the Cloud API phone number id.
- `WHATSAPP_ACCESS_TOKEN` — permanent System User token with `whatsapp_business_messaging`.
- `WHATSAPP_BUSINESS_ACCOUNT_ID` — the WABA id (for reference / future use).
- `WHATSAPP_API_BASE` — optional; set to a BSP base URL to route sends through a
  BSP. Defaults to `https://graph.facebook.com/v23.0` (direct Meta Cloud API).

## Setup (Bill — external, can run while the code is reviewed)

1. **Confirm the team is on the WhatsApp _Business_ app** (not personal) for
   `+1 829 449 1104`, and that someone opens it at least every 14 days
   (Coexistence drops the API link otherwise).
2. **Enable Coexistence** for the number directly via Meta Cloud API onboarding
   (Embedded Signup / Coexistence flow in Meta Business). No BSP required; a BSP
   (360dialog/Twilio) is optional and only smooths onboarding.
3. **Get Meta Verified for Business** so your display name (not just the number)
   shows in customers' chat headers — Coexistence accounts can't use standard
   Business Verification or the blue badge.
4. **Grab credentials:** Phone Number ID, WABA ID, and a permanent System User
   token. Put them in Vercel env (`WHATSAPP_*`).
5. **Register the webhook** in the Meta App dashboard:
   - Callback URL: `https://cepti-nu.vercel.app/api/sma/whatsapp/webhook`
   - Verify token: the existing `META_WEBHOOK_VERIFY_TOKEN`
   - Subscribe the **`messages`** field on the WhatsApp Business Account.
6. Deploy. Send a test message to the number from another phone and confirm a
   reply, then check `/admin/sma/whatsapp`.

## Operating it

- `/admin/sma/whatsapp` lists conversations with a Bot / Human status. "Take
  over" flips a thread to human (bot goes silent); "Return to bot" hands it
  back. Handed-off threads are answered by the team in the WhatsApp Business app.
- Once a human replies in a thread, the bot backs off (it should not double-reply
  alongside a person).

## Known v1 limitations / TODO

- **Coexistence echo payload shape is unverified.** `handleHumanEcho` is wired
  defensively against `value.message_echoes`, so the bot backs off when a human
  replies from the app — but confirm the real payload field name on first live
  traffic and adjust `app/api/sma/whatsapp/webhook/route.ts` if needed. Until
  verified, the safety net is the manual "Take over" button.
- **Text only.** Media messages are acknowledged and handed off.
- **No proactive messaging.** Templates / outside-window follow-ups are v1.5.
- **KB is prompt-stuffed, not retrieved.** All fichas live in `prompts/whatsapp/kb.md`
  and load into the cached system prompt. If the KB ever outgrows the context
  budget (many more products), switch to retrieval then — not before.
- **Source data has a few inconsistencies** flagged for Francisco to confirm
  (Papelex sheet thickness unit; Papelex rest time 4h vs 2h; "vida útil 25 años"
  vs the website's "10 years"; a contradictory "inflamable" line in the Ladriflex
  ficha that conflicts with its own fire-resistance spec — KB encodes
  fire-resistant). Correct `kb.md` once confirmed.
- **Per-user single conversation.** `conversation_id = wa_id`; no session split.
