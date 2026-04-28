import { describe, it, expect } from 'vitest';
import { 
    getCurrentVolumeFromVolumeConfigs, 
    getCurrentStateFromStateConfigs, 
    getCurrentPlaybackRateFromConfigs,
    getCurrentOverlayVisibilityFromConfigs 
} from '../../src/lib/helpers/reaction.js';
import { computeTwinPlayersSyncTick } from '../../src/lib/helpers/twinPlayersSyncTick.ts';

describe('Twin Player Sync Logic (Integration)', () => {
    describe('getCurrentOverlayVisibilityFromConfigs', () => {
        it('should return default visibility (true) when no timeline provided', () => {
            const result = getCurrentOverlayVisibilityFromConfigs(5.0, null);
            expect(result).toBe(true);
        });

        it('should handle visibility switches in timeline', () => {
            const timeline = [
                { t: 0, visible: true },
                { t: 3, visible: false },
                { t: 6, visible: true }
            ];

            expect(getCurrentOverlayVisibilityFromConfigs(1.0, timeline)).toBe(true);
            expect(getCurrentOverlayVisibilityFromConfigs(3.0, timeline)).toBe(false);
            expect(getCurrentOverlayVisibilityFromConfigs(4.0, timeline)).toBe(false);
            expect(getCurrentOverlayVisibilityFromConfigs(6.0, timeline)).toBe(true);
            expect(getCurrentOverlayVisibilityFromConfigs(10.0, timeline)).toBe(true);
        });

        it('should respect time offset', () => {
            const timeline = [
                { t: 0, visible: true },
                { t: 10, visible: false }
            ];

            // If timeOffset = 5, currentTime 12 maps to effective time 7 (visible)
            // If timeOffset = 5, currentTime 17 maps to effective time 12 (hidden)
            expect(getCurrentOverlayVisibilityFromConfigs(12.0, timeline, 5.0)).toBe(true);
            expect(getCurrentOverlayVisibilityFromConfigs(17.0, timeline, 5.0)).toBe(false);
        });

        it('should return true for time before first event', () => {
            const timeline = [
                { t: 10, visible: false }
            ];
            expect(getCurrentOverlayVisibilityFromConfigs(5.0, timeline)).toBe(true);
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
