/**
 * Constants for YouTube Player States
 */
export const YT_PLAYER_STATE = {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5,
};

/**
 * Reads the current state of twin players from the window object.
 * Returns a snapshot of time, state, readiness, error, and VOLUME.
 * @param {import('@playwright/test').Page} page
 */
export const readTwinPlayersSnapshot = async (page) => {
    return page.evaluate(() => {
        const players = window.__players;
        if (!players?.original || !players?.reaction) return null;

        const getProps = (p) => {
            let currentTime = 0;
            let paused = true;
            let readyState = 0;
            let error = null;
            let playerState = null;
            let volume = -1; // Default indicator for unknown/unavailable
            let isMuted = false;

            if (typeof p.getCurrentTime === 'function') {
                // YT Player
                currentTime = p.getCurrentTime();
                playerState = p.getPlayerState?.() ?? null;
                paused = playerState !== 1 && playerState !== 3; // 1=Playing, 3=Buffering
                readyState = 4;
                // Try to get volume if available
                if (typeof p.getVolume === 'function') {
                    volume = p.getVolume();
                }
                if (typeof p.isMuted === 'function') {
                    isMuted = p.isMuted();
                }

                if (playerState === 5) readyState = 1;
                else if (playerState === -1) readyState = 0;
            } else {
                // HTMLVideoElement
                currentTime = p.currentTime;
                paused = p.paused;
                readyState = p.readyState;
                error = p.error;
                volume = p.volume * 100; // Unify scale 0-100 like YT
                isMuted = p.muted;
            }

            return { currentTime, paused, readyState, error, playerState, volume, isMuted };
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
            originalVolume: original.volume,
            reactionVolume: reaction.volume,
            originalMuted: original.isMuted,
            reactionMuted: reaction.isMuted,
        };
    });
};

/**
 * Waits for twin players to be fully initialized and ready.
 * Uses extended timeout in CI environments to handle slower initialization.
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Optional timeout override. Defaults to 60s in CI, 30s locally.
 */
export const waitForPlayersReady = async (page, timeout = process.env.CI ? 60000 : 30000) => {
    // Add diagnostic logging to help debug missing players
    await page.evaluate(() => {
        const players = window.__players;
        if (!players) {
            console.log('[waitForPlayersReady] window.__players is not defined');
        } else if (!players.original) {
            console.log('[waitForPlayersReady] window.__players.original is missing');
        } else if (!players.reaction) {
            console.log('[waitForPlayersReady] window.__players.reaction is missing');
        } else {
            console.log('[waitForPlayersReady] Both players exist, checking ready state...');
        }
    });

    try {
        await page.waitForFunction(() => {
            const players = window.__players;
            if (!players || !players.original || !players.reaction) return false;

            const isReady = (p) => {
                // If HTMLVideoElement
                if (typeof p.readyState === 'number') return p.readyState >= 3;
                // If YouTube Player
                if (typeof p.getPlayerState === 'function') {
                    const state = p.getPlayerState();
                    return typeof state === 'number'; // Ready if state is accessible
                }
                return false;
            };

            return isReady(players.original) && isReady(players.reaction);
        }, null, { timeout });
    } catch (error) {
        // Add detailed error information on timeout
        const diagnostics = await page.evaluate(() => {
            const players = window.__players;
            return {
                playersExists: !!players,
                originalExists: !!players?.original,
                reactionExists: !!players?.reaction,
                originalType: players?.original ? typeof players.original : 'undefined',
                reactionType: players?.reaction ? typeof players.reaction : 'undefined',
                originalReadyState: players?.original?.readyState,
                reactionReadyState: players?.reaction?.readyState,
                originalHasGetPlayerState: typeof players?.original?.getPlayerState === 'function',
                reactionHasGetPlayerState: typeof players?.reaction?.getPlayerState === 'function'
            };
        });
        
        throw new Error(
            `waitForPlayersReady timed out after ${timeout}ms. ` +
            `Diagnostics: ${JSON.stringify(diagnostics, null, 2)}\n` +
            `Original error: ${error.message}`
        );
    }
};

/**
 * Ensures YouTube iframes are clickable and attempts to start them.
 * @param {import('@playwright/test').Page} page
 */
export const startPlaybackInteraction = async (page) => {
    // Ensure iframes exist
    await page.waitForFunction(() => {
        const players = window.__players;
        return Boolean(players?.original?.getIframe?.() && players?.reaction?.getIframe?.());
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

    if (originalIframeId) await page.locator(`#${originalIframeId}`).click({ force: true }).catch(() => { });
    if (reactionIframeId) await page.locator(`#${reactionIframeId}`).click({ force: true }).catch(() => { });

    const isMobileLikeUA = await page.evaluate(() => /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent));

    // If both players are already playing/buffering, don't spend extra time poking around inside
    // the iframe UI (those lookups can cost multiple seconds per step on mobile).
    const alreadyActive = await page.evaluate(() => {
        const players = window.__players;
        const isActive = (p) => {
            try {
                if (typeof p?.getPlayerState === 'function') {
                    const s = p.getPlayerState();
                    return s === 1 || s === 3;
                }
                if (typeof p?.paused === 'boolean') {
                    return !p.paused;
                }
            } catch {
                // ignore
            }
            return false;
        };

        return Boolean(players?.original && players?.reaction && isActive(players.original) && isActive(players.reaction));
    });

    // On mobile browsers (esp. iOS/WebKit), calling `playVideo()` from JS outside of a
    // user gesture is often blocked. Best-effort: click YouTube's own UI inside the
    // iframe to initiate playback with a real user gesture.
    if (isMobileLikeUA && !alreadyActive) {
        const tryStartYoutubePlaybackInFrame = async (iframeId) => {
            if (!iframeId) return;
            const frame = page.frameLocator(`#${iframeId}`);

            // YouTube embeds can show a "Show player controls" affordance first.
            await frame
                .getByRole('button', { name: /show player controls/i })
                .first()
                .click({ timeout: 2500 })
                .catch(() => { });

            // Try common play button labels (varies by locale/version).
            await frame
                .getByRole('button', { name: /^play$/i })
                .first()
                .click({ timeout: 2500 })
                .catch(() => { });
            await frame
                .getByRole('button', { name: /^replay$/i })
                .first()
                .click({ timeout: 2500 })
                .catch(() => { });

            // Most reliable: click the big play overlay if present.
            await frame
                .locator('.ytp-large-play-button')
                .first()
                .click({ timeout: 2500 })
                .catch(() => { });

            // Another fallback: click the player surface.
            await frame
                .locator('body')
                .click({ timeout: 2500 })
                .catch(() => { });

            // Fallback: click the iframe again (often toggles play).
            await page
                .locator(`#${iframeId}`)
                .click({ timeout: 2500, force: true })
                .catch(() => { });
        };

        await tryStartYoutubePlaybackInFrame(originalIframeId);
        await tryStartYoutubePlaybackInFrame(reactionIframeId);
    }

    // Backup direct play call
    await page.evaluate(() => {
        const players = window.__players;
        const play = (p) => {
            if (typeof p.play === 'function') p.play();
            else if (typeof p.playVideo === 'function') p.playVideo();
        };
        play(players.original);
        play(players.reaction);
    });
};
