import { test, expect } from '@playwright/test';
import {
    installMockYouTubeApi,
    readTwinPlayersSnapshot,
    waitForPlayersReady,
} from './utils/twin-player-helpers.js';

const PLAYLIST_PAGE = '/playlist/playlistGateTestPL001';

test.describe('Playlist Click-Gate Carry-Over', () => {

    test.describe.configure({ timeout: 90000 });

    test('Click gate must remain closed when navigating to another playlist item without clicking either video', async ({ page }) => {
        await installMockYouTubeApi(page);

        // Block the real YouTube IFrame API so it cannot overwrite our mock.
        await page.route('**/www.youtube.com/iframe_api*', (route) => route.abort());
        await page.route('**/www.youtube.com/s/player/**', (route) => route.abort());

        // Capture console messages for diagnostics
        const consoleLogs = [];
        page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

        // 1. Navigate to the playlist page (first item loads by default)
        await page.goto(PLAYLIST_PAGE);

        // 2. Wait for the playlist page to finish loading and display a reaction
        //    The playlist page loads asynchronously: onMount calls loadSelectedReaction
        //    which calls loadReactionInPlace, which creates the players.
        try {
            await page.waitForFunction(() => {
                const players = window.__players;
                return players?.original && players?.reaction;
            }, null, { timeout: 45000 });
        } catch (e) {
            const diag = await page.evaluate(() => ({
                players: !!window.__players,
                original: !!window.__players?.original,
                reaction: !!window.__players?.reaction,
                bothVideosStarted: window.__players?.bothVideosStarted,
                url: window.location.href,
                bodyText: document.body?.innerText?.slice(0, 500),
            })).catch(() => null);
            throw new Error(
                `Players never initialized on playlist page.\n` +
                `Diagnostics: ${JSON.stringify(diag, null, 2)}\n` +
                `Console logs:\n${consoleLogs.slice(-30).join('\n')}\n` +
                `Original: ${e.message}`
            );
        }

        await waitForPlayersReady(page, 30000);

        // 3. Verify the click gate is closed on the first item
        const snapshotBefore = await readTwinPlayersSnapshot(page);
        expect(snapshotBefore, 'Twin players snapshot should exist on first item').toBeTruthy();
        expect(snapshotBefore.bothVideosStarted, 'Click gate should be closed on first playlist item').toBe(false);

        // 4. Verify the "click both videos" warning is visible
        await expect(
            page.getByText(/tap or click each video once to sync playback/i)
        ).toBeVisible({ timeout: 10000 });

        // 5. Navigate to the second playlist item WITHOUT clicking either video
        const secondItem = page.getByRole('button').filter({ hasText: /Playlist Gate Test - Original B/i });
        await expect(secondItem).toBeVisible({ timeout: 10000 });
        await secondItem.click();

        // 6. Wait for the transition to settle — players may be momentarily null
        //    while loadReactionInPlace destroys old players and creates new ones.
        try {
            await page.waitForFunction(() => {
                const players = window.__players;
                return players?.original && players?.reaction;
            }, null, { timeout: 45000 });
        } catch (e) {
            const diag = await page.evaluate(() => ({
                hasPlayers: !!window.__players,
                originalExists: !!window.__players?.original,
                reactionExists: !!window.__players?.reaction,
                bothVideosStarted: window.__players?.bothVideosStarted,
                hasOriginalDiv: !!document.getElementById('player-original'),
                hasReactionDiv: !!document.getElementById('player-reaction'),
                url: window.location.href,
                bodySnippet: document.body?.innerText?.slice(0, 400),
            })).catch(() => null);
            throw new Error(
                `Players not ready after navigating to second item.\n` +
                `Diagnostics: ${JSON.stringify(diag, null, 2)}\n` +
                `Console logs:\n${consoleLogs.slice(-20).join('\n')}\n` +
                `Original: ${e.message}`
            );
        }

        await waitForPlayersReady(page, 30000);

        // 7. The click gate MUST still be closed on the second item
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            return s?.bothVideosStarted;
        }, {
            timeout: 15000,
            message: 'Click gate should remain closed (bothVideosStarted=false) after navigating to a new playlist item without clicking either video'
        }).toBe(false);

        // 8. The warning must still be visible
        await expect(
            page.getByText(/tap or click each video once to sync playback/i)
        ).toBeVisible({ timeout: 10000 });

        // 9. Verify neither player is in a playing state
        const snapshotAfter = await readTwinPlayersSnapshot(page);
        expect(snapshotAfter, 'Twin players snapshot should exist on second item').toBeTruthy();
        expect(snapshotAfter.bothVideosStarted, 'Click gate must be closed on second playlist item').toBe(false);
    });
});
