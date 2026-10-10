import { test, expect } from '@playwright/test';
import {
  installMockYouTubeApi,
  YT_PLAYER_STATE,
} from './utils/twin-player-helpers.js';
import {
  cueSecondsAt,
  ensureRemixOwner,
  isActive,
  loginAsRemixOwner,
  readPlayback,
  startOriginalOnly,
  waitForOriginalPlayer,
} from './utils/remix-e2e.js';

const DURATIONS = {
  origRemixPlay01: 180,
  origRemixPause01: 180,
  origRemixJump01: 180,
  origRemixWatch01: 180,
  reactRemixWatch01: 90,
  origRemixEdit01: 400,
  reactRemixEdit01: 90,
  origRemixEditOn01: 400,
  reactRemixEditOn01: 90,
};

test.describe('Remix mode', () => {
  test.describe.configure({ timeout: 90000 });

  test.beforeAll(async () => {
    await ensureRemixOwner();
  });

  test.beforeEach(async ({ page }) => {
    await installMockYouTubeApi(page, { durations: DURATIONS, autoAdvance: true });
    // The app injects the real IFrame API, which replaces window.YT and never becomes ready in tests.
    await page.route('**/www.youtube.com/iframe_api*', (route) => route.abort());
    await page.route('**/www.youtube.com/s/player/**', (route) => route.abort());
  });

  test('plays the original by itself after one click and keeps the reaction hidden', async ({ page }) => {
    await page.goto('/reaction/remixPlaythrough0001');
    await waitForOriginalPlayer(page);

    await expect(page.getByText(/reaction video id is missing/i)).toHaveCount(0);
    await expect(page.locator('[data-stage="reaction"]')).toHaveCount(0);
    await expect(page.locator('[data-details-layout="original"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reaction video' })).toHaveCount(0);
    await expect(page.locator('[data-testid="youtube-discussion-reaction"]')).toHaveCount(0);
    await expect(page.locator('[data-stage-role="overlay"]')).toHaveCount(0);
    await expect(page.locator('[data-stage="original"]')).toHaveAttribute('data-stage-role', 'primary');
    await expect(page.locator('[data-fullscreen-primary="original"]')).toBeVisible();
    const gate = page.getByTestId('click-gate-prompt');
    await expect(gate).toContainText('Click the original video to start playback');
    await expect(gate).toContainText('Once it is playing, shared controls will appear here.');
    await expect(gate).not.toContainText(/each video|both videos/i);

    await startOriginalOnly(page);

    await expect.poll(async () => {
      const playback = await readPlayback(page);
      return Boolean(playback?.bothVideosStarted) && isActive(playback?.original?.state);
    }, { timeout: 15000 }).toBe(true);

    await expect(page.getByTestId('click-gate-prompt')).toBeHidden();
    await expect.poll(async () => {
      const playback = await readPlayback(page);
      return playback?.original?.state === YT_PLAYER_STATE.PLAYING && playback.original.time > 1.2;
    }, { timeout: 8000 }).toBe(true);
  });

  test('pauses the original in place at a pause cue', async ({ page }) => {
    await page.goto('/reaction/remixPauseAtCue0001');
    await waitForOriginalPlayer(page);
    await startOriginalOnly(page);

    await expect.poll(async () => {
      const playback = await readPlayback(page);
      const time = playback?.original?.time ?? 0;
      return playback?.original?.state === YT_PLAYER_STATE.PAUSED && time >= 1 && time < 3;
    }, { timeout: 8000 }).toBe(true);
  });

  test('seeks once to the play cue target and then keeps normal playback', async ({ page }) => {
    await page.goto('/reaction/remixJumpCue000001');
    await waitForOriginalPlayer(page);
    await startOriginalOnly(page);

    await expect.poll(async () => (await readPlayback(page))?.original?.time >= 35, { timeout: 8000 }).toBe(true);
    const jumped = await readPlayback(page);
    await page.waitForTimeout(700);
    const later = await readPlayback(page);

    expect(later?.original?.state).toBe(YT_PLAYER_STATE.PLAYING);
    expect(later.original.time).toBeGreaterThan(jumped.original.time - 0.05);
    expect(later.original.time).toBeLessThan(55);
  });

  test('drops a stored reaction video and plays the original fullscreen', async ({ page }) => {
    await page.goto('/reaction/remixWatchReaction01');
    await waitForOriginalPlayer(page);

    await expect(page.locator('[data-fullscreen-primary="original"]')).toBeVisible();
    await expect(page.getByTestId('click-gate-prompt')).toContainText('Click the original video to start playback');
    await expect(page.locator('[data-stage="reaction"]')).toHaveCount(0);
    await expect(page.locator('[data-details-layout="original"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Remix watch reaction' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Reaction video' })).toHaveCount(0);
    await expect(page.locator('[data-testid="youtube-discussion-reaction"]')).toHaveCount(0);

    await startOriginalOnly(page);

    await expect.poll(async () => {
      const playback = await readPlayback(page);
      return Boolean(playback?.bothVideosStarted)
        && isActive(playback?.original?.state)
        && playback?.reaction == null;
    }, { timeout: 15000 }).toBe(true);
  });

  test('edits remix settings on the original clock and hides reaction tracks', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'This test writes the shared editor document');
    await loginAsRemixOwner(page);
    await page.goto('/edit-reaction/remixEditor00000001');
    await expect(page.getByRole('heading', { name: 'Edit Reaction' })).toBeVisible();
    await waitForOriginalPlayer(page);
    await page.waitForFunction(() => {
      const players = window.__players;
      return players?.original?.getDuration?.() === 400 && players?.reaction?.getDuration?.() === 90;
    }, null, { timeout: 15000 });

    const aboutRemix = page.getByRole('button', { name: 'About remix mode' });
    await expect(aboutRemix).toBeVisible();
    await aboutRemix.focus();
    const remixTip = page.getByRole('tooltip');
    await expect(remixTip).toBeVisible();
    await expect(remixTip).toContainText('Remix the original video without uploading a reaction.');
    await expect(page.getByLabel('Reaction video URL or ID')).toBeEnabled();
    await expect(page.getByText('4. Player layout')).toBeVisible();

    await page.getByRole('button', { name: '3. Audio' }).click();
    await expect(page.getByText('Reaction mute mode')).toBeVisible();
    await page.getByRole('button', { name: '1. Reaction video source' }).click();

    await page.getByRole('button', { name: 'Enable fine-tune mode' }).click();
    await expect(page.getByText('Live reaction timeline')).toBeVisible();
    await expect(page.locator('[data-track-id="reactionVolume"]')).toBeVisible();
    await expect(page.locator('[data-track-id="overlayVisibility"]')).toBeVisible();
    const reactionCue = await cueSecondsAt(page, 'originalVideo', 0.5);
    expect(reactionCue).toBeGreaterThan(30);
    expect(reactionCue).toBeLessThan(70);

    await page.getByRole('button', { name: 'Disable fine-tune mode' }).click();
    await page.getByRole('switch', { name: 'Turn on remix mode' }).click();
    await expect(page.getByRole('switch', { name: 'Turn off remix mode' })).toBeVisible();
    const reactionInput = page.getByLabel('Reaction video URL or ID');
    await expect(reactionInput).toBeDisabled();
    await expect(reactionInput).toHaveValue('');
    await expect(page.locator('[data-stage="reaction"]')).toHaveCount(0);
    await expect(page.getByText('4. Player layout')).toHaveCount(0);

    await page.getByRole('button', { name: '3. Audio' }).click();
    await expect(page.getByText('Reaction mute mode')).toHaveCount(0);

    await page.getByRole('button', { name: 'Enable fine-tune mode' }).click();
    await expect(page.getByText('Original video timeline')).toBeVisible();
    await expect(page.locator('[data-track-id="reactionVolume"]')).toHaveCount(0);
    await expect(page.locator('[data-track-id="overlayVisibility"]')).toHaveCount(0);
    await expect(page.locator('[data-track-id="volume"]')).toBeVisible();

    if (testInfo.project.name !== 'mobile') {
      const track = page.locator('[data-track-id="originalVideo"]');
      await track.scrollIntoViewIfNeeded();
      const box = await track.boundingBox();
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
      await expect(page.getByText('3:20')).toBeVisible();
    }

    const originalCue = await cueSecondsAt(page, 'originalVideo', 0.5);
    expect(originalCue).toBeGreaterThan(150);
    expect(originalCue).toBeLessThan(250);
    await expect(page.getByRole('dialog', { name: 'New playback configuration' })).toContainText('Original at');
    await expect(page.getByRole('dialog', { name: 'New playback configuration' })).toContainText('Skip to');
  });

  test('uses the original clock when remix mode is already on', async ({ page }, testInfo) => {
    await loginAsRemixOwner(page);
    await page.goto('/edit-reaction/remixEditorOn000001');
    await expect(page.getByRole('heading', { name: 'Edit Reaction' })).toBeVisible();
    await waitForOriginalPlayer(page);
    await page.waitForFunction(() => window.__players?.original?.getDuration?.() === 400, null, { timeout: 15000 });

    await expect(page.getByLabel('Reaction video URL or ID')).toBeDisabled();
    await expect(page.getByText('4. Player layout')).toHaveCount(0);
    await page.getByRole('button', { name: 'Enable fine-tune mode' }).click();
    await expect(page.getByText('Original video timeline')).toBeVisible();
    await expect(page.locator('[data-track-id="reactionVolume"]')).toHaveCount(0);
    await expect(page.locator('[data-track-id="overlayVisibility"]')).toHaveCount(0);

    if (testInfo.project.name !== 'mobile') {
      const track = page.locator('[data-track-id="originalVideo"]');
      await track.scrollIntoViewIfNeeded();
      const box = await track.boundingBox();
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
      await expect(page.getByText('3:20')).toBeVisible();
    }

    const originalCue = await cueSecondsAt(page, 'originalVideo', 0.5);
    expect(originalCue).toBeGreaterThan(150);
    expect(originalCue).toBeLessThan(250);
  });
});
