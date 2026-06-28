# Social Media Agent (SMA)

The SMA recommends posts, schedules them, and drafts replies to public comments across CEPTI's Instagram, Facebook Page, and Threads accounts. A human approves every published post and every reply. Social-platform DMs (IG/FB/Threads) are out of scope. Inbound WhatsApp is handled directly by humans today; an inbound **WhatsApp Advisor** bot is greenlit but not yet built (see `docs/sma/architecture-v2.md` §6).

The north-star metric is WhatsApp quote requests attributable to social. Every wa.me link the SMA emits carries a ref-token so leads can be traced back to the post or comment they came from.

> **This file documents Phase 1.** SMA v2 (Coordinator, guardrails, FB + IG agents, generalized publish pipeline, WhatsApp Advisor, scheduling, measurement, finops, video) shipped across PRs #5–#19. For the current plan-vs-reality map, see `docs/sma/architecture-v2.md` §0 — it is authoritative over the phase table below.

## Phase status (updated 2026-06-28)

| Phase | Scope                                                                 | Status        |
| ----- | --------------------------------------------------------------------- | ------------- |
| 1     | Foundation: schema, OAuth, encryption, dashboard skeleton, wa-link    | shipped       |
| 2     | Recommendations engine (per-platform drafts, hashtags, posting times) | shipped       |
| 3     | Scheduling & publishing                                               | FB + IG shipped (pipeline generalized); **Threads agent is a stub**; IG prod posting gated on App Review |
| 4     | Comment polling/webhooks + reply drafter + Inbox UI                   | Inbox + classification shipped; **`draftReply()` reply-posting stubbed on all agents** |
| 5     | Daily metrics snapshots + attribution dashboard                       | shipped (FB + IG engagement; WhatsApp leads logged by hand) |
| —     | WhatsApp Advisor (inbound, reactive)                                  | built (PR #17); not live until Coexistence onboarding |

## Architecture (Phase 1)

```
+--------------------+       +-------------------------+
|  Admin (browser)   | <---> |  Next.js App Router     |
|  /admin/sma        |       |  app/[lang]/admin/sma   |
+--------------------+       |  app/api/sma/**         |
                             +------------+------------+
                                          |
                  +-----------------------+-----------------------+
                  |                       |                       |
       +----------v---------+  +----------v---------+   +---------v---------+
       |  Supabase (DB+RLS) |  |  Meta Graph APIs   |   |   Anthropic API   |
       |  sma_* tables      |  |  IG / FB / Threads |   |   (Phase 2+)      |
       |  Supabase Auth     |  +--------------------+   +-------------------+
       +--------------------+
                  ^
                  |
       +----------+---------+
       |  Vercel Cron       |
       |  refresh-tokens    |
       +--------------------+
```

- Server-only secrets never leave the server. OAuth tokens are stored AES-256-GCM-encrypted in `sma_tokens` using `SMA_TOKEN_ENCRYPTION_KEY`.
- Admin gating: `/app/[lang]/admin/(gated)/layout.tsx` checks for a Supabase Auth session *and* membership in `public.sma_admins`. Failures redirect to `/admin/login`.
- All admin DB writes go through the user's authenticated session — RLS allows admins (`is_sma_admin()`) to read/write everything and blocks everyone else. The service role is used only by webhooks and cron.

## Tables (see `supabase/migrations/0001_sma_schema.sql`)

- `sma_admins` — single-user-for-now admin membership.
- `sma_tokens` — encrypted OAuth tokens per platform+external account.
- `sma_drafts` — recommendation drafts (Phase 2 writes).
- `sma_scheduled_posts` / `sma_published_posts` — Phase 3.
- `sma_comments` / `sma_reply_drafts` — Phase 4.
- `sma_metrics_snapshots` — Phase 5.

Enums: `sma_platform`, `sma_post_status`, `sma_comment_class`, `sma_reply_status`.

## Routes shipped in Phase 1

- `app/[lang]/admin/login` — sign-in (server action).
- `app/[lang]/admin/(gated)/sma` — dashboard root (connection status + Phase 1 status panel).
- `app/[lang]/admin/(gated)/sma/connections` — connection controls + requested scopes.
- `app/[lang]/admin/(gated)/sma/{recommendations,scheduled,inbox,insights,settings}` — placeholders for later phases.
- `app/api/sma/oauth/[platform]/start` — initiates OAuth handshake (CSRF state cookie).
- `app/api/sma/oauth/[platform]/callback` — exchanges code → long-lived token, stores encrypted.
- `app/api/sma/webhooks/[platform]` — GET verify-token handshake, POST signed-payload receiver (Phase 4 will parse).
- `app/api/sma/cron/refresh-tokens` — Vercel Cron daily refresh of tokens within 7 days of expiry.

## Environment variables

See `.env.example` for the full list. New variables introduced in Phase 1:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`
- `SMA_TOKEN_ENCRYPTION_KEY` — 32-byte hex; generate with `openssl rand -hex 32`. Rotating this invalidates all stored tokens (re-OAuth required).
- `CRON_SECRET` — Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` on the scheduled call.

`ANTHROPIC_API_KEY` is reused from the existing chat route.

## Meta App configuration

1. Create a Meta App at https://developers.facebook.com/apps.
2. Add **Instagram**, **Facebook Login**, and **Threads** products.
3. Register valid OAuth redirect URIs:
   - `https://cepti-nu.vercel.app/api/sma/oauth/instagram/callback`
   - `https://cepti-nu.vercel.app/api/sma/oauth/facebook/callback`
   - `https://cepti-nu.vercel.app/api/sma/oauth/threads/callback`
   - For local dev, also `http://localhost:4000/api/sma/oauth/<platform>/callback`.
4. Register webhook subscriptions pointing at:
   - `https://cepti-nu.vercel.app/api/sma/webhooks/instagram`
   - `https://cepti-nu.vercel.app/api/sma/webhooks/facebook`
   - `https://cepti-nu.vercel.app/api/sma/webhooks/threads`
   Use `META_WEBHOOK_VERIFY_TOKEN` as the verify token in each subscription.
5. Submit the permissions in the next section for App Review.

## Meta permissions requiring App Review (2–4 weeks each)

Instagram: `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments`, `instagram_business_manage_insights`.

Facebook Page: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `pages_read_user_content`.

Threads: `threads_basic`, `threads_content_publish`, `threads_manage_replies`, `threads_read_replies`, `threads_manage_insights`.

Threads publishing also requires **Tech Provider Verification** with Meta (~1 week, separate process from per-permission App Review).

Each App Review screencast must demonstrate the end-to-end user flow that needs the permission. Capture these flows once the dashboard ships:
- Approve and publish a post on each platform (publish permissions).
- View a comment and approve a draft reply (comment/reply permissions).
- Display per-platform insights pulled by the cron (insights permissions).

## Setup checklist

1. Create a Supabase project (free tier). Copy the URL, anon key, and service-role key into Vercel envs.
2. Run `supabase/migrations/0001_sma_schema.sql` against the project (Supabase SQL editor is fine for first run; we'll wire `supabase db push` later if needed).
3. Create your admin user in Supabase Auth (email/password). Then in the SQL editor:
   ```sql
   insert into public.sma_admins (user_id) values ('<the-new-user-uuid>');
   ```
4. Generate secrets:
   ```sh
   openssl rand -hex 32   # SMA_TOKEN_ENCRYPTION_KEY
   openssl rand -hex 24   # META_WEBHOOK_VERIFY_TOKEN
   openssl rand -hex 24   # CRON_SECRET
   ```
5. Populate the rest of the Meta-side envs after creating the Meta App.
6. Deploy. The Vercel Cron job in `vercel.json` runs `refresh-tokens` daily at 06:00 UTC.

## Known limits and failure modes

- **Tokens silently expire** if the cron stops running for longer than the longest provider TTL (~60 days). The dashboard will show "Reconnect required" once a row is revoked, but the cron is the first line of defense — alert on `failed` results in its response.
- **Webhook delivery is best-effort.** Phase 4 will also poll every 15 minutes for comments as a safety net.
- **No social-platform DM handling.** The SMA must not subscribe to IG/FB/Threads DM webhooks. Inbound WhatsApp is currently direct — visitors click a `wa.me` link and humans handle the conversation on WhatsApp Business (no ManyChat, no Zapier, no Sheets auto-logging). NOTE: an inbound WhatsApp Advisor bot is greenlit (2026-06-28, `docs/sma/architecture-v2.md` §6); when built it will own the WhatsApp Cloud API webhook for `+1 (829) 449-1104`.
- **`SMA_TOKEN_ENCRYPTION_KEY` rotation** is destructive: existing ciphertexts cannot be decrypted with the new key. Plan a re-OAuth window when rotating.
- **Phase 1 does not yet refresh the Supabase auth cookie** in Server Components. If the admin session expires mid-page, they'll be redirected to login on the next request — acceptable for a single-admin tool; revisit in Phase 2 if it becomes noisy.
