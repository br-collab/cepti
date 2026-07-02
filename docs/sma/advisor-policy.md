# CEPTI Advisor — Answer Policy

> **Single source of truth** for how the conversational advisor behaves across
> every channel: WhatsApp, Facebook Messenger, Instagram Direct (and the website
> chatbot, which shares the same knowledge base). All channels run one brain
> (`lib/sma/advisor-core.ts`) with one knowledge base (`prompts/whatsapp/kb.md`)
> and these identical rules. Decided 2026-06-28.

## Policy name: "Bot-first, human-override, price-safe"

**"Price-safe" (one line):** the advisor quotes **only** from CEPTI's official
published price list — it never invents, negotiates, or discounts a price — and
complaints, uncertainty, and explicit human requests still escalate.

The advisor answers every inbound message instantly, around the clock — product
questions **and** pricing/quotes, but pricing only from the official price list —
and a human can take over any conversation at any moment, which silences the bot
for that thread. The point is to capture lead intent the instant it appears, with
zero risk of the bot quoting a number that isn't on the official list.

## The rules

1. **Always-on, bot-first.** Every new inbound DM gets an immediate reply, any
   hour of any day, in the customer's language (Spanish by default; it mirrors
   the customer). No time-gating — speed is the value.
2. **Guardrailed content + official quotes only.** It answers product questions
   grounded in the ficha-técnica knowledge base (what a product is, its uses,
   technical specs, installation, warranty, maintenance, safety) **and** quotes
   prices — but **only** from CEPTI's official price list (`prompts/advisor/pricing.md`).
   It runs a quote flow (greet; ask where/how many m²; for paints ask lisa/rugosa
   and 1/2 manos; for Papelex/Ladriflex ask interior/exterior; give the per-m² rate
   and, if given m², the total). It **never** invents, negotiates, or discounts a
   price, never quotes a number not derivable from that list, and never invents
   specs. It offers to take a photo of the surface and can share the factory
   location; the products are for walls/ceilings/surfaces (interior & exterior) but
   NOT floors or stairs.
3. **Hard handoff triggers.** When any of these occur, the bot sends a short
   bridge message, flips the conversation to "human," and goes silent:
   - complaints or upset/negative tone
   - anything it cannot answer confidently or that is outside the knowledge base
     and the official price list (e.g. a price it can't derive, or a request to
     negotiate/discount)
   - an explicit request to talk to a person
   - any non-text message (image, audio, document, location, sticker)

   (Note: a plain price/quote request is **no longer** a handoff trigger — the bot
   quotes it from the official list.)
4. **Human override always wins.** A human reply from the platform inbox — or
   the dashboard **Take over** button — immediately silences the bot for that
   conversation. **Return to bot** re-enables it. The bot never talks over a
   human and never double-replies (messages are de-duplicated; one reply per
   inbound).
5. **Honest, not deceptive.** The bot speaks as CEPTI's knowledgeable assistant.
   It never claims to be a specific person, and it discloses that it is an
   assistant **if asked directly**. It does not post a proactive "I am a bot"
   banner.
6. **One brain, every channel.** The same policy, knowledge base, and guardrails
   apply on WhatsApp, Messenger, and Instagram Direct. The website chatbot uses
   the same knowledge base, so all surfaces answer at the same depth.

## Parameters CEPTI sets (defaults below — none block go-live)

- **Handoff wording by time of day — CONFIGURED + LIVE (2026-06-28).** Business
  hours are **Mon–Fri 09:00–17:30, America/Santo_Domingo** (constants in
  `lib/sma/advisor-core.ts`). When the bot hands off, it sets an honest
  response-time expectation in the customer's language: within hours → "our team
  will respond shortly"; outside hours → "our team will respond during business
  hours (Mon–Fri 9:00 a.m.–5:30 p.m.)." To change days/hours, edit
  `BUSINESS_DAYS` / `BUSINESS_START_MIN` / `BUSINESS_END_MIN`. (Saturdays are not
  currently counted — add `6` to `BUSINESS_DAYS` if that changes.)
- **Escalation visibility.** Handed-off threads surface in `/admin/sma`
  (Bot/Human status) and in the platform inbox the team already uses (WhatsApp
  Business app / Meta Business Suite). v1 has no separate push notification; add
  a Slack/email ping later if human response time slips.
- **Alternative mode (flip-able).** "After-hours only" — the bot answers solely
  outside business hours and humans own daytime. Documented as an option;
  **default is always-on**, which captures the most lead intent. Not recommended
  unless the team specifically wants to own daytime conversations.

## Why this policy (rationale for operators and buyers)

The advisor's job is to never let a real question sit unanswered and to move
genuine buying intent forward fast — including giving an on-the-spot quote from
the official price list. Because the guardrails fence pricing to the official
list (no improvising, negotiating, or discounting) and still escalate complaints,
uncertainty, and explicit human requests, answering instantly is safe — there is
no upside to making a customer wait for a human to repeat a number that is already
on the price list. Human override means the team keeps full control of any
conversation that matters, and the "price-safe" guarantee (the bot only ever
quotes official, published numbers and never negotiates) is what makes autonomous
24/7 response acceptable in the first place.

## Where this is enforced in code

- `lib/sma/advisor-core.ts` — the shared brain: prompt + KB, the `[HANDOFF]`
  decision, transcript handling, usage logging.
- `prompts/advisor/system.md` — the guardrail/quote-flow/handoff instructions (rules 2, 3, 5).
- `prompts/advisor/pricing.md` — the official price list the bot quotes from (rule 2).
- `lib/sma/dm-advisor.ts` + `lib/sma/whatsapp-advisor.ts` — arbitration (rules 1,
  4): dedupe, bot-first reply, back off when a human replies, escalate non-text.
- `prompts/whatsapp/kb.md` — the knowledge base (rule 2).
- `/admin/sma/whatsapp` and `/admin/sma/messages` — the Take over / Return to bot
  controls (rule 4).

> Reminder: none of the advisors are live until Meta App Review for the relevant
> permissions and the channel webhooks/onboarding are completed. This policy
> governs behavior once they are live.
