# Social Media Agent — Capabilities & Policy

> **What this is.** A single, plain statement of what the agent **can** and
> **cannot** do — for operators, reviewers, and prospective clients. It is
> **model-agnostic**: the agent runs on a configurable LLM, and every policy
> below holds regardless of which model is plugged in.
>
> Companion docs: `advisor-policy.md` (inbound-chat answer policy),
> `architecture-v2.md` §0 (build-state map), `CLAUDE.md` (conventions +
> governance), `PLAYBOOK.md` (deploy + operate).

## Overview

A governed, human-in-the-loop system for social content and customer chat
across **Facebook, Instagram, Threads, WhatsApp, Messenger, Instagram Direct,
and a website chatbot**. It is built as reusable scaffolding — a Coordinator,
per-platform publishing agents, inbound conversational advisors sharing one
brain, and an admin dashboard — layered on top of an LLM. The value is the
governance and the cross-channel plumbing, not any single model.

## What it CAN do

- **Draft content** tailored per platform — captions, hashtags, and posting
  rationale — from a product or topic.
- **Schedule and publish approved posts** to Facebook and Instagram (single
  image and carousel), with the WhatsApp call-to-action link embedded.
- **Generate short product videos** from an image (Video Studio), with
  selectable duration and resolution.
- **Run inbound advisors** on WhatsApp, Messenger, and Instagram Direct (and the
  website chatbot): instant, 24/7, in the customer's language, answering product
  questions grounded in a product knowledge base.
- **Capture results** — engagement metrics (Facebook + Instagram) and
  hand-logged WhatsApp lead attribution.
- **Accept operator media** — upload/select your own images or videos (≤30MB)
  for a post instead of auto-attached product images.

## What it WILL NOT do — hard guardrails, enforced in code

- **Never publishes autonomously.** Every post and every public-comment reply
  requires explicit human approval (the "Five Immutable Stops"). The Coordinator
  never calls a publish API directly.
- **Never quotes prices, cost, coverage, or delivery times.** Any price / quote
  / order / availability request is handed off to a human.
- **Never resolves complaints autonomously** — it escalates to a human at once.
- **Human override always wins.** In any DM, a human reply (or the dashboard
  "Take over") silences the bot for that conversation.
- **Fails closed on auth.** If a platform token is expired or revoked, the agent
  refuses to act and surfaces "reconnect required" — it never posts on a dead token.
- **Never fabricates metrics.** API failures are surfaced, never invented.
- **Honest about being an assistant.** It never claims to be a specific person,
  and discloses that it's an assistant if asked.

## What it does NOT do (yet) — scope limits

- **Threads publishing** — the agent is a stub; needs Meta Tech Provider Verification.
- **Video publishing to feeds/Reels** — the publish path is image-only; an
  uploaded video can be selected but will not post until video publishing is built.
- **Autonomous comment-reply posting** — replies to public comments are not
  wired to post on any platform (the inbox classifies; it does not auto-reply).
- **Proactive / outbound messaging** — the advisors are reactive only (no
  unsolicited or template-based outbound).

## Oversight & governance

- Human-in-the-loop on **all** publishing and public replies.
- One curated content-lifecycle audit record per post.
- Admin-gated dashboard; all data row-level-security protected.
- Inbound behavior follows the "Bot-first, human-override, price-safe" answer
  policy (`advisor-policy.md`).

## Model-agnostic note (for build-out deployments)

The capabilities and guardrails above are **independent of the underlying LLM**.
LLM calls are isolated in the generation layer (`lib/sma/advisor-core.ts`,
`lib/sma/llm-client.ts`), so the model provider can be swapped — including a
client's own model — without changing the channels, governance, or guardrails in
this document. (Current deployment uses one provider for text and one for video;
making the provider fully pluggable is a small, contained change rather than a
re-architecture.)
