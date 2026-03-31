import { describe, it, expect } from 'vitest';
import {
    buildReactionTransportConfigs,
    RECORDER_PLAYER_STATES,
} from '../../src/lib/helpers/recorderState.js';
import { deriveTimelines } from '../../src/lib/helpers/reactionPlayer.ts';
import { computeTwinPlayersSyncTick } from '../../src/lib/helpers/twinPlayersSyncTick.ts';
import { applyTwinPlayersSyncActions } from '../../src/lib/helpers/twinPlayersSyncApply.ts';

const YT_STATES = { PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5, ENDED: 0 };

const makeBaseInput = (overrides = {}) => ({
    reactionCurrentTime: 0,
    previousReactionTime: 0,
    seekMin: 0,
    seekMax: 100000,
    timeOffset: 0,
    globalGain: 1,
    isFineTuneModeOn: false,
    isFullscreen: false,
    currentStateOriginalVideo: -1,
    currentPlaybackRate: 1,
    currentVolumeOriginalVideo: 100,
    currentVolumeReactionVideo: 100,
    currentFullscreenOverlayVisible: true,
    isReactionMuteModeEnabled: false,
    isReactionAutoMuted: false,
    isMobileAudioEnvironment: false,
    isMobilePlaybackDevice: false,
    playerConfigs: {},
    volumeConfigs: {},
    reactionVolumeConfigs: {},
    playbackRateConfigs: {},
    overlayVisibilityTimeline: [],
    stateTimeline: [],
    reactionTransportTrack: [],
    now: 1000,
    yt: YT_STATES,
    ...overrides,
});

const makeTracking = (overrides = {}) => ({
    lastOriginalSeekAt: 0,
    mobileAudioWinner: null,
    lastSoftSyncAt: 0,
    softSyncIsActive: false,
    ...overrides,
});

describe('buildReactionTransportConfigs', () => {
    it('creates an initial PLAYING entry at t=0', () => {
        const result = buildReactionTransportConfigs({
            existingConfigs: new Map(),
            reactionVideoTime: '0.0',
            stateCode: RECORDER_PLAYER_STATES.PLAYING,
        });

        expect(result.entries).toEqual([
            ['0.0', { state: RECORDER_PLAYER_STATES.PLAYING }],
        ]);
        expect(result.object).toEqual({
            '0.0': { state: RECORDER_PLAYER_STATES.PLAYING },
        });
    });

    it('adds a PAUSED entry at finish time', () => {
        const start = buildReactionTransportConfigs({
            existingConfigs: new Map(),
            reactionVideoTime: '0.0',
            stateCode: RECORDER_PLAYER_STATES.PLAYING,
        });
        const finish = buildReactionTransportConfigs({
            existingConfigs: start.map,
            reactionVideoTime: '45.0',
            stateCode: RECORDER_PLAYER_STATES.PAUSED,
        });

        expect(finish.entries).toEqual([
            ['0.0', { state: RECORDER_PLAYER_STATES.PLAYING }],
            ['45.0', { state: RECORDER_PLAYER_STATES.PAUSED }],
        ]);
    });

    it('normalizes BUFFERING state to PAUSED', () => {
        const result = buildReactionTransportConfigs({
            existingConfigs: new Map(),
            reactionVideoTime: '10.0',
            stateCode: RECORDER_PLAYER_STATES.BUFFERING,
        });

        expect(result.entries[0][1].state).toBe(RECORDER_PLAYER_STATES.PAUSED);
    });
});

describe('deriveTimelines — reactionTransportTrack migration', () => {
    it('uses existing reactionTransportTrack when present', () => {
        const doc = {
            reactionTransportTrack: [
                { t: 0, state: 1 },
                { t: 60, state: 2 },
            ],
        };
        const { reactionTransportTrack } = deriveTimelines(doc);
        expect(reactionTransportTrack).toEqual([
            { t: 0, state: 1 },
            { t: 60, state: 2 },
        ]);
    });

    it('defaults to playing at t=0 when no reactionTransportTrack in document', () => {
        const doc = {};
        const { reactionTransportTrack } = deriveTimelines(doc);
        expect(reactionTransportTrack).toEqual([{ t: 0, state: 1 }]);
    });

    it('defaults to playing at t=0 when reactionTransportTrack is an empty array', () => {
        const doc = { reactionTransportTrack: [] };
        const { reactionTransportTrack } = deriveTimelines(doc);
        expect(reactionTransportTrack).toEqual([{ t: 0, state: 1 }]);
    });
});

describe('computeTwinPlayersSyncTick — reaction transport track', () => {
    it('emits applyReactionStateChange PAUSED when crossing a PAUSED boundary', () => {
        const input = makeBaseInput({
            reactionTransportTrack: [
                { t: 0, state: 1 },
                { t: 10, state: 2 },
            ],
            previousReactionTime: 9.5,
            reactionCurrentTime: 10.1,
            reactionPlayerState: YT_STATES.PLAYING,
        });

        const { actions } = computeTwinPlayersSyncTick(input, makeTracking());
        const reactionAction = actions.find(a => a.type === 'applyReactionStateChange');
        expect(reactionAction).toBeDefined();
        expect(reactionAction.nextState).toBe(YT_STATES.PAUSED);
    });

    it('emits applyReactionStateChange PLAYING when crossing a PLAYING boundary', () => {
        const input = makeBaseInput({
            reactionTransportTrack: [
                { t: 0, state: 2 },
                { t: 5, state: 1 },
            ],
            previousReactionTime: 4.5,
            reactionCurrentTime: 5.1,
            reactionPlayerState: YT_STATES.PAUSED,
        });

        const { actions } = computeTwinPlayersSyncTick(input, makeTracking());
        const reactionAction = actions.find(a => a.type === 'applyReactionStateChange');
        expect(reactionAction).toBeDefined();
        expect(reactionAction.nextState).toBe(YT_STATES.PLAYING);
    });

    it('does not emit applyReactionStateChange when no boundary is crossed', () => {
        const input = makeBaseInput({
            reactionTransportTrack: [
                { t: 0, state: 1 },
                { t: 30, state: 2 },
            ],
            previousReactionTime: 5,
            reactionCurrentTime: 6,
            reactionPlayerState: YT_STATES.PLAYING,
        });

        const { actions } = computeTwinPlayersSyncTick(input, makeTracking());
        const reactionAction = actions.find(a => a.type === 'applyReactionStateChange');
        expect(reactionAction).toBeUndefined();
    });

    it('does NOT emit applyOriginalStateChange(PAUSED) when transport track pauses the reaction and isFineTuneModeOn is true', () => {
        // Regression: previously isFineTuneModeOn + reaction paused → shouldHoldOriginalWhilePaused=true
        // → effectiveConfigState=PAUSED even though original's config says PLAYING.
        const input = makeBaseInput({
            isFineTuneModeOn: true,
            // Transport track intends reaction to be PAUSED at this point
            reactionTransportTrack: [
                { t: 0, state: YT_STATES.PLAYING },
                { t: 115, state: YT_STATES.PAUSED },
            ],
            // Reaction is currently paused (as commanded by transport track)
            reactionPlayerState: YT_STATES.PAUSED,
            reactionCurrentTime: 115.8,
            previousReactionTime: 115.7,
            // Original's config says PLAYING — use array format so getCurrentStateFromStateConfigs
            // correctly returns state PLAYING for the current time.
            playerConfigs: [{ t: 0, state: YT_STATES.PLAYING, targetTime: 0 }],
            currentStateOriginalVideo: YT_STATES.PLAYING,
            originalPlayerState: YT_STATES.PLAYING,
            originalCurrentTime: 50,
        });

        const { actions } = computeTwinPlayersSyncTick(input, makeTracking());
        const pauseActions = actions.filter(
            a => a.type === 'pauseOriginal' ||
                (a.type === 'applyOriginalStateChange' && a.nextState !== YT_STATES.PLAYING)
        );
        expect(pauseActions).toHaveLength(0);
    });

    it('does NOT emit seek corrections for the original when transport track pauses the reaction (anti-loop)', () => {
        // Regression: while reaction is transport-paused, reactionCurrentTime is frozen so
        // computedTargetTime never advances. Without the fix, drift grows → hard seek fires
        // every ~3.5 s → original loops back a few seconds.
        const frozenReactionTime = 115.8;
        const input = makeBaseInput({
            isFineTuneModeOn: true,
            reactionTransportTrack: [
                { t: 0, state: YT_STATES.PLAYING },
                { t: 115, state: YT_STATES.PAUSED },
            ],
            reactionPlayerState: YT_STATES.PAUSED,
            reactionCurrentTime: frozenReactionTime,
            previousReactionTime: frozenReactionTime,
            playerConfigs: [{ t: 0, state: YT_STATES.PLAYING, targetTime: 0 }],
            currentStateOriginalVideo: YT_STATES.PLAYING,
            originalPlayerState: YT_STATES.PLAYING,
            // Original has drifted far ahead of the frozen target (simulates several seconds of free play)
            originalCurrentTime: 125,
            originalDuration: 300,
            now: 1000,
        });

        const { actions } = computeTwinPlayersSyncTick(
            input,
            makeTracking({ lastOriginalSeekAt: 0 }) // cooldown expired → seek would normally fire
        );
        const seekActions = actions.filter(a => a.type === 'applyOriginalStateChange');
        expect(seekActions).toHaveLength(0);
    });

    it('virtual-time: stop-original config fires during transport-pause window', () => {
        // Regression: with frozen reactionCurrentTime, config events at later times never
        // fired. With virtual reaction time (advancing via original clock), they do.
        //
        // Setup:
        //   - Transport PAUSE at reaction t=100. Reaction frozen at 100.
        //   - transportPauseStart saved: reactionTime=100, originalTime=50.
        //   - Original has played 22s since pause start → originalCurrentTime=72.
        //   - virtualReactionTime = 100 + (72-50) = 122.
        //   - playerConfig says: PAUSED (stop original) at t=120 (effective=120, no timeOffset).
        //   - Original is currently PLAYING → shouldApplyState=true → PAUSE action fires.
        const input = makeBaseInput({
            isFineTuneModeOn: true,
            reactionTransportTrack: [
                { t: 0, state: YT_STATES.PLAYING },
                { t: 100, state: YT_STATES.PAUSED },
            ],
            reactionPlayerState: YT_STATES.PAUSED,
            reactionCurrentTime: 100,
            previousReactionTime: 100,
            // Original config: play from 0, then stop at reaction-time 120
            playerConfigs: [
                { t: 0, state: YT_STATES.PLAYING, targetTime: 0 },
                { t: 120, state: YT_STATES.PAUSED, targetTime: 70 },
            ],
            currentStateOriginalVideo: YT_STATES.PLAYING,
            originalPlayerState: YT_STATES.PLAYING,
            originalCurrentTime: 72,
            originalDuration: 300,
            now: 2000,
        });

        // Tracking with saved pause-start values (as would be set on the tick when PAUSE fired)
        const tracking = makeTracking({
            lastOriginalSeekAt: 0,
            transportPauseStartReactionTime: 100,
            transportPauseStartOriginalTime: 50,
            lastVirtualReactionTime: 121, // previous virtual time
        });

        const { actions } = computeTwinPlayersSyncTick(input, tracking);
        const pauseAction = actions.find(
            a => a.type === 'applyOriginalStateChange' && a.nextState === YT_STATES.PAUSED
        );
        expect(pauseAction).toBeDefined();
    });

    it('virtual-time: resume-reaction transport config fires during transport-pause window', () => {
        // Regression: with frozen reactionCurrentTime, transport PLAY entry at a later time
        // never fires. With virtual reaction time it does.
        //
        // Setup:
        //   - Transport PAUSE at t=100, PLAY at t=108.
        //   - Reaction frozen at 100. virtualReactionTime = 100 + (58-50) = 108.
        //   - previousVirtualReactionTime = 107 → the PLAY entry at 108 is in the window (107, 108].
        //   - Reaction is currently PAUSED → applyReactionStateChange(PLAYING) fires.
        const input = makeBaseInput({
            isFineTuneModeOn: true,
            reactionTransportTrack: [
                { t: 0, state: YT_STATES.PLAYING },
                { t: 100, state: YT_STATES.PAUSED },
                { t: 108, state: YT_STATES.PLAYING },
            ],
            reactionPlayerState: YT_STATES.PAUSED,
            reactionCurrentTime: 100,
            previousReactionTime: 100,
            playerConfigs: [{ t: 0, state: YT_STATES.PLAYING, targetTime: 0 }],
            currentStateOriginalVideo: YT_STATES.PLAYING,
            originalPlayerState: YT_STATES.PLAYING,
            originalCurrentTime: 58,
            originalDuration: 300,
            now: 3000,
        });

        const tracking = makeTracking({
            transportPauseStartReactionTime: 100,
            transportPauseStartOriginalTime: 50,
            lastVirtualReactionTime: 107, // previous virtual time (just before PLAY entry at 108)
            reactionTransportTrackIndex: 2, // cursor pointing at PLAY entry at 108
        });

        const { actions } = computeTwinPlayersSyncTick(input, tracking);
        const resumeAction = actions.find(
            a => a.type === 'applyReactionStateChange' && a.nextState === YT_STATES.PLAYING
        );
        expect(resumeAction).toBeDefined();
    });

    it('virtual-time: saves transportPauseStart values when transport PAUSE fires', () => {
        // When the transport PAUSE action fires, nextTracking must record the current
        // reaction and original times so subsequent ticks can compute virtual time.
        const input = makeBaseInput({
            reactionTransportTrack: [
                { t: 0, state: YT_STATES.PLAYING },
                { t: 10, state: YT_STATES.PAUSED },
            ],
            reactionPlayerState: YT_STATES.PLAYING,
            reactionCurrentTime: 10.5,
            previousReactionTime: 9.5,
            originalCurrentTime: 40,
        });

        const { nextTracking } = computeTwinPlayersSyncTick(input, makeTracking());
        expect(nextTracking.transportPauseStartReactionTime).toBe(10.5);
        expect(nextTracking.transportPauseStartOriginalTime).toBe(40);
    });

    it('virtual-time: sets transportPausePlayEntryT (not clears transportPauseStart) when transport PLAY fires via virtual time', () => {
        // When the transport PLAY entry fires (via the virtual-time cursor), the saved
        // pause-start values must be KEPT (not cleared) so that virtualReactionTime stays
        // elevated until the reaction's real clock catches up past the PLAY entry time.
        // transportPausePlayEntryT is saved to record when PLAY fired.
        const input = makeBaseInput({
            reactionTransportTrack: [
                { t: 0, state: YT_STATES.PLAYING },
                { t: 100, state: YT_STATES.PAUSED },
                { t: 108, state: YT_STATES.PLAYING },
            ],
            reactionPlayerState: YT_STATES.PAUSED,
            reactionCurrentTime: 100,
            previousReactionTime: 100,
            playerConfigs: [{ t: 0, state: YT_STATES.PLAYING, targetTime: 0 }],
            originalCurrentTime: 58,
            now: 3000,
        });

        const tracking = makeTracking({
            transportPauseStartReactionTime: 100,
            transportPauseStartOriginalTime: 50,
            lastVirtualReactionTime: 107,
            reactionTransportTrackIndex: 2,
        });

        const { nextTracking } = computeTwinPlayersSyncTick(input, tracking);
        // transportPauseStart* kept alive until reaction's real clock passes playEntryT + 0.5
        expect(nextTracking.transportPauseStartReactionTime).toBe(100);
        expect(nextTracking.transportPauseStartOriginalTime).toBe(50);
        // transportPausePlayEntryT records the PLAY entry time (108)
        expect(nextTracking.transportPausePlayEntryT).toBe(108);
    });

    it('virtual-time: clears all transport pause fields once reaction advances past playEntryT', () => {
        // Once reactionCurrentTime > transportPausePlayEntryT + 0.5 AND reaction is PLAYING,
        // all three transport pause fields are cleared and virtual time reverts to real time.
        const input = makeBaseInput({
            reactionTransportTrack: [
                { t: 0, state: YT_STATES.PLAYING },
                { t: 100, state: YT_STATES.PAUSED },
                { t: 108, state: YT_STATES.PLAYING },
            ],
            reactionPlayerState: YT_STATES.PLAYING,
            reactionCurrentTime: 109, // > 108 + 0.5 → reaction has resumed past the PLAY entry
            previousReactionTime: 108,
            playerConfigs: [{ t: 0, state: YT_STATES.PLAYING, targetTime: 0 }],
            originalCurrentTime: 65,
            now: 4000,
        });

        const tracking = makeTracking({
            transportPauseStartReactionTime: 100,
            transportPauseStartOriginalTime: 50,
            transportPausePlayEntryT: 108,
            lastVirtualReactionTime: 115,
            reactionTransportTrackIndex: 3,
        });

        const { nextTracking } = computeTwinPlayersSyncTick(input, tracking);
        expect(nextTracking.transportPauseStartReactionTime).toBeUndefined();
        expect(nextTracking.transportPauseStartOriginalTime).toBeUndefined();
        expect(nextTracking.transportPausePlayEntryT).toBeUndefined();
    });

    it('advances the reactionTransportTrackIndex in tracking', () => {
        const input = makeBaseInput({
            reactionTransportTrack: [
                { t: 0, state: 1 },
                { t: 10, state: 2 },
                { t: 20, state: 1 },
            ],
            previousReactionTime: 0,
            reactionCurrentTime: 5,
        });

        const { nextTracking } = computeTwinPlayersSyncTick(input, makeTracking());
        expect(nextTracking.reactionTransportTrackIndex).toBe(1);
    });

    it('emits correction when cursor is stale after backward seek and state mismatches', () => {
        const trackingWithStaleIdx = makeTracking({ reactionTransportTrackIndex: 3 });
        const input = makeBaseInput({
            reactionTransportTrack: [
                { t: 0, state: 1 },
                { t: 10, state: 2 },
            ],
            // Seek back to t=5 (between t=0 PLAYING and t=10 PAUSED)
            previousReactionTime: 5,
            reactionCurrentTime: 5,
            reactionPlayerState: YT_STATES.PAUSED, // currently paused but should be playing
        });

        const { actions } = computeTwinPlayersSyncTick(input, trackingWithStaleIdx);
        const reactionAction = actions.find(a => a.type === 'applyReactionStateChange');
        expect(reactionAction).toBeDefined();
        expect(reactionAction.nextState).toBe(YT_STATES.PLAYING);
    });

    it('includes next reaction transport boundary in nextBoundaryReactionTime', () => {
        const input = makeBaseInput({
            reactionTransportTrack: [
                { t: 0, state: 1 },
                { t: 30, state: 2 },
            ],
            previousReactionTime: 5,
            reactionCurrentTime: 5,
        });

        const { nextBoundaryReactionTime } = computeTwinPlayersSyncTick(input, makeTracking());
        // Next boundary should be t=30 (the PAUSED entry)
        expect(nextBoundaryReactionTime).toBe(30);
    });
});

// ---------------------------------------------------------------------------
// Multi-tick end-to-end simulation helpers
// ---------------------------------------------------------------------------

/**
 * Run `n` ticks, threading tracking through each call.
 *
 * Each `tickInputs[i]` is merged with `baseInput` (earlier keys win).
 * Returns the array of per-tick results plus the final tracking.
 */
function simulateTicks(baseInput, tickInputs) {
    let tracking = makeTracking();
    const results = [];
    for (const overrides of tickInputs) {
        const input = { ...baseInput, ...overrides };
        const result = computeTwinPlayersSyncTick(input, tracking);
        tracking = result.nextTracking;
        results.push(result);
    }
    return { results, finalTracking: tracking };
}

describe('multi-tick end-to-end simulation', () => {
    /**
     * Scenario A — "pause reaction, let original finish a segment, resume reaction"
     *
     * Transport track : PLAY@0, PAUSE@50, PLAY@60
     * Original config : PLAY from t=0 (targetTime=0), PAUSED at reaction-t=55 (original stops)
     *
     * Expected sequence:
     *   t=0-49  : both playing normally
     *   t=50    : transport PAUSE fires → reaction freezes at 50
     *   virtual 50-55 : original keeps playing, virtual time advances via original clock
     *   virtual 55  : stop-original config fires → original pauses
     *   virtual 60  : transport PLAY fires → reaction resumes  *eventually*
     *   real t=61   : reaction resumes past the PLAY entry → virtual time reverts to real
     */
    it('scenario A — reaction pause window: stop-original config fires, then reaction resumes without re-pausing', () => {
        const YT = YT_STATES;
        const baseInput = makeBaseInput({
            isFineTuneModeOn: true,
            reactionTransportTrack: [
                { t: 0, state: YT.PLAYING },
                { t: 50, state: YT.PAUSED },
                { t: 60, state: YT.PLAYING },
            ],
            playerConfigs: [
                { t: 0, state: YT.PLAYING, targetTime: 0 },
                { t: 55, state: YT.PAUSED, targetTime: 55 },
            ],
            seekMin: 0,
            seekMax: 100000,
            originalDuration: 300,
        });

        // Tick 0: both playing normally at t=5
        // Tick 1: reaction and original at t=10 — still normal
        // Tick 2: transport PAUSE fires (window crosses t=50)
        //         reactionCurrentTime=50, originalCurrentTime=50
        // Tick 3: reaction frozen at 50, original advances to 52 → virtual=52
        // Tick 4: original at 55.5 → virtual=55.5, original config changes to PAUSED
        // Tick 5: original at 60.5 → virtual=60.5, transport PLAY fires
        // Tick 6: reaction still frozen/resuming (50), original at 61.5 → virtual=61.5 (still active pause)
        // Tick 7: reaction PLAYING at 60.6 (> 60 + 0.5) → transport pause cleared, real time resumes
        // Tick 8: reaction PLAYING at 61 → normal forward scan, no spurious PAUSED action

        const ticks = [
            // Tick 0: normal play, before pause entry
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 5, previousReactionTime: 0,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 5, now: 100,
            },
            // Tick 1: still normal
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 10, previousReactionTime: 5,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 10, now: 200,
            },
            // Tick 2: transport PAUSE fires (window [10, 50.5] contains entry at 50)
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 50.5, previousReactionTime: 10,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 50.5, now: 500,
            },
            // Tick 3: reaction now frozen at 50.5 (PAUSED), original at 52
            {
                reactionPlayerState: YT.PAUSED, reactionCurrentTime: 50.5, previousReactionTime: 50.5,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 52, now: 600,
            },
            // Tick 4: original at 55.5 → virtual=50.5+(55.5-50.5)=55.5; original config PAUSED fires
            {
                reactionPlayerState: YT.PAUSED, reactionCurrentTime: 50.5, previousReactionTime: 50.5,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 55.5, now: 700,
            },
            // Tick 5: original at 60.5 → virtual=60.5; transport PLAY fires
            {
                reactionPlayerState: YT.PAUSED, reactionCurrentTime: 50.5, previousReactionTime: 50.5,
                currentStateOriginalVideo: YT.PAUSED, originalPlayerState: YT.PAUSED,
                originalCurrentTime: 60.5, now: 800,
            },
            // Tick 6: reaction still paused (not resumed yet), original at 61.5 → virtual still active
            {
                reactionPlayerState: YT.PAUSED, reactionCurrentTime: 50.5, previousReactionTime: 50.5,
                currentStateOriginalVideo: YT.PAUSED, originalPlayerState: YT.PAUSED,
                originalCurrentTime: 61.5, now: 900,
            },
            // Tick 7: reaction now PLAYING and real time > 60 + 0.5 → transport pause clears
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 61, previousReactionTime: 60,
                currentStateOriginalVideo: YT.PAUSED, originalPlayerState: YT.PAUSED,
                originalCurrentTime: 62, now: 1000,
            },
            // Tick 8: reaction advancing normally, no spurious PAUSED action should fire
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 62, previousReactionTime: 61,
                currentStateOriginalVideo: YT.PAUSED, originalPlayerState: YT.PAUSED,
                originalCurrentTime: 63, now: 1100,
            },
        ];

        const { results } = simulateTicks(baseInput, ticks);

        // Tick 2: transport PAUSE fires
        const tick2Actions = results[2].actions;
        const pauseAction = tick2Actions.find(a => a.type === 'applyReactionStateChange' && a.nextState === YT.PAUSED);
        expect(pauseAction, 'tick2: transport PAUSE should fire').toBeDefined();

        // Tick 4: stop-original config fires
        // Tick 4: stop-original config fires (virtual time crosses original-config entry at t=55)
        const tick4Actions = results[4].actions;
        const stopOriginalActionCorrect = tick4Actions.find(
            a => a.type === 'applyOriginalStateChange' && a.nextState === YT.PAUSED
        );
        expect(stopOriginalActionCorrect, 'tick4: stop-original config should fire when virtual crosses t=55').toBeDefined();

        // Tick 5: transport PLAY fires
        const tick5Actions = results[5].actions;
        const resumeAction = tick5Actions.find(
            a => a.type === 'applyReactionStateChange' && a.nextState === YT.PLAYING
        );
        expect(resumeAction, 'tick5: transport PLAY should fire').toBeDefined();

        // Ticks 7 & 8: NO spurious re-pause of reaction
        for (const tickIdx of [6, 7, 8]) {
            const spuriousPause = results[tickIdx]?.actions.find(
                a => a.type === 'applyReactionStateChange' && a.nextState === YT.PAUSED
            );
            expect(spuriousPause, `tick${tickIdx}: no spurious PAUSED action`).toBeUndefined();
        }
    });

    it('scenario B — two transport pauses in sequence: second pause fires correctly', () => {
        const YT = YT_STATES;
        const baseInput = makeBaseInput({
            isFineTuneModeOn: true,
            reactionTransportTrack: [
                { t: 0, state: YT.PLAYING },
                { t: 20, state: YT.PAUSED },
                { t: 25, state: YT.PLAYING },
                { t: 40, state: YT.PAUSED },
                { t: 50, state: YT.PLAYING },
            ],
            playerConfigs: [{ t: 0, state: YT.PLAYING, targetTime: 0 }],
            seekMin: 0,
            seekMax: 100000,
            originalDuration: 300,
        });

        const ticks = [
            // Normal play until first PAUSE at t=20
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 20.5, previousReactionTime: 0,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 20.5, now: 100,
            },
            // Reaction frozen, virtual advances: crosses PLAY@25
            {
                reactionPlayerState: YT.PAUSED, reactionCurrentTime: 20.5, previousReactionTime: 20.5,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 25.5, now: 200,
            },
            // Reaction resumes (PLAYING), real time 25.5 → real time advances past 25+0.5=25.5
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 26, previousReactionTime: 25,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 26, now: 300,
            },
            // Reaction at 30, approaching second PAUSE at t=40
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 30, previousReactionTime: 26,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 30, now: 400,
            },
            // Second PAUSE fires (t=40 in window)
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 40.5, previousReactionTime: 30,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 40.5, now: 500,
            },
            // Virtual advances past second PLAY@50
            {
                reactionPlayerState: YT.PAUSED, reactionCurrentTime: 40.5, previousReactionTime: 40.5,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 50.5, now: 600,
            },
        ];

        const { results } = simulateTicks(baseInput, ticks);

        // First PAUSE (tick 0)
        const firstPause = results[0].actions.find(a => a.type === 'applyReactionStateChange' && a.nextState === YT.PAUSED);
        expect(firstPause, 'first PAUSE should fire').toBeDefined();

        // First PLAY (tick 1)
        const firstPlay = results[1].actions.find(a => a.type === 'applyReactionStateChange' && a.nextState === YT.PLAYING);
        expect(firstPlay, 'first PLAY should fire').toBeDefined();

        // Second PAUSE (tick 4)
        const secondPause = results[4].actions.find(a => a.type === 'applyReactionStateChange' && a.nextState === YT.PAUSED);
        expect(secondPause, 'second PAUSE should fire').toBeDefined();

        // Second PLAY (tick 5)
        const secondPlay = results[5].actions.find(a => a.type === 'applyReactionStateChange' && a.nextState === YT.PLAYING);
        expect(secondPlay, 'second PLAY should fire').toBeDefined();
    });

    it('scenario C — no spurious re-pause on ticks after transport PLAY fires', () => {
        // Specifically exercises the bug where, after transport PLAY fires and the virtual
        // time is still elevated via the original clock, the stale cursor would find
        // PAUSE@50 and re-fire PAUSED on subsequent ticks.
        const YT = YT_STATES;
        const baseInput = makeBaseInput({
            isFineTuneModeOn: true,
            reactionTransportTrack: [
                { t: 0, state: YT.PLAYING },
                { t: 50, state: YT.PAUSED },
                { t: 60, state: YT.PLAYING },
            ],
            playerConfigs: [{ t: 0, state: YT.PLAYING, targetTime: 0 }],
            seekMin: 0,
            seekMax: 100000,
            originalDuration: 300,
        });

        // Set up post-PLAY state manually: transportPauseStart* set, transportPausePlayEntryT=60
        // Reaction just resumed (PLAYING) but real time is only 59 (not past 60.5 yet)
        // Simulate 6 ticks from this state (real time 59→65, no re-pause should happen)
        let tracking = makeTracking({
            transportPauseStartReactionTime: 50.5,
            transportPauseStartOriginalTime: 50.5,
            transportPausePlayEntryT: 60,
            lastVirtualReactionTime: 62,
            reactionTransportTrackIndex: 3,
            lastOriginalSeekAt: 0,
        });

        for (let i = 0; i < 6; i++) {
            const reactionTime = 59 + i; // 59, 60, 61, 62, 63, 64
            const originalTime = 60 + i;
            const input = makeBaseInput({
                isFineTuneModeOn: true,
                reactionTransportTrack: [
                    { t: 0, state: YT.PLAYING },
                    { t: 50, state: YT.PAUSED },
                    { t: 60, state: YT.PLAYING },
                ],
                playerConfigs: [{ t: 0, state: YT.PLAYING, targetTime: 0 }],
                reactionPlayerState: YT.PLAYING,
                reactionCurrentTime: reactionTime,
                previousReactionTime: reactionTime - 1,
                currentStateOriginalVideo: YT.PLAYING,
                originalPlayerState: YT.PLAYING,
                originalCurrentTime: originalTime,
                seekMin: 0, seekMax: 100000, originalDuration: 300, now: 1000 + i * 100,
            });

            const result = computeTwinPlayersSyncTick(input, tracking);
            tracking = result.nextTracking;

            const spuriousPause = result.actions.find(
                a => a.type === 'applyReactionStateChange' && a.nextState === YT.PAUSED
            );
            expect(spuriousPause, `tick${i} (reaction at ${reactionTime}): no spurious PAUSED`).toBeUndefined();
        }
    });
});

describe('applyTwinPlayersSyncActions — applyReactionStateChange', () => {
    const makeSnapshot = (overrides = {}) => ({
        currentVolumeOriginalVideo: 100,
        currentVolumeReactionVideo: 100,
        currentPlaybackRate: 1,
        playerOriginal: null,
        playerReaction: null,
        ...overrides,
    });

    const makeGuards = () => ({
        changingVolume: false,
        changingReactionVolume: false,
        changingSpeed: false,
    });

    it('calls controlReactionVideo with the desired next state', () => {
        const controlReactionVideoCalls = [];
        const deps = {
            setVolumeForOriginalVideo: () => {},
            setVolumeForReactionVideo: () => {},
            setPlaybackRateForOriginalVideo: () => {},
            pauseOriginalVideo: () => {},
            handleStateChangeInOriginalVideo: () => {},
            controlReactionVideo: (state) => controlReactionVideoCalls.push(state),
            muteReactionAudio: () => true,
            unmuteReactionAudio: () => true,
            updateState: () => {},
        };

        applyTwinPlayersSyncActions(
            [{ type: 'applyReactionStateChange', nextState: YT_STATES.PAUSED }],
            {
                snapshot: makeSnapshot(),
                guards: makeGuards(),
                workingState: YT_STATES.PLAYING,
                ytEndedState: YT_STATES.ENDED,
                deps,
            }
        );

        expect(controlReactionVideoCalls).toEqual([YT_STATES.PAUSED]);
    });

    it('does not call controlReactionVideo when allowStateActions is false', () => {
        const controlReactionVideoCalls = [];
        const deps = {
            setVolumeForOriginalVideo: () => {},
            setVolumeForReactionVideo: () => {},
            setPlaybackRateForOriginalVideo: () => {},
            pauseOriginalVideo: () => {},
            handleStateChangeInOriginalVideo: () => {},
            controlReactionVideo: (state) => controlReactionVideoCalls.push(state),
            muteReactionAudio: () => true,
            unmuteReactionAudio: () => true,
            updateState: () => {},
        };

        applyTwinPlayersSyncActions(
            [{ type: 'applyReactionStateChange', nextState: YT_STATES.PAUSED }],
            {
                snapshot: makeSnapshot(),
                guards: makeGuards(),
                workingState: YT_STATES.PLAYING,
                ytEndedState: YT_STATES.ENDED,
                deps,
                options: { allowStateActions: false },
            }
        );

        expect(controlReactionVideoCalls).toHaveLength(0);
    });
});
