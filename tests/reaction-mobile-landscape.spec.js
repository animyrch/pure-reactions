import { test, expect } from '@playwright/test';
import {
  installMockYouTubeApi,
  readTwinPlayersSnapshot,
  startPlaybackInteraction,
  waitForPlayersReady,
} from './utils/twin-player-helpers.js';

test('mobile landscape: primary stage keeps full height with dock overlay', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile') testInfo.skip(true, 'mobile-only');
  if (process.env.PUBLIC_FIREBASE_USE_EMULATORS !== 'true') testInfo.skip(true, 'requires Firestore emulator fixtures');

  await installMockYouTubeApi(page);
  await page.setViewportSize({ width: 844, height: 390 });

  const slug = '1PaTrdCMKn6ay7nShHES';
  await page.goto(`/reaction/${slug}`);

  const container = page.locator('[data-stage="container"]');
  const primary = page.locator('[data-stage-role="primary"]');
  const dock = page.getByRole('toolbar', { name: 'Reaction playback controls' });

  await expect(container).toBeVisible({ timeout: 30000 });
  const loadingOverlay = page.locator('.fixed.inset-0.z-50');
  await expect(loadingOverlay).toHaveCount(0, { timeout: 20000 });

  await waitForPlayersReady(page, 15000);
  await startPlaybackInteraction(page);

  await expect.poll(async () => {
    const snapshot = await readTwinPlayersSnapshot(page);
    return Boolean(snapshot?.bothVideosStarted);
  }, { timeout: 15000 }).toBe(true);

  await expect(primary).toBeVisible();
  await expect(dock).toBeVisible();

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  const containerBox = await container.boundingBox();
  const primaryBox = await primary.boundingBox();
  const dockBox = await dock.boundingBox();

  const toEdges = (box) => ({
    left: box.x,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
    width: box.width,
    height: box.height,
  });

  const containerEdges = toEdges(containerBox);
  const primaryEdges = toEdges(primaryBox);
  const dockEdges = toEdges(dockBox);

  expect(containerBox, 'Expected a stage container box').toBeTruthy();
  expect(primaryBox, 'Expected a primary stage box').toBeTruthy();
  expect(dockBox, 'Expected a dock box').toBeTruthy();

  expect(Math.abs(containerEdges.width - viewport.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(containerEdges.height - viewport.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(primaryEdges.left)).toBeLessThanOrEqual(2);
  expect(Math.abs(primaryEdges.top)).toBeLessThanOrEqual(2);
  expect(primaryEdges.width).toBeGreaterThanOrEqual(viewport.width - 2);
  expect(primaryEdges.height).toBeGreaterThanOrEqual(viewport.height - 2);

  expect(dockEdges.left).toBeGreaterThanOrEqual(-2);
  expect(dockEdges.right).toBeLessThanOrEqual(viewport.width + 2);
  expect(dockEdges.bottom).toBeLessThanOrEqual(viewport.height + 2);
  expect(dockEdges.top).toBeGreaterThanOrEqual(0);
});
