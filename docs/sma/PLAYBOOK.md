# CEPTI SMA — Operations & Commercialization Playbook

> **Purpose.** One document to stand up, operate, and hand off the CEPTI Social
> Media Agent (SMA) and WhatsApp Advisor from zero — for a new operator, a
> developer dropping in, or a buyer evaluating the system. If anything here
> conflicts with the code, the code wins; flag the drift and fix this doc.
>
> **Last reconciled:** 2026-06-28 against `main` (through PR #27).
>
> **Companion docs:** `CLAUDE.md` (conventions + governance),
> `docs/sma.md` (Phase 1 detail), `docs/sma/architecture-v2.md` (architecture +
> §0 implementation status), `docs/sma/whatsapp-advisor.md` (WhatsApp runbook).

---

## 0. TL;DR — what this is and what state it's in

The SMA is an admin-gated system bolted onto the CEPTI Next.js site that helps
run CEPTI's social presence and customer chat, all funneling to one metric:
**WhatsApp quote requests**. It has four parts:

1. **Coordinator + platform agents** — generate, schedule, and publish posts and
   draft replies to public comments on Facebook, Instagram, Threads. Every post
   and reply is human-approved (no autonomous publishing).
2. **Inbound advisors** (WhatsApp, Facebook Messenger, Instagram Direct) — one
   reactive customer-service brain, autonomous within hard guardrails, governed by
   the answer policy; hands off to a human for prices/quotes/complaints.
3. **Admin dashboard** (`/admin/sma`) — approval queue, scheduling, inbox,
   WhatsApp conversations, insights, FinOps.
4. **Measurement** — engagement snapshots + manual WhatsApp lead attribution.

**Reality check (read before selling or deploying):**

| Capability | State |
| --- | --- |
| Coordinator, guardrails, audit | ✅ built |
| **Facebook** publish / engagement | ✅ built end-to-end (comment-reply posting separate — see below) |
| **Instagram** publish / engagement | ✅ built (App Review gates production) |
| **Threads** publish / reply / engagement | ⛔ STUB — `NOT_IMPLEMENTED` |
| Comment-reply posting (`draftReply`) | ⛔ STUB on all agents |
| WhatsApp Advisor (code) | ✅ built (needs onboarding to run) |
| Messenger + IG Direct DM advisors (code) | ✅ built (needs App Review + webhook to run) |
| Grok video studio | ✅ built |
| FinOps / measurement / scheduling | ✅ built |
| Meta App Review (publish + messaging perms) | ⏳ not granted — gates production |

So today **Facebook and Instagram** can publish (Threads is still a stub), but
**nothing is live in production until Meta App Review is granted and the accounts
are connected**. The dashboard showing "0 published" is expected — not an
approval-rate or content-quality problem. The low approval count (1 approved /
47 denied) is just Bill + Francisco doing test reviews; nothing is connected or
reviewed yet. See §9 for the roadmap to close these.

---

## 1. Prerequisites (accounts you must own)

| Service | Why | Notes |
| --- | --- | --- |
| **Vercel** | Hosting + Cron | Project deploys from the repo; crons are in `vercel.json`. |
| **Supabase** | Postgres + Auth | One project. Free tier is fine to start. |
| **Anthropic** | LLM (captions, classification, WhatsApp replies) | `ANTHROPIC_API_KEY`. |
| **xAI** | Grok video generation | `XAI_API_KEY`. Only needed for Video Studio. |
| **Meta App** (developers.facebook.com) | IG/FB/Threads + WhatsApp APIs | One app covers all four. Business verification required for production. |
| **Facebook Page + IG Business account** | Posting targets | IG must be a Business/Creator account linked to the Page. |
| **WhatsApp Business** number + WABA | WhatsApp Advisor | Via Coexistence (see §7). |
| **Meta Verified for Business** | Display name on WhatsApp; Coexistence verification | Coexistence can't use standard Business Verification / blue badge. |

---

## 2. Environment variables (complete reference)

All are server-side. Set them in Vercel project settings (and `.env.local` for
local dev). `.env.example` is the canonical list.

| Variable | Required | Used by | How to get / notes |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | captions, comment classification, WhatsApp replies, website chat | Anthropic console. |
| `XAI_API_KEY` | for video | `lib/sma/xai-video.ts` | xAI console. Throws if a video job runs without it. |
| `SUPABASE_URL` | yes | all DB access | Supabase project settings → API. |
| `SUPABASE_ANON_KEY` | yes | admin auth (RLS-scoped) | Supabase API settings. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | webhooks/cron/agents (bypass RLS) | Supabase API settings. **Secret — server only.** |
| `NEXT_PUBLIC_SUPABASE_URL` | optional | `scripts/sma/verify-*` E2E only | Same value as `SUPABASE_URL`. App runtime doesn't need it. |
| `META_APP_ID` | yes | OAuth | Meta App dashboard. |
| `META_APP_SECRET` | yes | OAuth + **all webhook signature checks** (incl. WhatsApp) | Meta App dashboard. **Secret.** |
| `META_WEBHOOK_VERIFY_TOKEN` | yes | webhook GET handshake (all platforms incl. WhatsApp) | You choose it: `openssl rand -hex 24`. |
| `SMA_TOKEN_ENCRYPTION_KEY` | yes | AES-256-GCM encryption of stored OAuth tokens | `openssl rand -hex 32`. **Rotating it invalidates all stored tokens (re-OAuth needed).** |
| `CRON_SECRET` | yes | Vercel Cron auth (`Authorization: Bearer`) | `openssl rand -hex 24`. |
| `WHATSAPP_PHONE_NUMBER_ID` | for WhatsApp | WhatsApp send | Meta WhatsApp → API setup. |
| `WHATSAPP_ACCESS_TOKEN` | for WhatsApp | WhatsApp send | Permanent System User token w/ `whatsapp_business_messaging`. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | reference | (future) | WABA id. |
| `WHATSAPP_API_BASE` | optional | swap to a BSP | Defaults to `https://graph.facebook.com/v23.0`. Set to a BSP base (e.g. 360dialog) to route sends through a BSP. |

---

## 3. Database — migrations & bootstrap

Migrations live in `supabase/migrations/`. Apply in order (Supabase SQL editor
is fine for first run, or `supabase db push`):

| File | Adds |
| --- | --- |
| `0001_sma_schema.sql` | Core schema, RLS, `sma_admins`, `is_sma_admin()` security-definer fn |
| `0002_sma_v2_schema.sql` | Coordinator/lifecycle tables (`sma_coordinator_tasks`, `sma_handoffs`, `sma_paused_lifecycles`, `sma_content_lifecycles`) + `sma_whatsapp_conversations` / `sma_whatsapp_messages` |
| `0003_sma_video_jobs.sql` | Grok video jobs |
| `0004_sma_examples.sql` | Curated examples library |
| `0005_sma_ai_usage.sql` | FinOps usage ledger (`sma_ai_usage`) |
| `0006_sma_measurement.sql` | Engagement snapshots + lead logging |
| `0007_sma_scheduled_jobs.sql` | Scheduled publishing jobs |
| `0008_sma_dm.sql` | Messenger / IG Direct DM conversation + message tables (`sma_dm_*`), RLS admin-only |

**RLS:** every `sma_*` table is admin-only via `is_sma_admin()`. Browser/anon
sessions can't read them; the service-role key (webhooks/cron/agents) bypasses RLS.

**Admin bootstrap:** create an admin user in Supabase Auth (email/password), then:

```sql
insert into public.sma_admins (user_id) values ('<the-new-user-uuid>');
```

Both Bill and Francisco are intended to be in `sma_admins` with equal access.

---

## 4. Deploy from zero (checklist)

1. Create the Supabase project; copy URL + anon + service-role keys into Vercel env.
2. Apply migrations `0001`→`0008`.
3. Create your admin user + insert into `sma_admins` (§3).
4. Generate secrets: `SMA_TOKEN_ENCRYPTION_KEY` (hex 32), `META_WEBHOOK_VERIFY_TOKEN` (hex 24), `CRON_SECRET` (hex 24).
5. Create the Meta App; add Instagram, Facebook Login, Threads, and WhatsApp products; fill `META_*` envs.
6. Set `ANTHROPIC_API_KEY` and (for video) `XAI_API_KEY`.
7. Deploy to Vercel. Confirm the three crons in `vercel.json` are registered.
8. Register OAuth redirect URIs + webhooks (§5, §6).
9. Connect IG/FB/Threads via `/admin/sma/connections` (OAuth).
10. Onboard WhatsApp via Coexistence (§7).
11. Submit Meta App Review per permission as each feature becomes demonstrable (§8).

---

## 5. Cron jobs

Defined in `vercel.json`; all require `Authorization: Bearer $CRON_SECRET`.

| Path | Schedule | Job |
| --- | --- | --- |
| `/api/sma/cron/refresh-tokens` | `0 6 * * *` (daily 06:00 UTC) | Refresh long-lived OAuth tokens nearing expiry. Alert on `failed` results. |
| `/api/sma/cron/poll-videos` | `*/2 * * * *` | Poll Grok video jobs for completion. |
| `/api/sma/cron/publish-scheduled` | `*/5 * * * *` | Publish approved posts whose scheduled time has arrived. |

---

## 6. Webhooks

All use the same Meta verification: GET handshake against
`META_WEBHOOK_VERIFY_TOKEN`, POST signature `X-Hub-Signature-256` =
HMAC-SHA256(rawBody, `META_APP_SECRET`).

| Platform | Callback URL (prod) | Subscribe |
| --- | --- | --- |
| Instagram | `https://<host>/api/sma/webhooks/instagram` | comments |
| Facebook | `https://<host>/api/sma/webhooks/facebook` | feed/comments |
| Threads | `https://<host>/api/sma/webhooks/threads` | mentions/replies |
| **WhatsApp** | `https://<host>/api/sma/whatsapp/webhook` | **`messages`** |
| **Messenger + Instagram Direct DMs** | `https://<host>/api/sma/messaging/webhook` | subscribe `messages`/`messaging` on the Page + Instagram (webhook `object` "page" = Messenger, "instagram" = IG) |

(Replace `<host>` with `cepti-nu.vercel.app` or the production domain.)

---

## 7. WhatsApp Advisor onboarding (Coexistence)

Full detail in `docs/sma/whatsapp-advisor.md`. Summary:

1. Confirm the team is on the WhatsApp **Business app** for the number and opens
   it at least every 14 days (Coexistence drops the API link otherwise).
2. Enable **Coexistence** for the number via Meta Cloud API onboarding (no BSP
   required; a BSP is optional and only smooths onboarding).
3. Get **Meta Verified for Business** so the display name shows.
4. Fill `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`,
   `WHATSAPP_BUSINESS_ACCOUNT_ID`.
5. Register the webhook (§6) and subscribe `messages`.
6. Test from another phone; check `/admin/sma/whatsapp`.

**Behavior:** answers product questions autonomously (Spanish default) from the
ficha-técnica KB (`prompts/whatsapp/kb.md`); **hard handoff** to a human on
price/quote/order, complaint, low confidence, explicit human request, or any
non-text message. Operators take over / hand back in `/admin/sma/whatsapp`.

---

## 7a. Advisor answer policy ("Bot-first, human-override, price-safe")

The single answer policy governing every conversational channel — WhatsApp,
Facebook Messenger, Instagram Direct, and the website chatbot (one brain, one
KB). **One line:** the bot answers product questions instantly 24/7, **never**
quotes prices or anything commercial, and hard-hands-off to a human (who can
also take over any thread at will) the moment a sale, complaint, or uncertainty
appears. This is the commercial selling point: a governed, price-safe, always-on
bot that captures lead intent the instant it lands while a human keeps full
control of anything that matters. Canonical spec: `docs/sma/advisor-policy.md`.

---

## 8. Meta App Review (gates production posting)

Meta requires a screencast of the complete user journey per permission, and the
feature must be demonstrable in `/admin/sma` before submitting (empty stubs get
rejected and burn a review cycle).

- **Threads:** 8 permissions added in dev mode (`threads_basic`,
  `threads_content_publish`, `threads_keyword_search`, `threads_manage_insights`,
  `threads_manage_mentions`, `threads_manage_replies`, `threads_profile_discovery`,
  `threads_read_replies`). Also needs **Tech Provider Verification** (~1 week).
- **Instagram Graph API** use case: `instagram_content_publish` is now
  demonstrable (IG publish is built) and can be submitted; `instagram_manage_messages`
  (IG Direct DMs; was removed 2026-05-24, must be re-added) also needs review.
- **Facebook Pages** use case: publish perms + `pages_messaging` (Messenger).
- **WhatsApp**: business messaging permission for the Cloud API.

Until publish permissions are granted, posting stays blocked regardless of code.

---

## 9. What works vs. what's left (roadmap)

**Works now:** Coordinator + guardrails; Facebook agent end-to-end; Instagram
publish + engagement (single + carousel); generalized publish pipeline
(`publishApprovedTask`); scheduling + publish cron; comment inbox + reply
*drafting* (FB/IG); three DM advisors on one brain (WhatsApp, Messenger, IG
Direct), governed by the answer policy; website chatbot reusing the shared ficha
KB; FinOps; measurement; Grok video; WhatsApp Advisor (pending onboarding).

**Open work, priority order** (mirrors `CLAUDE.md`):

1. **Meta App Review + connect accounts** — submit publish perms
   (`instagram_content_publish`, Facebook Pages) and messaging perms
   (`pages_messaging`, `instagram_manage_messages`), and connect the live
   accounts. This is the go-live gate — nothing is in production until it clears.
2. **Threads agent** — implement `publish`/`draftReply`/`fetchEngagement` (only
   platform that can't post); needs Threads base URL + Tech Provider Verification.
3. **Comment-reply posting** — `draftReply()` is stubbed on every agent (inbox
   classifies comments but can't post replies); build the posting path.
4. **Reconcile `feat/sma-v2-scaffold`** (diverged branch: scheduling, multi-user
   approvals, analytics, ~2,800 lines of E2E tests).
5. **(Optional) Escalation alert for DM handoffs** — notify an operator when a
   DM advisor hard-hands-off.

Website-KB reuse is **DONE** (PR #22) — web + WhatsApp/DM answer from the same KB.

---

## 10. FinOps (costs)

LLM + video spend is logged to `sma_ai_usage` and surfaced on the dashboard
(estimates from an approximate price map in `lib/sma/ai-usage.ts`).

| Use | Model | Approx rate |
| --- | --- | --- |
| Captions / scripts (`kind` `caption`) | `claude-opus-4-8` | $15 / $75 per 1M tok (in/out) |
| WhatsApp / Messenger / IG DM replies (`kind` `whatsapp` / `messenger` / `instagram_dm`) | `claude-sonnet-4-6` | $3 / $15 per 1M tok |
| Website chat | `claude-sonnet-4-6` | $3 / $15 per 1M tok |
| Video | `grok-imagine-video-1.5` | ~$0.08 / sec (computed from `sma_video_jobs`) |

WhatsApp inbound replies inside the 24-hour service window are **free on Meta's
side** — cost is the LLM call only. The WhatsApp KB (~10k tokens) is cached via
`cache_control`, so it isn't re-billed each turn.

---

## 11. Failure modes & guardrails

- **Fail closed on auth.** Expired/revoked token → the agent refuses to act and
  surfaces "reconnect required"; it never posts on a dead token.
- **No autonomous social posting.** Every post and public-comment reply is
  human-approved (Coordinator's Five Immutable Stops, enforced in
  `lib/sma/coordinator/guardrails.ts`).
- **Advisor guardrails (all DM channels).** Never quotes prices/coverage;
  complaints and uncertainty escalate to a human; reactive only (no proactive
  messaging in v1). Canonical spec: `docs/sma/advisor-policy.md`.
- **Webhook security.** Invalid `X-Hub-Signature-256` → 401. Keep `META_APP_SECRET` secret.
- **Token encryption.** OAuth tokens are AES-256-GCM encrypted at rest;
  rotating `SMA_TOKEN_ENCRYPTION_KEY` is destructive (plan a re-OAuth window).
- **Coexistence.** API link drops if the Business app isn't opened within 14 days.
- **No fabricated metrics.** API failures surface; numbers are never invented.

---

## 12. Governance (how changes are made)

From `CLAUDE.md` (authoritative): never commit to `main` directly (branch +
PR/`--no-ff`); never `git add .` (stage by path); typecheck + lint before every
commit (baseline noted in `CLAUDE.md`); `lib/calculator/rates.ts` and product
data are spec-gated; agents stop before irreversible actions (merge, push,
prod env change, external API call, DB migration) and never self-approve a merge.
