# Phase 7 — Maintenance
**Also known as (AI-era): Continuous Operations & Assurance**
**Status: 🔄 Active** — the product is in continuous iterative maintenance via a disciplined cumulative change log; full public-operations maintenance begins once RLS is enabled and the product opens beyond the founder.

## Purpose
Keep the system correct, current, and secure as it's used and extended.

## Process (repeatable)
1. Log every change cumulatively (never delete history).
2. Move items between Working / Needs-testing / Not-built / Known-issues as status changes.
3. Keep the schema section current when columns/tables change.
4. Patch integrations (Resend/Twilio) and address known issues.
5. Commit `CLAUDE.md` after every task.

## What we did on StripeUp

### Living maintenance discipline (`CLAUDE.md`)
StripeUp is maintained through a strict, cumulative project-memory file:
- **Recent Changes Log** — every session's edits, dated, by file (April–June 2026), never deleted.
- **What's Working ✅ / Needs Browser Testing 🚀 / Not Yet Built ⏳ / Known Issues ❌** — status buckets kept current.
- **Auto-update instructions** require, after any task: log the change, update Working, move items between status sections, record schema changes, add new bugs, and commit `CLAUDE.md`.

### Known issues being managed
- DEV bar visible in production (should be hidden).
- SMS blocked pending Twilio A2P 10DLC upgrade.

### Recurring operational care
- Email deliverability via Resend; test-email filtering keeps real sends to the 3 real officials.
- Deploy safety via Netlify deploy history (rollback) and the QA gate before merges.

### When full public maintenance begins
Once RLS is enabled and the app is opened to other orgs: monitor multi-org isolation, watch deliverability and Twilio status, keep dependencies patched, and continue the cumulative log discipline.

## AI's role in this phase
**Maturity: AI-Assisted, trending Agentic (under guardrails).** AI maintains the cumulative change log, keeps the schema/status sections current, and diagnoses regressions; the founder verifies fixes in the browser and approves every change. The auto-update rules make documentation a required step of every task.

## Key artifacts
- [`../../CLAUDE.md`](../../CLAUDE.md) — Recent Changes Log, status buckets, auto-update rules.
- `.claude/agents/qa.md` — the QA gate.
- See the [artifact index](../artifacts/README.md).
