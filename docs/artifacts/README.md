# Artifacts & Reference Index
**Where the supporting documents live, organized by SDLC phase.**

Most of StripeUp's working material lives in code and in the cumulative [`../../CLAUDE.md`](../../CLAUDE.md). This index maps each SDLC phase to those files plus deliverables, rather than duplicating content.

## Phase 1 — Planning
- [`../../CLAUDE.md`](../../CLAUDE.md) — single source of truth (status, schema, change log).
- [`../../HOW-TO-RUN-LOCALLY.md`](../../HOW-TO-RUN-LOCALLY.md).

## Phase 2 — Analysis
- Database Schema + "Critical" rules sections of [`../../CLAUDE.md`](../../CLAUDE.md).

## Phase 3 — Design
- `../../index.html`, `../../self-schedule.html`, `../../netlify/functions/*`, `../../send-invites.js`.
- Reports Reference + Stack sections of [`../../CLAUDE.md`](../../CLAUDE.md).

## Phase 4 — Implementation
- `../../index.html`, `../../self-schedule.html`, `../../register.html`, `../../signup.html`, `../../netlify/functions/*`, `../../netlify.toml`.
- Recent Changes Log + What's Working in [`../../CLAUDE.md`](../../CLAUDE.md).

## Phase 5 — Testing
- `../../tests/automated.spec.js`, `../../playwright.config.js`, `../../test-checklist.html`, `../../.claude/agents/qa.md`.
- "Next Test Plan" + "Deployed — Needs Browser Testing" in [`../../CLAUDE.md`](../../CLAUDE.md).

## Phase 6 — Deployment
- `../../netlify.toml`, `../../HOW-TO-RUN-LOCALLY.md`, `../../Launch-StripeUp.bat`, `../../Setup-Desktop-Icon.bat`.
- **RLS launch gate:** `../../rls-policies.sql`, `../../rls-testing.sql`, `../../RLS-README.md`.

## Phase 7 — Maintenance
- [`../../CLAUDE.md`](../../CLAUDE.md) (Recent Changes Log, status buckets, auto-update rules), `../../.claude/agents/qa.md`.

## Phase 8 — Future Releases
- "Not Yet Built," "Known Issues," "Phase 2 Notes" in [`../../CLAUDE.md`](../../CLAUDE.md).
- `../../rls-policies.sql`, `../../rls-testing.sql`, `../../RLS-README.md` (RLS gate).

## Compiled deliverable
- `StripeUp_SDLC_Documentation.docx` — the full SDLC narrative (Planning → Future Releases) compiled into one polished Word document, generated from the Markdown in [`../sdlc/`](../sdlc/README.md). Regenerate when the Markdown changes.

> **Note:** a file named `StripeUp_AI_Matrix_and_Roadmap.xlsx` currently sits in the **CrewCore** repo — it appears to belong here and should be moved into StripeUp.

---
*If a referenced file moves or is renamed, update this index.*
