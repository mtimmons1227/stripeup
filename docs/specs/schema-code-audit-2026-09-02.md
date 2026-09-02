# Schema ↔ Code Audit — September 2, 2026

Systematic sweep for places where the database schema and the application code disagree. Method: cross-reference every column in the live `public` schema against every reference in `index.html`, `self-schedule.html`, `signup.html` and `netlify/functions/send-invites.js`, plus constraint/index/FK analysis in Postgres.

Every finding below is line-verified. Two candidate findings were discarded as false positives (noted at the end).

---

## Critical — silent failures in production

### C1. The 1099 report can never return a row

`v_1099_report` filters on `c.pay_amount > 0`:

```sql
WHERE t.is_taxable = true AND c.status = 'confirmed' AND c.pay_amount > 0
```

**`claims.pay_amount` is never written.** Zero occurrences of the string `pay_amount` in `index.html` or `self-schedule.html`. Both claim-insert paths (`self-schedule.html:995`, `index.html:5873`) omit it, so it takes its column default. All four pre-wipe claims carried `pay_amount = 0`.

The 1099 Payments report — the tax-compliance feature — is structurally incapable of returning data. It has presumably always shown an empty table, and that would have been read as "nobody hit $600 yet."

**Fix:** write `pay_amount` at claim time (`block.game_count × tournament.pay_per_game`), or change the view to compute pay by joining `available_blocks` and `tournaments` rather than trusting a denormalized column nothing populates. The second is better — it's the same "second source of truth" problem as `games.org_id`.

### C2. Scratching an official silently does nothing

`index.html:5458` POSTs to `assigner_scratches` with a `notify_official` field. That column does not exist (`id, org_id, official_id, reason, scratched_by, created_at, restored_at, restored_by`). PostgREST rejects the entire insert with a 400.

The `.then()` at 5461 never checks `r.ok` — it unconditionally closes the modal and reloads the roster. The assigner sees a success path. **No scratch row is ever written.** An official you deliberately excluded stays fully eligible and will be invited again.

**FIXED (Sept 2, 2026)** — `notify_official` removed from the payload and an `r.ok` check added that surfaces the PostgREST error instead of reporting success.

### C3. `availability.official_id` is never populated

Read at `index.html:3364, 5093, 6217`, but no insert writes it — not `signup.html:262/290`, not `index.html:4577`. Always null.

The scheduler compensates by generating synthetic IDs (`'O001'`…), which permanently severs the link between an availability submission and the real `officials` row. Any feature that needs "what did this official tell us about their availability" cannot work.

**Relevant to the spec:** the commitment ledger keys on `official_id`. This must be fixed before availability data can feed it.

---

## High — data quietly wrong

### H1. Re-saving blocks destroys `officials_needed` and halves `total_pay`

`brSaveBlocksDB` (`index.html:2866-2874`) builds its row objects without `officials_needed`, and computes `total_pay: blk.game_ids.length * pay` — omitting the `× officials_per_game` factor that `calculateBlocks` applies (added June 7).

So blocks created by CSV import are correct; the same blocks re-saved from the Review Blocks editor come back with `officials_needed = NULL` and half the pay for 2-official games.

Worse, the read sites disagree on the fallback. `index.html:1725, 1818, 3150, 3165, 3216` use `parseInt(...) || 1`, but `2025, 2030, 4363` use `|| 0`. So after a re-save, the dashboard's slot totals and revenue estimate count those blocks as **zero slots and zero dollars**, while the block grid treats them as one slot. The two halves of the UI disagree about the same tournament.

### H2. Two roster columns are written but never selected back

- `officials.rank_notes` — written at `5505`, read at `5490`, but the `selectCols` list at `4594` omits it. The rank-notes field is always blank when reopened.
- `officials.travel_radius` — rendered at `4732` as `o.travel_radius || 'national'`, but `4594` omits it too. **Every roster row displays "national" regardless of the stored value** — and travel radius is a live filter in `send-invites.js`. The roster shows one thing; the invite logic does another.

### H3. `tournaments.courts` is never written

No insert (`index.html:3007-3018`) or update (`2285-2298`) writes it. Rendered unguarded at `index.html:2108` and — on the official-facing page — `self-schedule.html:453` and `472` as `T.courts + ' courts'`.

Officials see `null courts` on the tournament banner.

---

## Systemic

### S1. Nineteen foreign key columns have no supporting index

19 FK columns lack a covering index (`claims.tournament_id` and `claims.official_id` already had one): `claims.block_id`, `games.tournament_id`, `available_blocks.tournament_id`, `officials.org_id`, `availability.*`, and the rest.

Consequences: every `.eq('tournament_id', tid)` is a sequential scan, and every `DELETE FROM tournaments` scans all eight child tables end-to-end. At 107 games this is invisible. At 10,000 it is not, and cascade deletes are where it bites first.

This also matters directly for the spec: the commitment ledger's exclusion constraint creates a GiST index, but `official_commitments.official_id` lookups and the travel-check trigger's same-day neighbour query both need their own indexes or the check runs on every confirmation at full-table cost.

**FIXED (Sept 2, 2026)** — migration `add_missing_foreign_key_indexes` created all 19. Confirmed independently by Supabase's performance advisor before and after.

### S2. Three incompatible representations of time

- `available_blocks.start_time` / `end_time` — `text`
- `tournaments.start_time` / `end_time` — `text`
- `games.time_slot` — `text`
- `official_blocks.block_start_min` / `block_end_min` — `integer` (minutes past midnight)
- No timezone column anywhere in the schema

The integer-minutes pair in `official_blocks` is a fourth convention, from the removed Scheduler tab. This is P0.1/P0.2 in the spec.

### S3. Write-only columns (dead denormalization)

Written, never read: `games.org_id` (5286), `available_blocks.org_id` (2866, 5225), `availability.org_id` (signup.html:263/290, index.html:4577), `officials.profile_complete` (4823, 4879, 4962), `officials.market` (hardcoded `'DFW'` at 4821, 4879).

Never referenced at all: `officials.imported_by`, `officials.pro_subscriber`, `claims.accept_token`, `claims.expires_at`, `assigner_scratches.restored_at`/`restored_by` (the restore path hard-deletes instead), `tournaments.cancelled_at`/`cancelled_reason` (cancel sets only `status`), `tournaments.block_size_mode`, `game_duration_minutes`, `layout_locked_at`, `available_blocks.tournament_day_id`, `min_rank_level`, `sort_order`, `deleted_at`, `admin_unlocked_at`, `admin_unlocked_by`.

`games.court_name` is neither written nor read — the CSV importer folds it into `court` at `3471-3472`.

Note `officials.imported_by` is the column the spec proposes to keep when `org_id` is dropped. It is currently unused, so adopting it costs nothing.

### S4. Duplicate representations of the same fact

- **`officials.sport` vs `officials.sports`** — both written with identical values (`4818/4819`, `4875/4876`, `4956/4957`). Reads split: `4668` uses `o.sport`; `4683` uses `o.sport || o.sports`.
- **`tournaments.date` vs `start_date`** — the edit path writes both (`2287-2288`), the create path writes only `date` (`3025`). Every reader defends with `t.date || t.start_date`.
- **`games.court` vs `court_name`** — `court_name` is the CSV header, `court` is the column; reconciled client-side at `3444, 3471`.
- **`available_blocks.total_pay`** is persisted but every consumer recomputes it from `pay_per_game` (`2557, 2628` comment: "always recalc from live pay"; `self-schedule.html:793, 1050-1067`). The stored value is decorative — and per H1, wrong after a re-save.

### S5. Comments that contradict the schema

- `index.html:1668` — "games table has no org_id column." False; `5286` writes it.
- `index.html:4593` — "rank_level may not be there yet." It exists.
- `index.html:4606` — "assigner_scratches may not exist yet." It exists.
- `self-schedule.html:561` — "tournament_day_id doesn't exist on available_blocks." False; the column exists.
- `index.html:1688` — "claims has no org_id column." **Correct.** Not a finding.

These are defensive comments from a period when the schema was uncertain. They now actively misinform — `1668` is what caused `games.org_id` to go unused.

---

## False positives (checked and dismissed)

- **`tournament_days` "does not exist"** — it does. Artifact of an incomplete table list in the audit brief.
- **`v_1099_report` / `tax_year` / `total_games` "do not exist"** — the view exists with exactly those columns. Same cause. (The report is nonetheless broken, for the different reason in C1.)
- **`tournaments.admin_unlocked`** — the code correctly writes only `available_blocks.admin_unlocked`. The error is in `CLAUDE.md:335`, which lists the column under `tournaments`. Documentation bug, not a code bug.

---

## Suggested order

1. **C2** — one-line fix, stops a feature that silently does nothing.
2. **C1** — decide compute-vs-store for claim pay; unblocks tax compliance.
3. **H2** — two column names in a `select` list; fixes a misleading roster.
4. **H1** — align `brSaveBlocksDB` with `calculateBlocks`; reconcile the `|| 0` vs `|| 1` fallbacks.
5. **S1** — 19 `CREATE INDEX CONCURRENTLY` statements, no code change.
6. **C3 + S2** — fold into spec Phase 1, since the commitment ledger depends on both.
7. **S3/S4/S5** — cleanup, safe to batch with the Phase 2 migration.
