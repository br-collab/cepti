# CEPTI SMA — Architecture v2

> **Status:** PARTIALLY IMPLEMENTED — most of v2 is shipped to `main`. See
> **Section 0 (Implementation Status)** below for the plan-vs-reality map. The
> design sections (1–14) are retained as the original rationale; where a section
> is now stale or wrong, Section 0 is authoritative.
> **Author:** Drafted 2026-05-26 by Bill, with Claude as architecture partner.
> Reconciled to actual code 2026-06-28.
> **Reference:** Patterns adapted from Project Aureon's `ThifurC2` coordinator
> (financial-services multi-agent system). Domain-specific elements
> (regulatory compliance, settlement, OFAC screening) explicitly excluded.
> **Supersedes:** SMA v1 design captured in CLAUDE.md and `docs/sma.md`.

---

## 0. Implementation Status (reconciled 2026-06-28, updated post-merge)

This document was written 2026-05-26 as a *proposal*. As of `main` @ `1096afd`
(2026-06-28), most of it is built and merged via PRs #5–#19 — including the
WhatsApp Advisor (#17), the Instagram agent + generalized publish pipeline
(#18), and the commercialization playbook (#18). This section is the single
source of truth for what exists; the design sections below explain *why* but no
longer reliably describe *what is*.

### What is DONE on `main`

| Area | File(s) | State |
| --- | --- | --- |
| Coordinator (Light scope) | `lib/sma/coordinator/coordinator.ts` | DONE — all 10 §4 API methods present; schedules/dispatches approved content, does not author or pick topics. Some lineage helpers (`makeLineageHash`, `assembleLifecycle`, `recordTelemetry`, `getContentLifecycle`) are stubbed/minimal. |
| Five Immutable Stops | `lib/sma/coordinator/guardrails.ts` | DONE — each Stop is a throwing guard (`assertNotSelfPublishing`, `assertNotCoordinatorAuthorship`, `assertValidHandoff`, `assertAuditTableOnly` + `assertLifecycleNotDuplicated`, `assertApprovalContextComplete`). Stop 1 double-enforced in `FacebookAgent.publish()`. |
| Audit log | `lib/sma/coordinator/audit.ts` | DONE |
| Registry / dispatch map | `lib/sma/coordinator/registry.ts` | DONE |
| Facebook agent | `lib/sma/agents/facebook-agent.ts` | DONE end-to-end — real Graph API `publish()` + `fetchEngagement()` (`draftReply()` stubbed; comment-reply posting not built for any platform). |
| Instagram agent | `lib/sma/agents/instagram-agent.ts` | DONE (PR #18) — `publish()` (container→publish, single + carousel, rejects text-only) + `fetchEngagement()` (likes/comments + reach). `draftReply()` stubbed, matching FB. Production posting still gated on Meta App Review for `instagram_content_publish`. |
| WhatsApp Advisor | `lib/sma/whatsapp-advisor.ts`, `whatsapp-client.ts`, `whatsapp-store.ts`, `app/api/sma/whatsapp/webhook` | DONE (PR #17) — inbound, reactive, autonomous-within-guardrails; KB from `prompts/whatsapp/kb.md`. Not live until Coexistence onboarding (see §6 + `whatsapp-advisor.md`). |
| Messenger + IG Direct DM advisor | `lib/sma/advisor-core.ts` (shared brain), `dm-advisor.ts`, `messenger-client.ts`, `instagram-dm-client.ts`, `dm-store.ts`, `app/api/sma/messaging/webhook`, `/admin/sma/messages`, migration `0008` | DONE — shares the advisor brain + KB + guardrails with WhatsApp; reverses the "no DM handling" rule for FB/IG (Threads DMs still out). Answer policy DECIDED: "Bot-first, human-override, price-safe" (`docs/sma/advisor-policy.md`). Not live until App Review for `pages_messaging` + `instagram_manage_messages` + messaging webhook subscription. |
| Platform base | `lib/sma/agents/platform-base.ts` | DONE |
| v2 schema | `supabase/migrations/0002_sma_v2_schema.sql` | DONE — creates `sma_coordinator_tasks`, `sma_handoffs`, `sma_paused_lifecycles`, `sma_content_lifecycles`, `sma_whatsapp_conversations`, `sma_whatsapp_messages` (+ indexes, RLS). |
| Coordinator API routes | `app/api/sma/coordinator/{task,queue,ready,recommend,history,decide/[taskId],dismiss/[taskId]}` | DONE — note: approve/deny merged into `decide`. |
| Publish + scheduling | `app/api/sma/publish/[taskId]`, `app/api/sma/schedule`, `app/api/sma/cron/{publish-scheduled,poll-videos,refresh-tokens}`, `lib/sma/publish-service.ts` | DONE — generalized to all platforms (PR #18) via `publishApprovedTask(taskId, platform)`; FB + IG wired end-to-end, Threads pending its agent. `publishApprovedFacebookTask` kept as a back-compat wrapper. |
| Commercialization docs | `docs/sma/PLAYBOOK.md`, README §7, `.env.example` | DONE (PR #18) — zero-to-deploy handoff playbook. |
| OAuth | `app/api/sma/oauth/[platform]/{start,callback}` | DONE (parameterized, not per-platform folders). |
| Dashboard tabs | `app/[lang]/admin/(gated)/sma/{page,connections,queue,scheduled,inbox,insights,recommendations,guide,settings}` | DONE — `queue` is the approval queue. |
| Per-platform prompts | `prompts/{facebook,instagram,threads}/` | DONE (v1 root prompts `caption.md`/`reply.md`/`classify.md` not yet archived per §11). |
| Finops / measurement / video | `lib/sma/{ai-usage,dashboard-stats,video-poller,xai-video}.ts`, video routes | DONE (not in the original v2 plan; added since). |

### What is STUB or MISSING

| Item | Where | State / impact |
| --- | --- | --- |
| **Threads agent** | `lib/sma/agents/threads-agent.ts` | **STUB** — `publish()`/`draftReply()`/`fetchEngagement()` throw `NOT_IMPLEMENTED`. No `threads-client.ts` yet. The last platform stub; needs Tech Provider Verification for production. |
| **Comment-reply posting** | `draftReply()` on all agents | **NOT BUILT** — `draftReply()` is stubbed across FB/IG/Threads; the Inbox can classify comments but reply *posting* isn't wired for any platform. |
| Coordinator sub-modules | `handoff.ts`, `lineage.ts`, `escalation.ts`, `pause-resume.ts` | **N/A by design** — folded into `coordinator.ts` rather than split. Not a gap. |
| `calendar` dashboard tab | — | MISSING (the `scheduled` list view stands in). |
| dedicated `coordinator-status` tab | — | MISSING (status shown on dashboard/insights). |

### Why the dashboard shows 0 published

Confirmed in code (not speculation): publishing is **fully manual by design**
(Immutable Stops 1 + 5 — nothing auto-posts) and `publishApprovedTask()` requires
a COMPLETE+APPROVED lifecycle, a draft for the platform, a live token, and a
human/cron trigger. FB and IG can publish (Threads still a stub); IG also needs
Meta App Review for `instagram_content_publish` before production. The low
approval count on the dashboard (1 approved / 47 denied) is **not a
content-quality signal** — it's an artifact of Bill and Francisco clicking
through reviews while testing. The real gate to going live is the Meta side:
App Review for the publish permissions + connecting the accounts. There is no
"approval-rate problem" to diagnose.

### Unmerged work

`origin/feat/sma-v2-scaffold` is **7 commits ahead of `main`** (scheduling,
multi-user approvals, analytics, ~2,800 lines of E2E tests) but has **diverged
history** (it deletes migrations/prompts that exist on `main`) and **still does
not** finish IG/Threads or build WhatsApp. Merging it is a conflict-resolution
job, not a fast-forward. Do not assume it is safe to merge as-is.

### Recommended next build target

Instagram is done (PR #18); website-KB reuse is done (PR #22). The remaining
priorities, in order:
1. **Submit Meta App Review** for the publish + messaging permissions
   (`instagram_content_publish`, `pages_messaging`, `instagram_manage_messages`)
   and connect the accounts — this, not any content issue, is the gate to going
   live across publishing, WhatsApp, and DMs.
2. **Threads agent** — last platform stub; mirror IG, but production needs Tech
   Provider Verification.
3. **Comment-reply posting** — `draftReply()` is stubbed on all agents.

---

## 1. Why v2

The original SMA design (v1, shipped Phase 1 on 2026-05-14) assumed:

- One agent handles all three platforms (FB, IG, Threads) via unified prompts
- WhatsApp is out of scope ("No DM handling" rule)
- ManyChat owns the inbound lead pipeline (later corrected — ManyChat is NOT in
  the pipeline; on-site chatbot routes inbound to WhatsApp via `wa.me` links)

Francisco's 2026-05-26 input changed three things:

1. **Multiple agents needed.** One per platform, ring-fenced to that platform's
   constraints, voice, and audience characteristics.
2. **A Coordinator above the platform agents.** Single human authority surface
   so Bill and Francisco see one queue, not three.
3. **WhatsApp Advisor integration.** The website Advisor chatbot extends to
   WhatsApp Business as a customer-service channel — using the same knowledge
   base, separate execution path from the social media coordinator.

This document specifies the v2 architecture that satisfies these requirements
without over-engineering for CEPTI's scale (1,300 IG followers, low-traffic
FB and Threads presence, no production volume yet).

---

## 2. Five Immutable Stops

These rules are non-negotiable. They are documented here, enforced in code,
and reviewed in every PR that touches the SMA layer.

1. **No self-publishing.** The Coordinator dispatches to platform agents.
   The Coordinator NEVER calls Meta's publish APIs directly. Publishing
   happens only inside a platform agent, only after a Bill/Francisco approval.

2. **No content authorship by the Coordinator.** The Coordinator's job is
   timing, dispatch, and lineage assembly. It does NOT write captions,
   replies, or copy. Content is authored by platform agents using
   platform-specific prompts.

3. **No platform action without a Coordinator dispatch record.** Each
   platform agent (Facebook, Instagram, Threads) checks for a valid
   `HandoffRecord` from the Coordinator before acting. Direct invocation
   of a platform agent without a dispatch record is rejected.

4. **One audit record per content lifecycle.** Raw agent telemetry (every
   intermediate draft, every prompt variation, every metric snapshot) does
   NOT go to the audit log. Only the Coordinator's curated
   `ContentLifecycle` record reaches `sma_content_lifecycles`. This keeps
   the audit log readable and forensically useful.

5. **No approval request without full context.** When the Coordinator
   surfaces an item for Bill or Francisco's approval, it bundles
   intent + draft + platform + scheduled time + relevant metrics. Approval
   UI shows everything in one view. No "approve this thing, find the
   context yourself" requests.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ /admin/sma DASHBOARD (Supabase Auth gated — Bill + Francisco)   │
│                                                                  │
│   - Approval queue        - Calendar     - Audit                 │
│   - Connection status     - Settings     - Coordinator status    │
└──────────────────────────┬──────────────────────────────────────┘
                           │ approve / deny / inspect
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ COORDINATOR (Tier 0)                                             │
│   Mandate: timing, dispatch, lineage assembly, escalation        │
│   Five Immutable Stops enforced in code                          │
└──────┬──────────────────┬──────────────────┬────────────────────┘
       │ dispatch         │ dispatch         │ dispatch
       ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Facebook     │  │ Instagram    │  │ Threads      │
│ Agent        │  │ Agent        │  │ Agent        │
│              │  │              │  │              │
│ - Drafts     │  │ - Drafts     │  │ - Drafts     │
│ - Publishes  │  │ - Publishes  │  │ - Publishes  │
│ - Reads      │  │ - Reads      │  │ - Reads      │
│   metrics    │  │   metrics    │  │   metrics    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       ▼                 ▼                 ▼
   Meta Graph        Meta Graph        Threads API
   (Pages API)       (IG API)          (separate base)

──── PARALLEL TRACK ────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────┐
│ WHATSAPP ADVISOR (separate from Coordinator)                     │
│   Inbound: WhatsApp Business webhook → KB-grounded LLM response  │
│   Shares knowledge base with website Advisor chatbot             │
│   No proactive outbound in v1 (WhatsApp template approval scope) │
└─────────────────────────────────────────────────────────────────┘
```

### Why WhatsApp is outside the Coordinator

The Coordinator handles **proactive broadcast** (posting content to followers).
WhatsApp Advisor handles **reactive 1:1** (responding to inbound customer
messages). These have different latency requirements, different message
formats, different compliance posture, and different success metrics.
Mixing them in one Coordinator would force timing logic to handle both
patterns, doubling complexity for no benefit.

The shared element is the knowledge base (`docs/sma/inputs/chatbot-kb/`),
not the orchestration layer.

---

## 4. Coordinator Design (Light, v1)

### Scope decision: Light Coordinator

The Coordinator decides **WHEN** to post pre-approved content from a queue.
It does NOT decide:

- WHAT to post about (Bill or Francisco proposes topics via dashboard)
- Whether engagement signals warrant posting at all (always posts approved
  content on schedule)
- Cross-platform coordination of message themes (each platform queue is
  independent in v1)

This is the simplest viable Coordinator. v1.5 may evolve to topic selection
based on engagement signals. v2.0+ may evolve to full content director with
"should we post at all" judgment. We commit to Light for v1.

### Public API (TypeScript)

```typescript
class SMACoordinator {
  // Dispatch
  issueTask(intent: ContentIntent, platforms: Platform[]): Promise<string>;

  // Handoff governance
  handoff(
    taskId: string,
    fromAgent: AgentRole,
    toAgent: AgentRole,
    payload: unknown,
  ): Promise<HandoffRecord>;
  confirmHandoff(record: HandoffRecord): Promise<boolean>;

  // Lineage
  recordTelemetry(
    taskId: string,
    agent: AgentRole,
    telemetry: AgentTelemetry,
  ): Promise<void>;
  getContentLifecycle(taskId: string): Promise<ContentLifecycle | null>;

  // Escalation (approval routing)
  requestApproval(
    taskId: string,
    reason: ApprovalReason,
    context: ApprovalContext,
  ): Promise<void>;

  // Pause / resume
  pauseLifecycle(
    taskId: string,
    reason: PauseReason,
    context: unknown,
  ): Promise<void>;
  resumeLifecycle(
    taskId: string,
    decision: 'APPROVE' | 'DENY',
    attribution: Attribution,
  ): Promise<TaskResult>;
  listPausedLifecycles(): Promise<PausedLifecycle[]>;

  // Status
  getStatus(): CoordinatorStatus;
}
```

### Core types

```typescript
type Platform = 'facebook' | 'instagram' | 'threads';

type AgentRole =
  | 'COORDINATOR'
  | 'FACEBOOK_AGENT'
  | 'INSTAGRAM_AGENT'
  | 'THREADS_AGENT';

type ContentIntent = {
  intent_id: string;
  proposed_by: 'bill' | 'francisco';
  topic: string;
  notes?: string;
  proposed_platforms: Platform[];
  scheduled_for?: string; // ISO timestamp; null = ASAP after approval
  reference_assets?: string[]; // Supabase storage paths to images
};

type HandoffRecord = {
  handoff_id: string;
  task_id: string;
  ts: string;
  from_agent: AgentRole;
  to_agent: AgentRole;
  payload: unknown;
  status: 'ISSUED' | 'ACTIVE' | 'COMPLETE' | 'ESCALATED' | 'FAILED';
  coordinator_authorized: true;
};

type ContentLifecycle = {
  task_id: string;
  intent: ContentIntent;
  drafts: Partial<Record<Platform, DraftResult>>;
  approvals: ApprovalRecord[];
  publications: Partial<Record<Platform, PublishResult>>;
  initial_metrics: Partial<Record<Platform, EngagementSnapshot>>;
  lineage_hash: string;
  assembled_at: string;
};
```

### Implementation budget

Target: **300-500 lines of TypeScript** for `coordinator.ts`. If we exceed
800 lines, we're over-engineering and should cut. Reference: Aureon's
`ThifurC2` is 1,766 lines but carries financial regulatory load
(BCBS 239 P3 validation, RTS6 alerts, OFAC screening, six convergence
scenarios) that CEPTI does not.

---

## 5. Platform Agent Design

### Common interface

All three platform agents implement the same `PlatformAgent` interface.
Differences are in prompts, API client, and platform-specific constraints
(character limits, media format, hashtag conventions).

```typescript
interface PlatformAgent {
  readonly platform: Platform;
  readonly role_id: AgentRole;

  // Draft generation from Coordinator dispatch
  draftPost(
    handoffRecord: HandoffRecord,
    intent: ContentIntent,
  ): Promise<DraftResult>;

  draftReply(
    handoffRecord: HandoffRecord,
    inbound: InboundComment,
  ): Promise<DraftResult>;

  // Publication (only after approval flag set)
  publish(
    handoffRecord: HandoffRecord,
    approvedDraft: ApprovedDraft,
  ): Promise<PublishResult>;

  // Read-only metric snapshot
  fetchEngagement(postId: string): Promise<EngagementSnapshot>;
}
```

### Per-platform specializations

#### Facebook Agent

- **Prompt directory:** `prompts/facebook/` — caption, reply, scheduling-window
- **API base:** Meta Graph API v25.0 — `https://graph.facebook.com/v25.0/`
- **Permissions used:** `pages_manage_posts`, `pages_read_engagement`,
  `pages_read_user_content`, `pages_manage_metadata`, `pages_show_list`
- **Platform constraints:**
  - Long-form posts work well (no character limit issue)
  - Link previews auto-generated; can include external links freely
  - Audience: 12 followers, primarily Spanish-speaking
  - Tone: professional, descriptive, slightly formal

#### Instagram Agent

- **Prompt directory:** `prompts/instagram/`
- **API base:** Meta Graph API v25.0 (via IG sub-app, App ID `1361461932563029`)
- **Permissions used:** `instagram_business_basic`,
  `instagram_business_content_publish`, `instagram_business_manage_comments`,
  `instagram_business_manage_insights`, `instagram_manage_comments`
- **Platform constraints:**
  - 2,200 character caption limit
  - Hashtag-heavy convention (up to 30)
  - First 125 characters are most important (preview cutoff)
  - Audience: 1,300 followers, the primary CEPTI audience
  - Tone: visual-first, aspirational, hashtag-rich
- **Out of scope:** DM handling (permission explicitly removed during App
  rebuild on 2026-05-24; Francisco's team handles DMs manually)

#### Threads Agent

- **Prompt directory:** `prompts/threads/`
- **API base:** Threads API — `https://graph.threads.net/v1.0/` (separate from
  graph.facebook.com)
- **Permissions used:** `threads_basic`, `threads_content_publish`,
  `threads_keyword_search`, `threads_manage_insights`, `threads_manage_mentions`,
  `threads_manage_replies`, `threads_profile_discovery`, `threads_read_replies`
- **Platform constraints:**
  - 500 character post limit
  - Thread chaining supported (multi-post sequences)
  - Audience: small but engaged Threads user base
  - Tone: conversational, opinion-friendly, less polished than IG

### Prompt management

Each platform gets a dedicated prompt directory. Within each, separate prompts
for distinct content types:

```
prompts/
├── facebook/
│   ├── caption.md
│   ├── reply.md
│   └── product-feature.md
├── instagram/
│   ├── caption.md
│   ├── reply.md
│   ├── carousel-caption.md
│   └── reel-caption.md
└── threads/
    ├── post.md
    ├── reply.md
    └── thread-chain.md
```

Prompts are version-controlled in the repo, tested with `prompts/eval/` (TBD),
and updated only through PRs with Bill's review.

---

## 6. WhatsApp Advisor (Separate Concern) — GREENLIT 2026-06-28

> **Decision (Bill, 2026-06-28):** BUILD the WhatsApp Advisor. This reverses
> the prior stance in CLAUDE.md ("inbound WhatsApp is handled directly by
> humans; do not duplicate the pipeline"). CLAUDE.md is being updated to match.
> Not yet implemented — no code exists. The blocking decisions below must be
> resolved with Francisco before the build starts.

### Blocking decisions (resolve before building)

1. **Number sharing.** The bot would live on `+1 (829) 449-1104`, the number
   Yuri/Francisco answer by hand today. A WhatsApp number has exactly one
   webhook destination — once the Cloud API owns it, inbound stops landing in
   the WhatsApp Business *app* unless explicitly forwarded. Decide: does the
   bot answer ALL inbound, only outside business hours, or only after N minutes
   of human non-response? (Cloud API has no native "answer only if human
   hasn't" — that logic must be built, and humans would need to work inside the
   same API surface or a shared inbox, not the consumer WhatsApp app.)
   **RESOLVED 2026-06-28:** policy decided — "Bot-first, human-override,
   price-safe" — the bot answers ALL inbound, always-on, with a human able to
   take over any thread (which silences the bot). Canonical spec:
   `docs/sma/advisor-policy.md`.
2. **API tier.** Inbound free-form replies are allowed only inside the 24-hour
   customer service window. Anything proactive (quote follow-ups) needs
   Meta-approved message templates per category. v1 = reactive only.
3. **WABA + verification.** Requires a WhatsApp Business Account, Meta Business
   verification, and the number migrated off the consumer WhatsApp Business app
   onto the Cloud API. This is a one-way move for that number — plan a cutover.
4. **Handoff target.** When the bot escalates ("Te conecto con nuestro
   equipo"), who is notified and how (shared inbox, Slack, a second human
   number)? §13 Q1 was never answered.
5. **North-star conflict.** The whole site is built around `wa.me` → human.
   Inserting a bot changes the conversion experience. Confirm this is intended,
   not a regression of the "conversion over content / don't duplicate the
   pipeline" principle.

### Scope (v1, once unblocked)

The WhatsApp Advisor handles **inbound** customer messages on CEPTI's
WhatsApp Business number `+1 (829) 449-1104` (`wa.me/18294491104`). It does
NOT proactively message users in v1 (proactive requires WhatsApp Business
Platform template approval per message category — defer to v1.5+).

### Architecture

```
WhatsApp Business webhook (Meta)
       │
       ▼
/api/sma/whatsapp/webhook (Next.js route)
       │
       ▼
WhatsApp Advisor agent
  - Look up conversation history (Supabase)
  - Retrieve relevant KB chunks (vector search against docs/sma/inputs/chatbot-kb/)
  - Generate response via Sonnet
  - Send reply via WhatsApp Business API
  - Log interaction to Supabase
```

### Knowledge base shared with website Advisor

Both the website Advisor chatbot and the WhatsApp Advisor draw from the same
5 PDFs in `docs/sma/inputs/chatbot-kb/`. Implementation note: a single
embedding index serves both surfaces.

### Where WhatsApp Advisor differs from website Advisor

- **Channel:** WhatsApp messages, not browser chat widget
- **Conversation persistence:** WhatsApp threads are long-lived; website chat is
  per-session
- **Latency budget:** ~5 seconds (WhatsApp users expect quick responses)
- **Handoff to human:** when the LLM is uncertain or the user asks for a
  person, the Advisor sends "Te conecto con nuestro equipo" and notifies
  Francisco's team to take over the thread manually

### Out of scope for v1

- Proactive messaging (requires template approval — defer to v1.5+)
- Multi-turn quoting workflows (defer)
- Order taking (CEPTI doesn't take orders through WhatsApp — quotes only)
- Integration with the Coordinator (these are independent agents)

---

## 7. Supabase Schema Additions

### New tables

```sql
-- Coordinator tasks
CREATE TABLE sma_coordinator_tasks (
  task_id text PRIMARY KEY,
  intent jsonb NOT NULL,
  platforms text[] NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Handoff records
CREATE TABLE sma_handoffs (
  handoff_id text PRIMARY KEY,
  task_id text REFERENCES sma_coordinator_tasks(task_id),
  from_agent text NOT NULL,
  to_agent text NOT NULL,
  payload jsonb,
  status text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Paused lifecycles awaiting approval
CREATE TABLE sma_paused_lifecycles (
  task_id text PRIMARY KEY REFERENCES sma_coordinator_tasks(task_id),
  pause_reason text NOT NULL,
  context jsonb NOT NULL,
  paused_at timestamptz DEFAULT now(),
  resumed_at timestamptz,
  approver_id uuid REFERENCES sma_admins(id),
  approval_decision text, -- 'APPROVE' | 'DENY'
  approval_rationale text
);

-- Assembled content lifecycle records (audit)
CREATE TABLE sma_content_lifecycles (
  task_id text PRIMARY KEY REFERENCES sma_coordinator_tasks(task_id),
  lifecycle_record jsonb NOT NULL,
  lineage_hash text NOT NULL,
  assembled_at timestamptz DEFAULT now()
);

-- WhatsApp Advisor conversations
CREATE TABLE sma_whatsapp_conversations (
  conversation_id text PRIMARY KEY,
  whatsapp_user_id text NOT NULL,
  first_message_at timestamptz NOT NULL,
  last_message_at timestamptz NOT NULL,
  handed_off_to_human boolean DEFAULT false,
  handoff_reason text
);

CREATE TABLE sma_whatsapp_messages (
  message_id text PRIMARY KEY,
  conversation_id text REFERENCES sma_whatsapp_conversations(conversation_id),
  direction text NOT NULL, -- 'inbound' | 'outbound'
  content text NOT NULL,
  ts timestamptz DEFAULT now(),
  llm_response_metadata jsonb -- model, tokens, KB sources used, etc.
);
```

### RLS

All new tables get RLS policies matching existing pattern: `sma_admins` table
gates access via `is_sma_admin()` security-definer function. Service-role key
bypasses RLS for the Coordinator's internal operations.

---

## 8. Dashboard Changes (`/admin/sma`)

### New views

Routes added under `app/admin/sma/`:

- `/admin/sma/approval-queue` — paused lifecycles awaiting Bill/Francisco
  approval. Bundled context per Immutable Stop 5.
- `/admin/sma/calendar` — scheduled and posted content across all three
  platforms, week and month views.
- `/admin/sma/coordinator-status` — task counts, handoff log, escalation
  feed, system health.
- `/admin/sma/whatsapp` — WhatsApp Advisor inbox view; handed-off
  conversations highlighted for Francisco's team follow-up.

### Existing views retained

- `/admin/sma` — main dashboard (refactored to surface Coordinator metrics
  alongside existing connection status)
- `/admin/sma/connections` — OAuth connection management per platform
  (unchanged)

### Access model (MVP)

Both Bill and Francisco are in `sma_admins` with identical access. No
role-based view splitting in v1. If Francisco later asks for a curated
executive view that hides developer logs, add a `role` column on
`sma_admins` and split views then.

---

## 9. Repo Layout (Proposed)

```
lib/sma/
├── coordinator/
│   ├── coordinator.ts          ─ Main SMACoordinator class
│   ├── types.ts                ─ Coordinator-specific types
│   ├── registry.ts             ─ PLATFORM_AGENTS dispatch map
│   ├── handoff.ts              ─ Handoff record creation and validation
│   ├── lineage.ts              ─ ContentLifecycle assembly
│   ├── escalation.ts           ─ Approval request routing
│   └── pause-resume.ts         ─ Halt-and-pend logic
├── agents/
│   ├── platform-base.ts        ─ PlatformAgent interface and shared utils
│   ├── facebook-agent.ts
│   ├── instagram-agent.ts
│   ├── threads-agent.ts
│   └── whatsapp-advisor.ts     ─ Separate from platform agents (different role)
├── meta-client.ts              ─ Existing — Graph API client (refactor for IG sub-app)
├── threads-client.ts           ─ NEW — Threads API client (separate base URL)
├── whatsapp-client.ts          ─ NEW — WhatsApp Business client
├── wa-link.ts                  ─ Existing — wa.me link attribution (unchanged)
├── encryption.ts               ─ Existing (unchanged)
└── guardrails.ts               ─ NEW — Five Immutable Stops enforced in code

app/api/sma/
├── oauth/
│   ├── facebook/
│   ├── instagram/
│   └── threads/
├── webhooks/
│   ├── facebook/
│   ├── instagram/
│   ├── threads/
│   └── whatsapp/               ─ NEW
├── coordinator/
│   ├── task/route.ts           ─ Issue task, query task status
│   ├── approve/[taskId]/route.ts  ─ Approve paused lifecycle
│   └── deny/[taskId]/route.ts     ─ Deny paused lifecycle
└── cron/
    └── token-refresh/route.ts  ─ Existing — daily OAuth token refresh

app/admin/sma/
├── page.tsx                    ─ Existing dashboard (refactored)
├── approval-queue/page.tsx     ─ NEW
├── calendar/page.tsx           ─ NEW
├── coordinator-status/page.tsx ─ NEW
└── whatsapp/page.tsx           ─ NEW

prompts/
├── facebook/                   ─ NEW
├── instagram/                  ─ NEW
├── threads/                    ─ NEW
└── whatsapp/                   ─ NEW

supabase/migrations/
└── 0002_sma_v2_schema.sql      ─ NEW migration for v2 tables
```

---

## 10. Phasing

### v1 (this build cycle, ~3-4 weeks dev work after architecture approval)

Ships:

- Coordinator (Light scope — scheduling-only)
- Three platform agents (FB, IG, Threads) for posts + comment reply drafts
- WhatsApp Advisor for inbound 1:1 chat (KB-grounded, human handoff option)
- Dashboard with approval queue, calendar, coordinator status, WhatsApp inbox
- Text + image content only (no video in v1)
- Both Bill and Francisco have full dashboard access via `sma_admins`

Does NOT ship in v1:

- Video content generation or assembly
- Topic selection by Coordinator (Bill/Francisco propose topics)
- Engagement-driven posting decisions
- WhatsApp proactive outbound (template-approved messaging)
- Cross-platform message theme coordination
- Role-based dashboard view split

### v1.5 (~6 weeks after v1 ships)

- Templated video assembly (not generative video; uses existing CEPTI footage
  + Sonnet-generated voiceover + Shotstack/Creatomate-style API)
- Medium Coordinator scope: topic selection based on engagement signals
- WhatsApp template approvals submitted for high-value proactive use cases
  (e.g., quote follow-ups)

### v2.0+ (indefinite)

Only if operational data justifies:

- Heavy Coordinator scope: full content director with "should we post at all"
  judgment
- Generative video (Sora/Veo/Runway integration) — gated on whether templated
  video proves insufficient
- Role-based dashboard view split if Francisco-vs-Bill role friction emerges

---

## 11. Migration From v1

### What survives from v1 (no rework)

- Supabase Auth + `sma_admins` table (Francisco gets added)
- OAuth + token storage (`sma_tokens` table, `encryption.ts`)
- Vercel Cron token refresh
- `lib/sma/wa-link.ts` attribution
- `lib/sma/meta-client.ts` (refactored for IG sub-app, otherwise intact)
- `/admin/sma` connection status view
- The Meta App `CEPTI SMA v2` (App ID `1753058746104461`) being built right now

### What gets replaced

- The implicit "one agent handles all platforms" assumption — replaced by
  Coordinator + three platform agents
- The "DM handling is out of scope" rule — replaced by "DM handling is out of
  scope for the SMA Coordinator; in scope for a separate WhatsApp Advisor"
- The v1 prompt files (`prompts/caption.md`, `prompts/classify.md`,
  `prompts/reply.md`) — replaced by per-platform prompt directories

### Migration order

1. Architecture v2 approved by Francisco
2. Phase 7-11 of Meta App rebuild completes (already in flight as of
   2026-05-26)
3. Supabase migration `0002_sma_v2_schema.sql` applied
4. Coordinator + platform agents built on `feat/sma-v2` branch
5. Dashboard updates merged
6. v1 prompts archived in `docs/sma/v1-archive/`, v2 prompts replace them
7. WhatsApp Advisor built and connected to KB
8. Old App `2548322912289648` archived (currently still alive as fallback)
9. CLAUDE.md updated to reflect v2 architecture
10. Production cutover with Bill and Francisco both in `sma_admins`

---

## 12. What We Did NOT Take From Aureon

Explicit list, so future maintainers don't wonder why these patterns are
missing despite the Aureon reference:

- **Three-tier agent hierarchy (Ranger/JTAC/Hunter-Killer).** CEPTI uses
  two tiers (autonomous-within-scope, human-approved). Aureon's third tier
  ("declared but not activated") is a financial-risk-mitigation pattern with
  no analogue in CEPTI's risk profile.

- **Doctrine versioning.** Aureon pins doctrine versions across paused
  lifecycles to handle mid-flight regulatory changes. CEPTI's "doctrine"
  (CLAUDE.md hard rules + prompts) changes rarely enough that pinning is
  over-engineered.

- **Convergence Governance Table.** Six scenarios for TradFi-DeFi
  convergence (tokenized settlement, smart contract conflicts, payment
  rail failures, etc.). Pure financial domain. CEPTI has none.

- **BCBS 239 P3 validation, RTS6 alerts, OFAC counterparty screening.**
  All financial regulatory compliance. CEPTI is a paint manufacturer.

- **Atrox / Kaladan / Mentat upstream components.** Aureon has separate
  components for recommendation origination, lifecycle structuring, and
  doctrine ownership. CEPTI has Bill and Francisco directly upstream of
  the Coordinator with no intermediary components.

- **Cryptographic lineage hashes for regulatory submission.** Aureon's
  `_make_lineage_hash()` produces audit hashes for regulatory bodies.
  CEPTI's audit is for Bill and Francisco's own review; SHA-256 hashing
  for tamper-evidence is nice-to-have but not gating.

- **Approval lineage rules JSON (`approval_lineage_rules.json`).** Aureon
  has a data-driven approval-authority-required-by-scenario lookup
  (Compliance + Legal + Operations roles required for different halt types).
  CEPTI has one authority: Bill or Francisco. No JSON rules file needed.

The discipline pattern (Five Immutable Stops, handoff records, unified
lineage, escalation completeness) translates. The regulatory machinery
does not.

---

## 13. Open Questions For Francisco

These should be resolved before v1 build starts:

1. **WhatsApp Advisor handoff:** When the bot escalates to "let me connect
   you with our team," who in CEPTI receives the notification, and via
   what channel? Slack? Direct WhatsApp forward to Francisco?

2. **Posting cadence defaults:** What's the target posting frequency per
   platform? E.g., IG 3x/week, FB 1x/week, Threads 5x/week? The Light
   Coordinator schedules from a queue, but needs default cadence rules.

3. **Approval expectations:** SLA on Bill/Francisco approving content in
   the queue? E.g., "items unapproved after 48 hours expire and need
   re-proposing"? This affects how the queue UX is designed.

4. **Content asset library:** CEPTI has product photos. Are they organized
   in a way the SMA can access? Google Drive folder? Supabase storage
   bucket? The Coordinator needs to know where to point platform agents
   when an intent says "post about Ladriflex with photo from the new shipment."

5. **WhatsApp number — confirm:** All inbound WhatsApp messages currently
   go to the assigned number +1 (829) 449-1104. Does the Advisor bot intercept
   ALL messages, or only ones during certain hours? Or only when Francisco's
   team isn't responding within X minutes?

6. **Failure modes Francisco cares about:** Beyond Five Immutable Stops,
   are there CEPTI-specific failure modes to encode as guardrails? E.g.,
   "never post about competitors" or "never use specific words"?

---

## 14. Approval

> **Superseded by Section 0 (2026-06-28).** v2 was approved-in-practice and
> built across PRs #5–#16 without a formal sign-off being recorded here. The
> remaining open decision requiring Francisco is the WhatsApp Advisor greenlight
> and its blocking decisions in §6. The sign-off block below is retained for
> the record but no longer gates the already-shipped v2 work.

Architecture v2 is a proposal. Bill and Francisco both review. Sign off
required from both before v1 build begins.

**Bill:** _____________________ Date: __________

**Francisco:** _____________________ Date: __________
