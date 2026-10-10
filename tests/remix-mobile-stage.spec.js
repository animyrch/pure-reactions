import { test, expect } from '@playwright/test';

const boxOf = (page, selector) => page.locator(selector).first().boundingBox();

test.describe('Remix mobile stage', () => {
  test.use({
    viewport: { width: 390, height: 844 },
  });

  test('portrait player and dock use the full column', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile-only');

    await page.goto('/test-layout?remix=1&started=0');
    const remixPlayer = await boxOf(page, '[data-stage="original"]');
    const remixDock = await boxOf(page, '.controls-dock');
    const column = await page.locator('.test-container').boundingBox();

    await page.goto('/test-layout?started=0');
    const normalPlayer = await boxOf(page, '[data-stage="original"]');
    const normalDock = await boxOf(page, '.controls-dock');

    expect(remixPlayer.width).toBeGreaterThan(normalPlayer.width - 2);
    expect(Math.abs(remixPlayer.x - normalPlayer.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(remixPlayer.width - column.width)).toBeLessThanOrEqual(2);
    expect(remixPlayer.height).toBeGreaterThan(remixPlayer.width * 0.5);
    expect(remixPlayer.height).toBeLessThan(remixPlayer.width * 0.62);

    expect(Math.abs(remixDock.width - normalDock.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(remixDock.x - remixPlayer.x)).toBeLessThanOrEqual(2);
    expect(remixDock.y).toBeGreaterThanOrEqual(remixPlayer.y + remixPlayer.height - 2);
    expect(remixDock.y + remixDock.height).toBeLessThanOrEqual(844);
  });

  test('landscape stage and dock fill the viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile-only');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/test-layout?remix=1&started=0');

    const viewport = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    const player = await boxOf(page, '[data-stage="original"]');
    const dock = await boxOf(page, '.controls-dock');

    expect(Math.abs(player.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(player.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(player.width - viewport.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(player.height - viewport.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(dock.width - viewport.width)).toBeLessThanOrEqual(2);
    expect(dock.y + dock.height).toBeLessThanOrEqual(viewport.height + 2);
    expect(dock.y).toBeGreaterThan(viewport.height * 0.45);
  });
});
