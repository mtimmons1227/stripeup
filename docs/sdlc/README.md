# StripeUp — Software Development Lifecycle (SDLC)

_How this product was built, phase by phase, using the standard 8-phase SDLC._

StripeUp is a self-assign operations and staffing platform for sports officiating (and adaptable to event staffing / gig operations). Assigners publish a tournament's games and time blocks; officials self-schedule via a token link (no login) by claiming blocks; the assigner tracks confirmations, staffing gaps, and payouts in a command-center dashboard. Deployed live on Netlify.

## Start here
**[00-ai-in-the-sdlc.md](00-ai-in-the-sdlc.md)** — the framework and where StripeUp sits.

## The phases
| # | Phase | Doc | Status |
|---|---|---|---|
| 1 | Planning | [01-planning.md](01-planning.md) | ✅ Complete |
| 2 | Analysis | [02-analysis.md](02-analysis.md) | ✅ Complete |
| 3 | Design | [03-design.md](03-design.md) | ✅ Complete |
| 4 | Implementation | [04-implementation.md](04-implementation.md) | ✅ Complete (core) · actively iterating |
| 5 | Testing | [05-testing.md](05-testing.md) | 🔄 In progress (Playwright + browser-test backlog) |
| 6 | Deployment | [06-deployment.md](06-deployment.md) | ✅ Live (private); RLS gate before public launch |
| 7 | Maintenance | [07-maintenance.md](07-maintenance.md) | 🔄 Active (cumulative change log) |
| 8 | Future Releases | [08-future-releases.md](08-future-releases.md) | 🗺️ Planned |

**Where it stands:** the full assigner + official product is built and deployed on Netlify, in real use by the founder. Before public launch: enable RLS, hide the DEV bar, and clear the browser-testing backlog. Future work includes travel-radius UI, SMS (Twilio A2P), an official-facing 1099 view, and Stripe payments.

**Supporting artifacts:** the [artifact index](../artifacts/README.md) maps this narrative to `index.html`, `self-schedule.html`, the Netlify functions, the test suite, the RLS SQL, and the cumulative `CLAUDE.md`.

## Tech stack at a glance
- **Frontend:** vanilla HTML/CSS/JS (no framework) — `index.html`, `self-schedule.html`.
- **Backend:** Netlify Functions (`send-invites`, `send-confirmation`, `send-schedules`).
- **Database:** Supabase Postgres. **Email:** Resend. **SMS:** Twilio (A2P-gated).
- **Hosting:** Netlify (auto-deploy from `main`) — `officials-scheduler.netlify.app`.
