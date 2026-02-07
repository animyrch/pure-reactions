import { test, expect } from '@playwright/test';
import {
    YT_PLAYER_STATE,
    readTwinPlayersSnapshot,
    waitForPlayersReady,
    startPlaybackInteraction
} from './utils/twin-player-helpers.js';

const REACTION_PAGE_URLS = {
    basicSync: '/reaction/1PaTrdCMKn6ay7nShHES',
    playTrigger: '/reaction/8O1sPJr6atB0K2CvyItV',
    volumeStability: '/reaction/Dw3UZ6PqZH37E5pbKmhZ',
    resumeAfterConfigPause: '/reaction/BUOR5TM6yAHSClCCRvIp',
};

const isActive = (state) => state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING;

test.describe('Twin Video Sync & Stability', () => {

    // Playwright default per-test timeout in this repo is 30s, but YouTube playback + autoplay gates
    // can legitimately take longer (especially on mobile).
    test.describe.configure({ timeout: 90000 });

    test('Basic Sync: should play both videos in sync', async ({ page }, testInfo) => {
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

        const drift = Math.abs((s.originalCurrentTime || 0) - (s.reactionCurrentTime || 0));
        expect(drift, 'Sync drift after 5s (seconds)').toBeLessThanOrEqual(driftThreshold);
    });

    test('Play Trigger: should start both videos within 2500ms', async ({ page }) => {
        await page.goto(REACTION_PAGE_URLS.playTrigger);

        // 1. Wait for readiness
        await waitForPlayersReady(page);

        // 2. Click both players so they actually start playback
        await startPlaybackInteraction(page);

        // 3. Give the players a brief head start
        await page.waitForTimeout(2500);

        const snapshot = await readTwinPlayersSnapshot(page);
        expect(snapshot, 'Expected twin players snapshot').toBeTruthy();
        expect(isActive(snapshot.originalPlayerState), 'Original should be playing or buffering').toBe(true);
        expect(isActive(snapshot.reactionPlayerState), 'Reaction should be playing or buffering').toBe(true);
    });

    test('Volume Stability: should preserve sync when volume changes automatically', async ({ page }, testInfo) => {
        await page.goto(REACTION_PAGE_URLS.volumeStability);

        const isMobileProject = testInfo.project.name === 'mobile';
        const driftThreshold = 0.5;
        const volumeConfigTimeSeconds = 5;

        const looksLikeTenPercent = (vol) => Number.isFinite(Number(vol)) && Math.abs(Number(vol) - 10) <= 2;

        const hasExpectedReactionVolumeChangeDesktop = (initial, current) => {
            // Desktop expectation: both start audible; reaction volume is forced down to ~10 around 5s.
            const initialVol = Number(initial.reactionVolume);
            const currentVol = Number(current.reactionVolume);
            const volChanged = Number.isFinite(initialVol) && Number.isFinite(currentVol)
                ? Math.abs(initialVol - currentVol)
                : 0;
            const clearlyChanged = volChanged >= 5;

            return current.reactionMuted === false && looksLikeTenPercent(currentVol) && clearlyChanged;
        };

        const hasExpectedMobileAudioGateSwap = (initial, current) => {
            // Mobile expectation (audio gate): original starts muted; reaction starts unmuted.
            // At ~5s, reaction volume is configured down to 10%, so original becomes the audio winner:
            // original unmuted, reaction muted.
            const sawExpectedInitial = initial.originalMuted === true && initial.reactionMuted === false;
            const sawExpectedAfter = current.originalMuted === false && current.reactionMuted === true;
            return sawExpectedInitial && sawExpectedAfter;
        };

        const computeDrift = (s) => Math.abs((s.originalCurrentTime || 0) - (s.reactionCurrentTime || 0));

        // 1. Setup & Start
        await waitForPlayersReady(page);
        await startPlaybackInteraction(page);

        // 2. Wait until both are actively playing/buffering.
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) return false;
            return isActive(s.reactionPlayerState) && isActive(s.originalPlayerState);
        }, { timeout: 45000 }).toBe(true);

        // 3. Capture a baseline around ~1s of playback (no fixed wait; we gate on playback time).
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) return -1;
            if (!isActive(s.reactionPlayerState) || !isActive(s.originalPlayerState)) return -1;
            return Number(s.reactionCurrentTime || 0);
        }, { timeout: 20000 }).toBeGreaterThanOrEqual(1);

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

        if (isMobileProject) {
            expect(initial.originalMuted, 'Mobile: original should start muted').toBe(true);
            expect(initial.reactionMuted, 'Mobile: reaction should start unmuted').toBe(false);
        } else {
            // Desktop should start audible on both.
            expect(initial.originalMuted, 'Desktop: original should start unmuted').toBe(false);
            expect(initial.reactionMuted, 'Desktop: reaction should start unmuted').toBe(false);

            // Best-effort: the fixture intends both to start at full volume.
            expect(Number(initial.originalVolume), 'Desktop: original should start near full volume').toBeGreaterThanOrEqual(70);
            expect(Number(initial.reactionVolume), 'Desktop: reaction should start near full volume').toBeGreaterThanOrEqual(70);
        }

        const baselineDrift = computeDrift(initialSnapshot);
        // Baseline can be slightly noisy right after start/buffer; don't fail on tiny overshoots.
        expect(baselineDrift, 'Baseline sync drift (~1s)').toBeLessThanOrEqual(driftThreshold);

        // Sanity-check that the page actually has a REACTION volume config around 5s.
        // `useTwinPlayers` exposes this as `window.reactionVolumeConfigs` for debug purposes.
        const reactionVolumeConfigDebug = await page.evaluate(() => {
            const vc = window.reactionVolumeConfigs;
            if (!vc) return { hasAny: false, hasAtFive: false, kind: 'missing', sample: null };

            if (Array.isArray(vc)) {
                const times = vc
                    .map((e) => Number(e?.t ?? e?.[0] ?? e?.time))
                    .filter((n) => Number.isFinite(n));
                const hasAtFive = times.some((t) => Math.abs(t - 5) <= 0.11);
                return { hasAny: vc.length > 0, hasAtFive, kind: 'array', sample: vc.slice(0, 5) };
            }

            if (typeof vc === 'object') {
                const keys = Object.keys(vc);
                const times = keys.map((k) => Number(k)).filter((n) => Number.isFinite(n));
                const hasAtFive = times.some((t) => Math.abs(t - 5) <= 0.11);
                return { hasAny: keys.length > 0, hasAtFive, kind: 'object', sample: keys.slice(0, 8) };
            }

            return { hasAny: true, hasAtFive: false, kind: typeof vc, sample: null };
        });

        console.log(`[Test] reactionVolumeConfigs debug | kind=${reactionVolumeConfigDebug.kind} hasAny=${reactionVolumeConfigDebug.hasAny} hasAtFive=${reactionVolumeConfigDebug.hasAtFive}`);
        if (!reactionVolumeConfigDebug.hasAny) {
            console.log('[Test] Warning: window.reactionVolumeConfigs was empty at baseline; continuing and relying on observed volume/mute changes.');
        } else if (!reactionVolumeConfigDebug.hasAtFive) {
            console.log('[Test] Warning: window.reactionVolumeConfigs did not show an entry at ~5s; continuing and relying on observed volume/mute changes.');
        }

        // 4. Wait until we cross the configured volume timeline point (~5s).
        await expect.poll(async () => {
            const s = await readTwinPlayersSnapshot(page);
            if (!s) return -1;
            if (!isActive(s.reactionPlayerState) || !isActive(s.originalPlayerState)) return -1;
            return Number(s.reactionCurrentTime || 0);
        }, { timeout: isMobileProject ? 60000 : 45000 }).toBeGreaterThanOrEqual(volumeConfigTimeSeconds);

        const reactionVolumeConfigDebugAtFive = await page.evaluate(() => {
            const vc = window.reactionVolumeConfigs;
            if (!vc) return { hasAny: false, hasAtFive: false, kind: 'missing', sample: null };

            if (Array.isArray(vc)) {
                const times = vc
                    .map((e) => Number(e?.t ?? e?.[0] ?? e?.time))
                    .filter((n) => Number.isFinite(n));
                const hasAtFive = times.some((t) => Math.abs(t - 5) <= 0.11);
                return { hasAny: vc.length > 0, hasAtFive, kind: 'array', sample: vc.slice(0, 5) };
            }

            if (typeof vc === 'object') {
                const keys = Object.keys(vc);
                const times = keys.map((k) => Number(k)).filter((n) => Number.isFinite(n));
                const hasAtFive = times.some((t) => Math.abs(t - 5) <= 0.11);
                return { hasAny: keys.length > 0, hasAtFive, kind: 'object', sample: keys.slice(0, 8) };
            }

            return { hasAny: true, hasAtFive: false, kind: typeof vc, sample: null };
        });

        console.log(`[Test] reactionVolumeConfigs @~5s | kind=${reactionVolumeConfigDebugAtFive.kind} hasAny=${reactionVolumeConfigDebugAtFive.hasAny} hasAtFive=${reactionVolumeConfigDebugAtFive.hasAtFive}`);

        // 5. Detect the expected volume/mute outcome AFTER we reach the config time.
        // Use a manual loop so failures include the last observed snapshot + config debug.
        const changeTimeoutMs = isMobileProject ? 20000 : 15000;
        const changeStart = Date.now();
        let changeSnapshot = null;
        let lastSnapshot = null;

        while (Date.now() - changeStart < changeTimeoutMs) {
            const s = await readTwinPlayersSnapshot(page);
            lastSnapshot = s;
            if (!s) {
                await page.waitForTimeout(250);
                continue;
            }
            if (!isActive(s.reactionPlayerState) || !isActive(s.originalPlayerState)) {
                await page.waitForTimeout(250);
                continue;
            }
            if ((s.reactionCurrentTime || 0) < volumeConfigTimeSeconds) {
                await page.waitForTimeout(250);
                continue;
            }

            const ok = isMobileProject
                ? hasExpectedMobileAudioGateSwap(initial, s)
                : hasExpectedReactionVolumeChangeDesktop(initial, s);

            if (ok) {
                changeSnapshot = s;
                break;
            }

            await page.waitForTimeout(250);
        }

        if (!changeSnapshot) {
            const debugOnTimeout = await page.evaluate(() => {
                const summarize = (value) => {
                    if (!value) return { hasAny: false, kind: 'missing' };
                    if (Array.isArray(value)) {
                        const times = value
                            .map((e) => Number(e?.t ?? e?.[0] ?? e?.time))
                            .filter((n) => Number.isFinite(n));
                        const hasAtFive = times.some((t) => Math.abs(t - 5) <= 0.11);
                        return { hasAny: value.length > 0, kind: 'array', len: value.length, hasAtFive };
                    }
                    if (typeof value === 'object') {
                        const keys = Object.keys(value);
                        const times = keys.map((k) => Number(k)).filter((n) => Number.isFinite(n));
                        const hasAtFive = times.some((t) => Math.abs(t - 5) <= 0.11);
                        return { hasAny: keys.length > 0, kind: 'object', len: keys.length, hasAtFive };
                    }
                    return { hasAny: true, kind: typeof value };
                };

                return {
                    volumeConfigs: summarize(window.volumeConfigs),
                    reactionVolumeConfigs: summarize(window.reactionVolumeConfigs)
                };
            });

            const rTime = Number(lastSnapshot?.reactionCurrentTime ?? -1);
            const oVol = lastSnapshot?.originalVolume;
            const oMuted = lastSnapshot?.originalMuted;
            const rVol = lastSnapshot?.reactionVolume;
            const rMuted = lastSnapshot?.reactionMuted;
            const oState = lastSnapshot?.originalPlayerState;
            const rState = lastSnapshot?.reactionPlayerState;

            throw new Error(
                `Timed out waiting for expected volume/mute outcome after ~${volumeConfigTimeSeconds}s. `
                + `Last snapshot: reactionTime=${rTime.toFixed(2)} `
                + `O=${oVol}/${oMuted} R=${rVol}/${rMuted} `
                + `originalState=${oState} reactionState=${rState}. window.configs=${JSON.stringify(debugOnTimeout)}`
            );
        }

        const afterChangeSnapshot = await readTwinPlayersSnapshot(page);
        expect(afterChangeSnapshot, 'Expected twin players snapshot after volume change').toBeTruthy();

        console.log(
            `[Test] After change Vol/Mute | O: ${afterChangeSnapshot.originalVolume}/${afterChangeSnapshot.originalMuted} | R: ${afterChangeSnapshot.reactionVolume}/${afterChangeSnapshot.reactionMuted}`
        );

        // Assert the outcome we care about really happened (explicit, not best-effort).
        if (isMobileProject) {
            expect(
                hasExpectedMobileAudioGateSwap(initial, afterChangeSnapshot),
                'Mobile: expected original to unmute and reaction to mute at ~5s due to audio gate'
            ).toBe(true);
        } else {
            expect(
                hasExpectedReactionVolumeChangeDesktop(initial, afterChangeSnapshot),
                'Desktop: expected reaction volume to drop to ~10 at ~5s per config'
            ).toBe(true);
        }

        // 6. Validate we kept playing and drift stayed bounded after the change.
        expect(isActive(afterChangeSnapshot.originalPlayerState), 'Original video should keep playing').toBe(true);
        expect(isActive(afterChangeSnapshot.reactionPlayerState), 'Reaction video should keep playing').toBe(true);

        const driftAfter = computeDrift(afterChangeSnapshot);
        expect(driftAfter, 'Sync drift after volume change').toBeLessThanOrEqual(driftThreshold);

        // Optional safety: the volume change itself should not introduce a sudden drift spike.
        const allowedSpike = 0.5;
        expect(driftAfter, 'Drift spike after volume change').toBeLessThanOrEqual(Math.max(driftThreshold, baselineDrift + allowedSpike));
    });

    test('Resume After Config Pause: should resume only reaction when original is paused by timeline', async ({ page }) => {
        await page.goto(REACTION_PAGE_URLS.resumeAfterConfigPause);

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
