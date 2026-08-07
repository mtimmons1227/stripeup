# Phase 2 — Analysis
**Also known as (AI-era): Requirements & Feasibility Analysis**
**Status: ✅ Complete**

## Purpose
Gather detailed requirements and analyze them — use cases, the data model, and the technical approach (and its constraints) — before design.

## Process (repeatable)
1. Capture use cases per role.
2. Specify the data model.
3. Define success criteria and constraints.
4. Choose the approach and confirm feasibility.

## Part A — Requirements gathering

**Assigner use cases.** Create tournaments (single or multi-day series); import games via CSV (court names, dates normalized, filtered to the tournament's date); auto-build time blocks with games/pay/officials-needed; review and lock the block layout; send invitations (email/SMS) and reminders with correct pending counts; view confirmed officials grouped by court-staffing status; track staffing and estimated payout; run reports and export CSV; use Demo Mode to rehearse without sending real emails.

**Official use cases.** Open a token invite link (no login); set availability window and max games; view a block grid identical to the assigner's; claim a minimum of 2 blocks subject to rest-period rules; confirm and receive a "you're locked in" email.

**Data model (live schema).** Core tables: `tournaments`, `officials`, `available_blocks`, `claims`, `invite_tokens`, `games`, `availability`; a `v_1099_report` view aggregates confirmed payments by official per tax year. Travel-radius values: `local`/`regional`/`national`. Key behaviors: CASCADE delete from tournament to children; **no `org_id`** on `games`/`claims` (filter by `tournament_id IN org's tournaments`).

**Success criteria.** Self-schedule works end to end from invite link to confirmed claim; layout lock protects confirmed assignments; reports reconcile to confirmed claims × pay; recipient counts reflect real skip logic.

**Constraints.** Email/SMS via Resend/Twilio (SMS blocked pending A2P); RLS disabled (pre-launch gap); the Netlify proxy strips query strings on writes.

## Part B — Feasibility & approach analysis

### Key decisions
- **Token-based, login-less self-scheduling.** Officials act via a signed token link instead of accounts, lowering friction for one-off tournament staffing.
- **Block layout as the unit of work.** Games are imported, then grouped into time blocks officials claim — with `officials_per_game` driving slots and pay.
- **Smart Layout Lock.** The layout locks only after `invitations_sent_at` is set; locked blocks with confirmed claims show 🔒 and require Emergency Edit (`admin_unlocked`) — protecting commitments without freezing empty blocks.
- **Direct Supabase writes (proxy avoidance).** Because the Netlify proxy strips WHERE clauses, all writes use the Supabase JS client directly — a hard, documented rule.

### Risks/issues identified and mitigations
- **Proxy dropping query strings** → use Supabase JS client for all writes (insert/update/delete with filters).
- **Date off-by-one (UTC vs local)** → parse dates as local midnight everywhere (badges, token expiry).
- **Re-inviting confirmed officials** → skip tokens that are confirmed/declined or <24h old; scan all tokens per official.
- **Block stacking on re-import** → DELETE+INSERT via client directly, not proxy.
- **No RLS yet** → documented as a hard gate before public launch.

### Feasibility
Confirmed by a working, deployed product: import → blocks → invites → self-schedule → confirmations → reports all function in production for the founder's own use, with a Playwright smoke suite guarding core flows.

## AI's role in this phase
**Maturity: AI-Assisted.** AI helped enumerate the assigner/official use cases, shape the schema, and diagnose the recurring proxy/date/skip-logic issues that drove key decisions. The human owns acceptance via real browser testing.

## Key artifacts
- The Database Schema and "Critical" rules sections of [`../../CLAUDE.md`](../../CLAUDE.md).
- See the [artifact index](../artifacts/README.md).
