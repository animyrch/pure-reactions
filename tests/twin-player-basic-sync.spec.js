import { test, expect } from '@playwright/test';

const REACTION_PAGE_URL = '/reaction/FQdOfBiNsIkGPqHqndhc';

const YT_PLAYER_STATE = {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5,
};

const readTwinPlayersSnapshot = async (page) => {
    return page.evaluate(() => {
        const players = window.__players;
        if (!players?.original || !players?.reaction) return null;

        const getProps = (p) => {
            let currentTime = 0;
            let paused = true;
            let readyState = 0;
            let error = null;
            let playerState = null;

            if (typeof p.getCurrentTime === 'function') {
                // YT Player
                currentTime = p.getCurrentTime();
                playerState = p.getPlayerState?.() ?? null;
                paused = playerState !== 1 && playerState !== 3; // 1=Playing, 3=Buffering
                readyState = 4;
                if (playerState === 5) readyState = 1;
                else if (playerState === -1) readyState = 0;
            } else {
                // HTMLVideoElement
                currentTime = p.currentTime;
                paused = p.paused;
                readyState = p.readyState;
                error = p.error;
            }

            return { currentTime, paused, readyState, error, playerState };
        };

        const original = getProps(players.original);
        const reaction = getProps(players.reaction);

        return {
            originalCurrentTime: original.currentTime,
            reactionCurrentTime: reaction.currentTime,
            originalPaused: original.paused,
            reactionPaused: reaction.paused,
            originalReadyState: original.readyState,
            reactionReadyState: reaction.readyState,
            originalError: original.error,
            reactionError: reaction.error,
            originalPlayerState: original.playerState,
            reactionPlayerState: reaction.playerState,
        };
    });
};

test('Basic Twin Video Sync Test', async ({ page }) => {
    // Navigate to the provided reaction page URL
    await page.goto(REACTION_PAGE_URL);

    // Wait for window.__players to be available and videos to be ready
    await page.waitForFunction(() => {
        const players = window.__players;
        if (!players || !players.original || !players.reaction) return false;

        // Helper to check readiness
        const isReady = (p) => {
            // If HTMLVideoElement
            if (typeof p.readyState === 'number') return p.readyState >= 3;
            // If YouTube Player
            if (typeof p.getPlayerState === 'function') {
                const state = p.getPlayerState();
                // YT States: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
                // We consider it "ready" if it's not undefined and loaded (cued or started)
                return typeof state === 'number';
            }
            return false;
        };

        return isReady(players.original) && isReady(players.reaction);
    }, null, { timeout: 30000 });

    // Ensure the YouTube iframes exist, then click each once (product-intended gate)
    await page.waitForFunction(() => {
        const players = window.__players;
        const originalIframe = players?.original?.getIframe?.();
        const reactionIframe = players?.reaction?.getIframe?.();
        return Boolean(originalIframe && reactionIframe);
    }, null, { timeout: 30000 });

    const { originalIframeId, reactionIframeId } = await page.evaluate(() => {
        const players = window.__players;
        const ensureId = (iframe, prefix) => {
            if (!iframe) return null;
            if (!iframe.id) iframe.id = `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
            return iframe.id;
        };

        return {
            originalIframeId: ensureId(players?.original?.getIframe?.(), 'original-yt'),
            reactionIframeId: ensureId(players?.reaction?.getIframe?.(), 'reaction-yt'),
        };
    });

    if (originalIframeId) {
        await page.locator(`#${originalIframeId}`).click({ timeout: 15000, force: true });
    }
    if (reactionIframeId) {
        await page.locator(`#${reactionIframeId}`).click({ timeout: 15000, force: true });
    }

    // Backup: attempt to play directly using exposed players (some environments ignore iframe clicks)
    await page.evaluate(() => {
        const players = window.__players;
        const play = (p) => {
            if (typeof p.play === 'function') p.play();
            else if (typeof p.playVideo === 'function') p.playVideo();
        };
        play(players.original);
        play(players.reaction);
    });

    // Product intent: reaction buffering may pause the original. So:
    // 1) wait until reaction is PLAYING, then
    // 2) wait until original is not paused, then
    // 3) measure drift when both are PLAYING.
    await expect
        .poll(
            async () => {
                const snapshot = await readTwinPlayersSnapshot(page);
                return snapshot?.reactionPlayerState ?? null;
            },
            { timeout: 45000, intervals: [250, 500, 1000] },
        )
        .toBe(YT_PLAYER_STATE.PLAYING);

    await expect
        .poll(
            async () => {
                const snapshot = await readTwinPlayersSnapshot(page);
                if (!snapshot) return null;
                if (snapshot.reactionPlayerState !== YT_PLAYER_STATE.PLAYING) return null;
                return snapshot.originalPaused;
            },
            { timeout: 45000, intervals: [250, 500, 1000] },
        )
        .toBe(false);

    await expect
        .poll(
            async () => {
                const snapshot = await readTwinPlayersSnapshot(page);
                if (!snapshot) return null;
                if (snapshot.originalPlayerState !== YT_PLAYER_STATE.PLAYING) return null;
                if (snapshot.reactionPlayerState !== YT_PLAYER_STATE.PLAYING) return null;
                const t1 = snapshot.originalCurrentTime || 0;
                const t2 = snapshot.reactionCurrentTime || 0;
                return Math.abs(t1 - t2);
            },
            { timeout: 45000, intervals: [250, 500, 1000] },
        )
        .toBeLessThanOrEqual(0.15);

    const finalState = await readTwinPlayersSnapshot(page);
    const finalDrift = finalState
        ? Math.abs((finalState.originalCurrentTime || 0) - (finalState.reactionCurrentTime || 0))
        : null;
    console.log('Final Sync State:', finalState);
    console.log('Final Drift:', finalDrift);

    expect(finalState).not.toBeNull();

    // readyState >= 3
    expect(finalState.originalReadyState, 'Original video readyState').toBeGreaterThanOrEqual(3);
    expect(finalState.reactionReadyState, 'Reaction video readyState').toBeGreaterThanOrEqual(3);

    // No media errors
    expect(finalState.originalError, 'Original video error').toBeNull();
    expect(finalState.reactionError, 'Reaction video error').toBeNull();
});
