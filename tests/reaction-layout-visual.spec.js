import { test, expect } from '@playwright/test';

const CASES = [
  {
    name: 'unverified-channel-shows-claim-cta',
    slug: 'layout-unverified',
    expectAttribution: true,
    expectVerifiedChip: false,
    expectClaimCta: true
  },
  {
    name: 'verified-channel-owned-by-reactor-hides-attribution',
    slug: 'layout-verified-owner',
    expectAttribution: false,
    expectVerifiedChip: false,
    expectClaimCta: false
  },
  {
    name: 'verified-channel-not-owned-by-reactor-shows-third-party-without-cta',
    slug: 'layout-verified-thirdparty',
    expectAttribution: true,
    expectVerifiedChip: true,
    expectClaimCta: false
  }
];

test.describe('Reaction page layout visual', () => {
  test.use({
    viewport: { width: 390, height: 844 },
  });

  for (const testCase of CASES) {
    test(`metadata + attribution layout (${testCase.name})`, async ({ page }, testInfo) => {
      if (testInfo.project.name !== 'mobile') {
        testInfo.skip(true, 'mobile-only');
      }
      if (process.env.PUBLIC_FIREBASE_USE_EMULATORS !== 'true') {
        testInfo.skip(true, 'requires Firestore emulator fixtures');
      }
      await page.goto(`/reaction/${testCase.slug}`);

      const stage = page.locator('[data-stage="container"]');
      await expect(stage).toBeVisible({ timeout: 30000 });

      // Wait for the loading overlay to disappear (has a ~4 s fallback timeout
      // even when YouTube players don't fully initialize, e.g. mobile CI).
      // Using CSS selector for the fixed z-50 overlay rendered by +page.svelte.
      const loadingOverlay = page.locator('.fixed.inset-0.z-50');
      await expect(loadingOverlay).toHaveCount(0, { timeout: 20000 });

      const metadata = page.locator('[data-testid="reaction-metadata"]');
      await expect(metadata).toBeVisible({ timeout: 15000 });

      const attribution = page.locator('[data-testid="attribution-block"]');
      if (testCase.expectAttribution) {
        await expect(attribution).toBeVisible();
      } else {
        const debugAttributes = [
          'data-debug-channel-handle',
          'data-debug-reactor-id',
          'data-debug-claim-user-id',
          'data-debug-claim-id',
          'data-debug-verification-status',
          'data-debug-should-hide'
        ];
        const debugValues = await attribution.evaluateAll((nodes, attrs) => {
          return nodes.map((node) => {
            const entry = {};
            attrs.forEach((attr) => {
              entry[attr] = node.getAttribute(attr);
            });
            return entry;
          });
        }, debugAttributes);
        // eslint-disable-next-line no-console
        console.log(`[reaction-layout][${testCase.name}] attribution debug`, debugValues);
        await testInfo.attach(`attribution-debug-${testCase.name}`, {
          body: JSON.stringify(debugValues, null, 2),
          contentType: 'application/json'
        });
        await expect(attribution).toHaveCount(0, { timeout: 15000 });
      }

      if (testCase.expectVerifiedChip) {
        await expect(metadata).toContainText('Verified channel');
      }

      if (testCase.expectClaimCta) {
        await expect(metadata).toContainText('Log in to claim');
      } else {
        await expect(metadata).not.toContainText('Log in to claim');
        await expect(metadata).not.toContainText('Claim this channel');
      }

      await expect(metadata).toHaveScreenshot(`reaction-layout-${testCase.name}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.05,
        timeout: 30000,
      });
    });
  }
});
