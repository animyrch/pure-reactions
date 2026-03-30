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
