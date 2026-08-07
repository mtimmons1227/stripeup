# Phase 4 — Implementation
**Also known as (AI-era): Build & Integration**
**Status: ✅ Complete (core) and actively iterating** — the full assigner + official product is built and deployed; new capabilities are added continuously (see the cumulative change log).

## Purpose
Write the code that realizes the design — the two surfaces, the Netlify functions, and the data integration — in small, logged increments.

## Process (repeatable)
1. Build against the live schema using the Supabase JS client directly.
2. Add Netlify functions for email/SMS.
3. Log every change cumulatively in `CLAUDE.md`.
4. Pass the QA gate (JS syntax check + Supabase verify) before marking a task done.

## What we did on StripeUp

### Assigner dashboard (`index.html`)
The tournament **command center**: days-until badge, metric tiles (% filled, confirmed, open slots, responded), court breakdown, countdown, pay estimate, and quick actions. Multi-day **series** creation and grouping with a series-rollup header. CSV game import with court-name aliasing and date normalization/filtering. Auto block building (`calculateBlocks` with `officials_per_game`). **Smart Layout Lock**. Send Invitations / Send Reminders with accurate pending counts. Confirmed Officials modal grouped by staffing status. View Responses with per-official status and actions. Demo Mode + Simulate Responses + `showToast`. Four CSV-exporting reports.

### Official self-schedule (`self-schedule.html`)
Token-based, login-less grid matching the assigner's Review Blocks (via `GAMES_MAP`); availability window + max-games; minimum-2-blocks rule; rest-period validation (`checkRestViolations`, slot-index based); co-official display; fresh session per load with held-block release; confirmation email on submit.

### Netlify functions
- `send-invites.js` — email/SMS invites, token generation, skip logic (confirmed/declined/<24h), token expiry at local midnight, travel-radius filtering.
- `send-confirmation.js` — official "you're locked in" email with block table + totals.
- `send-schedules.js` — full schedule + partner info to all confirmed officials.

### Hard-won integration rules (from `CLAUDE.md`)
- **All writes use the Supabase JS client directly** — the Netlify proxy strips query strings (would drop WHERE clauses). This fixed repeated bugs (block stacking on re-import, "UPDATE/DELETE requires a WHERE clause").
- **Local-midnight date parsing** everywhere fixed UTC off-by-one in badges and token expiry.
- **Filter `games`/`claims` by `tournament_id IN org's tournaments`** — neither table has `org_id`.

### Change history
The cumulative **Recent Changes Log** in `CLAUDE.md` records every session's edits (April–June 2026), and **What's Working ✅** lists browser-confirmed capabilities across Auth, Tournaments, Games & Blocks, Invitations, Demo Mode, Self-Schedule, View Responses, Confirmed Officials, Reports, and UI/UX.

## AI's role in this phase
**Maturity: AI-Assisted (LLM copilot).** AI generated the dashboard logic, the self-schedule grid, and the Netlify functions, and repeatedly diagnosed the proxy/date/skip-logic defects. A QA gate (JS syntax check + Supabase verify) and the founder's browser testing gate every change.

## Key artifacts
- `index.html`, `self-schedule.html`, `register.html`, `signup.html`.
- `netlify/functions/*`, `send-invites.js`, `netlify.toml`.
- The Recent Changes Log + What's Working in [`../../CLAUDE.md`](../../CLAUDE.md).
- See the [artifact index](../artifacts/README.md).
