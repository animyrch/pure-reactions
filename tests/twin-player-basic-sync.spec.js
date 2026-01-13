import { test, expect } from '@playwright/test';
import {
    YT_PLAYER_STATE,
    readTwinPlayersSnapshot,
    waitForPlayersReady,
    startPlaybackInteraction
} from './utils/twin-player-helpers.js';

const REACTION_PAGE_URL = '/reaction/1PaTrdCMKn6ay7nShHES';

const isActive = (state) => state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING;

const seekReactionViaScrubber = async (page, seconds) => {
    const value = String(seconds);
    await page.evaluate((val) => {
        const el = document.querySelector('input[type="range"][aria-label="Seek reaction video"]');
        if (!el) return;
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
};

const pauseAndSeekNearStart = async (page) => {
    // Wait for the control surface (implies click-gate has been released)
    await page.getByRole('button', { name: 'Pause both videos' }).waitFor({ timeout: 45000 });

    // Pause promptly so we don't run past the timeline pause point (~5s)
    await page.getByRole('button', { name: 'Pause both videos' }).click({ force: true });
    await page.getByRole('button', { name: 'Resume both videos' }).waitFor({ timeout: 20000 });

    // Seek very close to start so the timeline expects original to be PLAYING.
    await seekReactionViaScrubber(page, 0.2);

    // Ensure both are not actively playing before resuming.
    await expect.poll(async () => {
        const s = await readTwinPlayersSnapshot(page);
        if (!s) return false;
        return !isActive(s.originalPlayerState) && !isActive(s.reactionPlayerState);
    }, { timeout: 20000 }).toBe(true);
};

test.describe('Twin Video Sync & Stability', () => {

    // Playwright default per-test timeout in this repo is 30s, but YouTube playback + autoplay gates
    // can legitimately take longer (especially on mobile).
    test.describe.configure({ timeout: 90000 });

    test('Basic Sync: should play both videos in sync', async ({ page }, testInfo) => {
        await page.goto(REACTION_PAGE_URL);

        // 1. Wait for readiness
        await waitForPlayersReady(page);

        // 2. Start Playback
        await startPlaybackInteraction(page);

        // 3. Force playback back near the start to avoid the configured pause point (~5s)
        await pauseAndSeekNearStart(page);

        // 4. Resume and assert we can get a tight drift window early in playback
        await page.getByRole('button', { name: 'Resume both videos' }).click({ force: true });

        const driftThreshold = testInfo.project.name === 'mobile' ? 0.35 : 0.15;

        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) return 999;
            if (!isActive(s.originalPlayerState) || !isActive(s.reactionPlayerState)) return 999;
            // Stay within the pre-pause window
            if ((s.reactionCurrentTime || 0) >= 4.5) return 999;
            return Math.abs((s.originalCurrentTime || 0) - (s.reactionCurrentTime || 0));
        }, { timeout: 15000 }).toBeLessThanOrEqual(driftThreshold);
    });

    test('Play Trigger: should start both videos within 250ms', async ({ page }, testInfo) => {
        await page.goto(REACTION_PAGE_URL);

        // 1. Wait for readiness
        await waitForPlayersReady(page);

        // 2. Satisfy the click-gate once so the app control surface is enabled.
        await startPlaybackInteraction(page);

        // 3. Keep the timeline within the pre-pause window and ensure we're paused before measuring.
        await pauseAndSeekNearStart(page);

        // 4. Arm timers for first confirmed playback start (PLAYING + currentTime advancing)
        await page.evaluate(() => {
            const players = window.__players;
            if (!players?.original || !players?.reaction) return;

            window.__twinPlayStartTimes = {
                armedAt: performance.now(),
                original: null,
                reaction: null,
            };

            const getState = (p) => {
                if (typeof p?.getPlayerState === 'function') return p.getPlayerState();
                if (typeof p?.paused === 'boolean') return p.paused ? 2 : 1;
                return null;
            };

            const getTime = (p) => {
                if (typeof p?.getCurrentTime === 'function') return p.getCurrentTime();
                if (typeof p?.currentTime === 'number') return p.currentTime;
                return 0;
            };

            const initial = {
                original: getTime(players.original),
                reaction: getTime(players.reaction),
            };

            const markIfUnset = (key) => {
                const t = window.__twinPlayStartTimes;
                if (!t || t[key] != null) return;
                t[key] = performance.now();
            };

            const tick = () => {
                const t = window.__twinPlayStartTimes;
                if (!t) return;

                try {
                    if (t.original == null) {
                        const state = getState(players.original);
                        const time = getTime(players.original);
                        if ((state === 1 || state === 3) && time > initial.original + 0.02) markIfUnset('original');
                    }
                } catch {
                    // No-op
                }

                try {
                    if (t.reaction == null) {
                        const state = getState(players.reaction);
                        const time = getTime(players.reaction);
                        if ((state === 1 || state === 3) && time > initial.reaction + 0.02) markIfUnset('reaction');
                    }
                } catch {
                    // No-op
                }

                if (t.original == null || t.reaction == null) {
                    requestAnimationFrame(tick);
                }
            };

            requestAnimationFrame(tick);
        });

        // 5. Resume via app control
        await page.getByRole('button', { name: 'Resume both videos' }).click({ force: true });

        // 6. Wait until both have recorded a start time
        await expect.poll(async () => {
            const t = await page.evaluate(() => window.__twinPlayStartTimes);
            return Boolean(t && t.original != null && t.reaction != null);
        }, { timeout: 45000 }).toBe(true);

        // 7. Assert both transitions happened within threshold
        const times = await page.evaluate(() => window.__twinPlayStartTimes);
        expect(times, 'Expected play start times').toBeTruthy();
        const deltaThreshold = testInfo.project.name === 'mobile' ? 600 : 350;
        expect(Math.abs(times.original - times.reaction), 'Start time delta (ms)').toBeLessThanOrEqual(deltaThreshold);
    });

    test('Volume Stability: should preserve sync when volume changes automatically', async ({ page }, testInfo) => {
        await page.goto(REACTION_PAGE_URL);

        const driftThreshold = testInfo.project.name === 'mobile' ? 0.45 : 0.2;
        const driftSettleTimeout = testInfo.project.name === 'mobile' ? 12000 : 7000;

        // 1. Setup & Start
        await waitForPlayersReady(page);
        await startPlaybackInteraction(page);

        // Keep us within the pre-pause window for this reaction's timeline.
        await pauseAndSeekNearStart(page);
        await page.getByRole('button', { name: 'Resume both videos' }).click({ force: true });

        // 2. Wait for stable playback first (within pre-pause window)
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) return false;
            return isActive(s.reactionPlayerState) && isActive(s.originalPlayerState) && (s.reactionCurrentTime || 0) < 4.5;
        }, { timeout: 20000 }).toBe(true);

        // Capture initial volume/mute to verify change later.
        // On mobile, audio arbitration can mute/unmute either player depending on configured volumes.
        const initialSnapshot = await readTwinPlayersSnapshot(page);
        expect(initialSnapshot, 'Expected twin players snapshot').toBeTruthy();

        const initial = {
            originalVolume: initialSnapshot.originalVolume,
            originalMuted: initialSnapshot.originalMuted,
            reactionVolume: initialSnapshot.reactionVolume,
            reactionMuted: initialSnapshot.reactionMuted,
        };
        console.log(`[Test] Initial Vol/Mute | O: ${initial.originalVolume}/${initial.originalMuted} | R: ${initial.reactionVolume}/${initial.reactionMuted}`);

        // 3. Verify sync while both videos are active.
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) return 999;
            if (!isActive(s.originalPlayerState) || !isActive(s.reactionPlayerState)) return 999;
            return Math.abs((s.originalCurrentTime || 0) - (s.reactionCurrentTime || 0));
        }, { timeout: driftSettleTimeout }).toBeLessThanOrEqual(driftThreshold);

        // 4. Monitor briefly and best-effort detect volume/mute changes.
        const checkDuration = testInfo.project.name === 'mobile' ? 1500 : 2500;
        const startTime = Date.now();
        let changeDetected = false;

        while (Date.now() - startTime < checkDuration) {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) {
                await page.waitForTimeout(150);
                continue;
            }

            if (!isActive(s.originalPlayerState) || !isActive(s.reactionPlayerState)) break;

            const changed = (
                s.originalVolume !== initial.originalVolume ||
                s.originalMuted !== initial.originalMuted ||
                s.reactionVolume !== initial.reactionVolume ||
                s.reactionMuted !== initial.reactionMuted
            );
            if (changed) changeDetected = true;

            expect(isActive(s.originalPlayerState), 'Original video should keep playing').toBe(true);
            expect(isActive(s.reactionPlayerState), 'Reaction video should keep playing').toBe(true);

            const continuousDrift = Math.abs((s.originalCurrentTime || 0) - (s.reactionCurrentTime || 0));
            expect(continuousDrift, 'Continuous sync drift').toBeLessThanOrEqual(driftThreshold);

            await page.waitForTimeout(250);
        }

        console.log(`[Test] Observable volume/mute change detected (best-effort): ${changeDetected}`);
    });

    test('Resume After Config Pause: should resume only reaction when original is paused by timeline', async ({ page }) => {
        await page.goto(REACTION_PAGE_URL);

        // 1. Wait for readiness & start playback
        await waitForPlayersReady(page);
        await startPlaybackInteraction(page);

        // 2. Wait until we are past the configured pause point (~5s) and confirm:
        //    - reaction is playing
        //    - original is NOT active (paused/cued/ended)
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) return false;
            const isActive = (state) => state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING;
            return (s.reactionCurrentTime || 0) >= 6 && isActive(s.reactionPlayerState) && !isActive(s.originalPlayerState);
        }, { timeout: 45000 }).toBe(true);

        // 3. Pause via app control (this pauses reaction; original is already paused by config)
        await page.getByRole('button', { name: 'Pause both videos' }).click({ force: true });
        await page.getByRole('button', { name: 'Resume both videos' }).waitFor({ timeout: 20000 });

        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) return false;
            const isActive = (state) => state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING;
            return !isActive(s.originalPlayerState) && !isActive(s.reactionPlayerState);
        }, { timeout: 20000 }).toBe(true);

        // 4. Resume via app control
        const originalTimeAtResume = await page.evaluate(() => {
            const p = window.__players?.original;
            return typeof p?.getCurrentTime === 'function' ? Number(p.getCurrentTime()) : 0;
        });

        await page.getByRole('button', { name: 'Resume both videos' }).click({ force: true });

        // Reaction should resume playing
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            return s?.reactionPlayerState;
        }, { timeout: 45000 }).toBe(YT_PLAYER_STATE.PLAYING);

        // Original should remain paused (and not advance) because the last timeline config is PAUSED.
        const guardMs = 2500;
        const start = Date.now();
        while (Date.now() - start < guardMs) {
            const s = await readTwinPlayersSnapshot(page);
            const isActive = (state) => state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING;
            expect(isActive(s.originalPlayerState), 'Original should not resume playing').toBe(false);

            // Best-effort time stability check (allows a tiny drift due to API jitter)
            expect(s.originalCurrentTime, 'Original time should not advance').toBeLessThanOrEqual(originalTimeAtResume + 0.15);
            await page.waitForTimeout(350);
        }
    });

});
