# Social Media Agent (SMA) — Phase 1 (historical)

> **Superseded — kept only for historical context and inbound links.**
>
> This file captured the original SMA **Phase 1** design (schema, OAuth,
> encryption, dashboard skeleton, Meta App config). The SMA has since shipped
> through v2 — Coordinator + Five Immutable Stops governance, Facebook and
> Instagram publishing, the shared inbound advisor (WhatsApp + Messenger +
> Instagram Direct + website chatbot), scheduling, measurement, FinOps, and
> video — so the phase-status table and setup steps that used to live here have
> been removed to avoid drift.

## Where the current docs live

| Topic | Authoritative doc |
| --- | --- |
| Plan-vs-reality build-state map (what's shipped / stubbed / gated) | `docs/sma/architecture-v2.md` §0 |
| What the agent can and cannot do (model-agnostic) | `docs/sma/agent-policy.md` |
| Inbound-chat answer policy ("Bot-first, human-override, price-safe") | `docs/sma/advisor-policy.md` |
| Deploy, operate, and full setup (schema, OAuth, Meta App config, env vars) | `docs/sma/PLAYBOOK.md` |
| WhatsApp Advisor runbook | `docs/sma/whatsapp-advisor.md` |
| Conventions + governance | `CLAUDE.md` |

For the original Phase-1 detail (routes, tables, env vars, Meta App setup as it
stood at launch), see this file's git history.
