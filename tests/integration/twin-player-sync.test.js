import { describe, it, expect } from 'vitest';
import { 
    getCurrentVolumeFromVolumeConfigs, 
    getCurrentStateFromStateConfigs, 
    getCurrentPlaybackRateFromConfigs,
    getCurrentOverlayVisibilityFromConfigs,
    getCurrentOverlayPrimaryFromConfigs,
    getCurrentOverlaySnapshotFromConfigs,
    integratePlaybackRate
} from '../../src/lib/helpers/reaction.js';
import { computeTwinPlayersSyncTick } from '../../src/lib/helpers/twinPlayersSyncTick.ts';
import { overlayVisibilityTimelineArrayToMap } from '../../src/lib/helpers/twinPlayersTimeline.ts';

describe('Twin Player Sync Logic (Integration)', () => {
    describe('overlay snapshot timeline resolution', () => {
        it('should return defaults when no overlay cues exist', () => {
            const snapshot = getCurrentOverlaySnapshotFromConfigs(5.0, null, 0, 'reaction');
            expect(snapshot).toEqual({ visible: true, primary: 'reaction' });
            expect(getCurrentOverlayVisibilityFromConfigs(5.0, null)).toBe(true);
        });

        it('should apply complete cue snapshots atomically at cue boundaries', () => {
            const timeline = [
                { t: 0, visible: true, primary: 'original' },
                { t: 3, visible: false, primary: 'reaction' },
                { t: 6, visible: true, primary: 'reaction' }
            ];

            expect(getCurrentOverlayVisibilityFromConfigs(1.0, timeline)).toBe(true);
            expect(getCurrentOverlayVisibilityFromConfigs(3.0, timeline)).toBe(false);
            expect(getCurrentOverlayVisibilityFromConfigs(4.0, timeline)).toBe(false);
            expect(getCurrentOverlayVisibilityFromConfigs(6.0, timeline)).toBe(true);
            expect(getCurrentOverlayVisibilityFromConfigs(10.0, timeline)).toBe(true);
            expect(getCurrentOverlayPrimaryFromConfigs(2.99, timeline, 'original')).toBe('original');
            expect(getCurrentOverlayPrimaryFromConfigs(3.0, timeline, 'original')).toBe('reaction');
        });

        it('should respect time offset', () => {
            const timeline = [
                { t: 0, visible: true, primary: 'original' },
                { t: 10, visible: false, primary: 'reaction' }
            ];

            // If timeOffset = 5, currentTime 12 maps to effective time 7 (visible)
            // If timeOffset = 5, currentTime 17 maps to effective time 12 (hidden)
            expect(getCurrentOverlayVisibilityFromConfigs(12.0, timeline, 5.0)).toBe(true);
            expect(getCurrentOverlayVisibilityFromConfigs(17.0, timeline, 5.0)).toBe(false);
            expect(getCurrentOverlayPrimaryFromConfigs(17.0, timeline, 'original', 5.0)).toBe('reaction');
        });

        it('should carry forward previous active cue values for later cue defaults', () => {
            const timeline = [
                { t: 2, visible: false, primary: 'reaction' },
                { t: 8, visible: true }
            ];

            expect(getCurrentOverlaySnapshotFromConfigs(7.5, timeline, 0, 'original')).toEqual({
                visible: false,
                primary: 'reaction'
            });
            expect(getCurrentOverlaySnapshotFromConfigs(8.0, timeline, 0, 'original')).toEqual({
                visible: true,
                primary: 'reaction'
            });
        });

        it('should normalize legacy visibility-only cues with static primary fallback', () => {
            const timeline = [
                { t: 10, visible: false }
            ];

            expect(getCurrentOverlaySnapshotFromConfigs(5.0, timeline, 0, 'reaction')).toEqual({
                visible: true,
                primary: 'reaction'
            });
            expect(getCurrentOverlaySnapshotFromConfigs(12.0, timeline, 0, 'reaction')).toEqual({
                visible: false,
                primary: 'reaction'
            });
        });
    });

    describe('overlay timeline map persistence normalization', () => {
        it('should persist full snapshots with carry-forward primary for legacy entries', () => {
            const map = overlayVisibilityTimelineArrayToMap(
                [
                    { t: 6, visible: true },
                    { t: 3, visible: false, primary: 'reaction' }
                ],
                'original'
            );

            expect(Array.from(map.values())).toEqual([
                { t: 3, visible: false, primary: 'reaction' },
                { t: 6, visible: true, primary: 'reaction' }
            ]);
        });
    });

    describe('getCurrentVolumeFromVolumeConfigs', () => {
        it('should return default volume when no configs provided', () => {
            const result = getCurrentVolumeFromVolumeConfigs(5.0, null, 1.0, 0);
            expect(result).toBe(100);
        });

        it('should handle array format timeline', () => {
            const timeline = [
                { t: 0, volume: 100 },
                { t: 5, volume: 10 },
                { t: 10, volume: 50 }
            ];
            
            expect(getCurrentVolumeFromVolumeConfigs(2.0, timeline, 1.0, 0)).toBe(100);
            expect(getCurrentVolumeFromVolumeConfigs(5.0, timeline, 1.0, 0)).toBe(10);
            expect(getCurrentVolumeFromVolumeConfigs(7.5, timeline, 1.0, 0)).toBe(10);
            expect(getCurrentVolumeFromVolumeConfigs(10.0, timeline, 1.0, 0)).toBe(50);
        });

        it('should handle object format timeline (legacy)', () => {
            const configs = {
                '0.0': { volume: 100 },
                '5.0': { volume: 10 },
                '10.0': { volume: 50 }
            };
            
            expect(getCurrentVolumeFromVolumeConfigs(2.0, configs, 1.0, 0)).toBe(100);
            expect(getCurrentVolumeFromVolumeConfigs(5.0, configs, 1.0, 0)).toBe(10);
            expect(getCurrentVolumeFromVolumeConfigs(7.5, configs, 1.0, 0)).toBe(10);
        });

        it('should apply global gain correctly', () => {
            const timeline = [{ t: 0, volume: 100 }];
            
            expect(getCurrentVolumeFromVolumeConfigs(1.0, timeline, 0.5, 0)).toBe(50);
            expect(getCurrentVolumeFromVolumeConfigs(1.0, timeline, 2.0, 0)).toBe(200);
        });

        it('should clamp volume to 0-200 range', () => {
            const timeline = [{ t: 0, volume: 100 }];
            
            expect(getCurrentVolumeFromVolumeConfigs(1.0, timeline, 3.0, 0)).toBe(200);
            expect(getCurrentVolumeFromVolumeConfigs(1.0, timeline, -1.0, 0)).toBe(0);
        });

        it('should respect time offset', () => {
            const timeline = [
                { t: 0, volume: 100 },
                { t: 10, volume: 50 }
            ];
            
            // If timeOffset = 5, currentTime 15 maps to effective time 10
            expect(getCurrentVolumeFromVolumeConfigs(15.0, timeline, 1.0, 5.0)).toBe(50);
        });
    });

    describe('getCurrentStateFromStateConfigs', () => {
        it('should return default state when no configs provided', () => {
            const result = getCurrentStateFromStateConfigs(5.0, null, 0);
            expect(result.state).toBe(-1);
            expect(result.time).toBe('0.00');
        });

        it('should handle array format timeline', () => {
            const timeline = [
                { t: 0, state: 1, targetTime: 0 },
                { t: 5, state: 2, targetTime: 10 },
                { t: 15, state: 1, targetTime: 15 }
            ];
            
            const result1 = getCurrentStateFromStateConfigs(2.0, timeline, 0);
            expect(result1.state).toBe(1);
            expect(result1.time).toBe('0.00');
            
            const result2 = getCurrentStateFromStateConfigs(5.0, timeline, 0);
            expect(result2.state).toBe(2);
            expect(result2.time).toBe('10.00');
            
            const result3 = getCurrentStateFromStateConfigs(20.0, timeline, 0);
            expect(result3.state).toBe(1);
            expect(result3.time).toBe('15.00');
        });

        it('should handle object format timeline (legacy)', () => {
            const configs = {
                '0.0': { state: 1, time: '0.00' },
                '5.0': { state: 2, time: '10.00' }
            };
            
            const result = getCurrentStateFromStateConfigs(7.0, configs, 0);
            expect(result.state).toBe(2);
            expect(result.time).toBe('10.00');
        });

        it('should respect time offset', () => {
            const timeline = [
                { t: 0, state: 1, targetTime: 0 },
                { t: 10, state: 2, targetTime: 10 }
            ];
            
            // currentTime 15 with offset 5 = effective time 10
            const result = getCurrentStateFromStateConfigs(15.0, timeline, 5.0);
            expect(result.state).toBe(2);
        });
    });

    describe('getCurrentPlaybackRateFromConfigs', () => {
        it('should return default playback rate when no configs provided', () => {
            const result = getCurrentPlaybackRateFromConfigs(5.0, null, 0);
            expect(result).toBe(1);
        });

        it('should handle array format timeline', () => {
            const timeline = [
                { t: 0, rate: 1.0 },
                { t: 5, rate: 1.5 },
                { t: 10, rate: 0.75 }
            ];
            
            expect(getCurrentPlaybackRateFromConfigs(2.0, timeline, 0)).toBe(1.0);
            expect(getCurrentPlaybackRateFromConfigs(5.0, timeline, 0)).toBe(1.5);
            expect(getCurrentPlaybackRateFromConfigs(7.5, timeline, 0)).toBe(1.5);
            expect(getCurrentPlaybackRateFromConfigs(10.0, timeline, 0)).toBe(0.75);
        });

        it('should handle object format timeline (legacy)', () => {
            const configs = {
                '0.0': { rate: 1.0 },
                '5.0': { rate: 1.5 }
            };
            
            expect(getCurrentPlaybackRateFromConfigs(2.0, configs, 0)).toBe(1.0);
            expect(getCurrentPlaybackRateFromConfigs(7.0, configs, 0)).toBe(1.5);
        });

        it('should respect time offset', () => {
            const timeline = [
                { t: 0, rate: 1.0 },
                { t: 10, rate: 2.0 }
            ];
            
            // currentTime 15 with offset 5 = effective time 10
            expect(getCurrentPlaybackRateFromConfigs(15.0, timeline, 5.0)).toBe(2.0);
        });
    });

    describe('Timeline boundary detection', () => {
        it('should correctly find last event at or before given time', () => {
            const timeline = [
                { t: 0, volume: 100 },
                { t: 5, volume: 50 },
                { t: 10, volume: 75 },
                { t: 15, volume: 25 }
            ];

            // Test exact boundaries
            expect(getCurrentVolumeFromVolumeConfigs(0, timeline, 1.0, 0)).toBe(100);
            expect(getCurrentVolumeFromVolumeConfigs(5, timeline, 1.0, 0)).toBe(50);
            expect(getCurrentVolumeFromVolumeConfigs(10, timeline, 1.0, 0)).toBe(75);

            // Test between boundaries
            expect(getCurrentVolumeFromVolumeConfigs(4.99, timeline, 1.0, 0)).toBe(100);
            expect(getCurrentVolumeFromVolumeConfigs(5.01, timeline, 1.0, 0)).toBe(50);
            expect(getCurrentVolumeFromVolumeConfigs(9.99, timeline, 1.0, 0)).toBe(50);
            expect(getCurrentVolumeFromVolumeConfigs(10.01, timeline, 1.0, 0)).toBe(75);
        });

        it('should handle empty timeline', () => {
            expect(getCurrentVolumeFromVolumeConfigs(5, [], 1.0, 0)).toBe(100);
        });

        it('should handle time before first boundary', () => {
            const timeline = [{ t: 10, volume: 50 }];
            expect(getCurrentVolumeFromVolumeConfigs(5, timeline, 1.0, 0)).toBe(100); // default
        });
    });

    describe('Volume change stability', () => {
        it('should maintain consistent volume lookups across rapid queries', () => {
            const timeline = [
                { t: 0, volume: 100 },
                { t: 5, volume: 10 }
            ];

            // Simulate rapid polling around the boundary
            const results = [];
            for (let t = 4.9; t <= 5.1; t += 0.01) {
                results.push({
                    time: t,
                    volume: getCurrentVolumeFromVolumeConfigs(t, timeline, 1.0, 0)
                });
            }

            // All queries before 5.0 should return 100
            const before = results.filter(r => r.time < 5.0);
            expect(before.every(r => r.volume === 100)).toBe(true);

            // All queries at or after 5.0 should return 10
            const after = results.filter(r => r.time >= 5.0);
            expect(after.every(r => r.volume === 10)).toBe(true);
        });
    });
});

// ---------------------------------------------------------------------------
// Regression: playback speed cues must persist through subsequent state cues
// ---------------------------------------------------------------------------

const YT_PLAYING = 1;
const YT_PAUSED = 2;
const YT_BUFFERING = 3;
const YT_CUED = 5;
const YT_ENDED = 0;

const ytStates = { PLAYING: YT_PLAYING, PAUSED: YT_PAUSED, BUFFERING: YT_BUFFERING, CUED: YT_CUED, ENDED: YT_ENDED };

const makeTracking = (overrides = {}) => ({
    lastOriginalSeekAt: 0,
    lastOriginalTargetTime: undefined,
    lastOriginalSeekTarget: undefined,
    mobileAudioWinner: null,
    stateTimelineIndex: 0,
    lastSoftSyncAt: 0,
    softSyncIsActive: false,
    softSyncResetTimeoutId: undefined,
    ...overrides
});

const makeInput = (overrides = {}) => ({
    reactionCurrentTime: 0,
    previousReactionTime: 0,
    seekMin: 0,
    seekMax: Infinity,
    timeOffset: 0,
    globalGain: 1,
    isFineTuneModeOn: false,
    isFullscreen: false,
    currentStateOriginalVideo: YT_PLAYING,
    currentPlaybackRate: 1,
    currentVolumeOriginalVideo: 100,
    currentVolumeReactionVideo: 100,
    currentFullscreenOverlayVisible: true,
    isReactionMuteModeEnabled: false,
    isReactionAutoMuted: false,
    isMobileAudioEnvironment: false,
    isMobilePlaybackDevice: () => false,
    isMobileLazySyncEnabled: false,
    playerConfigs: {},
    volumeConfigs: {},
    reactionVolumeConfigs: {},
    playbackRateConfigs: {},
    playbackRateTimeline: [],
    overlayVisibilityTimeline: [],
    stateTimeline: [],
    reactionPlayerState: YT_PLAYING,
    originalPlayerState: YT_PLAYING,
    originalCurrentTime: 0,
    originalDuration: 120,
    originalIsMuted: false,
    reactionIsMuted: false,
    now: 1000,
    yt: ytStates,
    ...overrides
});

describe('Playback speed cue persistence (regression)', () => {
    describe('getCurrentPlaybackRateFromConfigs handles timeline-only reactions', () => {
        it('returns the rate from playbackRateTimeline when playbackRateConfigs is empty', () => {
            // Simulates a document where playbackTimeline (new format) is the only source
            // and playbackRateConfigs was stored as {} (empty object).
            const emptyConfigs = {};
            const timeline = [{ t: 0, rate: 1.0 }, { t: 5, rate: 1.5 }];

            // Empty configs: falls back to default
            expect(getCurrentPlaybackRateFromConfigs(6, emptyConfigs, 0)).toBe(1);
            // Array timeline: correctly returns 1.5
            expect(getCurrentPlaybackRateFromConfigs(6, timeline, 0)).toBe(1.5);
        });
    });

    describe('computeTwinPlayersSyncTick: speed cue from playbackRateTimeline', () => {
        it('emits setOriginalPlaybackRate when a speed cue fires via playbackRateTimeline', () => {
            const playbackRateTimeline = [{ t: 0, rate: 1.0 }, { t: 5, rate: 1.5 }];
            const input = makeInput({
                reactionCurrentTime: 5.1,
                previousReactionTime: 4.9,
                currentPlaybackRate: 1.0,
                // playbackRateConfigs is empty – only the timeline carries the cue
                playbackRateConfigs: {},
                playbackRateTimeline,
                originalPlayerState: YT_PLAYING,
                originalCurrentTime: 5.1,
            });

            const result = computeTwinPlayersSyncTick(input, makeTracking());
            const rateAction = result.actions.find(a => a.type === 'setOriginalPlaybackRate');

            expect(rateAction).toBeDefined();
            expect(rateAction.rate).toBe(1.5);
            expect(result.stateUpdates.currentPlaybackRate).toBe(1.5);
        });

        it('does NOT emit setOriginalPlaybackRate when playbackRateTimeline is empty and configs is empty', () => {
            const input = makeInput({
                reactionCurrentTime: 5.1,
                previousReactionTime: 4.9,
                currentPlaybackRate: 1.0,
                playbackRateConfigs: {},
                playbackRateTimeline: [],
            });

            const result = computeTwinPlayersSyncTick(input, makeTracking());
            const rateAction = result.actions.find(a => a.type === 'setOriginalPlaybackRate');

            expect(rateAction).toBeUndefined();
        });
    });

    describe('computeTwinPlayersSyncTick: speed cue persists through state cues', () => {
        // Shared timeline: speed cue at t=5, play cue at t=10, pause cue at t=15, play cue at t=20
        const playbackRateTimeline = [{ t: 0, rate: 1.0 }, { t: 5, rate: 1.5 }];
        const stateTimeline = [
            { t: 0, state: YT_PLAYING, targetTime: 0 },
            { t: 10, state: YT_PAUSED, targetTime: 10 },
            { t: 15, state: YT_PLAYING, targetTime: 15 },
        ];

        it('does not reset speed to 1 when a pause cue fires after a speed cue', () => {
            // At t=10.1 the pause cue fires. Current rate should already be 1.5.
            // No new speed cue exists, so no setOriginalPlaybackRate should fire.
            const input = makeInput({
                reactionCurrentTime: 10.1,
                previousReactionTime: 9.9,
                currentPlaybackRate: 1.5,
                playbackRateConfigs: {},
                playbackRateTimeline,
                stateTimeline,
                originalPlayerState: YT_PLAYING,
                originalCurrentTime: 10.1,
                stateTimelineIndex: 2, // cursor past the t=10 entry will be set via tracking
            });

            const tracking = makeTracking({ stateTimelineIndex: 1 }); // cursor at t=10 entry
            const result = computeTwinPlayersSyncTick(input, tracking);

            // No rate reset
            const rateAction = result.actions.find(a => a.type === 'setOriginalPlaybackRate');
            expect(rateAction).toBeUndefined();

            // Pause state change should be requested
            const stateAction = result.actions.find(a => a.type === 'applyOriginalStateChange');
            expect(stateAction).toBeDefined();
            expect(stateAction.nextState).toBe(YT_PAUSED);
        });

        it('does not reset speed to 1 when a play cue fires after a speed cue', () => {
            // At t=15.1 the second play cue fires. Rate is 1.5, no new speed cue.
            const input = makeInput({
                reactionCurrentTime: 15.1,
                previousReactionTime: 14.9,
                currentPlaybackRate: 1.5,
                playbackRateConfigs: {},
                playbackRateTimeline,
                stateTimeline,
                originalPlayerState: YT_PAUSED,
                originalCurrentTime: 15.1,
            });

            const tracking = makeTracking({ stateTimelineIndex: 2 }); // cursor at t=15 entry
            const result = computeTwinPlayersSyncTick(input, tracking);

            // No rate reset
            const rateAction = result.actions.find(a => a.type === 'setOriginalPlaybackRate');
            expect(rateAction).toBeUndefined();
        });

        it('speed cue and play cue fire in the same tick: rate update precedes state change', () => {
            // Tick covers [4.9, 5.1]: speed cue at t=5 AND start of play are both captured.
            // playbackRateTimeline has the speed cue; playbackRateConfigs is empty.
            const stateTimelineWithPlay = [
                { t: 0, state: YT_PLAYING, targetTime: 0 },
                { t: 5, state: YT_PLAYING, targetTime: 5 },
            ];
            const input = makeInput({
                reactionCurrentTime: 5.1,
                previousReactionTime: 4.9,
                currentPlaybackRate: 1.0,
                playbackRateConfigs: {},
                playbackRateTimeline,
                stateTimeline: stateTimelineWithPlay,
                originalPlayerState: YT_PLAYING,
                originalCurrentTime: 5.1,
            });

            const tracking = makeTracking({ stateTimelineIndex: 1 }); // cursor at t=5 entry
            const result = computeTwinPlayersSyncTick(input, tracking);

            const actions = result.actions;
            const rateIdx = actions.findIndex(a => a.type === 'setOriginalPlaybackRate');
            const stateIdx = actions.findIndex(a => a.type === 'applyOriginalStateChange');

            // Both actions must be present
            expect(rateIdx).toBeGreaterThanOrEqual(0);
            expect(stateIdx).toBeGreaterThanOrEqual(0);

            // Rate change must come BEFORE state change so startOriginalVideo() picks up the new rate
            expect(rateIdx).toBeLessThan(stateIdx);
            expect(actions[rateIdx].rate).toBe(1.5);
            expect(result.stateUpdates.currentPlaybackRate).toBe(1.5);
        });
    });
});

describe('integratePlaybackRate', () => {
    it('returns zero for empty interval', () => {
        expect(integratePlaybackRate(10, 10, [])).toBe(0);
        expect(integratePlaybackRate(10, 5, [])).toBe(0);
    });

    it('uses 1× default rate when timeline is empty', () => {
        expect(integratePlaybackRate(0, 10, [])).toBe(10);
        expect(integratePlaybackRate(5, 15, [])).toBe(10);
    });

    it('uses 1× default rate when timeline is null/undefined', () => {
        expect(integratePlaybackRate(0, 10, null)).toBe(10);
        expect(integratePlaybackRate(0, 10, undefined)).toBe(10);
    });

    it('applies constant non-1x rate covering the whole interval', () => {
        const timeline = [{ t: 0, rate: 0.5 }];
        expect(integratePlaybackRate(0, 120, timeline)).toBe(60);
        expect(integratePlaybackRate(100, 120, timeline)).toBe(10);
    });

    it('correctly integrates a rate change mid-interval (document 1x6mbIpqMYU1G4YI33sq scenario)', () => {
        // Reaction: 1× from t=0 to t=120, then 0.5× from t=120 onward
        const timeline = [{ t: 120, rate: 0.5 }];

        // From t=0 to t=120: all at 1× → 120 original seconds
        expect(integratePlaybackRate(0, 120, timeline)).toBe(120);

        // From t=0 to t=125: 120s at 1× + 5s at 0.5× = 122.5
        expect(integratePlaybackRate(0, 125, timeline)).toBeCloseTo(122.5);

        // From t=120 to t=130: all at 0.5× → 5 original seconds
        expect(integratePlaybackRate(120, 130, timeline)).toBe(5);

        // From t=110 to t=130: 10s at 1× + 10s at 0.5× = 15
        expect(integratePlaybackRate(110, 130, timeline)).toBe(15);
    });

    it('handles multiple rate changes', () => {
        const timeline = [
            { t: 10, rate: 2.0 },
            { t: 20, rate: 0.5 },
        ];
        // t=0→10: 1× → 10; t=10→20: 2× → 20; t=20→30: 0.5× → 5 → total 35
        expect(integratePlaybackRate(0, 30, timeline)).toBe(35);
    });

    it('returns 1× rate for the interval before any rate-change event', () => {
        const timeline = [{ t: 50, rate: 0.25 }];
        expect(integratePlaybackRate(0, 50, timeline)).toBe(50);
    });
});

describe('computeTwinPlayersSyncTick — non-1x playback rate', () => {
    // Shared helpers
    const YT = { PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5, ENDED: 0 };

    const baseInput = (overrides = {}) => ({
        reactionCurrentTime: 125,
        previousReactionTime: 124.9,
        seekMin: 0,
        seekMax: Infinity,
        timeOffset: 0,
        globalGain: 1,
        isFineTuneModeOn: false,
        isFullscreen: false,
        currentStateOriginalVideo: YT.PLAYING,
        currentPlaybackRate: 0.5,
        currentVolumeOriginalVideo: 100,
        currentVolumeReactionVideo: 100,
        currentFullscreenOverlayVisible: true,
        isReactionMuteModeEnabled: false,
        isReactionAutoMuted: false,
        isMobileAudioEnvironment: false,
        isMobilePlaybackDevice: () => false,
        isMobileLazySyncEnabled: false,
        // Single state event at t=0: original starts at position 0, playing
        playerConfigs: { '0.0': { time: '0.00', state: 1 } },
        stateTimeline: [{ t: 0, state: 1, targetTime: 0 }],
        volumeConfigs: {},
        reactionVolumeConfigs: {},
        playbackRateConfigs: { '120.0': { rate: 0.5 } },
        playbackRateTimeline: [{ t: 120, rate: 0.5 }],
        overlayVisibilityTimeline: [],
        reactionPlayerState: YT.PLAYING,
        originalPlayerState: YT.PLAYING,
        // Original is at the correct 0.5× position: 120×1 + 5×0.5 = 122.5
        originalCurrentTime: 122.5,
        originalDuration: 300,
        originalIsMuted: false,
        reactionIsMuted: false,
        now: Date.now(),
        yt: YT,
        ...overrides
    });

    const baseTracking = () => ({
        lastOriginalTargetTime: undefined,
        lastOriginalSeekAt: 0,
        lastOriginalSeekTarget: undefined,
        mobileAudioWinner: null,
        stateTimelineIndex: undefined,
        softSyncIsActive: false,
        softSyncResetTimeoutId: undefined,
        lastSoftSyncAt: 0
    });

    it('does not emit soft-sync when desiredPlaybackRate is 0.5', () => {
        const result = computeTwinPlayersSyncTick(baseInput(), baseTracking());
        const hasSoftSync = result.actions.some(a => a.type === 'applySoftSync');
        expect(hasSoftSync).toBe(false);
    });

    it('computes correct target time using rate integration, producing near-zero drift', () => {
        // Original is exactly at 122.5 (correct 0.5× position).
        // With the fix, computedTargetTime should equal 122.5 → drift ≈ 0.
        // Without the fix it would be 125 → drift = -2.5, triggering a seek.
        const result = computeTwinPlayersSyncTick(baseInput(), baseTracking());
        const seekAction = result.actions.find(a => a.type === 'applyOriginalStateChange');
        // No seek should be required when original is at the correct position
        expect(seekAction).toBeUndefined();
    });

    it('still emits soft-sync at 1× rate when desiredPlaybackRate is 1.0', () => {
        const tracking = baseTracking();
        const input = baseInput({
            currentPlaybackRate: 1.0,
            playbackRateTimeline: [],   // no speed cues → 1× throughout
            playbackRateConfigs: {},
            // Introduce a small drift to trigger soft sync
            originalCurrentTime: 124.7, // slightly behind target 125
        });
        const result = computeTwinPlayersSyncTick(input, tracking);
        const hasSoftSync = result.actions.some(a => a.type === 'applySoftSync');
        expect(hasSoftSync).toBe(true);
    });
});
