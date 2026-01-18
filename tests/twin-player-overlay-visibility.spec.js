/**
 * Test: Twin-player overlay visibility control
 * 
 * Validates that the overlay visibility timeline controls whether the overlay
 * is shown or hidden in fullscreen mode.
 */

const { test, expect } = require('@playwright/test');

test.describe('Twin-player overlay visibility', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to reaction page
    await page.goto('/reaction/testOverlayVisibility123');
    
    // Wait for players to be ready
    await page.waitForSelector('#player-original', { timeout: 10000 });
    await page.waitForSelector('#player-reaction', { timeout: 10000 });
  });

  test('overlay visibility defaults to visible', async ({ page }) => {
    // Enter fullscreen
    await page.click('[aria-label="Enter fullscreen"]');
    
    // Wait for fullscreen transition
    await page.waitForTimeout(500);
    
    // Check that overlay is visible (opacity-100)
    const overlay = page.locator('[data-stage-role="overlay"]').first();
    await expect(overlay).toHaveClass(/opacity-100/);
    await expect(overlay).not.toHaveClass(/opacity-0/);
  });

  test('overlay hides at configured time', async ({ page }) => {
    // Enter fullscreen
    await page.click('[aria-label="Enter fullscreen"]');
    await page.waitForTimeout(500);
    
    // Get overlay element
    const overlay = page.locator('[data-stage-role="overlay"]').first();
    
    // Initially visible
    await expect(overlay).toHaveClass(/opacity-100/);
    
    // Wait for timeline to reach t=3 (overlay should hide)
    // Note: In a real test, you'd seek to the time or wait for playback
    await page.waitForTimeout(3500);
    
    // Check that overlay is now hidden
    await expect(overlay).toHaveClass(/opacity-0/);
    await expect(overlay).toHaveClass(/pointer-events-none/);
  });

  test('overlay shows again after configured time', async ({ page }) => {
    // Enter fullscreen
    await page.click('[aria-label="Enter fullscreen"]');
    await page.waitForTimeout(500);
    
    const overlay = page.locator('[data-stage-role="overlay"]').first();
    
    // Wait for t=6 (overlay should show again)
    await page.waitForTimeout(6500);
    
    // Check that overlay is visible again
    await expect(overlay).toHaveClass(/opacity-100/);
    await expect(overlay).not.toHaveClass(/opacity-0/);
  });

  test('overlay always visible in non-fullscreen mode', async ({ page }) => {
    // In non-fullscreen, overlay visibility timeline should not apply
    // Both videos should be visible in grid layout
    const originalStage = page.locator('[data-stage="original"]');
    const reactionStage = page.locator('[data-stage="reaction"]');
    
    await expect(originalStage).toBeVisible();
    await expect(reactionStage).toBeVisible();
    
    // Neither should have overlay role in non-fullscreen
    await expect(page.locator('[data-stage-role="overlay"]')).toHaveCount(0);
  });

  test('overlay becomes visible when exiting fullscreen', async ({ page }) => {
    // Enter fullscreen
    await page.click('[aria-label="Enter fullscreen"]');
    await page.waitForTimeout(500);
    
    const overlay = page.locator('[data-stage-role="overlay"]').first();
    
    // Wait for overlay to hide at t=3
    await page.waitForTimeout(3500);
    await expect(overlay).toHaveClass(/opacity-0/);
    
    // Exit fullscreen
    await page.click('[aria-label="Exit fullscreen"]');
    await page.waitForTimeout(500);
    
    // After exiting, both videos should be visible in grid
    const originalStage = page.locator('[data-stage="original"]');
    const reactionStage = page.locator('[data-stage="reaction"]');
    
    await expect(originalStage).toBeVisible();
    await expect(reactionStage).toBeVisible();
  });
});
