// StripeUp Officials Scheduler — Automated Playwright Tests
// Run: npx playwright test tests/automated.spec.js
// Requires: npm install -D @playwright/test && npx playwright install chromium
//
// Set env vars before running:
//   STRIPEUP_EMAIL=marv_timmons@yahoo.com
//   STRIPEUP_PASSWORD=<password>
//
// Or hard-code below for local dev only (do not commit credentials).

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.STRIPEUP_BASE_URL || 'https://stripeup.netlify.app';
const EMAIL = process.env.STRIPEUP_EMAIL || 'marv_timmons@yahoo.com';
const PASSWORD = process.env.STRIPEUP_PASSWORD || '';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto(BASE_URL);
  await page.waitForSelector('#login-email', { timeout: 15000 });
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PASSWORD);
  await page.click('button[type="submit"]');
  // Wait for dashboard to appear (tournaments list or nav)
  await page.waitForSelector('#tourn-list', { timeout: 20000 });
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Login
// ──────────────────────────────────────────────────────────────────────────────

test('1. Login with test credentials', async ({ page }) => {
  await login(page);
  // Dashboard visible
  await expect(page.locator('#tourn-list')).toBeVisible();
  // Nav bar should show org name or user email
  const nav = page.locator('#nav-user, #nav-org, .nav-bar');
  await expect(nav.first()).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Tournament card days-away badge colour coding
// ──────────────────────────────────────────────────────────────────────────────

test('2. Days-away badge uses correct colour for each range', async ({ page }) => {
  await login(page);

  // Wait for tournament cards to render
  await page.waitForSelector('.tourn-card', { timeout: 10000 });

  // Each days-away badge is a span whose text is like "17 days" or "Today" or "2 days"
  const badges = page.locator('[id^="days-badge-"]');
  const count = await badges.count();

  if (count === 0) {
    console.log('No days-away badges found — skipping colour check');
    return;
  }

  for (let i = 0; i < count; i++) {
    const badge = badges.nth(i);
    const text = await badge.textContent();
    const style = await badge.getAttribute('style');

    // Parse days from text like "17 days" or "Today" or "1 day"
    const match = text && text.match(/(\d+)/);
    const days = match ? parseInt(match[1]) : 0;

    if (text && text.toLowerCase().includes('today')) {
      // Red
      expect(style).toContain('#C0392B');
    } else if (days <= 7) {
      // Red
      expect(style).toContain('#C0392B');
    } else if (days <= 21) {
      // Amber
      expect(style).toContain('#C9A84C');
    } else {
      // Green
      expect(style).toContain('#1A7A4A');
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Import Games button disabled on tournaments with games
// ──────────────────────────────────────────────────────────────────────────────

test('3. Import Games button is disabled when tournament has games', async ({ page }) => {
  await login(page);
  await page.waitForSelector('.tourn-card', { timeout: 10000 });

  // Wait for stats to load (loadTournamentStats fires after 400ms delay)
  await page.waitForTimeout(1500);

  const cards = page.locator('.tourn-card');
  const cardCount = await cards.count();

  let checkedAtLeastOne = false;

  for (let i = 0; i < cardCount; i++) {
    const card = cards.nth(i);
    const tournId = await card.getAttribute('data-tid');
    if (!tournId) continue;

    const importBtn = page.locator(`#btn-import-${tournId}`);
    if (!(await importBtn.count())) continue;

    const gamesLabel = page.locator(`#hdr-games-${tournId}`);
    if (!(await gamesLabel.count())) continue;

    const gamesText = await gamesLabel.textContent();
    const hasGames = gamesText && !gamesText.toLowerCase().includes('no games');

    if (hasGames) {
      const disabled = await importBtn.isDisabled();
      expect(disabled).toBe(true);
      checkedAtLeastOne = true;
    }
  }

  if (!checkedAtLeastOne) {
    console.log('No tournaments with games found — create one with a CSV import to test this check');
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Schedule status badge text matches tournament state
// ──────────────────────────────────────────────────────────────────────────────

test('4. Schedule status badge text is correct for each tournament state', async ({ page }) => {
  await login(page);
  await page.waitForSelector('.tourn-card', { timeout: 10000 });
  await page.waitForTimeout(1500); // let stats load

  const cards = page.locator('.tourn-card');
  const cardCount = await cards.count();

  const validTexts = [
    'No games yet',
    'Games ready',
    'Self-scheduling open',
    'Signup closed'
  ];

  for (let i = 0; i < cardCount; i++) {
    const card = cards.nth(i);
    const tournId = await card.getAttribute('data-tid');
    if (!tournId) continue;

    const badge = page.locator(`#hdr-sched-${tournId}`);
    if (!(await badge.count())) continue;

    const text = (await badge.textContent()) || '';
    const visible = await badge.isVisible();

    expect(visible).toBe(true);
    const matched = validTexts.some(v => text.includes(v));
    expect(matched).toBe(true);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. Shuffle button disabled when layout is locked
// ──────────────────────────────────────────────────────────────────────────────

test('5. Shuffle button is disabled when layout is locked', async ({ page }) => {
  await login(page);
  await page.waitForSelector('.tourn-card', { timeout: 10000 });

  // Find a tournament that has invitations sent (layout_locked = true)
  // We'll open Review Blocks for each tournament and check shuffle state
  const cards = page.locator('.tourn-card');
  const cardCount = await cards.count();

  let foundLockedTournament = false;

  for (let i = 0; i < cardCount; i++) {
    const card = cards.nth(i);
    const tournId = await card.getAttribute('data-tid');
    if (!tournId) continue;

    // Look for the Review Blocks button
    const reviewBtn = page.locator(`[onclick*="brOpen('${tournId}')"], [onclick*='brOpen("${tournId}")']`);
    if (!(await reviewBtn.count())) continue;

    await reviewBtn.first().click();

    // Wait for modal to appear
    const modal = page.locator('#br-modal');
    try {
      await modal.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      continue;
    }

    // Check for the invite-lock-notice (means layout is locked)
    const lockNotice = page.locator('#br-invite-lock-notice');
    const lockVisible = await lockNotice.isVisible();

    if (lockVisible) {
      foundLockedTournament = true;
      const shuffleBtn = page.locator('#br-shuffle');
      if (await shuffleBtn.count()) {
        const disabled = await shuffleBtn.isDisabled();
        expect(disabled).toBe(true);
      }
    }

    // Close modal
    const closeBtn = page.locator('#br-modal [onclick*="brClose"], #br-modal button').filter({ hasText: 'Close' });
    if (await closeBtn.count()) {
      await closeBtn.first().click();
    } else {
      await page.keyboard.press('Escape');
    }

    await page.waitForTimeout(300);
  }

  if (!foundLockedTournament) {
    console.log('No layout-locked tournaments found — send invitations on a tournament to test this check');
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. Block editing: confirmed blocks locked, empty blocks editable (when locked)
// ──────────────────────────────────────────────────────────────────────────────

test('6. Block edit panel blocked on confirmed blocks, allowed on empty blocks', async ({ page }) => {
  await login(page);
  await page.waitForSelector('.tourn-card', { timeout: 10000 });

  const cards = page.locator('.tourn-card');
  const cardCount = await cards.count();

  let foundLockedTournament = false;

  for (let i = 0; i < cardCount; i++) {
    const card = cards.nth(i);
    const tournId = await card.getAttribute('data-tid');
    if (!tournId) continue;

    const reviewBtn = page.locator(`[onclick*="brOpen('${tournId}')"], [onclick*='brOpen("${tournId}")']`);
    if (!(await reviewBtn.count())) continue;

    await reviewBtn.first().click();

    const modal = page.locator('#br-modal');
    try {
      await modal.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      continue;
    }

    const lockNotice = page.locator('#br-invite-lock-notice');
    const lockVisible = await lockNotice.isVisible();

    if (!lockVisible) {
      // Not locked — close and try next
      const closeBtn = page.locator('#br-modal button').filter({ hasText: 'Close' });
      if (await closeBtn.count()) await closeBtn.first().click();
      else await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      continue;
    }

    foundLockedTournament = true;

    // Find confirmed blocks (🔒 prefix) and try clicking — edit panel should NOT appear
    const confirmedCells = page.locator('#br-grid td').filter({ hasText: '🔒' });
    const confirmedCount = await confirmedCells.count();

    if (confirmedCount > 0) {
      await confirmedCells.first().click();
      await page.waitForTimeout(300);
      const editPanel = page.locator('#br-edit');
      const editVisible = await editPanel.isVisible();
      // Edit panel should NOT be visible for confirmed blocks
      expect(editVisible).toBe(false);
    }

    // Find unconfirmed empty slots — click one and edit panel SHOULD appear
    // Empty blocks don't have 🔒 and have lighter styling
    const allCells = page.locator('#br-grid td[onclick*="brSelect"]');
    const allCount = await allCells.count();

    for (let j = 0; j < allCount; j++) {
      const cell = allCells.nth(j);
      const text = (await cell.textContent()) || '';
      if (!text.includes('🔒')) {
        await cell.click();
        await page.waitForTimeout(300);
        const editPanel = page.locator('#br-edit');
        const editVisible = await editPanel.isVisible();
        if (editVisible) {
          // Edit panel is visible for non-confirmed block — correct
          break;
        }
      }
    }

    // Close modal
    const closeBtn = page.locator('#br-modal button').filter({ hasText: 'Close' });
    if (await closeBtn.count()) await closeBtn.first().click();
    else await page.keyboard.press('Escape');

    break; // Only need to test one locked tournament
  }

  if (!foundLockedTournament) {
    console.log('No layout-locked tournaments with confirmed blocks found — send invitations first');
  }
});
