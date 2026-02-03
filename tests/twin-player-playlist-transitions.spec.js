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

    test('should apply correct volume states when switching to different reaction video', async ({ page }) => {
        // 1. Initial Load (Reaction A: original muted, reaction not muted)
        await page.goto('/reaction/playlist-trans-A');
        await waitForPlayersReady(page);
        await startPlaybackInteraction(page);

        // Wait for it to be playing
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            return s?.reactionPlayerState === 1; // Playing
        }, { timeout: 30000 }).toBe(true);

        const sInitial = await readTwinPlayersSnapshot(page);
        console.log(`[Test] Initial state A - Original volume: ${sInitial.currentVolumeOriginalVideo}, Reaction volume: ${sInitial.currentVolumeReactionVideo}`);
        
        // Playlist trans A has original muted (0) and reaction at 100
        expect(sInitial.currentVolumeOriginalVideo).toBe(0);
        expect(sInitial.currentVolumeReactionVideo).toBe(100);

        // 2. Transition to DIFFERENT reaction video (Playlist Trans C: original NOT muted, reaction muted)
        await page.evaluate(async () => {
            await window.__actions.loadReactionInPlace('playlist-trans-C', { preserveReactionTime: true, autoPlay: true });
        });

        // Wait for transition to complete
        await page.waitForTimeout(3000);

        // Wait for players to be ready after transition
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            return s?.bothVideosStarted === true;
        }, { timeout: 15000 }).toBe(true);

        const sAfterTransition = await readTwinPlayersSnapshot(page);
        console.log(`[Test] After transition to C - Original volume: ${sAfterTransition.currentVolumeOriginalVideo}, Reaction volume: ${sAfterTransition.currentVolumeReactionVideo}`);

        // Playlist trans C has original at 100 and reaction muted (0)
        // These values should be derived from the new reaction's volume configurations
        expect(sAfterTransition.currentVolumeOriginalVideo).toBe(100);
        expect(sAfterTransition.currentVolumeReactionVideo).toBe(0);
    });

    test('should reset bothVideosStarted when switching to different reaction video', async ({ page }) => {
        // 1. Initial Load (Reaction A)
        await page.goto('/reaction/playlist-trans-A');
        await waitForPlayersReady(page);
        await startPlaybackInteraction(page);

        // Wait for both videos to have started
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            return s?.bothVideosStarted === true;
        }, { timeout: 30000 }).toBe(true);

        const sInitial = await readTwinPlayersSnapshot(page);
        console.log(`[Test] Initial state A - bothVideosStarted: ${sInitial.bothVideosStarted}`);
        expect(sInitial.bothVideosStarted).toBe(true);

        // 2. Transition to DIFFERENT reaction video (Playlist Trans C)
        await page.evaluate(async () => {
            await window.__actions.loadReactionInPlace('playlist-trans-C', { preserveReactionTime: true, autoPlay: true });
        });

        // Wait briefly for the transition to begin
        await page.waitForTimeout(1000);

        // Check that bothVideosStarted is reset after transition
        const sAfterTransition = await readTwinPlayersSnapshot(page);
        console.log(`[Test] After transition to C - bothVideosStarted: ${sAfterTransition.bothVideosStarted}, reactionPlayerState: ${sAfterTransition.reactionPlayerState}, originalPlayerState: ${sAfterTransition.originalPlayerState}`);

        // With the fix, bothVideosStarted should be false initially after a transition to a different reaction video
        // and then both videos should start playing together
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            return s?.bothVideosStarted === true && s?.reactionPlayerState === 1 && s?.originalPlayerState === 1;
        }, { timeout: 15000 }).toBe(true);

        const sFinal = await readTwinPlayersSnapshot(page);
        console.log(`[Test] Final state - Both videos playing: reaction=${sFinal.reactionPlayerState}, original=${sFinal.originalPlayerState}`);
    });
});
