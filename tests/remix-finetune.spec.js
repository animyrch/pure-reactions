import { test, expect } from '@playwright/test';
import { installMockYouTubeApi, YT_PLAYER_STATE } from './utils/twin-player-helpers.js';
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
  origRemixEditOn01: 400,
  origRemixFineCue: 400,
  origRemixFinePause: 180,
  origRemixFineJump: 180,
  origRemixFinePlays: 180,
};

async function openFineTune(page, slug, durationVideoId) {
  await loginAsRemixOwner(page);
  await page.goto(`/edit-reaction/${slug}`);
  await expect(page.getByRole('heading', { name: 'Edit Reaction' })).toBeVisible();
  await waitForOriginalPlayer(page);
  await page.waitForFunction(
    (expected) => window.__players?.original?.getDuration?.() === expected,
    DURATIONS[durationVideoId],
    { timeout: 15000 },
  );
  await page.getByRole('button', { name: 'Enable fine-tune mode' }).click();
  await expect(page.getByText('Original video timeline')).toBeVisible();
}

function markerCenterRatio(markerBox, trackBox) {
  return (markerBox.x + markerBox.width / 2 - trackBox.x) / trackBox.width;
}

test.describe('Remix fine-tune editing', () => {
  test.describe.configure({ timeout: 90000 });

  test.beforeAll(async () => {
    await ensureRemixOwner();
  });

  test.beforeEach(async ({ page }) => {
    await installMockYouTubeApi(page, { durations: DURATIONS, autoAdvance: true });
    await page.route('**/www.youtube.com/iframe_api*', (route) => route.abort());
    await page.route('**/www.youtube.com/s/player/**', (route) => route.abort());
  });

  test('places saved cues by original time across the original length', async ({ page }) => {
    await openFineTune(page, 'remixFineTuneCue0001', 'origRemixFineCue');

    const pause = page.getByRole('button', { name: 'Stopped original at 3:20' });
    const volume = page.getByRole('button', { name: 'Volume 25% at 1:40' });
    await expect(pause).toBeVisible();
    await expect(volume).toBeVisible();
    await expect(page.locator('[data-track-id="reactionVolume"]')).toHaveCount(0);
    await expect(page.locator('[data-track-id="overlayVisibility"]')).toHaveCount(0);

    const pauseTrack = page.locator('[data-track-id="originalVideo"]');
    const volumeTrack = page.locator('[data-track-id="volume"]');
    const pauseRatio = markerCenterRatio(await pause.boundingBox(), await pauseTrack.boundingBox());
    const volumeRatio = markerCenterRatio(await volume.boundingBox(), await volumeTrack.boundingBox());
    expect(pauseRatio).toBeGreaterThan(0.45);
    expect(pauseRatio).toBeLessThan(0.55);
    expect(volumeRatio).toBeGreaterThan(0.2);
    expect(volumeRatio).toBeLessThan(0.3);
  });

  test('moves the fine-tune playhead with the original video', async ({ page }) => {
    await openFineTune(page, 'remixEditorOn000001', 'origRemixEditOn01');
    const playhead = page.getByRole('slider', { name: 'Playhead scrubber' });
    await expect(playhead).toHaveAttribute('aria-valuenow', '0');

    await startOriginalOnly(page);

    await expect.poll(async () => Number(await playhead.getAttribute('aria-valuenow')), {
      timeout: 8000,
    }).toBeGreaterThan(1.2);

    const shown = Number(await playhead.getAttribute('aria-valuenow'));
    const playback = await readPlayback(page);
    expect(Math.abs(shown - playback.original.time)).toBeLessThan(1.5);
    expect(playback.original.time).toBeLessThan(30);
  });

  test('a pause cue entered on the original timeline pauses the original there', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'This test writes the shared fine-tune document');
    await openFineTune(page, 'remixFineTunePause01', 'origRemixFinePause');

    await cueSecondsAt(page, 'originalVideo', 0.5);
    await page.locator('#pending-reaction-minutes').fill('0');
    await page.locator('#pending-reaction-seconds').fill('2');
    await page.getByRole('button', { name: 'Pause original here' }).click();
    await expect(page.getByRole('button', { name: 'Stopped original at 0:02' })).toBeVisible();

    await startOriginalOnly(page);

    await expect.poll(async () => {
      const playback = await readPlayback(page);
      return playback?.original?.state === YT_PLAYER_STATE.PAUSED
        && playback.original.time >= 1.5
        && playback.original.time < 4;
    }, { timeout: 8000 }).toBe(true);

    const pausedAt = (await readPlayback(page)).original.time;
    await page.waitForTimeout(700);
    const later = await readPlayback(page);
    expect(later.original.state).toBe(YT_PLAYER_STATE.PAUSED);
    expect(Math.abs(later.original.time - pausedAt)).toBeLessThan(0.4);
  });

  test('a play cue entered on the original timeline jumps once to its original target', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'This test writes the shared fine-tune document');
    await openFineTune(page, 'remixFineTuneJump001', 'origRemixFineJump');

    await cueSecondsAt(page, 'originalVideo', 0.2);
    await page.locator('#pending-reaction-minutes').fill('0');
    await page.locator('#pending-reaction-seconds').fill('1');
    await page.locator('#pending-target-minutes').fill('0');
    await page.locator('#pending-target-seconds').fill('25');
    await page.getByRole('button', { name: 'Play original here' }).click();
    await expect(page.getByRole('button', { name: 'Resumed original at 0:01' })).toBeVisible();

    await startOriginalOnly(page);

    await expect.poll(async () => {
      const playback = await readPlayback(page);
      return isActive(playback?.original?.state) && playback.original.time >= 24;
    }, { timeout: 8000 }).toBe(true);

    const jumped = (await readPlayback(page)).original.time;
    await page.waitForTimeout(700);
    const later = await readPlayback(page);
    expect(isActive(later.original.state)).toBe(true);
    expect(later.original.time).toBeGreaterThan(jumped - 0.05);
    expect(later.original.time).toBeLessThan(40);
  });

  test('a second play cue does not throw the playhead forward or pin scrubs to that cue', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'This test writes the shared fine-tune document');
    await openFineTune(page, 'remixFineTunePlays01', 'origRemixFinePlays');

    await expect(page.getByRole('button', { name: 'Resumed original at 0:01' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resumed original at 0:05' })).toBeVisible();

    await startOriginalOnly(page);

    let furthest = 0;
    await expect.poll(async () => {
      const playback = await readPlayback(page);
      const time = playback?.original?.time ?? 0;
      if (isActive(playback?.original?.state)) {
        furthest = Math.max(furthest, time);
      }
      return isActive(playback?.original?.state) && time >= 18;
    }, { timeout: 8000 }).toBe(true);

    await page.waitForTimeout(700);
    const afterJump = await readPlayback(page);
    expect(isActive(afterJump.original.state)).toBe(true);
    expect(furthest).toBeLessThan(40);
    expect(afterJump.original.time).toBeLessThan(40);

    await page.evaluate(() => {
      window.__mockYtSeekDelayMs = 500;
    });
    await scrubPlayheadTo(page, 3, DURATIONS.origRemixFinePlays);

    const playhead = page.getByRole('slider', { name: 'Playhead scrubber' });
    await expect.poll(async () => Number(await playhead.getAttribute('aria-valuenow')), {
      timeout: 2000,
    }).toBeLessThan(8);

    await page.waitForTimeout(1200);
    const scrubbed = await readPlayback(page);
    const shown = Number(await playhead.getAttribute('aria-valuenow'));
    expect(shown).toBeGreaterThan(1);
    expect(shown).toBeLessThan(8);
    expect(scrubbed.original.time).toBeGreaterThan(1);
    expect(scrubbed.original.time).toBeLessThan(8);
    await expect(page.getByRole('button', { name: 'Resumed original at 0:01' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resumed original at 0:05' })).toBeVisible();
  });

  test('skip to cannot be earlier than original at in the cue form', async ({ page }) => {
    await openFineTune(page, 'remixFineTuneCue0001', 'origRemixFineCue');

    await cueSecondsAt(page, 'originalVideo', 0.25);
    await page.locator('#pending-reaction-minutes').fill('0');
    await page.locator('#pending-reaction-seconds').fill('30');
    await page.locator('#pending-target-minutes').fill('0');
    await page.locator('#pending-target-seconds').fill('5');
    await expect.poll(() => readClockInputs(page, 'pending-target')).toBe(30);
    await page.locator('#pending-target-seconds').fill('5');
    await expect.poll(() => readClockInputs(page, 'pending-target')).toBe(30);

    await page.locator('#pending-target-minutes').fill('1');
    await page.locator('#pending-target-seconds').fill('0');
    await expect.poll(() => readClockInputs(page, 'pending-target')).toBe(60);

    await page.locator('#pending-reaction-seconds').fill('0');
    await page.locator('#pending-reaction-minutes').fill('2');
    await expect.poll(() => readClockInputs(page, 'pending-reaction')).toBe(120);
    await expect.poll(() => readClockInputs(page, 'pending-target')).toBe(120);

    await page.locator('#pending-reaction-seconds').fill('20');
    await expect.poll(() => readClockInputs(page, 'pending-reaction')).toBe(140);
    await expect.poll(() => readClockInputs(page, 'pending-target')).toBe(140);

    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Stopped original at 3:20' }).click();
    const editor = page.getByRole('dialog', { name: 'Edit playback cue' });
    await expect(editor).toBeVisible();
    await page.locator('#active-target-seconds').fill('0');
    await expect.poll(() => readClockInputs(page, 'active-target')).toBe(200);

    await page.locator('#active-target-minutes').fill('3');
    await page.locator('#active-target-seconds').fill('40');
    await expect.poll(() => readClockInputs(page, 'active-target')).toBe(220);

    await page.locator('#active-reaction-seconds').fill('50');
    await expect.poll(() => readClockInputs(page, 'active-reaction')).toBe(230);
    await expect.poll(() => readClockInputs(page, 'active-target')).toBe(230);

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('button', { name: 'Stopped original at 3:20' })).toBeVisible();
  });
});

async function readClockInputs(page, prefix) {
  const minutes = Number(await page.locator(`#${prefix}-minutes`).inputValue());
  const seconds = Number(await page.locator(`#${prefix}-seconds`).inputValue());
  return minutes * 60 + seconds;
}

async function scrubPlayheadTo(page, seconds, duration) {
  const scrubber = page.getByRole('slider', { name: 'Playhead scrubber' });
  const box = await scrubber.boundingBox();
  if (!box) {
    throw new Error('Playhead scrubber has no box');
  }
  const ratio = Math.min(Math.max(seconds / duration, 0), 1);
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.5, y);
  await page.mouse.down();
  await page.mouse.move(box.x + Math.max(box.width * ratio, 2), y, { steps: 8 });
  await page.mouse.up();
}
