# Spec — Platform-Wide Officials & Cross-Org Scheduling

**Status:** Draft for review
**Date:** September 2, 2026
**Owner:** Marvin Timmons
**Depends on:** Tenancy fix (`org_members`) — see CLAUDE.md §7

---

## Problem Statement

StripeUp's marketing promises "platform-wide official pools that work across multiple assigners and tournaments," but the database binds every official to exactly one organization via `officials.org_id`. An official recruited by Assigner 1 is invisible to Assigner 2, so the same person must be re-recruited off-platform — which is the exact friction the product exists to remove.

Worse, the schema already contradicts itself: `officials` carries a **globally unique** constraint on `email` (`officials_email_unique`). A second assigner attempting to add an official who already exists anywhere on the platform gets a duplicate-key failure with no explanation. Today the platform can neither share officials nor let two orgs hold separate copies of one.

Meanwhile there is no representation of *when* a booking happens. A `claims` row records tournament, block, official and status — but no time. Nothing in the system can detect that an official has committed to two tournaments at once, and no such check exists anywhere in the codebase.

---

## Goals

1. **One human, one record.** An official exists once on the platform and can be booked by any org, without duplicate rows.
2. **Same-day multi-org work is possible.** An official can work Assigner 1's morning tournament and Assigner 2's afternoon tournament on the same day.
3. **Physically impossible bookings cannot be created.** Overlapping commitments are rejected by the database, not merely hidden in a UI.
4. **Travel time is respected.** Two non-overlapping assignments too close together to physically reach are refused or flagged.
5. **Cross-org correctness survives concurrency.** Two assigners booking the same official simultaneously cannot both succeed.

---

## Non-Goals

- **Route optimization / travel-time APIs.** V1 uses configurable buffers, not live traffic. Real distance calculation is P2.
- **Officials choosing which orgs may see them.** Privacy controls over roster visibility are a separate initiative (see Open Questions).
- **Pay reconciliation across orgs.** Each org pays independently; consolidated 1099 across orgs is Phase 2.
- **Replacing the intra-tournament rest rules.** W2/W3 rest logic in `self-schedule.html` addresses workload recovery, which is a different concern from physical travel feasibility. Both stay.
- **Retroactive conflict cleanup.** The constraint applies going forward; historical claims are not audited.

---

## User Stories

**Officials**

- As an official, I want to accept assignments from multiple assigners so that I can fill my day and maximize earnings.
- As an official, I want a tournament I've already committed to elsewhere to be unavailable when I self-schedule, so that I never accidentally double-book myself.
- As an official, I want blocks that I couldn't physically reach in time to be shown as unavailable, so that I don't accept work I'd have to cancel.
- As an official, I want to mark personal unavailability so assigners don't invite me when I'm not free.

**Assigners**

- As an assigner, I want to see officials in my market regardless of who recruited them, so that I can staff tournaments from the full talent pool.
- As an assigner, I want to know when an official I've invited is already booked elsewhere, so that I can invite someone else instead of waiting on a response that will never come.
- As an assigner, I want a confirmed booking to be genuinely mine, so that another assigner cannot take the same official for the same window.

**Edge cases**

- As an assigner, I want a clear message when a booking is refused for a conflict, so I understand it isn't a system error.
- As an official, I want to release an assignment and have that time immediately become bookable again.

---

## Recommended Model

### The core idea: a single commitment ledger

Rather than teaching every booking path to check every other booking path, introduce **one table that answers the single question "is this official busy?"** — regardless of which org, which tournament, or whether the block came from StripeUp at all.

```
officials ──< official_commitments >── claims
                     │
                     └── (claim_id NULL = personal blackout)
```

Every confirmed claim writes a commitment. Personal unavailability writes a commitment with no claim. Availability checks read one table. Conflict prevention is one constraint.

This is what makes the cross-org case tractable: Assigner 2's booking attempt doesn't need to know Assigner 1 exists — it only needs the ledger.

### Schema

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE official_commitments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  official_id    uuid NOT NULL REFERENCES officials(id) ON DELETE CASCADE,
  claim_id       uuid REFERENCES claims(id) ON DELETE CASCADE,
  source         text NOT NULL CHECK (source IN ('claim','blackout')),
  tournament_id  uuid REFERENCES tournaments(id) ON DELETE CASCADE,
  venue_key      text,                    -- normalized location for travel calc
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  span           tstzrange NOT NULL,      -- maintained by trigger, see note
  created_at     timestamptz DEFAULT now(),

  CONSTRAINT commitment_time_valid CHECK (ends_at > starts_at),

  CONSTRAINT no_overlapping_commitments
    EXCLUDE USING gist (official_id WITH =, span WITH &&)
);
```

**Implementation note — why `span` is trigger-maintained, not generated.** A `GENERATED ALWAYS AS` column requires an IMMUTABLE expression, and `timestamptz ± interval` is only STABLE in Postgres (it depends on the session time zone for DST arithmetic). A `BEFORE INSERT OR UPDATE` trigger setting `NEW.span := tstzrange(NEW.starts_at, NEW.ends_at, '[)')` is the correct approach. Attempting a generated column here will fail at migration time.

### Two layers of protection

**Layer 1 — the exclusion constraint (hard, race-proof).** Rejects any true overlap for the same official. This is enforced by the database at commit time, so two assigners inserting concurrently cannot both win: one transaction succeeds, the other raises `23P01 exclusion_violation`. This is the layer that makes cross-org booking safe, and it cannot be replicated in application code.

**Layer 2 — a travel-feasibility trigger (softer, pair-aware).** Overlap is not the only impossible booking. Two assignments 20 minutes apart in different cities don't overlap but still can't both be worked. On insert, a trigger looks at the official's neighbouring commitments that day and checks the gap against the required travel time between the two venues:

```
required_gap(A, B) =
  0 min                if venue_key(A) = venue_key(B)
  30 min               same city, different venue
  90 min               different city, same state
  block entirely       different state (v1 assumption; overridable)
```

These values live in a small configuration table so they can be tuned without a migration.

**Why two layers rather than one.** The exclusion constraint can only compare the two rows' own stored ranges — it cannot know that venue A and venue B are 40 miles apart, because that fact belongs to the *pair*, not to either row. Padding each row by half a fixed buffer would work for a uniform rule but would wrongly block back-to-back blocks at the same venue. Splitting the concerns gives an absolute guarantee against overlap plus tunable judgment about travel.

### Walking the scenario

> *Official A is invited by Assigner 1 and Assigner 2 for two different tournaments on the same day.*

1. **Assigner 1's tournament**, PSA McKinney, blocks 08:00–12:00. Official A confirms. Two rows are written: the `claims` rows, and a commitment `[2026-07-04 08:00, 2026-07-04 12:00)` with `venue_key = 'psa-mckinney'`.
2. **Assigner 2's tournament**, Plano Sportsplex, blocks 14:00–18:00. Official A opens the self-schedule link. The grid queries `official_commitments` for that day, finds the morning commitment, and evaluates each block:
   - 13:00 block → gap from 12:00 is 60 min; different venue, same city → requires 30 min → **selectable**.
   - 12:30 block → gap 30 min; same city → requires 30 min → **selectable, flagged tight**.
   - 12:15 block → gap 15 min → **shown greyed, "Not enough travel time from your 08:00–12:00 assignment"**.
   - 11:00 block → overlaps → **greyed, "You're already booked"**.
3. Official A confirms 14:00–18:00. A second commitment is written. Both assignments stand, neither assigner sees the other's tournament, and the day is legitimately double-booked in the good sense.

### Making officials platform-wide

The migration is mostly subtraction, because the unique-email constraint already assumes one global record per person:

```sql
-- officials.imported_by already exists and is the correct "who added them" column
ALTER TABLE officials DROP COLUMN org_id;
```

What `org_id` was silently doing — defining each assigner's visible roster — moves to an explicit pool:

```sql
CREATE TABLE org_official_pool (
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  official_id uuid NOT NULL REFERENCES officials(id) ON DELETE CASCADE,
  added_at    timestamptz DEFAULT now(),
  added_by    uuid,
  PRIMARY KEY (org_id, official_id)
);
```

Backfill: every current official joins Timmons Foundation's pool. Assigners then grow their pool by invitation or by discovering officials in their market.

---

## Requirements

### Must-Have (P0)

**P0.1 — Tournament timezone**
`tournaments` gains a `timezone` column (IANA identifier, e.g. `America/Chicago`). Without it, no clock time can be resolved to a `timestamptz` and every downstream calculation is wrong.

- [ ] Column added, `NOT NULL`, defaulting existing rows to `America/Chicago`
- [ ] New Tournament form captures it; defaults to the creating org's timezone
- [ ] Given a tournament in `America/Chicago` at 08:00, when a commitment is computed, then `starts_at` is `13:00Z` (CDT) — not `08:00Z`

**P0.2 — Typed clock times**
`available_blocks.start_time` / `end_time` and `tournaments.start_time` / `end_time` are `text` today. Convert to `time`.

- [ ] Migration converts existing values, failing loudly on unparseable rows
- [ ] CSV import writes typed values

**P0.3 — Commitment ledger**
Table, trigger and exclusion constraint as specified above.

- [ ] Confirming a claim writes exactly one commitment per block
- [ ] Releasing or declining a claim removes its commitment
- [ ] Given an official with a commitment 08:00–12:00, when any org attempts to insert an overlapping commitment, then the insert fails with `23P01`
- [ ] Given two assigners inserting overlapping commitments concurrently, then exactly one succeeds

**P0.4 — Travel feasibility check**
Trigger comparing new commitments against same-day neighbours using the venue rules above.

- [ ] Same venue, back-to-back → allowed
- [ ] Different venue, same city, 30+ min gap → allowed
- [ ] Different venue, same city, under 30 min gap → rejected with a human-readable message
- [ ] Buffer values are configuration, not hardcoded

**P0.5 — Officials go platform-wide**
Drop `officials.org_id`; introduce `org_official_pool`; backfill.

- [ ] Roster and invite-eligibility queries read the pool, not `org_id`
- [ ] An official already on the platform can be added to a second org's pool without a duplicate-key error
- [ ] Given an official in two pools, when either assigner views their roster, then the official appears in both

**P0.6 — Self-schedule respects the ledger**
The block grid greys out blocks that conflict with commitments from *any* org.

- [ ] Overlapping blocks greyed, labelled "You're already booked"
- [ ] Insufficient-travel blocks greyed, labelled with the conflicting assignment's time
- [ ] The conflicting tournament's *name and org* are **not** disclosed — only the time window (see Open Questions)

### Nice-to-Have (P1)

**P1.1 — Personal blackouts.** Officials mark themselves unavailable; writes a `source='blackout'` commitment and flows through the same constraint.

**P1.2 — Venue table.** Replace free-text `location` matching with `venues (id, name, city, state, lat, lng)`. `venue_key` string comparison is fragile — "PSA McKinney" vs "PSA - McKinney" read as different venues and over-restrict.

**P1.3 — Assigner conflict visibility.** In View Responses, show invited officials already committed elsewhere in that window, so the assigner can re-invite immediately rather than waiting on a response that cannot come.

**P1.4 — Hold-aware conflicts.** Decide whether an unconfirmed hold blocks other orgs (see Open Questions), and if so write provisional commitments with `held_until`.

### Future Considerations (P2)

**P2.1 — Distance-based travel.** Real driving time from lat/lng, replacing the city/state tiers.

**P2.2 — Cross-org earnings view.** An official's consolidated YTD across all orgs — enabled by the single-record model, and a natural premium feature.

**P2.3 — Talent-density signals.** With one global roster and real commitment data, the "verified talent report" concept in the project brief becomes computable.

---

## Success Metrics

**Leading (first 30 days)**

- **Double-booking incidents: 0.** Measured by scanning for overlapping commitments per official. This is a correctness target, not a trend — any non-zero value is a bug.
- **Cross-org officials:** ≥ 15% of active officials appear in more than one org pool. Stretch: 30%.
- **Conflict-rejection rate:** 2–8% of self-schedule confirmations hit a conflict. Near zero suggests the check isn't firing; above 15% suggests buffers are too aggressive.
- **Roster growth for a second org:** a newly onboarded assigner can reach 20+ eligible officials on day one without importing a CSV.

**Lagging (one quarter)**

- **Fill rate:** % of slots staffed at tournament start, versus the pre-change baseline. Hypothesis: a larger pool raises fill rate.
- **Time-to-full-staffing:** days from invitations sent to 100% staffed. Expected to fall.
- **Same-day multi-org rate:** % of working officials with two or more assignments in one day — the direct measure of whether the feature is used.
- **Cancellation rate:** should *fall*, since impossible bookings can no longer be made and then abandoned.

---

## Open Questions

**Blocking — needed before implementation**

1. **Pool visibility model.** Can an assigner see and invite *any* official on the platform, or only officials in their pool, where the pool grows by invitation acceptance? This determines whether officials need consent before appearing in a stranger's roster, and it has direct revenue implications for the "Verified Official" marketplace concept. *Recommendation: pool-based with market discovery — assigners search by city/state/rank and send invitations; accepting an invitation adds the official to that pool.* — **Marvin / product**

2. **Do holds block across orgs?** If only confirmed claims write commitments, two assigners can both hold the same official and one gets a late surprise. If holds block, an abandoned hold locks an official out until expiry — and `self-schedule.html` currently releases *all* holds on page load (line 386), which would need fixing first. — **Engineering**

3. **Contact-detail visibility.** Once officials are global, does every assigner see every official's email and phone, or only those in their pool? This is a privacy decision that RLS will encode. *Recommendation: contact details restricted to orgs holding a pool membership.* — **Marvin / legal**

**Non-blocking — resolvable during implementation**

4. **Cross-state default.** V1 blocks same-day assignments in different states. Is that right for the DFW metro, which spans no state line, versus markets that do? — **Marvin**

5. **Conflict message disclosure.** Telling an official "you're booked 08:00–12:00" is useful; naming the other org's tournament leaks competitive information between assigners. Confirm the time-only wording. — **Product**

6. **What happens to an existing conflicting claim** if a tournament's date or times are edited after officials confirm? — **Engineering**

---

## Timeline & Phasing

This cannot ship as one change. Suggested order, each phase independently shippable:

**Phase 0 — Tenancy (prerequisite, not in this spec).**
`org_members`, org resolution by `auth.uid()`, fix `loadOrgAndShow()`. Nothing here is safe to build until "which org am I" has a correct answer — the current `LIMIT 1` lookup would assign commitments to the wrong org.

**Phase 1 — Time becomes real.**
Timezone column, typed clock times, commitment ledger, exclusion constraint. No user-visible change; conflicts become *detectable*. Backfill commitments from existing confirmed claims.

**Phase 2 — Officials go global.**
Drop `org_id`, add `org_official_pool`, backfill, rewire roster and eligibility queries.

**Phase 3 — Conflicts become visible.**
Self-schedule greys out conflicting blocks; travel trigger enabled; assigner-side conflict indicators.

**Phase 4 — RLS.**
Only now can policies be written correctly: pool membership defines official visibility, `org_members` defines tournament access, and the token path moves server-side. Attempting RLS before Phase 2 would encode the single-tenant assumption into the security layer.

**Dependency note:** Phase 1 must precede Phase 2. If officials go global while commitments don't exist, an official can be booked by two orgs simultaneously with nothing to stop it — strictly worse than today, where org isolation accidentally prevents it.
