# Phase 1 — Planning
**Also known as (AI-era): Problem Framing & Scope Definition**
**Status: ✅ Complete**

## Purpose
Identify the scope and purpose of the software before any code: what we're building, why, who it's for, and what's in scope.

## Process (repeatable)
1. Frame the problem and name the primary users.
2. State the mission.
3. Set the scope — what's in, and explicitly out.
4. Name high-level success criteria.
5. Capture constraints.

## What we did on StripeUp

**Problem.** Staffing sports-officiating tournaments is manual and error-prone: an assigner has to import games, build time blocks, invite officials, chase responses, and reconcile who's covering what — often across multi-day, multi-court events.

**Mission.** A self-assign operations and staffing platform: the assigner publishes a tournament's games and blocks; officials **self-schedule** via a token link (no login) by claiming blocks; the assigner sees confirmations, staffing gaps, and payouts in a command-center dashboard. Built for sports officiating (and adaptable to event staffing / gig-style operations).

**Primary users.** (1) The **assigner** (tournament dashboard); (2) the **official** (token-based self-schedule page, no account needed).

**Scope (in).** Tournament CRUD (incl. multi-day series), CSV game import (date-filtered), block layout with locking, email/SMS invitations with tokens, official self-scheduling with rest-period and max-games rules, a Confirmed Officials view, View Responses, Demo Mode with simulated responses, and four reports (1099 Payments, Staffing, Official Activity, Payout Summary) with CSV export.

**Scope (out / later).** Travel-radius UI on the roster, Twilio A2P 10DLC for SMS, an official-facing 1099 earnings view, court-level rank override, an auto-release cron for expired holds, RLS policies, and Stripe payments — recorded in [08-future-releases.md](08-future-releases.md).

**High-level success criteria.**
- An assigner can go from CSV import → blocks → invitations in one flow.
- An official can self-schedule from an invite link to confirmed games without an account.
- Staffing, confirmations, and estimated payouts are visible at a glance.
- 1099-relevant earnings ($600+ threshold) are reportable for tax compliance.

**Constraints.** Vanilla stack (no framework); Netlify + Supabase; SMS gated by Twilio A2P approval; RLS must be enabled before public launch; the Netlify proxy strips query strings, so writes must use the Supabase JS client directly.

## AI's role in this phase
**Maturity: AI-Assisted.** An LLM assistant helped frame the assigner/official split, scope the tournament→blocks→invites→self-schedule flow, and maintain the cumulative project memory (`CLAUDE.md`). The human owns the officiating-operations domain and priorities.

## Key artifacts
- [`../../CLAUDE.md`](../../CLAUDE.md) — the single source of truth (status, schema, change log).
- [`../../HOW-TO-RUN-LOCALLY.md`](../../HOW-TO-RUN-LOCALLY.md).
- See the [artifact index](../artifacts/README.md).
