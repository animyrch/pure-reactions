import { describe, it, expect } from 'vitest';
import {
    compileSyncPlan,
    computeDesiredTwinPlayersState
} from '../../src/lib/helpers/twinPlayersSyncPlanV2.ts';
import { createSyncEngineV2 } from '../../src/lib/helpers/twinPlayersSyncEngineV2.ts';

const YT = {
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    ENDED: 0
};

const makePolicy = () => ({
    playingState: YT.PLAYING,
    pausedState: YT.PAUSED,
    bufferingState: YT.BUFFERING,
    endedState: YT.ENDED
});

const observe = (engine, overrides = {}) => {
    engine.observePlayers({
        nowMs: 0,
        reactionCurrentTimeMs: 0,
        reactionPlayerState: YT.PAUSED,
        originalCurrentTimeMs: 0,
        originalPlayerState: YT.PAUSED,
        originalVolume: 100,
        reactionVolume: 100,
        currentPlaybackRate: 1,
        fullscreenOverlayVisible: true,
        ...overrides
    });
};

const withoutIds = (events) => events.map(({ id: _id, ...event }) => event);

describe('Sync Engine V2', () => {
    it('plays the same sync plan from legacy configs and array timelines', () => {
        const fromLegacy = compileSyncPlan({
            timeOffset: 1,
            reactionConfigs: undefined,
            playerConfigs: {
                '0.0': { state: YT.PLAYING, time: '0.00' },
                '5.0': { state: YT.PAUSED, time: '8.00' }
            },
            volumeConfigs: {
                '0.0': { volume: 80 }
            },
            playbackRateConfigs: {
                '2.0': { rate: 1.25 }
            }
        });
        const fromArray = compileSyncPlan({
            timeOffset: 1,
            stateTimeline: [
                { t: 0, state: YT.PLAYING, targetTime: 0 },
                { t: 5, state: YT.PAUSED, targetTime: 8 }
            ],
            volumeTimeline: [{ t: 0, volume: 80 }],
            playbackRateTimeline: [{ t: 2, rate: 1.25 }]
        });

        expect(withoutIds(fromLegacy.stateEvents)).toEqual(withoutIds(fromArray.stateEvents));
        expect(withoutIds(fromLegacy.originalVolumeEvents)).toEqual(withoutIds(fromArray.originalVolumeEvents));
        expect(withoutIds(fromLegacy.playbackRateEvents)).toEqual(withoutIds(fromArray.playbackRateEvents));
    });

    it('starts playback from the configured original target', () => {
        const plan = compileSyncPlan({
            offsetStartTime: 10,
            stateTimeline: [{ t: 10, state: YT.PLAYING, targetTime: 45 }]
        });
        const desired = computeDesiredTwinPlayersState(plan, plan.offsetStartMs);

        expect(desired.originalState).toBe(YT.PLAYING);
        expect(desired.originalTargetTimeMs).toBe(45000);
    });

    it('scrubs to a new reaction time with compensated play timing', () => {
        const plan = compileSyncPlan({
            stateTimeline: [{ t: 10, state: YT.PLAYING, targetTime: 45 }]
        });
        const engine = createSyncEngineV2({
            plan,
            policy: makePolicy(),
            isMobilePlaybackDevice: true
        });

        engine.handleScrub(13200, 1000);
        observe(engine, {
            nowMs: 1000,
            reactionCurrentTimeMs: 13200,
            originalCurrentTimeMs: 45000,
            originalPlayerState: YT.PAUSED
        });

        const decisions = engine.tick(1000);
        expect(decisions).toContainEqual({
            type: 'seekThenPlayOriginal',
            targetTimeMs: 48700,
            compensationMs: 500
        });
    });

    it('holds the original at the exact paused target', () => {
        const plan = compileSyncPlan({
            stateTimeline: [
                { t: 0, state: YT.PLAYING, targetTime: 0 },
                { t: 20, state: YT.PAUSED, targetTime: 60 }
            ]
        });
        const desired = computeDesiredTwinPlayersState(plan, 23000);

        expect(desired.originalState).toBe(YT.PAUSED);
        expect(desired.originalTargetTimeMs).toBe(60000);
    });

    it('suppresses repeat hard sync while a seek and play command is settling', () => {
        const plan = compileSyncPlan({
            stateTimeline: [{ t: 0, state: YT.PLAYING, targetTime: 0 }]
        });
        const engine = createSyncEngineV2({
            plan,
            policy: makePolicy(),
            isMobilePlaybackDevice: true
        });

        observe(engine, { nowMs: 0, originalPlayerState: YT.PAUSED });
        expect(engine.tick(0).some((decision) => decision.type === 'seekThenPlayOriginal')).toBe(true);

        observe(engine, {
            nowMs: 250,
            reactionCurrentTimeMs: 250,
            originalCurrentTimeMs: 0,
            originalPlayerState: YT.PAUSED
        });
        const settlingDecisions = engine.tick(250);

        expect(settlingDecisions.some((decision) => decision.type === 'seekThenPlayOriginal')).toBe(false);
        expect(engine.getLastDiagnostics()?.suppressedByPendingCommand).toBe(true);
    });

    it('updates iframe latency from observed command completion', () => {
        const plan = compileSyncPlan({
            stateTimeline: [{ t: 0, state: YT.PLAYING, targetTime: 0 }]
        });
        const engine = createSyncEngineV2({
            plan,
            policy: makePolicy(),
            isMobilePlaybackDevice: true
        });

        observe(engine, { nowMs: 1000, originalPlayerState: YT.PAUSED });
        engine.tick(1000);
        observe(engine, {
            nowMs: 1500,
            reactionCurrentTimeMs: 500,
            reactionPlayerState: YT.PLAYING,
            originalCurrentTimeMs: 500,
            originalPlayerState: YT.PLAYING
        });
        engine.tick(1500);

        const diagnostics = engine.getLastDiagnostics();
        expect(diagnostics?.latencyEstimate.sampleCount).toBe(1);
        expect(diagnostics?.latencyEstimate.seekThenPlayMs).toBe(500);
    });

    it('keeps future config boundaries visible while the reaction is frozen and original plays', () => {
        const plan = compileSyncPlan({
            stateTimeline: [
                { t: 0, state: YT.PLAYING, targetTime: 0 },
                { t: 5, state: YT.PAUSED, targetTime: 5 }
            ]
        });
        const engine = createSyncEngineV2({ plan, policy: makePolicy() });

        observe(engine, {
            nowMs: 0,
            reactionCurrentTimeMs: 0,
            reactionPlayerState: YT.PAUSED,
            originalCurrentTimeMs: 0,
            originalPlayerState: YT.PLAYING
        });
        const decisions = engine.tick(6000);

        expect(engine.getLastDesiredState()?.originalState).toBe(YT.PAUSED);
        expect(decisions.some((decision) => decision.type === 'pauseOriginal')).toBe(true);
    });

    it('applies scheduled volume rate and overlay changes from one canonical clock', () => {
        const plan = compileSyncPlan({
            globalGain: 1.5,
            volumeTimeline: [{ t: 1, volume: 40 }],
            reactionVolumeTimeline: [{ t: 2, volume: 25 }],
            playbackRateTimeline: [{ t: 3, rate: 1.25 }],
            overlayVisibilityTimeline: [{ t: 4, visible: false }]
        });

        expect(computeDesiredTwinPlayersState(plan, 1500).originalVolume).toBe(60);
        expect(computeDesiredTwinPlayersState(plan, 2500).reactionVolume).toBe(25);
        expect(computeDesiredTwinPlayersState(plan, 3500).playbackRate).toBe(1.25);
        expect(computeDesiredTwinPlayersState(plan, 4500).fullscreenOverlayVisible).toBe(false);
        expect(computeDesiredTwinPlayersState(plan, 500).nextBoundaryMs).toBe(1000);
    });
});
