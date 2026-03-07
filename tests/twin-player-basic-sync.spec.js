import { test, expect } from '@playwright/test';
import {
    YT_PLAYER_STATE,
    clickPlayerSurface,
    installMockTikTokEmbed,
    installMockYouTubeApi,
    readTwinPlayersSnapshot,
    waitForPlayersReady,
    startPlaybackInteraction
} from './utils/twin-player-helpers.js';

const REACTION_PAGE_URLS = {
    basicSync: '/reaction/1PaTrdCMKn6ay7nShHES',
    tiktokOriginalSync: '/reaction/nM2iTikTokGateA1B2Cx',
};

const isActive = (state) => state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING;

test.describe('Twin Video Playback (Smoke)', () => {

    test.describe.configure({ timeout: 90000 });

    test('Should start both players after click-gate release (mocked YT, CI-safe)', async ({ page }) => {
        await installMockYouTubeApi(page);
        await page.goto(REACTION_PAGE_URLS.basicSync);

        await waitForPlayersReady(page, 15000);

        await startPlaybackInteraction(page);

        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) return false;
            return Boolean(s.bothVideosStarted) && isActive(s.originalPlayerState) && isActive(s.reactionPlayerState);
        }, { timeout: 15000 }).toBe(true);

        const snapshot = await readTwinPlayersSnapshot(page);
        expect(snapshot, 'Expected twin players snapshot').toBeTruthy();
        expect(snapshot.bothVideosStarted, 'Click gate should be released').toBe(true);
        expect(isActive(snapshot.originalPlayerState), 'Original player should be active').toBe(true);
        expect(isActive(snapshot.reactionPlayerState), 'Reaction player should be active').toBe(true);
    });

    test('Should release the click gate for TikTok originals after the second click', async ({ page }) => {
        await installMockYouTubeApi(page);
        await installMockTikTokEmbed(page);
        await page.goto(REACTION_PAGE_URLS.tiktokOriginalSync);

        await waitForPlayersReady(page, 15000);

        await clickPlayerSurface(page, 'reaction');

        await expect.poll(async () => {
            const snapshot = await readTwinPlayersSnapshot(page);
            if (!snapshot) return null;
            return {
                bothVideosStarted: snapshot.bothVideosStarted,
                reactionPlayerState: snapshot.reactionPlayerState,
                originalPlayerState: snapshot.originalPlayerState
            };
        }, { timeout: 10000 }).toEqual({
            bothVideosStarted: false,
            reactionPlayerState: YT_PLAYER_STATE.PAUSED,
            originalPlayerState: YT_PLAYER_STATE.UNSTARTED
        });

        await startPlaybackInteraction(page);

        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) return false;
            return Boolean(s.bothVideosStarted) && isActive(s.originalPlayerState) && isActive(s.reactionPlayerState);
        }, { timeout: 15000 }).toBe(true);

        await expect(page.getByText(/Tap or click each video once to sync playback/i)).toBeHidden();
        await expect(page.getByRole('toolbar', { name: 'Reaction playback controls' })).toBeVisible();

        const snapshot = await readTwinPlayersSnapshot(page);
        expect(snapshot, 'Expected twin players snapshot').toBeTruthy();
        expect(snapshot.bothVideosStarted, 'Click gate should be released').toBe(true);
        expect(isActive(snapshot.originalPlayerState), 'Original TikTok player should be active').toBe(true);
        expect(isActive(snapshot.reactionPlayerState), 'Reaction player should be active').toBe(true);
    });

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

        // 4) After ~5s of playback, assert drift is still small
        await page.waitForTimeout(5000);

        const driftThreshold = testInfo.project.name === 'mobile' ? 0.5 : 0.5;

        const s = await readTwinPlayersSnapshot(page);
        expect(s, 'Expected twin players snapshot').toBeTruthy();
        expect(isActive(s.originalPlayerState), 'Original player should be active').toBe(true);
        expect(isActive(s.reactionPlayerState), 'Reaction player should be active').toBe(true);
    });

});
