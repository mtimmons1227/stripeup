# Phase 5 — Testing
**Also known as (AI-era): Evaluation & Validation**
**Status: 🔄 In progress** — a Playwright smoke suite and a QA gate exist; several deployed features await end-to-end browser verification.

## Purpose
Prove the product does what the design said — core flows are guarded automatically, and newly deployed features are verified by real browser walkthroughs.

## Process (repeatable)
1. Pass the QA gate (JS syntax check + Supabase verify) before any task is "done."
2. Run the Playwright smoke suite on core flows.
3. Browser-test each newly deployed feature end to end.
4. Keep a running "needs testing" list so nothing ships unverified.

## What we did on StripeUp

### Automated
- **Playwright suite** (`tests/automated.spec.js`, config `playwright.config.js`, Chromium 60s): 6 checks — login, days-away badge colors, Import Games disabled when games exist, schedule-status badge text, shuffle disabled when locked, and block editing blocked on confirmed blocks.
- **QA gate** (`.claude/agents/qa.md`): JS syntax check + Supabase verify required before a task is marked complete.
- `test-checklist.html` — a manual checklist surface.

### Manual / browser-confirmed
The **What's Working ✅** section of `CLAUDE.md` is the cumulative list of capabilities the founder has confirmed in the browser (auth, tournament CRUD, CSV import, blocks, invitations, reports, etc.).

### Deployed — needs browser testing (open items)
Tracked explicitly in `CLAUDE.md §5`:
- Full self-schedule flow end to end (invite link → confirmed claim).
- `send-confirmation.js` and `send-schedules.js` with real official data.
- Confirmed Officials modal redesign and Tournament card command center with real data.
- Send Reminders dialog on a live tournament; Demo Mode + Simulate Responses walkthrough.
- View Responses status badges; token-expiry local-midnight fix; travel-radius filtering.

### Next test plan (`CLAUDE.md §2`)
Full self-schedule flow; Confirmed Officials modal; Demo Mode; Send Reminders pending count; travel-radius UI.

## AI's role in this phase
**Maturity: AI-Assisted.** AI authored the Playwright checks and the QA gate and maintains the "needs testing" backlog. The founder is the acceptance authority — features aren't moved to "Working" until browser-confirmed.

## Key artifacts
- `tests/automated.spec.js`, `playwright.config.js`, `test-checklist.html`, `.claude/agents/qa.md`.
- "Next Test Plan" and "Deployed — Needs Browser Testing" in [`../../CLAUDE.md`](../../CLAUDE.md).
- See the [artifact index](../artifacts/README.md).
