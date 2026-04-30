import {
  ExperienceClock,
  createExperienceClock,
  type ExperienceClockSnapshot
} from '$lib/helpers/twinPlayersExperienceClock';
import {
  computeDesiredTwinPlayersState,
  type CompileSyncPlanInput,
  compileSyncPlan,
  type DesiredTwinPlayersState,
  type SyncPlan
} from '$lib/helpers/twinPlayersSyncPlanV2';
import {
  createIframeLatencyEstimate,
  DEFAULT_SYNC_ENGINE_V2_POLICY,
  reconcileOriginalPlayer,
  settleOriginalCommandState,
  type IframeLatencyEstimate,
  type OriginalCommandState,
  type PlayerObservation,
  type SyncDecision,
  type SyncEngineV2Policy
} from '$lib/helpers/twinPlayersSyncReconcileV2';

export type SyncEngineV2Diagnostics = {
  activeConfigId: string;
  experienceTimeMs: number;
  desiredOriginalState: number;
  desiredOriginalTimeMs: number;
  observedOriginalState?: number;
  observedOriginalTimeMs?: number;
  driftMs: number | null;
  suppressedByPendingCommand: boolean;
  commandState: OriginalCommandState | null;
  latencyEstimate: IframeLatencyEstimate;
};

export type SyncEngineV2 = {
  observePlayers: (observation: PlayerObservation) => void;
  handleScrub: (reactionTimeMs: number, nowMs?: number) => void;
  handleManualSync: () => void;
  tick: (nowMs: number) => SyncDecision[];
  getClockSnapshot: (nowMs: number) => ExperienceClockSnapshot;
  getLastDesiredState: () => DesiredTwinPlayersState | null;
  getLastDiagnostics: () => SyncEngineV2Diagnostics | null;
  getPlan: () => SyncPlan;
};

export type CreateSyncEngineV2Options = {
  plan: SyncPlan;
  clock?: ExperienceClock;
  policy?: Partial<SyncEngineV2Policy>;
  isMobilePlaybackDevice?: boolean;
};

const mergePolicy = (policy?: Partial<SyncEngineV2Policy>): SyncEngineV2Policy => ({
  ...DEFAULT_SYNC_ENGINE_V2_POLICY,
  ...policy
});

const isReactionAdvancing = (observation: PlayerObservation, policy: SyncEngineV2Policy): boolean =>
  observation.reactionPlayerState === policy.playingState
  || observation.reactionPlayerState === policy.bufferingState;

export function createSyncEngineV2({
  plan,
  clock = createExperienceClock({ experienceTimeMs: plan.offsetStartMs, nowMs: 0 }),
  policy: policyOverride,
  isMobilePlaybackDevice = false
}: CreateSyncEngineV2Options): SyncEngineV2 {
  const policy = mergePolicy(policyOverride);
  let lastObservation: PlayerObservation | null = null;
  let lastDesired: DesiredTwinPlayersState | null = null;
  let commandState: OriginalCommandState | null = null;
  let latencyEstimate = createIframeLatencyEstimate({ isMobilePlaybackDevice, policy });
  let lastSoftSyncAtMs = 0;
  let forceHardSyncNext = false;
  let lastDiagnostics: SyncEngineV2Diagnostics | null = null;

  const updateClockFromObservation = (observation: PlayerObservation) => {
    if (observation.isUserPaused) {
      clock.freezeAt(observation.reactionCurrentTimeMs, observation.nowMs);
      return;
    }

    if (isReactionAdvancing(observation, policy)) {
      clock.anchorToReactionTime(observation.reactionCurrentTimeMs, observation.nowMs);
      return;
    }

    const snapshot = clock.snapshot(observation.nowMs);
    const desiredAtSnapshot = computeDesiredTwinPlayersState(plan, snapshot.experienceTimeMs);
    const originalCanAdvanceExperience =
      desiredAtSnapshot.originalState === policy.playingState
      && observation.originalPlayerState === policy.playingState;

    if (originalCanAdvanceExperience && snapshot.mode !== 'wall') {
      clock.advanceWithWallClock(
        Math.max(snapshot.experienceTimeMs, observation.reactionCurrentTimeMs),
        observation.nowMs
      );
      return;
    }

    if (!originalCanAdvanceExperience) {
      clock.freezeAt(observation.reactionCurrentTimeMs, observation.nowMs);
    }
  };

  return {
    observePlayers(observation: PlayerObservation) {
      const settled = settleOriginalCommandState({
        commandState,
        observation,
        latencyEstimate,
        policy
      });
      commandState = settled.commandState?.status === 'pending' ? settled.commandState : null;
      latencyEstimate = settled.latencyEstimate;
      lastObservation = observation;
      updateClockFromObservation(observation);
    },

    handleScrub(reactionTimeMs: number, nowMs?: number) {
      const effectiveNow = nowMs ?? lastObservation?.nowMs ?? 0;
      commandState = null;
      forceHardSyncNext = true;
      clock.anchorToReactionTime(reactionTimeMs, effectiveNow);
    },

    handleManualSync() {
      commandState = null;
      forceHardSyncNext = true;
    },

    tick(nowMs: number): SyncDecision[] {
      if (!lastObservation) {
        return [];
      }

      const clockSnapshot = clock.snapshot(nowMs);
      const desired = computeDesiredTwinPlayersState(plan, clockSnapshot.experienceTimeMs);
      lastDesired = desired;

      const result = reconcileOriginalPlayer({
        desired,
        observation: {
          ...lastObservation,
          nowMs
        },
        commandState,
        latencyEstimate,
        lastSoftSyncAtMs,
        forceHardSync: forceHardSyncNext,
        policy
      });

      commandState = result.commandState;
      latencyEstimate = result.latencyEstimate;
      if (result.decisions.some((decision) => decision.type === 'applySoftSync')) {
        lastSoftSyncAtMs = nowMs;
      }
      forceHardSyncNext = false;

      lastDiagnostics = {
        activeConfigId: desired.activeStateConfigId,
        experienceTimeMs: desired.experienceTimeMs,
        desiredOriginalState: desired.originalState,
        desiredOriginalTimeMs: desired.originalTargetTimeMs,
        observedOriginalState: lastObservation.originalPlayerState,
        observedOriginalTimeMs: lastObservation.originalCurrentTimeMs,
        driftMs: result.driftMs,
        suppressedByPendingCommand: result.suppressedByPendingCommand,
        commandState,
        latencyEstimate
      };

      return result.decisions;
    },

    getClockSnapshot(nowMs: number) {
      return clock.snapshot(nowMs);
    },

    getLastDesiredState() {
      return lastDesired;
    },

    getLastDiagnostics() {
      return lastDiagnostics;
    },

    getPlan() {
      return plan;
    }
  };
}

export function createSyncEngineV2FromReactionState(
  input: CompileSyncPlanInput,
  options: Omit<CreateSyncEngineV2Options, 'plan'> = {}
): SyncEngineV2 {
  return createSyncEngineV2({
    ...options,
    plan: compileSyncPlan(input)
  });
}
