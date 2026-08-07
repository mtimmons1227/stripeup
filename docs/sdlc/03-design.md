# Phase 3 — Design
**Also known as (AI-era): Solution Architecture & Pipeline Design**
**Status: ✅ Complete**

## Purpose
Turn the chosen approach into a concrete blueprint: components, data model, flows, and the user-facing shape.

## Process (repeatable)
1. Draw the architecture and the two surfaces (assigner / official).
2. Design the data model.
3. Design the invitation + self-schedule flow.
4. Design reporting.
5. Note cross-cutting concerns (locking, dates, brand).

## What we did on StripeUp

### Architecture
```
Assigner (index.html)  ──┐
                          ├─► Supabase JS client (direct writes) ──► Supabase Postgres
Official (self-schedule.html, token-based) ──┘                          tournaments / officials /
                          │                                             available_blocks / claims /
                          ▼                                             invite_tokens / games / availability
        Netlify Functions (netlify/functions/*)
          · send-invites.js     (email/SMS + token generation)
          · send-confirmation.js (official "locked in" email)
          · send-schedules.js   (full schedule to confirmed officials)
                          │
                          ▼ Resend (email) · Twilio (SMS, A2P-gated)
```
Hosting: Netlify, auto-deploying from the GitHub `main` branch. Live URL: `officials-scheduler.netlify.app`.

### Data model
`tournaments` (incl. `officials_per_game`, `pay_per_game`, `is_taxable`, `scheduling_mode`, `layout_locked`, `invitations_sent_at`, `admin_unlocked`); `officials` (incl. `home_city/state`, `travel_radius`); `available_blocks` (court, status, hold fields, `officials_needed`, `game_count`, `total_pay`, times); `claims`; `invite_tokens` (`used`, `expires_at`, `status`, `declined_at`); `games`; `availability`. View `v_1099_report` aggregates confirmed pay per official per year. CASCADE delete from tournament; no `org_id` on `games`/`claims`.

### Invitation + self-schedule flow
Import games (CSV, date-filtered) → auto-build blocks (`calculateBlocks` with `officials_per_game`) → review/lock layout → **Send Invitations** (sets `invitations_sent_at` + `layout_locked`, generates tokens) → official opens token link → sets availability/max-games → claims ≥2 blocks honoring rest periods → confirm (writes `claims`, fires confirmation email). Reminders re-send only to non-confirmed/declined and not-recently-invited officials.

### Reporting design
Four reports in the Reports tab, each pill-tabbed with CSV export: **1099 Payments** (from `v_1099_report`, $600+ badge), **Staffing** (slots filled/open/% with color coding), **Official Activity** (per-official games + est. pay), **Payout Summary** (per-tournament est. payout + grand total). All use the Supabase JS client directly.

### Cross-cutting
- **Smart Layout Lock** protects confirmed claims; Emergency Edit (`admin_unlocked`) for exceptions.
- **Local-midnight dates** everywhere (badges, token expiry `min(7 days, tournament_date + 1 day)`).
- **Brand:** Navy `#1B2A4A`, Gold `#C9A84C`, White `#FFFFFF`, Red (full block) `#EF4444`.
- **Demo Mode** mirrors the real flow (locks layout) without sending email; Simulate Responses seeds confirmed claims.

## AI's role in this phase
**Maturity: AI-Assisted.** AI designed the block/claim model, the lock semantics, the token/skip logic, and the report set. The human approved the schema and the operational rules (rest periods, lock behavior).

## Key artifacts
- The Database Schema, Reports Reference, and Stack sections of [`../../CLAUDE.md`](../../CLAUDE.md).
- `index.html`, `self-schedule.html`, `netlify/functions/*`, `send-invites.js`.
- See the [artifact index](../artifacts/README.md).
