import { test, expect } from '@playwright/test';
import {
    YT_PLAYER_STATE,
    readTwinPlayersSnapshot,
    waitForPlayersReady,
    startPlaybackInteraction
} from './utils/twin-player-helpers.js';

const REACTION_PAGE_URLS = {
    basicSync: '/reaction/1PaTrdCMKn6ay7nShHES',
};

const isActive = (state) => state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING;

test.describe('Twin Video Playback (Smoke)', () => {

    test.describe.configure({ timeout: 90000 });

    // Real YouTube playback is unreliable in headless CI (no guaranteed media delivery).
    // This smoke test is meant for local validation; skip it in CI to avoid flakes.
    // See AGENTS.md §6: "Media playback is nondeterministic in CI".
    test('Should load both players and reach playing state', async ({ page }, testInfo) => {
        if (process.env.CI) {
            testInfo.skip(true, 'Skipped in CI — real YT playback is nondeterministic in headless environments');
        }
        await page.goto(REACTION_PAGE_URLS.basicSync);

        // 1) Wait for readiness
        await waitForPlayersReady(page);

        // 2) Click both players to satisfy autoplay/click-gates and start playback
        await startPlaybackInteraction(page);

        // 3) Wait until both are actively playing/buffering
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) return false;
            return isActive(s.originalPlayerState) && isActive(s.reactionPlayerState);
        }, { timeout: 45000 }).toBe(true);

        const s = await readTwinPlayersSnapshot(page);
        expect(s, 'Expected twin players snapshot').toBeTruthy();
        expect(isActive(s.originalPlayerState), 'Original player should be active').toBe(true);
        expect(isActive(s.reactionPlayerState), 'Reaction player should be active').toBe(true);
    });

});
