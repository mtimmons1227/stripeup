# Phase 6 — Deployment
**Also known as (AI-era): Deployment & Operations**
**Status: ✅ Live (private use)** — deployed on Netlify and in real use by the founder; **RLS must be enabled before public launch.**

## Purpose
Ship the system to where users reach it and run it reliably.

## Process (repeatable)
1. Host with CI/CD from the repo.
2. Configure environment per host.
3. Operate the email/SMS integrations.
4. Close the pre-public-launch gates.

## What we did on StripeUp

### Hosting & CI/CD
- **Netlify**, auto-deploying from the GitHub `main` branch. Live at **`https://officials-scheduler.netlify.app`**. Repo: `github.com/gridironiq/stripeup` (migrated to `mtimmons1227/stripeup`; Netlify reconnected June 2026).
- Local preview via `HOW-TO-RUN-LOCALLY.md` (Netlify CLI; `Launch-StripeUp.bat` / `Setup-Desktop-Icon.bat`).

### Environment configuration (Netlify dashboard)
- `SUPABASE_URL` (`https://mqbxqtsnfzcmmzpbrxnx.supabase.co`), `SUPABASE_ANON_KEY` (public/publishable — safe in client), `RESEND_API_KEY`, and `TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM` (SMS, blocked until A2P).

### Integrations in operation
- **Email:** Resend (domain `thetimmonsfoundation.org`) — invites, confirmations, schedules.
- **SMS:** Twilio — **blocked** pending A2P 10DLC approval (~$25 to unblock).
- Test-email filtering: 84 of 87 officials have test-pattern emails filtered by `send-invites.js`; only 3 real officials receive mail.

### ⚠️ Pre-public-launch gates
- **RLS policies are currently disabled** and **must be enabled before public launch** (`rls-policies.sql`, `rls-testing.sql`, `RLS-README.md` are staged for this).
- **DEV bar** still visible in production — should be hidden.
- **SMS** unblocked only after Twilio A2P approval.

### Operations notes
- Auto-deploy on every push to `main`; Netlify deploy history provides rollback.
- A documented DNS workaround (Google Public DNS) resolved an AT&T-ISP issue during development.

## AI's role in this phase
**Maturity: AI-Assisted.** AI produced the deploy/run guides and staged the RLS SQL. Setting production secrets, enabling RLS, and Twilio A2P registration stay with the human.

## Key artifacts
- `netlify.toml`, `HOW-TO-RUN-LOCALLY.md`, `Launch-StripeUp.bat`, `Setup-Desktop-Icon.bat`.
- `rls-policies.sql`, `rls-testing.sql`, `RLS-README.md` (the launch gate).
- Stack & Environment section of [`../../CLAUDE.md`](../../CLAUDE.md).
- See the [artifact index](../artifacts/README.md).
