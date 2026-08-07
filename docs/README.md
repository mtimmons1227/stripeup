# StripeUp — Documentation

This folder follows the **standard documentation layout used across all of these projects**:

1. **This README** — what the product does and how the docs are organized.
2. **[`sdlc/`](sdlc/README.md)** — the Software Development Lifecycle, phase by phase.
3. **[`artifacts/`](artifacts/README.md)** — supporting reference documents and deliverables.

## What StripeUp is
A self-assign operations and staffing platform for sports officiating. Assigners publish a tournament's games and time blocks; officials self-schedule via a token link (no login) by claiming blocks; the assigner tracks confirmations, staffing gaps, and payouts — plus four CSV reports (1099 Payments, Staffing, Official Activity, Payout Summary). Built for sports officiating and adaptable to event staffing / gig-style operations. Deployed live on Netlify.

## How the documentation is organized

### `sdlc/` — the lifecycle
| # | Phase | What it covers |
|---|---|---|
| 1 | [Planning](sdlc/01-planning.md) | Scope and purpose |
| 2 | [Analysis](sdlc/02-analysis.md) | Requirements + feasibility |
| 3 | [Design](sdlc/03-design.md) | Architecture and design |
| 4 | [Implementation](sdlc/04-implementation.md) | Writing and integrating the code |
| 5 | [Testing](sdlc/05-testing.md) | Verifying it meets requirements |
| 6 | [Deployment](sdlc/06-deployment.md) | Releasing to users |
| 7 | [Maintenance](sdlc/07-maintenance.md) | Ongoing support and updates |
| 8 | [Future Releases](sdlc/08-future-releases.md) | Planned, not-yet-built work |

Start with [`sdlc/README.md`](sdlc/README.md) for the index and current status.

### `artifacts/` — reference docs & deliverables
The [artifact index](artifacts/README.md) maps each SDLC phase to its supporting files — the two HTML surfaces, the Netlify functions, the test suite, the RLS SQL, the operator runbooks, and the compiled SDLC Word document.

### The project's source of truth
[`../CLAUDE.md`](../CLAUDE.md) is StripeUp's cumulative single-source-of-truth (status, schema, change log, rules). The SDLC docs summarize and organize it by phase; `CLAUDE.md` remains the live operational record.

## The standard, in one line
**Markdown is the source of truth; Word is the polished output generated from it.**
