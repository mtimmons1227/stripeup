# StripeUp — Claude Code Project Memory

This file is the single source of truth. Read it first. Update it last.

---

## 1. Current Status

**As of June 7, 2026** — CSV game import now filters rows by tournament date, so a multi-day CSV file will only load the games matching the specific tournament's date. A combined 2-day PSA Summer Jam schedule CSV (July 4-5, 2026, 5 courts, 11 slots/day) has been generated in game-exports/. GitHub repo migrated to mtimmons1227/stripeup; Netlify reconnected. DNS issue with AT&T ISP resolved via Google Public DNS in Chrome/Edge. Signup auth bug fixed (was routing through proxy instead of Supabase JS client directly).

The next milestone is a full browser test of the self-schedule flow from invite link to confirmed games, and adding travel radius UI fields to the Officials roster table.

---

## 2. Next Test Plan

1. **Full self-schedule flow** — invite → official opens link → picks blocks → confirms → assigner sees in View Responses / Confirmed Officials modal
2. **Confirmed Officials modal** — verify court grouping, empty slot rows, game count per block
3. **Demo Mode** — toggle on, send invitations (no real emails), Simulate Responses populates confirmed officials modal
4. **Send Reminders dialog** — open Send Invitations on already-sent tournament → confirm dialog shows correct pending count
5. **Travel radius UI** — add home_city / home_state / travel_radius fields to Officials roster table

---

## 3. Recent Changes Log

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

### UI / UX
- Nav bar pills scoped to org's active tournaments — games and confirmed counts clear to 0 when all tournaments deleted
- `showToast()` helper for non-blocking status feedback
- show_co_officials toggle working
- Schedule status badge always visible (inline-block from initial HTML)
- Mobile optimization on self-schedule.html

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
- Reports tab 1099 Report UI
- Official-facing 1099 earnings view (Phase 2)
- Court-level rank override UI
- Auto-release cron job for expired holds
- RLS policies (must enable before public launch)
- Payment system / Stripe (Phase 3)

---

## 7. Known Issues ❌

- DEV bar still visible in production (should be hidden)
- SMS blocked — Twilio A2P 10DLC upgrade required

---

## 8. Database Schema

### Tables
| Table | Key columns |
|---|---|
| tournaments | id, name, date, location, tournament_city, tournament_state, officials_per_game, pay_per_game, sport, min_rank_level, show_co_officials, is_taxable, scheduling_mode, signup_code, blocks_reviewed, layout_locked, invitations_sent_at, admin_unlocked |
| officials | id, org_id, name, email, phone, home_city, home_state, travel_radius |
| available_blocks | id, tournament_id, block_name, court_first, status, held_by, held_until, officials_needed, game_ids, game_count, pattern, total_pay, start_time, end_time |
| claims | id, tournament_id, block_id, official_id, official_name, official_email, official_phone, status, claimed_at |
| invite_tokens | id, token, official_id, tournament_id, used, expires_at, status, declined_at |
| games | id, tournament_id, court_name, date, start_time |
| availability | id, tournament_id, official_id, official_name, official_email, avail_start, avail_end, max_games, blocked_times, notes |

### Views
- **v_1099_report** — aggregates confirmed payments by official for tax year reporting

### Travel radius values
- `local` = same city only
- `regional` = same state
- `national` = anywhere
- Filter applied in netlify/functions/send-invites.js

### CASCADE DELETE
All child tables cascade on tournament delete (confirmed April 2026). No org_id column on `games` or `claims` — always filter by `tournament_id IN (org's tournament IDs)`.

### Brand colors
- Navy: #1B2A4A — Gold: #C9A84C — White: #FFFFFF — Red (full block): #EF4444

---

## 9. Stack & Environment

### Stack
- **Frontend**: Vanilla HTML/CSS/JS — no framework
- **Hosting**: Netlify (auto-deploys from GitHub `main` branch)
- **Database**: Supabase Postgres — project ID: `mqbxqtsnfzcmmzpbrxnx`
- **Email**: Resend (domain: thetimmonsfoundation.org)
- **SMS**: Twilio — blocked by A2P 10DLC, upgrade needed
- **Repo**: github.com/gridironiq/stripeup
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

### Environment Variables (Netlify dashboard)
- `SUPABASE_URL` — https://mqbxqtsnfzcmmzpbrxnx.supabase.co
- `SUPABASE_ANON_KEY` — public anon key (also in index.html as publishable key — safe)
- `RESEND_API_KEY` — for send-invites.js
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` — SMS (blocked until A2P)

---

## 10. Test Officials

- **Marvin Timmons** — marv_timmons@yahoo.com — Dallas TX — regional
- **Erick Strickland** — marvin@thetimmonsfoundation.org — Dallas TX — regional
- **Latanya Martin** — marvin.timmons@theavhfoundation.org — Dallas TX — regional

### Org
- Name: Timmons Foundation
- Org ID: `996a40a8-eab7-4c03-9c25-a834296c99f6`

### Email filtering note
84 of 87 officials have test-pattern emails (`test@*`, `test\d*@`) that are filtered out by `send-invites.js`. Only the 3 real officials above receive actual emails. The recipient count display now correctly reflects this (shows ~3 when all 3 are already confirmed, not 87).

---

## 11. Phase 2 Notes

- **RLS policies** — currently disabled; must enable before public launch
- **Payment system (Stripe)** — Phase 3, not started
- **Official-facing 1099** — officials see their own YTD earnings summary
- **Court-level rank override** — per-court minimum rank settings
- **Auto-release holds** — cron job to expire held blocks after timeout

---

## 12. Auto-update Instructions

After ANY task, Claude Code must:
1. Add an entry to **Recent Changes Log** (section 3) with today's date and file changed
2. Update **What's Working** (section 4) with newly confirmed items
3. Move items between sections 5/6/7 as status changes
4. Add new bugs to **Known Issues** (section 7)
5. Update **Database Schema** (section 8) if columns/tables changed
6. Commit this file with message: `docs: update CLAUDE.md`

Never delete old entries from the Recent Changes Log — it is cumulative.
