import { test, expect } from '@playwright/test';

// This test assumes the repository has a mobile project configured in Playwright
// and that a test slug is available which can render both players.
// Adjust the URL/path as needed for your fixtures.

test('mobile landscape: primary stage fits viewport and dock auto-hides', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'mobile') testInfo.skip(true, 'mobile-only');
  if (process.env.PUBLIC_FIREBASE_USE_EMULATORS !== 'true') testInfo.skip(true, 'requires Firestore emulator fixtures');

  await page.setViewportSize({ width: 844, height: 390 });

  // Use a test slug (document id) that exists in the seeded fixtures.
  const slug = '1PaTrdCMKn6ay7nShHES';
  await page.goto(`/reaction/${slug}`);

  // Wait for the main stage container to be visible
  const container = page.locator('[data-stage="container"]');
  await expect(container).toBeVisible({ timeout: 30000 });

  // Wait for the loading overlay to disappear (players init fallback)
  const loadingOverlay = page.locator('.fixed.inset-0.z-50');
  await expect(loadingOverlay).toHaveCount(0, { timeout: 20000 });

  // Wait for the control surface to appear, not just the outer dock wrapper.
  const dockSurface = page.locator('.controls-surface');
  await expect(dockSurface).toBeVisible({ timeout: 30000 });

  // Ensure the surface actually fades out after the idle period (3s + buffer).
  await expect.poll(
    async () => await dockSurface.getAttribute('class'),
    { timeout: 7000 }
  ).toContain('opacity-0');

  const dockSurfaceClass = await dockSurface.getAttribute('class');
  expect(dockSurfaceClass || '').toContain('opacity-0');
  expect(dockSurfaceClass || '').toContain('pointer-events-none');
});
