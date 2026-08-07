# Phase 8 — Future Releases
**Also known as (AI-era): Roadmap & Honesty Ledger**
**Status: 🗺️ Planned (not built)**

## Purpose
Capture what's planned but not yet built, and the gates before public launch — so "planned" is never claimed as "shipped."

## What is built today (for contrast)
A deployed, working assigner + official product: tournament/series management, CSV import, block layout + Smart Layout Lock, email invitations, token-based self-scheduling, Confirmed Officials view, Demo Mode, and four CSV reports — live on Netlify for the founder's own use.

## Not yet built (`CLAUDE.md §6`)
1. **Travel-radius UI fields** on the Officials roster (`home_city` / `home_state` / `travel_radius`). The DB schema and the send-side filter exist; the roster UI does not.
2. **Twilio A2P 10DLC upgrade** (~$25) to unblock SMS invitations.
3. **Official-facing 1099 earnings view** (Phase 2) — officials see their own YTD earnings.
4. **Court-level rank override UI** — per-court minimum-rank settings.
5. **Auto-release cron job** for expired block holds.
6. **RLS policies** — staged (`rls-policies.sql`, `rls-testing.sql`, `RLS-README.md`) but **not enabled**; required before public launch.
7. **Payment system / Stripe** (Phase 3) — not started.

## Known issues to clear (`CLAUDE.md §7`)
- DEV bar still visible in production (should be hidden).
- SMS blocked until the Twilio A2P upgrade.

## Suggested phasing
- **Before public launch:** enable RLS (gate #6), hide the DEV bar, finish the open browser-testing backlog (see [05-testing.md](05-testing.md)).
- **Phase 2:** travel-radius UI, official-facing 1099 view, court-level rank override, auto-release cron, Twilio A2P for SMS.
- **Phase 3:** Stripe payments.

## AI's role in this phase
**Maturity: AI-Assisted.** AI maintains this roadmap and the status buckets in `CLAUDE.md`, mapping each item to its file/insertion point. The founder decides phasing and owns the launch gates.

## Key artifacts
- "Not Yet Built," "Known Issues," and "Phase 2 Notes" in [`../../CLAUDE.md`](../../CLAUDE.md).
- `rls-policies.sql`, `rls-testing.sql`, `RLS-README.md` (the RLS launch gate).
- See the [artifact index](../artifacts/README.md).
