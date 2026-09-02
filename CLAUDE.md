# StripeUp — Claude Code Project Memory

This file is the single source of truth. Read it first. Update it last.

---

## 1. Current Status

**As of September 2, 2026 (evening — DATA RESET)** — The database was deliberately cleared to a clean slate for the end-to-end self-schedule test. `DELETE FROM tournaments` removed both PSA Summer Jam tournaments and, by CASCADE, all 107 games, 43 blocks, 4 claims and 8 invite tokens. **`officials` (88 rows) and the Timmons Foundation org were kept.** The second org "Game Time Sports" and its auth user were deleted (see the tenancy bug in section 7). **The backup has since been dropped on request — the 164 deleted rows are gone permanently.** The only remaining trace is `backups/stripeup-pre-wipe-snapshot-2026-09-02.json` (tournaments, claims and invite tokens only — no games or blocks). This is fine by design: the deleted data was stale June test data and the fixture is being rebuilt from CSV. **There is now nothing to test against** — the flow must be rebuilt from CSV before any browser test; see section 2.

**As of September 2, 2026** — Header now has a unified account/profile menu (gold avatar + org name trigger with caret; dropdown shows org name, email, then Change Password/Sign Out) replacing the old standalone header buttons. This update also closes a ~3-month documentation gap: an Aug 7 repo/docs reorganization and the Sept 1 account-menu work had never been logged here (see section 3). Three standing doc errors were also fixed: the repo URL in section 10, the RLS status in section 12/6 (policies are **written**, not applied — all 12 public tables confirmed RLS-off), and the Database Schema table in section 8 (4 tables existed but weren't listed). A data scare was also chased down and closed: the live Supabase project's cached row-count stats (`list_tables` / dashboard estimates) showed 0 rows almost everywhere, which looked like a wipe — a direct `COUNT(*)` against the correct, active project (`mqbxqtsnfzcmmzpbrxnx`) shows the data is actually intact (88 officials, 2 tournaments, 107 games). See the "Critical" note in section 10 — don't trust cached row counts on this project again without verifying with a real query.

**As of June 7, 2026** — CSV game import now filters rows by tournament date, so a multi-day CSV file will only load the games matching the specific tournament's date. A combined 2-day PSA Summer Jam schedule CSV (July 4-5, 2026, 5 courts, 11 slots/day) has been generated in game-exports/. GitHub repo migrated to mtimmons1227/stripeup; Netlify reconnected. DNS issue with AT&T ISP resolved via Google Public DNS in Chrome/Edge. Signup auth bug fixed (was routing through proxy instead of Supabase JS client directly).

The next milestone is a full browser test of the self-schedule flow from invite link to confirmed games. Note the paragraph above supersedes this: as of the Sept 2 evening reset the tournaments/games/blocks/claims are **gone by design** and must be rebuilt from a CSV first. The 88 officials remain. Travel radius UI fields for the Officials roster table remain queued behind that.

---

## 2. Next Test Plan

**Step 0 — rebuild the fixture (required after the Sept 2 data reset).** Create a *single-day* tournament (not multi-day — series grouping, date filtering and the rollup are extra variables the token-path test doesn't need), then import `game-exports/karlos-tounament-saturday.csv` (1.4KB, one day) rather than the 110-game two-day file. Then Review Blocks → Confirm & Send Invitations.

**Constraint to plan around:** `send-invites.js` filters test-pattern emails, so of the 88 officials only 4 can actually receive an invite and all 4 are Marvin's own addresses. At `officials_per_game = 2` that genuinely staffs about two blocks. Beyond that the test relies on Demo Mode / Simulate Responses, which exercises the DB writes but **not** the email path or the real token link — be precise about which is being claimed as working.

**Also note:** `self-schedule.html` enforces a minimum of 2 blocks plus rest-period rules, so a single-block test fails by design. And `v_1099_report` aggregates confirmed claims — with claims at 0, all four Reports tab sections return empty until the rebuild produces confirmed claims.

1. **Full self-schedule flow** — invite → official opens link → picks blocks → confirms → assigner sees in View Responses / Confirmed Officials modal
2. **Confirmed Officials modal** — verify court grouping, empty slot rows, game count per block
3. **Demo Mode** — toggle on, send invitations (no real emails), Simulate Responses populates confirmed officials modal
4. **Send Reminders dialog** — open Send Invitations on already-sent tournament → confirm dialog shows correct pending count
5. **Travel radius UI** — add home_city / home_state / travel_radius fields to Officials roster table

---

## 3. Recent Changes Log

### September 2, 2026 (night — schema/code audit + fixes)
Full audit written to `docs/specs/schema-code-audit-2026-09-02.md`. Spec for the platform-wide officials model written to `docs/specs/platform-wide-officials-spec.md`. Findings and fixes:
- **🔴 C1 — the 1099 report has never been able to return a row.** `v_1099_report` filters on `c.pay_amount > 0`, but **`claims.pay_amount` is never written** — zero occurrences of the string in `index.html` or `self-schedule.html`; both claim-insert paths (`self-schedule.html:995`, `index.html:5873`) omit it, and all four pre-wipe claims carried `0`. The tax-compliance report is structurally empty and an empty table reads as "nobody hit $600". **NOT YET FIXED** — needs a decision: write `pay_amount` at claim time, or (recommended) change the view to compute pay by joining `available_blocks.game_count × tournaments.pay_per_game`, which removes the denormalized column rather than populating it.
- **C2 — scratching an official silently did nothing. FIXED.** `index.html:5458` sent a `notify_official` field; `assigner_scratches` has no such column, so PostgREST rejected the entire insert with a 400 while `.then()` never checked `r.ok` and reported success. The scratched official stayed fully eligible and would be re-invited. Removed the field and added an `r.ok` check that surfaces the error.
- **C3 — `availability.official_id` is never populated.** Read at `3364, 5093, 6217`; written by no insert path. Always null, so the scheduler substitutes synthetic IDs (`'O001'`) and the link back to the real `officials` row is permanently broken. **NOT YET FIXED** — folded into spec Phase 1, since the commitment ledger keys on `official_id`.
- **H1 — block re-save corrupted slots and pay. FIXED.** `brSaveBlocksDB` omitted `officials_needed` and computed `total_pay` without the `× officials_per_game` factor that `calculateBlocks` applies. Blocks created by CSV import were correct; the same blocks re-saved from Review Blocks came back with `officials_needed = NULL` and half the pay. Compounding it, read sites disagreed on the fallback — `|| 1` at 1725/1818/3150/3165/3216 but `|| 0` at 2025/2030/4363 — so after a re-save the dashboard counted those blocks as zero slots and zero dollars while the block grid counted one. Added `officials_needed`, multiplied `total_pay` by `opg`, and normalized the three `|| 0` sites to `|| 1`.
- **H2 — roster showed wrong travel radius. FIXED.** `selectCols` (`4594`) omitted `travel_radius` and `rank_notes`, so `4732` rendered `o.travel_radius || 'national'` as "national" for every official while `send-invites.js` filtered on the real stored value — roster and invite logic disagreed. Rank notes were also always blank on reopen. Added `rank_notes, travel_radius, home_city, home_state`.
- **H3 — `tournaments.courts` is never written** by any insert or update, but is rendered unguarded at `index.html:2108` and, on the official-facing page, `self-schedule.html:453` and `472` as `T.courts + ' courts'`. Officials see "null courts". **NOT YET FIXED.**
- **S1 — 19 foreign keys had no covering index. FIXED.** Migration `add_missing_foreign_key_indexes` created all 19 (confirmed independently by Supabase's performance advisor). Note `claims.tournament_id` and `claims.official_id` were already indexed — it was 19 FK columns lacking indexes, not every FK in the schema.
- **S5 — corrected three comments that contradicted the live schema**: `1668` ("games table has no org_id column" — false), `4593` ("rank_level may not be there yet" — it exists), `4606` ("assigner_scratches may not exist yet" — it exists). `self-schedule.html:561` ("tournament_day_id doesn't exist on available_blocks" — false) is **NOT YET FIXED**.
- **Docs** — section 8 previously listed `admin_unlocked` under `tournaments`; it is a column on `available_blocks`. Corrected below. The code was always right.
- **Verification** — all inline `<script>` blocks extracted and passed `node --check` after the edits, per the QA gate in `.claude/agents/qa.md`.

### September 2, 2026 (evening — data reset + tenancy findings)
- **DB** — Cleared to a clean slate for end-to-end testing: `DELETE FROM tournaments` (2 rows) cascaded to `games` (107), `available_blocks` (43), `claims` (4), `invite_tokens` (8), plus `availability`/`official_blocks`/`schedules`/`tournament_days` (already 0). `officials` (88) and the Timmons Foundation org intentionally retained. Post-delete counts verified.
- **DB** — Backup taken before the delete (schema `backup_20260902`, exact copies of all 11 tables, 254 rows total: the 164 deleted plus officials and organizations), then **dropped later the same evening on request** — `DROP SCHEMA backup_20260902 CASCADE`, verified no `backup%` schema remains. **The 164 deleted rows are therefore unrecoverable from the database.** Deliberate: the data was stale June test state and the fixture is being rebuilt from CSV.
- **Files** — `backups/stripeup-pre-wipe-snapshot-2026-09-02.json` still exists on disk and is the only surviving record of the deleted tournaments/claims/invite_tokens (it never contained games or blocks). It holds official emails, a phone number and live invite-token strings, and `.gitignore` does **not** cover `backups/` — add that line before the next `git add .`, or delete the file.
- **DB** — Deleted the second org "Game Time Sports" (`5ed3d3a2-…`, created Sept 2, no data) **and** its auth user `game_time_sports@yahoo.com`, together. Deleting the org alone would have been worse than leaving it: that account's next login would hit the hardcoded fallback at index.html:1590 and create a *second* "Timmons Foundation" row, making the `LIMIT 1` org lookup a coin flip.
- **Finding (index.html:1573, 1468)** — **Cross-tenant data exposure.** `loadOrgAndShow()` resolves the current org with `/rest/v1/organizations?select=id,name&limit=1` — no filter by user — and `doSignup()` creates the auth user and the org as two unrelated inserts with no link between them. `organizations` has no `owner_id`/`user_id` and there is no membership table, so **the schema has no user→org relationship at all**. While Game Time Sports existed, that query returned Timmons Foundation for *both* accounts. Now dormant (one org, one user), not fixed. Logged in section 7.
- **Finding (`rls-policies.sql`)** — Cannot be applied as-is; verified against the live DB. (a) Every assigner policy tests `auth.jwt() ->> 'org_id'`, but both auth users' `raw_app_meta_data` is just `{provider, providers}` — no custom claim, no auth hook — so the claim is NULL and every assigner policy evaluates false (lockout). (b) Official policies test `auth.uid()`, but self-schedule is token-based with no Supabase session. (c) `officials.id` has no relationship to `auth.users.id` — a join returned **0 of 88 matching** — so `officials_manage_self` / `officials_manage_own_claims` could never have worked. (d) The file only enables RLS on 6 of 12 tables. Root cause is (a)+the missing tenancy link, not the policy text. Details in section 12.
- **Docs** — Corrected the org ID in section 11 (was `996a40a8-…`, actual is `2270e1d1-…`) and the CASCADE DELETE note in section 8 (`games` *does* have `org_id`; so do `available_blocks` and `availability` — only `claims` lacks it).

### September 2, 2026 (documentation audit)
- **CLAUDE.md** — Closed a ~3-month gap: the Aug 7 and Sept 1 entries below existed in git history but were never logged, in violation of section 13's own auto-update rule. Fixed repo URL in section 10 (was `gridironiq/stripeup`, actual remote is `mtimmons1227/stripeup` — section 1 already recorded the migration but section 10 was never updated). Fixed RLS status in sections 6 and 12 (was framed as "not yet built"; corrected to "written April 2026, never applied" — `rls-policies.sql` and `RLS-README.md` have existed since April). Added 4 missing tables to the section 8 schema table (`assigner_scratches`, `tournament_days`, `official_blocks`, `schedules`).
- **DB investigation** — Chased down an apparent "empty database" (all tables 0 rows except `organizations`) that turned out to be stale cached row-count stats (`list_tables`/dashboard estimate, not a live query) on the correct, active Supabase project. Real `COUNT(*)` shows data intact: 88 officials, 2 tournaments, 107 games, 43 available_blocks, 4 claims, 8 invite_tokens. No data was lost and no project mismatch occurred; see the new "Critical" note in section 10.
- **Confirmed via Supabase directly**: all 12 public tables (including `officials`, `claims`, `invite_tokens`) have RLS disabled — matches the existing "must enable before public launch" item in section 12, now with an accurate count.

### September 1, 2026 (second session)
- **index.html** — `renderAcctMenu()`: header trigger now shows the org name (avatar initial from org name) instead of the signed-in email; falls back to email if `orgName` is missing, then to "Account" if both are missing. Dropdown reordered to org name (bold) then email (smaller/lighter), omitting the email line entirely if it's missing. Reuses `G.orgName` already loaded elsewhere — no new DB query. Auth/DB handlers unchanged.

### September 1, 2026
- **index.html** — Account/profile menu added to header: replaces the standalone "Change Password" and "Sign Out" buttons with a single compact dropdown (gold avatar + navy initial + label + caret trigger). Dropdown shows the signed-in email, "Org: {name}", a divider, then Change Password and Sign Out — calling the exact same `openModal('chgpwd-modal')` / `doLogout()` handlers as before. Toggles open/closed on click; closes on outside-click and Escape (document-level listeners); menu hides entirely if `supabase.auth.getUser()` returns no user; null-guards missing email (shows "Account", no initial). New CSS: `.acct-menu`, `.acct-trigger`, `.acct-avatar`, `.acct-dropdown`, `.acct-dd-*` classes, navy/gold palette.

### August 7, 2026 (repo reorganization — no functional index.html changes)
- **Repo** — First-time git commit of files that had existed locally since April 2026 but were never checked in: `rls-policies.sql`, `rls-testing.sql`, `RLS-README.md` (RLS policies drafted, never applied — see section 6/12), `HOW-TO-RUN-LOCALLY.md`, `Launch-StripeUp.bat`, `Setup-Desktop-Icon.bat` (local dev/launch helpers).
- **send-invites.js** (repo root) — added as a duplicate of `netlify/functions/send-invites.js`, with extra CORS-header and required-env-var-validation code the deployed version doesn't have. **Not deployed** — `netlify.toml`'s `[functions] directory` points at `netlify/functions/` only, so this root copy is dead code left over from the reorganization. Flagged as a known issue (section 7); should be deleted or reconciled.
- **docs/** — SDLC documentation set added (`docs/sdlc/00-planning` through `08-future-releases`, `docs/artifacts/`, a compiled Word doc) plus `tests/automated.spec.js` formalized alongside it.
- **.gitignore** — `game-exports/*.csv`, `.claude/`, `diff_index.html.txt` added.

### June 7, 2026 (fourth session)
- **index.html** — `loadSeriesRollup(seriesKey, tournIds, payMap)`: new function — fires 3 async Supabase queries (games count, confirmed claims, available_blocks) for all tournament IDs in a series; computes total games, distinct confirmed officials, % staffed, and total pay estimate; updates `series-rollup-{key}` div in the series header
- **index.html** — Series group header now includes `<div id="series-rollup-KEY">` placeholder (shows `…` until data loads); populated by `loadSeriesRollup` after render; shows games · confirmed · % staffed · pay est in gold/green/amber/red coloring

### June 7, 2026 (third session)
- **index.html** — Nav cleanup: removed Scheduler, Master Schedule, Individual Schedules, Sub Agent tabs; nav now has only Tournaments · Officials · Reports
- **index.html** — Reports tab rebuilt with 4 sections and pill-tab selector: 1099 Payments, Staffing, Official Activity, Payout Summary
- **index.html** — `run1099Report()`: replaces `runReport()`; uses supabase JS client directly (fixes sbFetch proxy bug); adds "1099 Required" badge for $600+, totals row, Export CSV
- **index.html** — `runStaffingReport()`: per-tournament slots filled/open/%, color-coded badge (green/amber/red), confirmed official count, Export CSV
- **index.html** — `runActivityReport()`: per-official view — tournaments worked, total games, estimated pay from confirmed assignments, Export CSV
- **index.html** — `runPayoutsReport()`: per-tournament estimated payout from confirmed claims × pay_per_game, grand total row, Export CSV
- **index.html** — `showReport(name)`, `_dlCsv()`, `initReportYearSelector()` updated for new element IDs; `_rptData` replaces `_reportData`
- **index.html** — "Send reminder" action card now clickable — opens Send Invitations/Reminders dialog

### June 7, 2026 (second session)
- **index.html** — `openSendSchedules(tid)`: new function — opens Send Schedules modal, counts confirmed officials via `supabase.from('claims')`, populates body with official count + tournament name/date, enables Send button when count > 0
- **index.html** — `doSendSchedules()`: new function — POSTs `{tournament_id}` to `/.netlify/functions/send-schedules`, shows result (sent count, skipped test accounts, errors), hides Send button and changes Cancel to Close on success; uses `showToast()` for non-blocking confirmation
- **index.html** — `SEND_SCHEDULES_TID` global added for Send Schedules state
- **netlify/functions/send-schedules.js** — NEW FILE: sends full schedule + partner info to all confirmed officials; queries claims + blocks + tournament; groups claims by official; builds `blockOfficials` map for co-official lookup; sends HTML email via Resend with block table (block, court, time, games, pay, partner name); skips test emails; returns `{sent, skipped, errors, results}`

### June 7, 2026
- **index.html** — `doLoad()`: added date filtering for CSV game import — after CSV is parsed, rows are filtered to only those matching the tournament's date (`G.allTournaments.find(t => t.id === G_IMPORT_TOURN_ID).date`); shows alert if no rows match; summary line now includes the tournament date; supports multi-day CSV files loaded against individual day tournaments
- **index.html** — CSV import validation: accepts `court` column as alias for `court_name`; normalizes M/D/YYYY dates to YYYY-MM-DD before date filter comparison
- **index.html** — `calculateBlocks()`: added `opg` parameter for `officials_per_game`; sets `officials_needed: officialsPerGame` and `total_pay: sz * pay * officialsPerGame` on each block; all 3 call sites (`brOpen`, `brApplyMode`, `saveGamesToDB` callback) updated to pass `officials_per_game` from tournament
- **index.html** — `loadTournamentStats()`: staffing summary line now shows "N games today" in navy bold before the slots-filled count; court breakdown shows per-court game count (`m.games + ' games'`) and total games in summary
- **index.html** — Quick actions row: "Send Schedules" button added (only shown when `invitations_sent_at` is set); modal HTML added (`id="send-schedules-modal"`)
- **self-schedule.html** — `doConfirmSubmit()`: fires `fetch('/.netlify/functions/send-confirmation', ...)` after successful DB write for non-test emails; sends `{official_name, official_email, tournament_name, tournament_date, blocks[], total_games, total_pay}`
- **netlify/functions/send-confirmation.js** — NEW FILE: sends "You're locked in" confirmation email to official after self-schedule completion; block table with name, court, time, games, pay; total row + important note; skips test emails
- **game-exports/psa-summer-jam-2026-both-days.csv** — New combined 2-day schedule CSV: PSA Summer Jam July 4-5 2026, 5 courts (Court 1–5), 11 time slots per day (08:00–19:40 at 70-min intervals), 110 total games

### April 11, 2026 (fifth session)
- **index.html** — Multi-day tournament creation: added "Number of Days" selector (1–4) to New Tournament modal; days > 1 shows helper text and renames button to "Create N Tournaments"; `createTournament()` loops each day, offsets date using local midnight (no UTC shift), appends day-of-week suffix (e.g. "Summer Jam Friday"), inserts sequentially; on completion shows dismissible green success banner above the list with clickable tournament name links; `addDays()`, `tnDaysChange()`, `showMultiCreateBanner()` helpers added; existing series-grouping feature auto-groups the new day-named tournaments

### April 11, 2026 (fourth session)
- **self-schedule.html** — Minimum 2 blocks enforced: Confirm button disabled with dynamic text ("Select at least 2 blocks to continue" / "Select 1 more block to continue") until ≥2 blocks selected
- **self-schedule.html** — Rest labels updated: `bState()` now emits "Rest required — W2" / "Rest required — W3" instead of "rest after X"
- **self-schedule.html** — `grid-lbl` text updated for 0/1/2+ selection states
- **self-schedule.html** — `checkRestViolations()`: new function validates that no selected block starts during a rest period imposed by an earlier selected block; sorts by start_time and walks the sequence
- **self-schedule.html** — `doConfirm()`: rejects if `SEL.length < 2`; runs `checkRestViolations()` and shows "Your selection violates rest period rules" toast if any violation found before DB write
- **self-schedule.html** — `stopTimer()`: button text restored to correct disabled label on timer expiry
- **self-schedule.html** — Helper hint added below grid: "Select minimum 2 blocks · Rest periods are required after each work set"

### April 11, 2026 (third session)
- **index.html** — Tournament series grouping: added `detectSeriesInfo()` and `groupTournamentsBySeries()` helpers; refactored `renderTournaments()` to group tournaments sharing a base name + day/week suffix (Friday/Saturday/Day 1/Week 2/etc.) under a navy/gold series header ("N-day series" badge + date range); extracted card HTML to `renderTournCard(t, nested)` helper; nested cards override border/border-radius/margin for clean containment; standalone tournaments render unchanged; no DB changes

### April 11, 2026 (second session)
- **index.html** — New Tournament form: added `autocomplete="off"` to all 7 text/number inputs in `#tourn-modal`; added `setTimeout(..., 50)` in `openNewTournamentModal()` to re-clear fields after `openModal()` makes modal visible — defeats Chrome autofill refill timing
- **index.html** — `createTournament()`: fixed `tn-rank` → `tn-minrank` ID mismatch — `min_rank_level` was always defaulting to 1 because `tn-rank` element does not exist
- **index.html** — `brOpen()`: switched games and available_blocks fetches from `sbFetch` (Netlify proxy) to Supabase JS client directly — proxy could drop `tournament_id` filter causing wrong tournament's data to load; added `console.log` at entry showing BRK.blocks state and fetch result counts; hardened empty-state check to `!BRK.games.length || !slots.length`

### April 11, 2026
- **index.html** — `saveGamesToDB`: added reset of `layout_locked=false` and `invitations_sent_at=null` after games saved — prevents layout lock persisting from prior sessions and triggering too early
- **index.html** — `brOpen()`: changed lock signal from `layout_locked` to `invitations_sent_at IS NOT NULL` — layout lock now only activates after invitations are actually sent, not on game import
- **index.html** — `calcExpiresAt` in send-invites.js: fixed UTC midnight off-by-one — `new Date('YYYY-MM-DD')` = UTC midnight (prev evening US); fix: parse as local midnight `new Date(+p[0], +p[1]-1, +p[2])` + 1 day
- **send-invites.js** — `usedTokenOfficialIds` all-token scan: removed deduplication guard for confirmed/used check so forceResend doesn't hide a confirmed token behind a newer unused one; declined deduplication retained
- **index.html** — `brSelect()`: now returns early for ALL blocks (not just confirmed ones) when `BRK.invitationLocked && !blk.admin_unlocked` — block edit panel fully inaccessible when layout is locked
- **index.html** — `openInviteModal()`: added `skipReminderCheck` parameter; if `invitations_sent_at` is set and `skipReminderCheck` is false, redirects to `openReminderConfirm()` instead of opening the full modal
- **index.html** — `openReminderConfirm()`: new function — shows "Send Reminders" confirmation dialog with pending count (eligible officials minus those with confirmed/declined tokens); Yes button calls `openInviteModal(tid, true)` to bypass check
- **index.html** — `openBlockReviewFromCard()`: stripped reminder intercept — now always calls `brOpen(tid)` directly; reminder dialog only appears on Send Invitations path
- **index.html** — Pending count fix: `openReminderConfirm` counts all active eligible officials minus those with a confirmed/declined/used token — was showing 0 because 84 of 87 officials have test emails filtered by send-invites.js
- **index.html** — Demo Mode added: "Demo Mode" toggle button + amber "DEMO" badge in nav bar, persisted in `localStorage('demoMode')`; `applyDemoModeUI()` called on login to restore state
- **index.html** — `sendInvitations()` Demo Mode intercept: when Demo ON, skips `fetch('/api/send-invites', ...)` entirely; shows "Demo Mode — N invitations queued (no emails sent)" status; still writes `invitations_sent_at` + `layout_locked` to DB so layout locks realistically
- **index.html** — "Simulate Responses" button added to invite modal (Demo Mode only, appears after invitations sent): fetches blocks + up to 10 random officials, inserts confirmed `claims` rows + used `invite_tokens` rows, refreshes tournament card stats
- **index.html** — `showToast()`: new helper — non-blocking bottom-center toast, fades after ~3 seconds; used by Demo Mode and Simulate Responses
- **index.html** — `countEligibleOfficials()`: now fetches `invite_tokens` for the tournament and subtracts officials with `used=true` token OR token created within last 24h — matches actual send-invites.js skip logic; "Estimated recipients" now shows 84 not 87 for End To End Test 1
- **index.html** — `updateNavCounts()`: games and confirmed-claims counts now scoped to org's tournament IDs (neither table has `org_id` column — old query was unfiltered); when no tournaments exist, pills immediately show 0
- **index.html** — Tournament delete handler: added `updateNavCounts()` call after deletion so header pills refresh immediately without page reload

### April 10, 2026 (evening — third session)
- **index.html** — Schedule status badge (`hdr-sched-`) initial HTML changed from `display:none` to `display:inline-block` with grey "No games yet" styling — badge now always visible on 0-game tournaments without waiting for `loadTournamentStats`
- **index.html** — `brAdj()`, `brSplit()`, `brMerge()` — added invitation-lock guard: if `BRK.invitationLocked` and selected block has confirmed claims (`BRK.claimCounts[blk.id] > 0`) and not `admin_unlocked`, calls `brLockWarn()` and returns — empty blocks remain editable
- **tests/automated.spec.js** — Playwright test suite added: 6 checks (login, days-away badge colours, Import Games disabled, schedule status badge text, shuffle disabled when locked, block editing blocked on confirmed blocks)
- **playwright.config.js**, **package.json** — Playwright config and devDependency added

### April 10, 2026 (evening — second session)
- **index.html** — `brConfirmOpen()` now guards against `layout_locked`: if layout is already locked (invitations sent), skips `brSaveBlocksDB` entirely and calls `brDoOpen(0)` directly — prevents CASCADE-delete of `claims` table which was wiping confirmed official assignments and causing re-invites to already-confirmed officials
- **send-invites.js** — Added secondary skip guard: queries `invite_tokens` for `used=true` tokens for this tournament; skips any official whose token is already used, even if their `claims` row was accidentally deleted

### April 10, 2026 (evening)
- **index.html** — `saveBlocksToDB` rewritten: DELETE now uses `supabase.from('available_blocks').delete().eq('tournament_id',tid)` and INSERT uses `supabase.from('available_blocks').insert(batch)` — proxy was stripping WHERE clause from DELETE causing blocks to stack on every CSV re-import
- **index.html** — `saveGamesToDB` rewritten: same fix — DELETE + INSERT via Supabase client directly instead of `fetch(SUPA_URL+...)` through proxy
- **DB** — Deduplicated stacked blocks in all 3 test tournaments: Summer Classic 50→17, Delete Tournament 33→17, End To End Test 83→17

### April 10, 2026 (afternoon — layout lock, status badges, availability)
- **index.html** — `brSelect()`, `brShuffleBlocks()`: disabled when `BRK.invitationLocked`; lock banner shown with Emergency Edit button
- **index.html** — `brOpen()`: sets `BRK.invitationLocked` from `invitations_sent_at IS NOT NULL`; locked blocks with confirmed claims show 🔒 prefix
- **index.html** — Schedule status badge: fixed all 4 states (No games yet / Games ready / Self-scheduling open / Signup closed)
- **index.html** — Import Games button: disabled when tournament already has games
- **index.html** — Days-until badge: standardized to midnight-local `Math.ceil` everywhere
- **index.html** — Quick actions row: reordered to Edit · Import · Review · Send · View · Copy · Close · Cancel · Delete
- **self-schedule.html** — Reject submissions when signup is closed (checks `scheduling_mode`)
- **self-schedule.html** — Availability window UI: officials set avail_start/avail_end + max_games before viewing grid
- **index.html** — View Responses modal: per-official status badges (confirmed / declined / pending) and action buttons (resend, force-confirm)
- **send-invites.js** — Resend skip logic rewritten: skip if token `status=confirmed` OR `status=declined` OR `created_at < 24h ago`; scans all tokens per official (not just most recent)
- **send-invites.js** — Token expiry: `min(7 days, tournament_date + 1 day)` using local midnight parsing
- **DB** — `invite_tokens` table: added `status` column (invited / confirmed / declined) and `declined_at` timestamp via migration

### April 10, 2026
- **index.html** — Tournament card fully redesigned as assigner command center: days-until badge (green/amber/red), 4 metric tiles (% filled, confirmed, open slots, responded), progress bar + summary line, court breakdown two-column list with colored dots, countdown circle sidebar, pay estimate, dynamic action cards, quick actions row
- **index.html** — `loadTournamentStats()` rewritten: single `Promise.all` fetching claims, blocks, games count, officials roster count, invite tokens — replaces 3 serial fetch chains
- **index.html** — Confirmed Officials modal fully redesigned: sticky navy header, dark summary bar (slots filled, courts full/partial/empty, days away), courts grouped into Fully Staffed / Partially Staffed / No Officials Yet sections with sticky sub-headers, official rows with avatar initials + name + email + phone + games badge, empty slot dashed rows with Assign Official button, sticky footer with Send Invitations + Close
- **index.html** — Confirmed Officials modal: game count added to block sub-rows (e.g. "BA · 08:00–09:10 · 4 games")
- **index.html** — Staffing progress bar, slots open field, schedule status logic (No games yet / Games ready — review blocks / Self-scheduling open / X games ready), Officials Responded shows "N officials · M blocks claimed", nav confirmed pill uses supabase client directly
- **index.html** — Games field added to tournament detail grid

### April 9, 2026
- **self-schedule.html** — Official block grid rebuilt to use GAMES_MAP (fetched from games table) for exact time row and continuation row parity with assigner Review Blocks
- **self-schedule.html** — Block hold writes directly to Supabase client (proxy fix)
- **self-schedule.html** — Pill-style block legend redesigned
- **self-schedule.html** — Session handling simplified: SID always fresh on page load; all held blocks released on load via `.eq('status','held')` with no expiry filter
- **self-schedule.html** — Availability dropdowns: 7:00 AM–11:00 PM, 30-min intervals, 12-hour format, defaults 8:00 AM / 11:00 PM
- **self-schedule.html** — Greyed block readability fixed: `.cg` uses opacity+pointer-events (not grey bg override), block color always shows; `.cna` class for outside-window blocks
- **self-schedule.html** — Rest period fix: slot-index count (W2=1 slot, W3=2 slots) replaces minute-arithmetic; only checks `b.start_time` against sitB (not full [bs,be] range)
- **self-schedule.html** — Max-games check fixed: `cg >= mxG` (was `cg + b.game_count > mxG`); game_count parsed as int
- **self-schedule.html** — Co-official names shown on partially filled blocks when `show_co_officials=true`
- **index.html** — Smart Layout Lock: `layout_locked` + `invitations_sent_at` set on first Send Invitations; locked blocks with confirmed claims show 🔒 prefix, Emergency Edit button sets `admin_unlocked=true`
- **send-invites.js** — Skip logic fixed: only skip token if < 24h old (was skipping all valid tokens → 84 officials skipped)
- **send-invites.js** — Cancel→Close button after send completes; resend note added

### April 8, 2026
- **index.html** — CSV filename displays in gold after file load ("✓ MyGames.csv loaded")
- **index.html** — Load Sample and Traditional Scheduler buttons removed from Import Games modal
- **index.html** — Cancel button changes to Close after successful CSV load; resets on modal reopen
- **index.html** — Block count multiply bug fixed: sbFetch DELETE/PATCH replaced with supabase.from() direct calls (Netlify proxy was stripping query strings → no WHERE clause → blocks stacked on every click)
- **index.html** — Confirm & Send Invitations: closes Review Blocks modal and opens Send Invitations modal directly
- **index.html** — saveEditTournament() rewritten to use supabase.from('tournaments').update().eq('id', tid) — was failing with "UPDATE requires a WHERE clause"
- **index.html** — createTournament() rewritten to use supabase.from('tournaments').insert() — was failing with "Unexpected end of JSON input" via Netlify proxy
- **index.html** — pay_per_game saving correctly: explicit parseFloat + isNaN guard
- **index.html** — is_taxable checkbox added to New and Edit Tournament forms, wired to DB
- **index.html** — Sign out fully clears session and localStorage
- **index.html** — Password recovery race condition fixed
- **index.html** — Court names from CSV (court_name column) showing correctly in block layout
- **index.html** — Block layout gaps showing correctly
- **index.html** — Download Template button added to each tournament card
- **index.html** — Import Games modal placeholder updated to use real court names (Red Court, Championship Court, Blue Court)
- **index.html** — Number of Courts, Start Time, End Time removed from New and Edit Tournament forms (reference info only — games come from CSV)
- **index.html** — Confirm & Send Invitations button renamed from "Confirm & Open Self-Scheduling"
- **.claude/agents/qa.md** — QA gate added: JS syntax check + Supabase verify required before task marked complete
- **CLAUDE.md** — restructured to cumulative format

---

## 4. What's Working ✅

*Cumulative — browser-confirmed by Marvin*

### Authentication
- Sign in / sign out fully clears session and localStorage
- Password recovery race condition fixed

### Tournament Management
- Create tournament — Supabase JS client direct (no proxy)
- Edit tournament save — WHERE clause fixed, Supabase direct
- pay_per_game saving correctly
- is_taxable (1099) checkbox saving correctly
- Delete tournament with typed name confirmation + nav header refreshes immediately
- Download Template button on each tournament card
- **Tournament card command center** — days-until badge, 4 metric tiles, court breakdown, countdown circle, pay estimate, dynamic action cards, quick actions row
- **Series group header rollup** — `loadSeriesRollup()` fires async queries post-render; shows combined games, distinct confirmed officials, % staffed, and total pay estimate across all days in a series

### Games & Blocks
- CSV import with real court names (`court_name` or `court` column); M/D/YYYY dates normalized to YYYY-MM-DD
- Multi-day CSV filtering: import only loads games matching the tournament's specific date
- Filename label shows in gold after file load
- Block layout showing correctly with gaps and colors
- Block count stays correct — no longer multiplies on re-click
- Import Games button disabled when games already exist
- Confirm & Send Invitations: closes Review Blocks → opens Send Invitations
- **Smart Layout Lock** — triggers only after `invitations_sent_at` is set (not on game import); locked blocks with claims show 🔒 + Emergency Edit; block edit panel fully inaccessible when locked
- `officials_needed` correctly set on all new blocks — `calculateBlocks()` takes `opg` param from tournament's `officials_per_game`
- Staffing summary line: "N games today · N of N slots filled"
- Court breakdown: per-court game count + total games in footer

### Invitations
- Email invites via Resend ✅
- Invite modal opens automatically after block confirm
- **Send Reminders dialog**: if tournament already has `invitations_sent_at`, shows confirmation with correct pending count (eligible minus confirmed/declined) before re-sending
- **Estimated recipients count**: subtracts already-confirmed and recently-invited officials (matches actual send logic)
- Skip logic: confirmed/declined tokens and tokens < 24h old are skipped; scans all tokens per official (not just most recent)
- Token expiry: `min(7 days, tournament_date + 1 day)` using local midnight parsing

### Demo Mode
- Toggle in nav bar; amber DEMO badge; `localStorage` persisted across sessions
- Send Invitations intercepted in Demo Mode — no real emails; still locks layout in DB
- Simulate Responses: inserts confirmed claims + used tokens for 8–10 random officials

### Self-Schedule (self-schedule.html)
- Official block grid matches assigner Review Blocks exactly (GAMES_MAP, continuation rows)
- Rest period correctly counts slot-index (W2=1, W3=2)
- Max-games check: `cg >= mxG`
- Block colors always show on unavailable blocks (opacity dimming)
- Availability dropdowns: 7 AM–11 PM, 30-min, 12-hour
- Co-official names on partially filled blocks
- Session: fresh SID on load, all held blocks released on page load
- Submissions rejected when signup is closed
- **Confirmation email**: after successful confirm, fires `send-confirmation` Netlify function — sends "You're locked in!" email with block table + total pay to real (non-test) emails

### View Responses
- Per-official status badges (confirmed / declined / pending)
- Resend and force-confirm action buttons per official

### Confirmed Officials Modal
- Grouped by court status: Fully Staffed / Partially Staffed / No Officials Yet
- Sticky navy header + dark summary bar + sticky footer
- Official rows: avatar initials, name, email, phone, games badge
- Empty slot dashed rows with Assign Official button
- Game count per block in sub-rows

### Officials
- Travel radius DB schema in place
- Multi-official blocks (1/2/3 officials per block)

### Reports
- **1099 Payments**: supabase client direct, $600+ badge, totals row, Export CSV
- **Staffing Report**: per-tournament slots filled/open/%, color-coded %, Export CSV
- **Official Activity**: per-official tournaments + games + est. pay, Export CSV
- **Payout Summary**: per-tournament est. payout from confirmed games, grand total, Export CSV

### UI / UX
- **Account/profile menu** — header trigger shows org name + gold/navy avatar + caret; dropdown shows org name, email, Change Password, Sign Out; closes on outside-click/Escape; hides with no session; null-guards missing org name/email
- Nav trimmed to 3 tabs: Tournaments · Officials · Reports (Scheduler/Master/Individual/SubAgent removed)
- Nav bar pills scoped to org's active tournaments — games and confirmed counts clear to 0 when all tournaments deleted
- `showToast()` helper for non-blocking status feedback
- show_co_officials toggle working
- Schedule status badge always visible (inline-block from initial HTML)
- Mobile optimization on self-schedule.html
- "Send reminder" action card clickable — opens Send Invitations/Reminders dialog

---

## 5. Deployed — Needs Browser Testing 🚀

- **Full self-schedule flow end to end** — built, not yet verified with real invite link → confirmed claim
- **Confirmation email** (`send-confirmation.js`) — deployed June 7, not yet browser-tested with real official submit
- **Send Schedules** (`send-schedules.js` + modal + `openSendSchedules`/`doSendSchedules`) — deployed June 7, not yet tested with confirmed officials data
- **Confirmed Officials modal redesign** — deployed April 10, not yet browser-tested with real data
- **Tournament card command center** — deployed April 10, not yet browser-tested
- **Send Reminders dialog** — deployed April 11, needs end-to-end test on a live tournament
- **Demo Mode + Simulate Responses** — deployed April 11, needs walkthrough test
- **View Responses status badges** — deployed April 10, not yet browser-tested
- **Token expiry local midnight fix** — in send-invites.js, not verified
- **Travel radius filtering** — in send-invites.js, not tested with real radius data

---

## 6. Not Yet Built ⏳

- Travel radius UI fields on Officials roster table
- Twilio A2P 10DLC upgrade for SMS (~$25 to unblock)
- Official-facing 1099 earnings view (Phase 2)
- Court-level rank override UI
- Auto-release cron job for expired holds
- Payment system / Stripe (Phase 3)
- RLS policies are **written but not applied** — see section 12 for status (this is not a "not yet built" item; the SQL exists, it just hasn't been run)

---

## 7. Known Issues ❌

- **🔴 The 1099 report cannot return a row (C1).** `v_1099_report` requires `claims.pay_amount > 0`; nothing ever writes `pay_amount`. Tax compliance is non-functional and fails silently as "nobody earned $600". Decision needed: populate the column at claim time, or rewrite the view to compute pay from `available_blocks.game_count × tournaments.pay_per_game` (recommended — one less denormalized copy).
- **`availability.official_id` is never written (C3).** Always null; the scheduler falls back to synthetic IDs and the link to the real official is lost. Blocks the commitment ledger in the spec.
- **`tournaments.courts` is never written (H3)** but is rendered unguarded — officials see "null courts" on the self-schedule banner (`self-schedule.html:453, 472`).
- **`self-schedule.html:561`** carries a comment claiming `tournament_day_id` doesn't exist on `available_blocks`. It does.
- DEV bar still visible in production (should be hidden)
- SMS blocked — Twilio A2P 10DLC upgrade required
- **Stray duplicate `send-invites.js`** at repo root (added Aug 7, 2026) diverges from the deployed `netlify/functions/send-invites.js` (extra CORS headers + env-var validation) and is not wired up anywhere — `netlify.toml` points `[functions] directory` at `netlify/functions/` only. Dead file; should be deleted or reconciled to avoid someone editing the wrong copy.
- RLS disabled on all 12 public tables (`officials`, `claims`, `invite_tokens` included) — anon key has full read/write. See section 12.
- **🔴 No user→org relationship exists in the schema.** `organizations` has no `owner_id`/`user_id` and there is no membership table. `loadOrgAndShow()` (index.html:1573) picks the org with `organizations?select=id,name&limit=1` — whichever row comes back first — and `doSignup()` (index.html:1468) creates the auth user and org as unrelated inserts. With more than one org in the table, every account loads the same first org: while "Game Time Sports" existed (Sept 2), that account would have loaded Timmons Foundation's 88 officials, tournaments and 1099 data. Currently dormant only because there is one org and one user again. **RLS will not fix this** — the client is asking for the wrong org, and policies keyed to the org the client already chose would authorize the leak. Fix order: add `org_members(user_id, org_id, role)` → backfill → resolve org through it in `loadOrgAndShow()` and write the membership row in `doSignup()` → *then* write RLS policies keyed off `auth.uid()` via a `SECURITY DEFINER` lookup.
- **Hardcoded org fallback** (index.html:1590) — if the org lookup returns nothing, the app creates an org literally named "Timmons Foundation" with slug `timmons`, regardless of who is signed in. Any orphaned account triggers this.

---

## 8. Database Schema

### Tables
| Table | Key columns |
|---|---|
| tournaments | id, name, date, location, tournament_city, tournament_state, officials_per_game, pay_per_game, sport, min_rank_level, show_co_officials, is_taxable, scheduling_mode, signup_code, blocks_reviewed, layout_locked, layout_locked_at, invitations_sent_at, courts (**never written**), start_date, end_date, block_size_mode, game_duration_minutes, cancelled_at, cancelled_reason, archived_at, self_schedule_deadline, status *(**no `admin_unlocked`** — that column is on `available_blocks`; corrected Sept 2, 2026)* |
| officials | id, org_id, name, email, phone, home_city, home_state, travel_radius |
| available_blocks | id, tournament_id, block_name, court_first, status, held_by, held_until, officials_needed, game_ids, game_count, pattern, total_pay, start_time, end_time |
| claims | id, tournament_id, block_id, official_id, official_name, official_email, official_phone, status, claimed_at |
| invite_tokens | id, token, official_id, tournament_id, used, expires_at, status, declined_at |
| games | id, tournament_id, court_name, date, start_time |
| availability | id, tournament_id, official_id, official_name, official_email, avail_start, avail_end, max_games, blocked_times, notes |
| assigner_scratches | id, org_id, official_id, reason, created_at — active: per-org "exclude this official" list (roster scratch feature); 0 rows is normal until someone scratches an official |
| tournament_days, official_blocks, schedules | legacy — from the removed Scheduler/Master Schedule/Individual Schedules tabs (nav cleanup, April 11 session); no longer written to by index.html, still referenced only as CASCADE-delete targets in `deleteTournament()`; 0 rows |

### Views
- **v_1099_report** — aggregates confirmed payments by official for tax year reporting

### Travel radius values
- `local` = same city only
- `regional` = same state
- `national` = anywhere
- Filter applied in netlify/functions/send-invites.js

### CASCADE DELETE
All child tables cascade on tournament delete (confirmed April 2026; re-verified Sept 2, 2026 via `information_schema` — `availability`, `available_blocks`, `claims`, `games`, `invite_tokens`, `official_blocks`, `schedules`, `tournament_days` are all `ON DELETE CASCADE` from `tournaments`).

**Correction (Sept 2, 2026):** the long-standing note "no org_id column on `games` or `claims`" was half wrong. `games` **does** have `org_id` — as do `available_blocks` and `availability`. Only **`claims`** lacks it. Filter `claims` by `tournament_id IN (org's tournament IDs)`; the others can be filtered on `org_id` directly.

**Ownership model (confirmed Sept 2, 2026):** games belong to a tournament, and a tournament belongs to an org — `games.tournament_id → tournaments.org_id` is the authoritative path, and it is the one the app actually uses (every games read filters on `tournament_id`; the `org_id` column on `games` is written by `saveGamesToDB` at index.html:5286 and never read — the comment at index.html:1668 even claims the column doesn't exist). The stray `org_id` on `games`, `available_blocks`, `availability` (and legacy `official_blocks`, `schedules`, `tournament_days`) is redundant denormalization: a second source of truth that can silently disagree with the tournament once more than one org exists, because `saveGamesToDB` stamps it from `G.orgId`, which comes from the `LIMIT 1` lookup (section 7). Checked against the pre-wipe data: 107 games and 43 blocks, 0 mismatched, 0 null — but only because there had only ever been one org.

**Rule going forward:** org-scoped entities (`officials`, `assigner_scratches`) carry `org_id`; tournament-scoped entities (`games`, `available_blocks`, `claims`, `invite_tokens`, `availability`) are scoped through `tournament_id` only. `claims` and `invite_tokens` already follow this. Proposed tidy-up: drop `org_id` from the tournament-scoped tables so the tournament is the only thing that says who owns a game.

**`officials.org_id → organizations` is `NO ACTION`, not CASCADE.** An org row cannot be deleted while any official references it — which is why the Timmons Foundation org survives a data reset that keeps officials.

### Brand colors
- Navy: #1B2A4A — Gold: #C9A84C — White: #FFFFFF — Red (full block): #EF4444

---

## 9. Reports Reference

All reports live in the **Reports** tab (`index.html` → `#tab-reports`). Each section uses a pill-tab selector. All queries use the Supabase JS client directly (never sbFetch proxy). All 4 reports have Export CSV buttons.

---

### 9a. 1099 Payments Report

**Purpose:** Tax compliance. Identifies officials who earned enough to require a 1099-NEC filing.

**Data source:** `v_1099_report` Supabase view → aggregates confirmed payments by official per tax year.

**Filters:** `org_id` + `tax_year` (dropdown: current year back 5 years)

**Columns:** Official name · Email · Total Games · Total Pay · 1099 Required (Yes if ≥ $600)

**Totals row:** Sum of all games and total pay across all officials.

**Logic:** Only includes payments from tournaments where `is_taxable = true` and claims where `status = 'confirmed'`. Sorted by total pay descending.

**Export CSV:** `1099_report_YYYY.csv` — columns: Official, Email, Games, Total Pay, Needs 1099

**JS functions:** `run1099Report()`, `export1099Csv()`

**When to run:** End of tax year, or any time you need to know who hit the $600 threshold.

---

### 9b. Staffing Report

**Purpose:** Operations. Shows which tournaments are understaffed so the assigner can take action before game day.

**Data source:** `tournaments` + `available_blocks` (slots needed) + `claims` (slots filled, distinct officials)

**Filters:** All tournaments for the org, ordered newest first.

**Columns:** Tournament name · Date · Games · Total Slots · Slots Filled · Open Slots · Confirmed Officials · % Staffed

**Color coding:** % Staffed badge — green ≥100%, amber ≥50%, red <50%

**Open Slots** column shows in red when > 0.

**Export CSV:** `staffing_report.csv`

**JS functions:** `runStaffingReport()`, `exportStaffingCsv()`

**When to run:** Weekly during signup period; daily in the 48 hours before a tournament.

---

### 9c. Official Activity Report

**Purpose:** Per-official earnings and workload summary across all tournaments. Useful for pay verification and workload balancing.

**Data source:** `tournaments` (pay_per_game) + `claims` (confirmed, by official) + `available_blocks` (game_count per block)

**Filters:** All confirmed claims across all org tournaments.

**Columns:** Rank · Official · Email · Tournaments worked · Total Games · Est. Pay

**Est. Pay** = sum of (game_count × pay_per_game) for each confirmed block.

Sorted by estimated pay descending.

**Export CSV:** `official_activity_report.csv`

**JS functions:** `runActivityReport()`, `exportActivityCsv()`

**When to run:** After each tournament to verify earnings; before season-end for 1099 prep.

---

### 9d. Payout Summary Report

**Purpose:** Budget tracking. Shows total estimated payout per tournament so the assigner knows what they owe before writing checks.

**Data source:** `tournaments` (pay_per_game) + `claims` (confirmed) + `available_blocks` (game_count)

**Filters:** All org tournaments, ordered newest first.

**Columns:** Tournament · Date · $/Game · Confirmed Officials · Games Assigned · Est. Payout

**Grand total row:** Sum of all estimated payouts across all tournaments.

**Est. Payout** per tournament = sum of (game_count × pay_per_game) for all confirmed claims on that tournament.

**Export CSV:** `payout_summary.csv`

**JS functions:** `runPayoutsReport()`, `exportPayoutsCsv()`

**When to run:** 1–2 days before a tournament to know the exact payout; after tournament to reconcile.

---

### 9e. Shared Reporting Notes

- `_rptData` global object holds last-run data for each section (`_rptData['1099']`, `.staffing`, `.activity`, `.payouts`) — used by export functions.
- `showReport(name)` switches the active pill tab and shows/hides sections.
- `_dlCsv(csv, filename)` shared CSV download helper.
- `initReportYearSelector()` populates the 1099 year dropdown (current year − 5); called by `gotoTab('reports')`.
- CSS alert class for errors is `.alert-err` (not `.alert-error`) — match this in any new report error HTML.

---

## 10. Stack & Environment

### Stack
- **Frontend**: Vanilla HTML/CSS/JS — no framework
- **Hosting**: Netlify (auto-deploys from GitHub `main` branch)
- **Database**: Supabase Postgres — project ID: `mqbxqtsnfzcmmzpbrxnx`
- **Email**: Resend (domain: thetimmonsfoundation.org)
- **SMS**: Twilio — blocked by A2P 10DLC, upgrade needed
- **Repo**: github.com/mtimmons1227/stripeup
- **Live URL**: https://officials-scheduler.netlify.app

### Key files
- `index.html` — assigner dashboard (tournaments, officials, scheduler, reports)
- `self-schedule.html` — official self-scheduling page (token-based, no login)
- `netlify/functions/send-invites.js` — email + SMS invites, token generation
- `netlify.toml` — Netlify build config
- `register.html`, `signup.html` — official registration
- `tests/automated.spec.js` — Playwright test suite (6 checks)
- `playwright.config.js` — Playwright config (Chromium, 60s timeout)

### ⚠️ Critical: Netlify proxy drops query strings
`sbFetch()` routes through `/.netlify/functions/supabase-proxy` which **strips query string params** from PATCH/DELETE requests. This means any write with a WHERE clause arrives at Supabase without a filter → "UPDATE/DELETE requires a WHERE clause" error.

**Rule**: Any Supabase write (insert, update, delete) that needs a WHERE clause MUST use the Supabase JS client directly:
```js
// CORRECT
supabase.from('tournaments').update(data).eq('id', tid)
supabase.from('tournaments').insert(data)
supabase.from('available_blocks').delete().eq('tournament_id', tid)

// BROKEN — proxy strips the ?id=eq.X
sbFetch('/rest/v1/tournaments?id=eq.' + tid, { method: 'PATCH', ... })
```

### ⚠️ Critical: games and claims tables have no org_id column
Filter by `tournament_id IN (list of org's tournament IDs)` — never by org_id directly on these tables. `updateNavCounts()` already does this correctly.

### ⚠️ Critical: Supabase tooling row counts can be stale — don't trust them for "is the DB empty" checks
On Sept 2, 2026, `list_tables` (and the dashboard's row estimate) reported 0 rows on every table except `organizations` (1), which looked like the whole dataset had been wiped. It hadn't — those figures come from cached Postgres planner statistics (`pg_class.reltuples`), not a live count. A direct query (`SELECT COUNT(*) FROM officials`, etc.) showed the real numbers: 88 officials, 2 tournaments, 107 games, 43 available_blocks, 4 claims, 8 invite_tokens — all intact on the correct, active project (`mqbxqtsnfzcmmzpbrxnx`). **Rule**: to check whether data actually exists, run `execute_sql` with real `COUNT(*)` queries, never rely on `list_tables`'s row-count column.

### Environment Variables (Netlify dashboard)
- `SUPABASE_URL` — https://mqbxqtsnfzcmmzpbrxnx.supabase.co
- `SUPABASE_ANON_KEY` — public anon key (also in index.html as publishable key — safe)
- `RESEND_API_KEY` — for send-invites.js
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` — SMS (blocked until A2P)

---

## 11. Test Officials

- **Marvin Timmons** — marv_timmons@yahoo.com — Dallas TX — regional
- **Erick Strickland** — marvin@thetimmonsfoundation.org — Dallas TX — regional
- **Latanya Martin** — marvin.timmons@theavhfoundation.org — Dallas TX — regional

### Org
- Name: Timmons Foundation
- Org ID: `2270e1d1-a485-4176-9cd4-c7046c1772fa` *(corrected Sept 2, 2026 — the previously documented `996a40a8-…` does not exist; the current row was created 2026-06-07)*
- This is the **only** org and Marvin is the **only** auth user as of the Sept 2 reset.

### Email filtering note
84 of the 88 officials have test-pattern emails (`test@*`, `test\d*@`) that are filtered out by `send-invites.js`; 4 do not. Only the real officials above receive actual emails, and all of them are Marvin's own addresses — so a "successful" invite send proves the send path, not multi-recipient behaviour. The recipient count display reflects the filtering.

---

## 12. Phase 2 Notes

- **RLS policies** — written (`rls-policies.sql`, `RLS-README.md`, drafted April 2026) but never applied; all 12 public tables still have RLS disabled, fully exposed to the anon key. **Reviewed Sept 2, 2026 against the live DB — do NOT apply as-is; it would be a same-day outage, not a hardening step:**
  - Every assigner policy tests `auth.jwt() ->> 'org_id'`. Neither auth user has that claim (`raw_app_meta_data` is just `{provider, providers}`) and there is no auth hook to inject one, so the condition is NULL → false for every assigner. Result: locked out of your own tournaments and officials.
  - Official policies test `auth.uid()`, but `self-schedule.html` is token-based with no Supabase session — always NULL. Self-schedule goes dark. The token-based fallbacks test `auth.jwt() ->> 'token'`, which has the same missing-claim problem.
  - `officials.id` has no relationship to `auth.users.id` — verified join returns **0 of 88 matching**. `officials_manage_self` and `officials_manage_own_claims` have never been capable of matching a row.
  - Only 6 of 12 tables get RLS enabled; `organizations`, `assigner_scratches`, `tournament_days`, `official_blocks`, `schedules` stay open.
  - **Root cause is architectural, not textual:** the file assumes a JWT-claims tenancy model the app doesn't implement, and the schema has no user→org link to key correct policies off (see section 7). Fix tenancy first, then rewrite policies using a `SECURITY DEFINER` function that resolves org from `auth.uid()`. The officials/token half should move server-side into the Netlify functions using the service key — there is no sound way to prove "I hold a valid token" at the RLS layer from the browser.
- **Payment system (Stripe)** — Phase 3, not started
- **Official-facing 1099** — officials see their own YTD earnings summary
- **Court-level rank override** — per-court minimum rank settings
- **Auto-release holds** — cron job to expire held blocks after timeout

---

## 13. Auto-update Instructions

After ANY task, Claude Code must:
1. Add an entry to **Recent Changes Log** (section 3) with today's date and file changed
2. Update **What's Working** (section 4) with newly confirmed items
3. Move items between sections 5/6/7 as status changes
4. Add new bugs to **Known Issues** (section 7)
5. Update **Database Schema** (section 8) if columns/tables changed
6. Commit this file with message: `docs: update CLAUDE.md`

Never delete old entries from the Recent Changes Log — it is cumulative.
