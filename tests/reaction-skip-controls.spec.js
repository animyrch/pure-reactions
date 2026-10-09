import { test, expect } from '@playwright/test';
import {
  installMockYouTubeApi,
  readTwinPlayersSnapshot,
  startPlaybackInteraction,
  waitForPlayersReady,
} from './utils/twin-player-helpers.js';

const readReactionTime = async (page) => {
  const snapshot = await readTwinPlayersSnapshot(page);
  const time = Number(snapshot?.reactionCurrentTime);
  return Number.isFinite(time) ? time : null;
};

const waitForSettledTime = async (page) => {
  let previous = null;
  await expect.poll(async () => {
    const time = await readReactionTime(page);
    const settled = previous != null && time != null && Math.abs(time - previous) < 0.35;
    previous = time;
    return settled;
  }, { timeout: 8000 }).toBe(true);
  return readReactionTime(page);
};

const waitForJump = async (page, from, delta) => {
  const target = from + delta;
  await expect.poll(async () => {
    const time = await readReactionTime(page);
    if (time == null) return 999;
    return Math.abs(time - target);
  }, { timeout: 8000 }).toBeLessThanOrEqual(1.5);
  return readReactionTime(page);
};

test('skip buttons and shortcuts jump playback by 15 seconds', async ({ page }, testInfo) => {
  await installMockYouTubeApi(page);
  await page.goto('/reaction/1PaTrdCMKn6ay7nShHES');
  await waitForPlayersReady(page, 20000);
  await startPlaybackInteraction(page);

  const toolbar = page.getByRole('toolbar', { name: 'Reaction playback controls' });
  await expect(toolbar).toBeVisible({ timeout: 15000 });

  const pause = toolbar.getByRole('button', { name: 'Pause both videos' });
  if (await pause.isVisible()) {
    await pause.click();
  }
  await expect(toolbar.getByRole('button', { name: 'Resume both videos' })).toBeVisible();

  const skipForward = toolbar.getByRole('button', { name: 'Skip forward 15 seconds' });
  const skipBack = toolbar.getByRole('button', { name: 'Skip back 15 seconds' });
  await expect(skipForward).toBeVisible();
  await expect(skipBack).toBeVisible();
  await expect(skipForward).toBeEnabled();

  await toolbar.screenshot({
    path: `/tmp/skip-dock-${testInfo.project.name}.png`,
  });

  const dockOverflow = await toolbar.evaluate((el) => el.scrollWidth - el.clientWidth);
  const viewport = page.viewportSize();
  const dockBox = await toolbar.boundingBox();
  expect(dockOverflow).toBeLessThanOrEqual(1);
  expect(dockBox.x).toBeGreaterThanOrEqual(-1);
  expect(dockBox.x + dockBox.width).toBeLessThanOrEqual(viewport.width + 1);

  const start = await waitForSettledTime(page);
  expect(start).not.toBeNull();

  await skipForward.click();
  const afterButton = await waitForJump(page, start, 15);

  await page.keyboard.press('l');
  const afterL = await waitForJump(page, afterButton, 15);

  await page.keyboard.press('j');
  const afterJ = await waitForJump(page, afterL, -15);

  await page.keyboard.press('Shift+ArrowLeft');
  const afterShift = await waitForJump(page, afterJ, -15);
  expect(afterShift).toBeGreaterThanOrEqual(0);

  if (afterShift <= 0.2) {
    await expect(skipBack).toBeDisabled();
  }
});
