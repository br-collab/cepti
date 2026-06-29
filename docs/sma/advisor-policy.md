# CEPTI Advisor — Answer Policy

> **Single source of truth** for how the conversational advisor behaves across
> every channel: WhatsApp, Facebook Messenger, Instagram Direct (and the website
> chatbot, which shares the same knowledge base). All channels run one brain
> (`lib/sma/advisor-core.ts`) with one knowledge base (`prompts/whatsapp/kb.md`)
> and these identical rules. Decided 2026-06-28.

## Policy name: "Bot-first, human-override, price-safe"

The advisor answers every inbound message instantly, around the clock, but only
product questions — never anything commercial — and a human can take over any
conversation at any moment, which silences the bot for that thread. The point is
to capture lead intent the instant it appears, with zero risk of the bot saying
something it shouldn't.

## The rules

1. **Always-on, bot-first.** Every new inbound DM gets an immediate reply, any
   hour of any day, in the customer's language (Spanish by default; it mirrors
   the customer). No time-gating — speed is the value.
2. **Guardrailed content only.** It answers product questions grounded in the
   ficha-técnica knowledge base (what a product is, its uses, technical specs,
   installation, warranty, maintenance, safety). It **never** quotes prices,
   costs, coverage in m², or delivery times, and never invents specs.
3. **Hard handoff triggers.** When any of these occur, the bot sends a short
   bridge message, flips the conversation to "human," and goes silent:
   - any price / cost / quote / "cuánto cuesta" / how-to-order / availability ask
   - complaints or upset/negative tone
   - anything it cannot answer confidently or that is outside the knowledge base
   - an explicit request to talk to a person
   - any non-text message (image, audio, document, location, sticker)
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

- **Handoff wording by time of day.** Default: the bridge message is
  time-neutral ("nuestro equipo te responderá a la brevedad"). Optional upgrade:
  vary the wording by business hours in `America/Santo_Domingo` (proposed default
  **Mon–Fri 08:00–17:00, Sat 08:00–12:00**) so an after-hours handoff sets an
  honest expectation. Confirm the real hours to enable this; it's a small change
  in `advisor-core.ts`.
- **Escalation visibility.** Handed-off threads surface in `/admin/sma`
  (Bot/Human status) and in the platform inbox the team already uses (WhatsApp
  Business app / Meta Business Suite). v1 has no separate push notification; add
  a Slack/email ping later if human response time slips.
- **Alternative mode (flip-able).** "After-hours only" — the bot answers solely
  outside business hours and humans own daytime. Documented as an option;
  **default is always-on**, which captures the most lead intent. Not recommended
  unless the team specifically wants to own daytime conversations.

## Why this policy (rationale for operators and buyers)

The advisor's only job is to never let a real question sit unanswered and to
route genuine buying intent to a human fast. Because the guardrails already fence
off everything commercially sensitive (prices, quotes, complaints), answering
instantly is safe — there is no upside to making a customer wait for a human to
say something the bot could have said correctly in two seconds. Human override
means the team keeps full control of any conversation that matters, and the
"price-safe" guarantee (the bot will never quote a number) is what makes
autonomous 24/7 response acceptable in the first place.

## Where this is enforced in code

- `lib/sma/advisor-core.ts` — the shared brain: prompt + KB, the `[HANDOFF]`
  decision, transcript handling, usage logging.
- `prompts/advisor/system.md` — the guardrail/handoff instructions (rules 2, 3, 5).
- `lib/sma/dm-advisor.ts` + `lib/sma/whatsapp-advisor.ts` — arbitration (rules 1,
  4): dedupe, bot-first reply, back off when a human replies, escalate non-text.
- `prompts/whatsapp/kb.md` — the knowledge base (rule 2).
- `/admin/sma/whatsapp` and `/admin/sma/messages` — the Take over / Return to bot
  controls (rule 4).

> Reminder: none of the advisors are live until Meta App Review for the relevant
> permissions and the channel webhooks/onboarding are completed. This policy
> governs behavior once they are live.
