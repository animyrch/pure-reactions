import { test, expect } from '@playwright/test';
import { seedReaction, clearReactions } from './utils/seed';

test.describe('Reactions Ecosystem', () => {
  let reaction;

  test.beforeAll(async () => {
    await clearReactions();
    reaction = await seedReaction({
      originalVideoTitle: 'BLACKPINK - ‘How You Like That’ M/V',
      originalVideoAuthor: 'BLACKPINK',
      originalVideoSlug: 'blackpink-how-you-like-that-blackpink',
      isPublished: true,
    });
  });

  test('should display the reaction hub page with correct data', async ({ page }) => {
    await page.goto(`/reactions/${reaction.originalVideoSlug}`);

    await expect(page.locator('h1')).toContainText('Reactions to BLACKPINK - ‘How You Like That’ M/V');
    await expect(page.locator(`text=${reaction.reactionVideoTitle}`)).toBeVisible();
  });

  test('should navigate to the canonical hub from a reaction page', async ({ page }) => {
    await page.goto(`/reaction/${reaction.id}`);
    await page.click('text=View all reactions');
    await expect(page).toHaveURL(`/reactions/${reaction.originalVideoSlug}`);
  });
});
