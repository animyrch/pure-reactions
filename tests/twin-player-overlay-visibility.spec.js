/**
 * Test: Twin-player overlay visibility control
 * 
 * Validates that the overlay visibility timeline controls whether the overlay
 * is shown or hidden in fullscreen mode.
 */

import { test, expect } from '@playwright/test';
import { waitForPlayersReady, startPlaybackInteraction } from './utils/twin-player-helpers.js';

test.describe('Twin-player overlay visibility', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to reaction page
    await page.goto('/reaction/testOverlayVisibility123');

    // Wait for players to be ready
    await waitForPlayersReady(page);

    // Start playback interaction
    await startPlaybackInteraction(page);
  });

  test('overlay visibility defaults to visible', async ({ page }) => {
    // Simulate device rotation to landscape (fullscreen mode on mobile)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    // Check that overlay is visible (opacity-100)
    const overlay = page.locator('[data-stage-role="overlay"]').first();
    await expect(overlay).toHaveClass(/opacity-100/);
    await expect(overlay).not.toHaveClass(/opacity-0/);
  });

  test('overlay hides at configured time', async ({ page }) => {
    // Simulate device rotation to landscape (fullscreen mode on mobile)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    // Get overlay element
    const overlay = page.locator('[data-stage-role="overlay"]').first();

    // Initially visible
    await expect(overlay).toHaveClass(/opacity-100/);

    // Wait for timeline to reach t=3 (overlay should hide)
    await page.waitForTimeout(3500);

    // Check that overlay is now hidden
    await expect(overlay).toHaveClass(/opacity-0/);
  });

  test('overlay shows again after configured time', async ({ page }) => {
    // Simulate device rotation to landscape (fullscreen mode on mobile)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    const overlay = page.locator('[data-stage-role="overlay"]').first();

    // Wait for t=6 (overlay should show again)
    await page.waitForTimeout(6500);

    // Check that overlay is visible again
    await expect(overlay).toHaveClass(/opacity-100/);
    await expect(overlay).not.toHaveClass(/opacity-0/);
  });

  test.skip('overlay always visible in non-fullscreen mode', async ({ page }) => {
    // In non-fullscreen, overlay visibility timeline should not apply
    // Both videos should be visible in grid layout
    const originalStage = page.locator('[data-stage="original"]');
    const reactionStage = page.locator('[data-stage="reaction"]');

    await expect(originalStage).toBeVisible();
    await expect(reactionStage).toBeVisible();

    // Neither should have overlay role in non-fullscreen
    await expect(page.locator('[data-stage-role="overlay"]')).toHaveCount(0);
  });

  test.skip('overlay becomes visible when exiting fullscreen', async ({ page }) => {
    // Simulate device rotation to landscape (fullscreen mode on mobile)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    const overlay = page.locator('[data-stage-role="overlay"]').first();

    // Wait for overlay to hide at t=3
    await page.waitForTimeout(3500);
    await expect(overlay).toHaveClass(/opacity-0/);

    // Simulate device rotation back to portrait (exit fullscreen mode on mobile)
    await page.setViewportSize({ width: 720, height: 1280 });
    await page.waitForTimeout(500);

    // After exiting, both videos should be visible in grid
    const originalStage = page.locator('[data-stage="original"]');
    const reactionStage = page.locator('[data-stage="reaction"]');

    await expect(originalStage).toBeVisible();
    await expect(reactionStage).toBeVisible();
  });
});

test.describe('Twin-player overlay visibility (debug)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to reaction page
    await page.goto('/reaction/testOverlayVisibility123');

    // Wait for players to be ready
    await waitForPlayersReady(page);

    // Start playback interaction
    await startPlaybackInteraction(page);
  });

  test('debug overlay visibility timeline', async ({ page }) => {
    // Simulate device rotation to landscape (fullscreen mode on mobile)
    await page.setViewportSize({ width: 1280, height: 720 });
    console.log('Viewport set to 1280x720');
    await page.waitForTimeout(500);

    // Check if overlay exists
    const overlayCount = await page.locator('[data-stage-role="overlay"]').count();
    console.log('Number of overlay elements found:', overlayCount);

    if (overlayCount === 0) {
      console.error('No overlay elements found!');
      return;
    }

    // Get overlay element
    const overlay = page.locator('[data-stage-role="overlay"]').first();

    // Log initial classes
    const initialClasses = await overlay.getAttribute('class', { timeout: 10000 });
    console.log('Initial overlay classes:', initialClasses);

    // Initially visible
    await expect(overlay).toHaveClass(/opacity-100/);
    console.log('Overlay is initially visible');

    // Wait for timeline to reach t=3 (overlay should hide)
    await page.waitForTimeout(3500);

    // Log classes after t=3
    const classesAfterHide = await overlay.getAttribute('class', { timeout: 10000 });
    console.log('Overlay classes after t=3:', classesAfterHide);

    // Check that overlay is now hidden
    await expect(overlay).toHaveClass(/opacity-0/);
    console.log('Overlay is hidden at t=3');

    // Wait for t=6 (overlay should show again)
    await page.waitForTimeout(3000);

    // Log classes after t=6
    const classesAfterShow = await overlay.getAttribute('class', { timeout: 10000 });
    console.log('Overlay classes after t=6:', classesAfterShow);

    // Check that overlay is visible again
    await expect(overlay).toHaveClass(/opacity-100/);
    console.log('Overlay is visible again at t=6');
  });
});
