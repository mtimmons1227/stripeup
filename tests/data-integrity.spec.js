// StripeUp — Data Integrity Tests
// Run: npx playwright test tests/data-integrity.spec.js
//
// These complement tests/automated.spec.js. That suite asserts on the DOM; this one
// asserts on the DATABASE. Every bug found in the Sept 2 2026 schema/code audit had
// the same shape: the UI reported success while the write failed or was wrong. A DOM
// assertion cannot catch that by construction — only a query can.
//
// Required env vars:
//   STRIPEUP_EMAIL      — assigner login
//   STRIPEUP_PASSWORD   — assigner password
//   SUPABASE_URL        — https://<ref>.supabase.co
//   SUPABASE_ANON_KEY   — the publishable anon key (same one index.html uses)
//
// Install: npm install -D @supabase/supabase-js
//
// ⚠️  These run against BASE_URL, which is PRODUCTION. Tests 1 and 2 write a row and
//     then delete it. Point BASE_URL and SUPABASE_URL at a staging project as soon as
//     one exists. Once RLS is enabled (spec Phase 4) the anon key will no longer be
//     able to read these tables and this file needs a service-role key supplied
//     through CI secrets, never committed.

const { test, expect } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');

const BASE_URL = process.env.STRIPEUP_BASE_URL || 'https://stripeup.netlify.app';
const EMAIL = process.env.STRIPEUP_EMAIL || 'marv_timmons@yahoo.com';
const PASSWORD = process.env.STRIPEUP_PASSWORD || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const db = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set for data-integrity tests');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
};

async function login(page) {
  await page.goto(BASE_URL);
  await page.waitForSelector('#login-email', { timeout: 15000 });
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('#tourn-list', { timeout: 20000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Schema contract — every column the app writes must actually exist.
//
//    This is the generalizable one. Bug C2 was an insert containing a column the
//    table did not have: PostgREST rejected the whole row with a 400 and the UI
//    reported success anyway. This test catches that entire class before it ships,
//    without needing a test per feature.
//
//    When you add a column to an insert in the app, add it here too.
// ─────────────────────────────────────────────────────────────────────────────

const WRITTEN_COLUMNS = {
  assigner_scratches: ['org_id', 'official_id', 'reason', 'scratched_by'],
  tournaments: ['org_id', 'name', 'date', 'location', 'pay_per_game', 'officials_per_game',
                'sport', 'min_rank_level', 'is_taxable', 'scheduling_mode', 'signup_code',
                'show_co_officials', 'layout_locked', 'invitations_sent_at'],
  games: ['tournament_id', 'org_id', 'game_id', 'court', 'time_slot', 'date'],
  available_blocks: ['tournament_id', 'org_id', 'block_name', 'block_color', 'game_ids',
                     'game_count', 'pattern', 'court_first', 'court_second', 'start_time',
                     'end_time', 'sit_slots', 'total_pay', 'status', 'is_custom',
                     'officials_needed'],
  claims: ['tournament_id', 'block_id', 'official_id', 'official_name', 'official_email',
           'official_phone', 'status', 'claimed_at'],
  invite_tokens: ['token', 'official_id', 'tournament_id', 'expires_at', 'used', 'status'],
  officials: ['name', 'email', 'phone', 'rank_level', 'rank_label', 'rank_notes',
              'status', 'sport', 'sports', 'market', 'travel_radius',
              'home_city', 'home_state'],
};

test('1. every column the app writes exists in the live schema', async () => {
  const sb = db();
  const missing = [];

  for (const [table, columns] of Object.entries(WRITTEN_COLUMNS)) {
    // Selecting a column that does not exist makes PostgREST return an error naming it.
    const { error } = await sb.from(table).select(columns.join(',')).limit(1);
    if (error) missing.push(`${table}: ${error.message}`);
  }

  expect(missing, `Columns referenced by app writes but absent from the schema:\n${missing.join('\n')}`)
    .toEqual([]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. C2 regression — scratching an official must actually write a row.
//
//    Before the fix this passed at the DOM level (modal closed, roster reloaded)
//    while the insert was rejected with a 400 and no row was written.
// ─────────────────────────────────────────────────────────────────────────────

test('2. scratching an official writes a row to assigner_scratches', async ({ page }) => {
  const sb = db();

  const { data: officials } = await sb
    .from('officials').select('id,name').order('name').limit(1);
  test.skip(!officials || !officials.length, 'no officials in roster');
  const official = officials[0];

  const { data: orgs } = await sb.from('organizations').select('id').limit(1);
  const orgId = orgs[0].id;

  // Clean any leftover from a previous run so the assertion is unambiguous.
  await sb.from('assigner_scratches').delete()
    .eq('official_id', official.id).eq('org_id', orgId);

  const { count: before } = await sb.from('assigner_scratches')
    .select('id', { count: 'exact', head: true })
    .eq('official_id', official.id).eq('org_id', orgId);
  expect(before).toBe(0);

  try {
    await login(page);
    await page.click('text=Officials');
    await page.waitForSelector('#roster-table', { timeout: 15000 });

    const row = page.locator('#roster-table tr', { hasText: official.name }).first();
    await row.locator('button', { hasText: /scratch/i }).first().click();
    await page.waitForSelector('#scratch-modal', { state: 'visible', timeout: 10000 });
    await page.fill('#scratch-reason', 'automated data-integrity test');
    await page.locator('#scratch-modal button', { hasText: /^Scratch Official$/ }).click();
    await page.waitForSelector('#scratch-modal', { state: 'hidden', timeout: 10000 });

    // The point of the test: the modal closing proves nothing. Ask the database.
    const { data: rows } = await sb.from('assigner_scratches')
      .select('id,reason').eq('official_id', official.id).eq('org_id', orgId);

    expect(rows, 'modal closed but no scratch row was written — C2 has regressed').toHaveLength(1);
    expect(rows[0].reason).toBe('automated data-integrity test');
  } finally {
    await sb.from('assigner_scratches').delete()
      .eq('official_id', official.id).eq('org_id', orgId);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. H1 regression — re-saving blocks must preserve officials_needed and full pay.
//
//    brSaveBlocksDB used to omit officials_needed entirely and compute total_pay
//    without the officials_per_game factor, so a re-save silently nulled the slot
//    count and halved the money for every block in the tournament.
// ─────────────────────────────────────────────────────────────────────────────

test('3. saved blocks carry officials_needed and correctly scaled total_pay', async () => {
  const sb = db();

  const { data: tourns } = await sb
    .from('tournaments').select('id,name,pay_per_game,officials_per_game')
    .order('date', { ascending: false }).limit(1);
  test.skip(!tourns || !tourns.length, 'no tournament to check — rebuild the fixture first');
  const t = tourns[0];

  const { data: blocks } = await sb
    .from('available_blocks').select('id,block_name,game_count,officials_needed,total_pay')
    .eq('tournament_id', t.id);
  test.skip(!blocks || !blocks.length, 'tournament has no blocks');

  const opg = parseInt(t.officials_per_game) || 1;
  const rate = parseFloat(t.pay_per_game) || 0;

  const nulled = blocks.filter(b => b.officials_needed === null);
  expect(nulled.map(b => b.block_name),
    'blocks with NULL officials_needed — H1 has regressed (a re-save dropped the column)')
    .toEqual([]);

  for (const b of blocks) {
    const expected = (parseInt(b.game_count) || 0) * rate * opg;
    expect(parseFloat(b.total_pay),
      `block ${b.block_name}: total_pay should be game_count(${b.game_count}) × rate(${rate}) × officials_per_game(${opg})`)
      .toBeCloseTo(expected, 2);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. C1 regression — the 1099 report must compute pay, not read a dead column.
//
//    v_1099_report used to filter on claims.pay_amount > 0, a column nothing writes,
//    so it could never return a row. It also aliased count(claims) as total_games,
//    which counted blocks rather than games.
// ─────────────────────────────────────────────────────────────────────────────

test('4. v_1099_report totals match the blocks actually claimed', async () => {
  const sb = db();

  const { data: report, error } = await sb.from('v_1099_report').select('*');
  expect(error, 'v_1099_report is not queryable').toBeNull();

  const { count: confirmed } = await sb.from('claims')
    .select('id', { count: 'exact', head: true }).eq('status', 'confirmed');
  test.skip(!confirmed, 'no confirmed claims yet — rebuild the fixture first');

  expect(report.length,
    'confirmed claims exist on taxable tournaments but the 1099 report is empty — C1 has regressed')
    .toBeGreaterThan(0);

  // Recompute one row independently and compare.
  const row = report[0];
  const { data: claims } = await sb.from('claims')
    .select('block_id, tournament_id').eq('official_id', row.official_id).eq('status', 'confirmed');

  let games = 0, pay = 0;
  for (const c of claims) {
    const { data: b } = await sb.from('available_blocks')
      .select('game_count').eq('id', c.block_id).single();
    const { data: tr } = await sb.from('tournaments')
      .select('pay_per_game,is_taxable').eq('id', c.tournament_id).single();
    if (!tr || !tr.is_taxable || !b) continue;
    games += parseInt(b.game_count) || 0;
    pay += (parseInt(b.game_count) || 0) * (parseFloat(tr.pay_per_game) || 0);
  }

  expect(Number(row.total_games),
    'total_games should sum game_count, not count claimed blocks').toBe(games);
  expect(parseFloat(row.total_pay)).toBeCloseTo(pay, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. H2 regression — the roster must display the stored travel radius.
//
//    selectCols omitted travel_radius, so every row rendered the 'national'
//    fallback while send-invites.js filtered on the real value. The roster and the
//    invite logic disagreed about who was eligible.
// ─────────────────────────────────────────────────────────────────────────────

test('5. roster displays each official\'s real travel radius', async ({ page }) => {
  const sb = db();

  const { data: officials } = await sb
    .from('officials').select('id,name,travel_radius')
    .not('travel_radius', 'is', null).neq('travel_radius', 'national').limit(1);
  test.skip(!officials || !officials.length,
    'no official with a non-default travel_radius to distinguish real value from fallback');
  const official = officials[0];

  await login(page);
  await page.click('text=Officials');
  await page.waitForSelector('#roster-table', { timeout: 15000 });

  const rowText = await page.locator('#roster-table tr', { hasText: official.name })
    .first().innerText();

  expect(rowText.toLowerCase(),
    `roster shows the fallback instead of the stored '${official.travel_radius}' — H2 has regressed`)
    .toContain(official.travel_radius.toLowerCase());
});
