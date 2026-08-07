# AI in the SDLC — Framework & How We Applied It
**The conceptual model behind these docs, and where StripeUp sits on it.**

This document frames *how* AI was used across the project. It presents the 8-phase SDLC standard used across all of these repos, AI's role in each phase, the AI-maturity ladder, and a crosswalk to the phase docs. The phase docs (`01`–`08`) carry the concrete record; this one carries the framework.

## The 8-phase SDLC (our standard)
1. **Planning** — identifying the scope and purpose of the software.
2. **Analysis** — gathering requirements and analyzing them.
3. **Design** — creating the architecture and design.
4. **Implementation** — writing and integrating the code.
5. **Testing** — verifying the software meets requirements and is defect-free.
6. **Deployment** — releasing the software to users.
7. **Maintenance** — ongoing support and updates.
8. **Future Releases** — planned work not yet built (roadmap / honesty ledger).

> **Note on labels.** "Implementation" means writing and integrating the code (Phase 4). "Deployment" means releasing to users (Phase 6). Applied identically across every repo.

## AI's role in each phase (general model)
| Phase | How AI contributes |
|---|---|
| Planning | Framing the problem, scope, and risks. |
| Analysis | Structuring requirements and the data model. |
| Design | Generating architecture/patterns; data-flow design. |
| Implementation | AI-assisted coding (LLM copilots). |
| Testing | Scaffolding checks; reasoning about edge cases. |
| Deployment | Drafting runbooks and config. |
| Maintenance | Change logging, monitoring, doc upkeep. |
| Future Releases | Maintaining the roadmap. |

## The AI-maturity ladder
- **AI-Assisted** — AI supports tasks; humans drive and approve.
- **AI-Autonomous** — AI generates whole components under oversight.
- **Agentic** — autonomous multi-step action under guardrails.

## Where StripeUp sits
Built at the **AI-Assisted** level: an LLM copilot generated the assigner dashboard, the token-based self-schedule grid, and the Netlify functions, and repeatedly diagnosed the recurring integration defects (the Netlify proxy stripping query strings, UTC date off-by-ones, invitation skip logic). A human founder owns the officiating-operations domain and **browser-confirms every capability** before it moves to "Working" — a strict human-in-the-loop gate, reinforced by a QA step (JS syntax check + Supabase verify) and a cumulative change log. There are no autonomous/agentic product features; the discipline is in the documented, append-only operating record.

## Crosswalk — our 8 phases → the docs
| # | Phase | Doc |
|---|---|---|
| 1 | Planning | [01-planning.md](01-planning.md) |
| 2 | Analysis | [02-analysis.md](02-analysis.md) |
| 3 | Design | [03-design.md](03-design.md) |
| 4 | Implementation | [04-implementation.md](04-implementation.md) |
| 5 | Testing | [05-testing.md](05-testing.md) |
| 6 | Deployment | [06-deployment.md](06-deployment.md) |
| 7 | Maintenance | [07-maintenance.md](07-maintenance.md) |
| 8 | Future Releases | [08-future-releases.md](08-future-releases.md) |

Each phase doc closes with an **"AI's role in this phase"** section.
