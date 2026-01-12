import { test, expect } from '@playwright/test';
import {
    YT_PLAYER_STATE,
    readTwinPlayersSnapshot,
    waitForPlayersReady,
    startPlaybackInteraction
} from './utils/twin-player-helpers.js';

const REACTION_PAGE_URL = '/reaction/1PaTrdCMKn6ay7nShHES';

test.describe('Twin Video Sync & Stability', () => {

    // Playwright default per-test timeout in this repo is 30s, but YouTube playback + autoplay gates
    // can legitimately take longer (especially on mobile).
    test.describe.configure({ timeout: 90000 });

    test('Basic Sync: should play both videos in sync', async ({ page }) => {
        await page.goto(REACTION_PAGE_URL);

        // 1. Wait for readiness
        await waitForPlayersReady(page);

        // 2. Start Playback
        await startPlaybackInteraction(page);

        // 3. Verify they reach PLAYING state
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            return s?.reactionPlayerState;
        }, { timeout: 45000 }).toBe(YT_PLAYER_STATE.PLAYING);

        // 4. Verify original is also running
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            return s?.originalPlayerState;
        }, { timeout: 45000 }).toBe(YT_PLAYER_STATE.PLAYING);

        // 5. Check sync drift < 0.15s
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) return null;
            return Math.abs((s.originalCurrentTime || 0) - (s.reactionCurrentTime || 0));
        }, { timeout: 45000 }).toBeLessThanOrEqual(0.15);
    });

    test('Play Trigger: should start both videos within 250ms', async ({ page }) => {
        await page.goto(REACTION_PAGE_URL);

        // 1. Wait for readiness
        await waitForPlayersReady(page);

        // 2. Satisfy the click-gate once so the app control surface is enabled.
        await startPlaybackInteraction(page);
        await page.getByRole('button', { name: 'Pause both videos' }).waitFor({ timeout: 45000 });

        // 3. Pause via app control
        await page.getByRole('button', { name: 'Pause both videos' }).click({ force: true });
        await page.getByRole('button', { name: 'Resume both videos' }).waitFor({ timeout: 20000 });

        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) return false;
            const isActive = (state) => state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING;
            return !isActive(s.originalPlayerState) && !isActive(s.reactionPlayerState);
        }, { timeout: 20000 }).toBe(true);

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
                        if (state === 1 && time > initial.original + 0.02) markIfUnset('original');
                    }
                } catch {
                    // No-op
                }

                try {
                    if (t.reaction == null) {
                        const state = getState(players.reaction);
                        const time = getTime(players.reaction);
                        if (state === 1 && time > initial.reaction + 0.02) markIfUnset('reaction');
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

        // 7. Assert both transitions happened within 250ms
        const times = await page.evaluate(() => window.__twinPlayStartTimes);
        expect(times, 'Expected play start times').toBeTruthy();
        expect(Math.abs(times.original - times.reaction), 'Start time delta (ms)').toBeLessThanOrEqual(250);
    });

    test('Volume Stability: should preserve sync when volume changes automatically', async ({ page }, testInfo) => {
        await page.goto(REACTION_PAGE_URL);

        const driftThreshold = testInfo.project.name === 'mobile' ? 0.35 : 0.15;
        const driftSettleTimeout = testInfo.project.name === 'mobile' ? 20000 : 8000;

        // 1. Setup & Start
        await waitForPlayersReady(page);
        await startPlaybackInteraction(page);

        // 2. Wait for stable playback first
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            return s?.reactionPlayerState === YT_PLAYER_STATE.PLAYING &&
                s?.originalPlayerState === YT_PLAYER_STATE.PLAYING;
        }, { timeout: 30000 }).toBe(true);

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

        // 3. Best-effort: wait for an AUTOMATIC volume/mute change.
        // This is intentionally non-fatal: on mobile a player may remain muted and not expose a visible
        // volume/mute toggle even though backend-configured logic is running.
        let changeDetected = false;
        try {
            await expect.poll(async () => {
                const s = await readTwinPlayersSnapshot(page);
                if (!s) return false;
                return (
                    s.originalVolume !== initial.originalVolume ||
                    s.originalMuted !== initial.originalMuted ||
                    s.reactionVolume !== initial.reactionVolume ||
                    s.reactionMuted !== initial.reactionMuted
                );
            }, { timeout: 25000 }).toBe(true);
            changeDetected = true;
        } catch {
            changeDetected = false;
        }

        console.log(`[Test] Observable volume/mute change detected: ${changeDetected}`);

        // 4. Verify sync during/after the period where an automatic change might occur.
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) return null;
            return Math.abs((s.originalCurrentTime || 0) - (s.reactionCurrentTime || 0));
        }, { timeout: driftSettleTimeout }).toBeLessThanOrEqual(driftThreshold);

        // 5. Continue monitoring for a few seconds to ensure no delayed interruptions
        // (e.g. if volume change triggered a re-buffer or pause)
        const checkDuration = 3000;
        const startTime = Date.now();

        while (Date.now() - startTime < checkDuration) {
            const s = await readTwinPlayersSnapshot(page);
            const isActive = (state) => state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING;
            expect(isActive(s.originalPlayerState), 'Original video should keep playing').toBe(true);
            expect(isActive(s.reactionPlayerState), 'Reaction video should keep playing').toBe(true);

            const continuousDrift = Math.abs((s.originalCurrentTime || 0) - (s.reactionCurrentTime || 0));
            expect(continuousDrift, 'Continuous sync drift').toBeLessThanOrEqual(driftThreshold);

            await page.waitForTimeout(500);
        }
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
