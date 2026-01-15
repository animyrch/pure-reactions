import { test, expect } from '@playwright/test';
import { waitForPlayersReady } from './utils/twin-player-helpers.js';

const REACTION_PAGE_URL = '/reaction/1PaTrdCMKn6ay7nShHES';

test.describe('Reaction page mobile landscape visual', () => {
  test.use({
    viewport: { width: 844, height: 390 },
  });

  test('default stage layout', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'mobile') {
      testInfo.skip(true, 'mobile-only');
    }
    await page.goto(REACTION_PAGE_URL);

    const stage = page.locator('[data-stage="container"]');
    await expect(stage).toBeVisible({ timeout: 30000 });

    await waitForPlayersReady(page);

    await page.waitForFunction(() => {
      const players = window.__players;
      const originalIframe = players?.original?.getIframe?.();
      const reactionIframe = players?.reaction?.getIframe?.();
      if (!originalIframe || !reactionIframe) return false;
      const originalRect = originalIframe.getBoundingClientRect();
      const reactionRect = reactionIframe.getBoundingClientRect();
      return originalRect.width > 0 && originalRect.height > 0 && reactionRect.width > 0 && reactionRect.height > 0;
    }, null, { timeout: 30000 });

    await page.waitForTimeout(1000);

    await expect(stage).toHaveScreenshot('reaction-mobile-landscape-stage.png', {
      animations: 'disabled',
      timeout: 30000,
    });
  });
});
