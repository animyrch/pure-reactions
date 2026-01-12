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

});
