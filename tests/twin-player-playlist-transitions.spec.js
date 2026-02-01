import { test, expect } from '@playwright/test';
import {
    readTwinPlayersSnapshot,
    waitForPlayersReady,
    startPlaybackInteraction
} from './utils/twin-player-helpers.js';

test.describe('Playlist Transitions Timing', () => {

    test.describe.configure({ timeout: 90000 });

    test('should preserve timing for same reaction video and reset for different reaction video', async ({ page }) => {
        // 1. Initial Load (Reaction A)
        await page.goto('/reaction/playlist-trans-A');
        await waitForPlayersReady(page);
        await startPlaybackInteraction(page);

        // Wait for it to be playing
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            return s?.reactionPlayerState === 1; // Playing
        }, { timeout: 30000 }).toBe(true);

        // 2. Seek to a recognizable time
        const seekTime = 15;
        await page.evaluate((time) => {
            window.__players.reaction.seekTo(time, true);
        }, seekTime);

        // Wait for seek to settle
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            return s?.reactionCurrentTime;
        }, { timeout: 10000 }).toBeGreaterThanOrEqual(seekTime);

        // 3. Transition to same reaction video (Playlist Trans B)
        // This transition happens between different reaction documents but points to the same underlying YouTube video.
        await page.evaluate(async () => {
             await window.__actions.loadReactionInPlace('playlist-trans-B', { preserveReactionTime: true, autoPlay: true });
        });

        // Wait for transition to complete (reaction doc ID changes in state)
        // Note: isPublished is used as a proxy to check if transition happened or just check snapshot
        await page.waitForTimeout(2000); 

        const sAfterSame = await readTwinPlayersSnapshot(page);
        console.log(`[Test] Time after same-video transition: ${sAfterSame.reactionCurrentTime}`);
        
        // Timing should be preserved (at least close to where we were)
        expect(sAfterSame.reactionCurrentTime).toBeGreaterThanOrEqual(seekTime);

        // 4. Transition to DIFFERENT reaction video (Playlist Trans C)
        await page.evaluate(async () => {
             await window.__actions.loadReactionInPlace('playlist-trans-C', { preserveReactionTime: true, autoPlay: true });
        });

        // Wait for transition
        await page.waitForTimeout(3000);

        const sAfterDiff = await readTwinPlayersSnapshot(page);
        console.log(`[Test] Time after diff-video transition: ${sAfterDiff.reactionCurrentTime}`);

        // Timing should be RESET to offsetStartTime (which is 10 for playlist-trans-C)
        // or 0 if it failed to reset. In the fixture I set offsetStartTime to 10.
        // If it preserved time, it would be around 15-20.
        expect(sAfterDiff.reactionCurrentTime).toBeLessThan(14); // 10 + some buffer
        expect(sAfterDiff.reactionCurrentTime).toBeGreaterThanOrEqual(9); // near 10
    });
});
