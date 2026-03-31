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
    /**
     * Scenario D — shouldHoldOriginalWhilePaused bug during post-PLAY transition
     *
     * After transport PLAY fires (virtual time > PLAY@60), the reaction player takes
     * one or two ticks to physically resume. During those ticks:
     *   - reactionPlayerState = PAUSED (still transitioning)
     *   - virtualReactionTime > PLAY@60  →  transportTrackIntendsPause = false
     *   - hasActiveTransportPause = true  (transportPauseStart* not yet cleared)
     *
     * Bug (pre-fix): shouldHoldOriginalWhilePaused = isFineTuneModeOn && !isReactionPlaying
     *   && !transportTrackIntendsPause  =  true && true && true  =  TRUE
     *   →  a stateTimeline PLAY event at virtual t=65 would be forced to PAUSED.
     *
     * After fix (adds !hasActiveTransportPause): shouldHoldOriginalWhilePaused = false
     *   →  the PLAY event fires correctly.
     */
    it('scenario D — post-PLAY transition: stateTimeline PLAY fires even while reaction is still transitioning', () => {
        const YT = YT_STATES;

        // stateTimeline variant: original PAUSE@55 (during pause window), PLAY@65 (after PLAY fires)
        const baseInput = makeBaseInput({
            isFineTuneModeOn: true,
            reactionTransportTrack: [
                { t: 0, state: YT.PLAYING },
                { t: 50, state: YT.PAUSED },
                { t: 60, state: YT.PLAYING },
            ],
            stateTimeline: [
                { t: 0,  state: YT.PLAYING, targetTime: 0 },
                { t: 55, state: YT.PAUSED,  targetTime: 55 },
                { t: 65, state: YT.PLAYING, targetTime: 65 },
            ],
            playerConfigs: {},
            seekMin: 0,
            seekMax: 100000,
            originalDuration: 300,
        });

        // Tracking represents state AFTER transport PLAY fired at t=60:
        //   transportPauseStart* still set (reaction hasn't physically resumed yet)
        //   transportPausePlayEntryT = 60
        //   lastVirtualReactionTime = 64 (from previous tick)
        //   stateTimelineIndex = 2 (cursor past PAUSE@55, pointing at PLAY@65)
        const tracking = makeTracking({
            transportPauseStartReactionTime: 50.5,
            transportPauseStartOriginalTime: 50.5,
            transportPausePlayEntryT: 60,
            lastVirtualReactionTime: 64,
            reactionTransportTrackIndex: 3,
            stateTimelineIndex: 2,
            lastOriginalSeekAt: 0,
        });

        // Reaction is still PAUSED (transitioning), original clock at 65.5
        // virtualReactionTime = 50.5 + (65.5 − 50.5) = 65.5  (past PLAY@60, PLAY@65 entry)
        const input = {
            ...baseInput,
            reactionPlayerState: YT.PAUSED,
            reactionCurrentTime: 50.5,
            previousReactionTime: 50.5,
            currentStateOriginalVideo: YT.PAUSED,
            originalPlayerState: YT.PAUSED,
            originalCurrentTime: 65.5,
            now: 1500,
        };

        const { actions } = computeTwinPlayersSyncTick(input, tracking);

        // The stateTimeline PLAY@65 must fire → original should resume
        const playOriginal = actions.find(
            a => a.type === 'applyOriginalStateChange' && a.nextState === YT.PLAYING
        );
        expect(playOriginal, 'stateTimeline PLAY@65 must fire during post-PLAY transition').toBeDefined();

        // No spurious re-pause of the original
        const holdPaused = actions.find(
            a => (a.type === 'applyOriginalStateChange' && a.nextState === YT.PAUSED) ||
                  a.type === 'pauseOriginal'
        );
        expect(holdPaused, 'original must not be held at PAUSED by shouldHoldOriginalWhilePaused bug').toBeUndefined();
    });

    it('scenario D-config — post-PLAY transition: playerConfig PLAY fires while reaction is still transitioning', () => {
        // Same bug, but exercised via playerConfigs (getCurrentStateFromStateConfigs path)
        // instead of stateTimeline.
        const YT = YT_STATES;

        const tracking = makeTracking({
            transportPauseStartReactionTime: 50.5,
            transportPauseStartOriginalTime: 50.5,
            transportPausePlayEntryT: 60,
            lastVirtualReactionTime: 64,
            reactionTransportTrackIndex: 3,
            stateTimelineIndex: 0,
            lastOriginalSeekAt: 0,
        });

        // virtualReactionTime = 50.5 + (65 − 50.5) = 65
        // playerConfigs says PLAY@60, so effectiveConfigState should be PLAYING
        const input = makeBaseInput({
            isFineTuneModeOn: true,
            reactionTransportTrack: [
                { t: 0, state: YT.PLAYING },
                { t: 50, state: YT.PAUSED },
                { t: 60, state: YT.PLAYING },
            ],
            playerConfigs: [
                { t: 0,  state: YT.PLAYING, targetTime: 0  },
                { t: 55, state: YT.PAUSED,  targetTime: 55 },
                { t: 60, state: YT.PLAYING, targetTime: 65 },
            ],
            reactionPlayerState: YT.PAUSED,
            reactionCurrentTime: 50.5,
            previousReactionTime: 50.5,
            currentStateOriginalVideo: YT.PAUSED,
            originalPlayerState: YT.PAUSED,
            originalCurrentTime: 65,
            seekMin: 0,
            seekMax: 100000,
            originalDuration: 300,
            now: 1500,
        });

        const { actions } = computeTwinPlayersSyncTick(input, tracking);

        const playOriginal = actions.find(
            a => a.type === 'applyOriginalStateChange' && a.nextState === YT.PLAYING
        );
        expect(playOriginal, 'playerConfig PLAY must fire during post-PLAY transition').toBeDefined();
    });

    /**
     * Scenario E — non-fine-tune mode (isFineTuneModeOn=false)
     *
     * In normal playback mode the transport track must still pause/resume the reaction
     * correctly, and original configs must still fire in the virtual-time window.
     */
    it('scenario E — non-fine-tune mode: transport track pause/resume + original configs fire', () => {
        const YT = YT_STATES;
        const baseInput = makeBaseInput({
            isFineTuneModeOn: false,
            reactionTransportTrack: [
                { t: 0,  state: YT.PLAYING },
                { t: 30, state: YT.PAUSED  },
                { t: 40, state: YT.PLAYING },
            ],
            playerConfigs: [
                { t: 0,  state: YT.PLAYING, targetTime: 0  },
                { t: 35, state: YT.PAUSED,  targetTime: 35 },
                { t: 40, state: YT.PLAYING, targetTime: 40 },
            ],
            seekMin: 0,
            seekMax: 100000,
            originalDuration: 300,
        });

        const ticks = [
            // Tick 0: transport PAUSE fires
            {
                reactionPlayerState: YT.PLAYING,
                reactionCurrentTime: 30.5, previousReactionTime: 0,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 30.5, now: 100,
            },
            // Tick 1: reaction frozen, virtual=35.5 → original PAUSE config fires
            {
                reactionPlayerState: YT.PAUSED,
                reactionCurrentTime: 30.5, previousReactionTime: 30.5,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 35.5, now: 200,
            },
            // Tick 2: virtual=40.5 → transport PLAY fires
            {
                reactionPlayerState: YT.PAUSED,
                reactionCurrentTime: 30.5, previousReactionTime: 30.5,
                currentStateOriginalVideo: YT.PAUSED, originalPlayerState: YT.PAUSED,
                originalCurrentTime: 40.5, now: 300,
            },
            // Tick 3: reaction now PLAYING, real 41 → clears transport pause
            {
                reactionPlayerState: YT.PLAYING,
                reactionCurrentTime: 41, previousReactionTime: 40,
                currentStateOriginalVideo: YT.PAUSED, originalPlayerState: YT.PAUSED,
                originalCurrentTime: 41.5, now: 400,
            },
        ];

        const { results } = simulateTicks(baseInput, ticks);

        // Tick 0: transport PAUSE fires
        expect(
            results[0].actions.find(a => a.type === 'applyReactionStateChange' && a.nextState === YT.PAUSED),
            'tick0: transport PAUSE fires in non-fine-tune mode'
        ).toBeDefined();

        // Tick 1: original stop config fires
        expect(
            results[1].actions.find(
                a => a.type === 'applyOriginalStateChange' && a.nextState === YT.PAUSED
            ),
            'tick1: original PAUSE config fires during virtual window (non-fine-tune)'
        ).toBeDefined();

        // Tick 2: transport PLAY fires
        expect(
            results[2].actions.find(a => a.type === 'applyReactionStateChange' && a.nextState === YT.PLAYING),
            'tick2: transport PLAY fires in non-fine-tune mode'
        ).toBeDefined();

        // Tick 3: original resume config fires (PLAY@40 → targetTime=40)
        expect(
            results[3].actions.find(
                a => a.type === 'applyOriginalStateChange' && a.nextState === YT.PLAYING
            ),
            'tick3: original PLAY config fires on resume in non-fine-tune mode'
        ).toBeDefined();
    });

    /**
     * Scenario F — 3-segment interleaved (fine-tune mode)
     *
     * Tests a realistic complex reaction with two reaction pauses:
     *   - First pause: reaction stops, original keeps playing then stops
     *   - Reaction resumes
     *   - Second pause: reaction stops again, original plays then stops
     *   - Reaction resumes
     *   - End: both playing normally
     */
    it('scenario F — 3-segment interleaved: two reaction pauses each with their own original configs', () => {
        const YT = YT_STATES;

        const baseInput = makeBaseInput({
            isFineTuneModeOn: true,
            reactionTransportTrack: [
                { t: 0,  state: YT.PLAYING },
                { t: 20, state: YT.PAUSED  },  // first reaction pause
                { t: 30, state: YT.PLAYING },  // first reaction resume
                { t: 50, state: YT.PAUSED  },  // second reaction pause
                { t: 60, state: YT.PLAYING },  // second reaction resume
            ],
            playerConfigs: [
                { t: 0,  state: YT.PLAYING, targetTime: 0  },
                { t: 25, state: YT.PAUSED,  targetTime: 25 }, // stop original during first pause
                { t: 30, state: YT.PLAYING, targetTime: 30 }, // resume original when reaction resumes
                { t: 55, state: YT.PAUSED,  targetTime: 55 }, // stop original during second pause
                { t: 60, state: YT.PLAYING, targetTime: 60 }, // resume original when reaction resumes
            ],
            seekMin: 0,
            seekMax: 100000,
            originalDuration: 300,
        });

        const ticks = [
            // Tick 0: first transport PAUSE fires
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 20.5, previousReactionTime: 0,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 20.5, now: 100,
            },
            // Tick 1: virtual=25.5 → original PAUSE fires
            {
                reactionPlayerState: YT.PAUSED, reactionCurrentTime: 20.5, previousReactionTime: 20.5,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 25.5, now: 200,
            },
            // Tick 2: virtual=30.5 → first transport PLAY fires
            {
                reactionPlayerState: YT.PAUSED, reactionCurrentTime: 20.5, previousReactionTime: 20.5,
                currentStateOriginalVideo: YT.PAUSED, originalPlayerState: YT.PAUSED,
                originalCurrentTime: 30.5, now: 300,
            },
            // Tick 3: reaction PLAYING at 31 → post-PLAY transition, originalCurrentTime=31.5
            //         original PLAY@30 should fire (effectiveConfigState=PLAYING)
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 31, previousReactionTime: 30,
                currentStateOriginalVideo: YT.PAUSED, originalPlayerState: YT.PAUSED,
                originalCurrentTime: 31.5, now: 400,
            },
            // Tick 4: both playing normally at t=40
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 40, previousReactionTime: 31,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 40, now: 500,
            },
            // Tick 5: second transport PAUSE fires at t=50
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 50.5, previousReactionTime: 40,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 50.5, now: 600,
            },
            // Tick 6: virtual=55.5 → original PAUSE fires (second window)
            {
                reactionPlayerState: YT.PAUSED, reactionCurrentTime: 50.5, previousReactionTime: 50.5,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 55.5, now: 700,
            },
            // Tick 7: virtual=60.5 → second transport PLAY fires
            {
                reactionPlayerState: YT.PAUSED, reactionCurrentTime: 50.5, previousReactionTime: 50.5,
                currentStateOriginalVideo: YT.PAUSED, originalPlayerState: YT.PAUSED,
                originalCurrentTime: 60.5, now: 800,
            },
            // Tick 8: reaction PLAYING at 61 → post-PLAY transition
            //         original PLAY@60 should fire
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 61, previousReactionTime: 60,
                currentStateOriginalVideo: YT.PAUSED, originalPlayerState: YT.PAUSED,
                originalCurrentTime: 61.5, now: 900,
            },
            // Tick 9: both playing normally at t=65, no spurious actions
            {
                reactionPlayerState: YT.PLAYING, reactionCurrentTime: 65, previousReactionTime: 61,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 65, now: 1000,
            },
        ];

        const { results } = simulateTicks(baseInput, ticks);

        // Tick 0: first transport PAUSE
        expect(
            results[0].actions.find(a => a.type === 'applyReactionStateChange' && a.nextState === YT.PAUSED),
            'tick0: first transport PAUSE fires'
        ).toBeDefined();

        // Tick 1: original stops (first pause window)
        expect(
            results[1].actions.find(a => a.type === 'applyOriginalStateChange' && a.nextState === YT.PAUSED),
            'tick1: original PAUSE fires during first pause window'
        ).toBeDefined();

        // Tick 2: first transport PLAY fires
        expect(
            results[2].actions.find(a => a.type === 'applyReactionStateChange' && a.nextState === YT.PLAYING),
            'tick2: first transport PLAY fires'
        ).toBeDefined();

        // Tick 3: original resumes (post-PLAY transition — this is the scenario D bug path)
        expect(
            results[3].actions.find(a => a.type === 'applyOriginalStateChange' && a.nextState === YT.PLAYING),
            'tick3: original PLAY fires during post-PLAY transition (scenario D bug path)'
        ).toBeDefined();

        // Tick 5: second transport PAUSE
        expect(
            results[5].actions.find(a => a.type === 'applyReactionStateChange' && a.nextState === YT.PAUSED),
            'tick5: second transport PAUSE fires'
        ).toBeDefined();

        // Tick 6: original stops (second pause window)
        expect(
            results[6].actions.find(a => a.type === 'applyOriginalStateChange' && a.nextState === YT.PAUSED),
            'tick6: original PAUSE fires during second pause window'
        ).toBeDefined();

        // Tick 7: second transport PLAY fires
        expect(
            results[7].actions.find(a => a.type === 'applyReactionStateChange' && a.nextState === YT.PLAYING),
            'tick7: second transport PLAY fires'
        ).toBeDefined();

        // Tick 8: original resumes (post-PLAY transition again)
        expect(
            results[8].actions.find(a => a.type === 'applyOriginalStateChange' && a.nextState === YT.PLAYING),
            'tick8: original PLAY fires during second post-PLAY transition'
        ).toBeDefined();

        // Tick 9: no spurious transport or original actions during steady playing
        const spuriousOnTick9 = results[9].actions.filter(
            a => a.type === 'applyReactionStateChange' ||
                (a.type === 'applyOriginalStateChange' && a.nextState === YT.PAUSED) ||
                a.type === 'pauseOriginal'
        );
        expect(spuriousOnTick9, 'tick9: no spurious actions during steady play').toHaveLength(0);
    });

    /**
     * Scenario G — reaction always paused from t=0 (edge case)
     *
     * The transport track starts with PAUSED at t=0 and becomes PLAYING at t=30.
     * The reaction player starts paused; the original should keep playing.
     */
    it('scenario G — reaction paused from start, original plays freely, then reaction starts', () => {
        const YT = YT_STATES;

        const baseInput = makeBaseInput({
            isFineTuneModeOn: true,
            reactionTransportTrack: [
                { t: 0,  state: YT.PAUSED  },
                { t: 30, state: YT.PLAYING },
            ],
            playerConfigs: [
                { t: 0, state: YT.PLAYING, targetTime: 0 },
            ],
            seekMin: 0,
            seekMax: 100000,
            originalDuration: 300,
        });

        const ticks = [
            // Tick 0: reaction is PAUSED at t=0 (stale cursor should enforce PAUSED → but reaction is already paused → no applyReactionStateChange)
            //         original should NOT be held (transport track says PAUSED, shouldHoldOriginalWhilePaused=false)
            {
                reactionPlayerState: YT.PAUSED,
                reactionCurrentTime: 0, previousReactionTime: 0,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 5, now: 100,
            },
            // Tick 1: original advances, virtual=15, reaction still paused
            {
                reactionPlayerState: YT.PAUSED,
                reactionCurrentTime: 0, previousReactionTime: 0,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 15, now: 200,
            },
            // Tick 2: virtual=30.5 → transport PLAY fires
            {
                reactionPlayerState: YT.PAUSED,
                reactionCurrentTime: 0, previousReactionTime: 0,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 30.5, now: 300,
            },
            // Tick 3: reaction now PLAYING at 31 → clears transport pause
            {
                reactionPlayerState: YT.PLAYING,
                reactionCurrentTime: 31, previousReactionTime: 30,
                currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
                originalCurrentTime: 31.5, now: 400,
            },
        ];

        const { results } = simulateTicks(baseInput, ticks);

        // Ticks 0 and 1: original should NOT be paused (transport track is pausing reaction,
        // shouldHoldOriginalWhilePaused must be false)
        for (const tickIdx of [0, 1]) {
            const holdPaused = results[tickIdx].actions.find(
                a => (a.type === 'applyOriginalStateChange' && a.nextState === YT.PAUSED) ||
                      a.type === 'pauseOriginal'
            );
            expect(holdPaused, `tick${tickIdx}: original must not be held at PAUSED when transport track pauses reaction`).toBeUndefined();
        }

        // Tick 2: transport PLAY fires
        expect(
            results[2].actions.find(a => a.type === 'applyReactionStateChange' && a.nextState === YT.PLAYING),
            'tick2: transport PLAY fires'
        ).toBeDefined();
    });

    /**
     * Scenario H — stateTimeline events fire correctly with no transport track
     * (regression: normal fine-tune mode behavior must be unaffected by the fix)
     */
    it('scenario H — normal fine-tune mode (no transport track): user pause still holds original', () => {
        const YT = YT_STATES;

        const input = makeBaseInput({
            isFineTuneModeOn: true,
            reactionTransportTrack: [],   // no transport track
            stateTimeline: [
                { t: 0,  state: YT.PLAYING, targetTime: 0  },
                { t: 10, state: YT.PLAYING, targetTime: 10 },
            ],
            playerConfigs: [
                { t: 0, state: YT.PLAYING, targetTime: 0 },
            ],
            // Reaction is PAUSED by user (not transport track)
            reactionPlayerState: YT.PAUSED,
            reactionCurrentTime: 5, previousReactionTime: 5,
            currentStateOriginalVideo: YT.PLAYING, originalPlayerState: YT.PLAYING,
            originalCurrentTime: 5, now: 500,
        });

        const { actions } = computeTwinPlayersSyncTick(input, makeTracking());

        // No transport track → shouldHoldOriginalWhilePaused = isFineTuneModeOn && !isReactionPlaying
        //                                                       && !false && !false = TRUE
        // So original should be held at PAUSED (state comes from stateTimeline entry at t=0 → PLAYING
        // but gets forced to PAUSED). In practice, original is already PLAYING, and the config says
        // PLAYING → effectiveConfigState = PAUSED (held). shouldApplyState = PLAYING !== PAUSED = true.
        // This confirms normal fine-tune "hold" behavior is unchanged.
        const holdAction = actions.find(
            a => a.type === 'applyOriginalStateChange' && a.nextState === YT.PAUSED
        );
        expect(holdAction, 'in normal fine-tune user-pause, original should be held at PAUSED').toBeDefined();
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
