import {
  computePlaybackRate,
  computeSoftSyncDuration,
  decideSyncMode
} from '$lib/sync/softSync/logic.js';
import type { DesiredTwinPlayersState } from '$lib/helpers/twinPlayersSyncPlanV2';

export type PlayerObservation = {
  nowMs: number;
  reactionCurrentTimeMs: number;
  reactionPlayerState?: number;
  originalCurrentTimeMs?: number;
  originalPlayerState?: number;
  originalDurationMs?: number;
  originalVolume?: number;
  reactionVolume?: number;
  currentPlaybackRate?: number;
  fullscreenOverlayVisible?: boolean;
  isUserPaused?: boolean;
};

export type OriginalCommandKind =
  | 'seek'
  | 'play'
  | 'pause'
  | 'seekThenPlay'
  | 'setRate'
  | 'setVolume';

export type OriginalCommandStatus = 'pending' | 'observed' | 'timedOut';

export type OriginalCommandState = {
  id: string;
  kind: OriginalCommandKind;
  status: OriginalCommandStatus;
  issuedAtMs: number;
  targetTimeMs?: number;
  expectedState?: number;
};

export type IframeLatencyEstimate = {
  playOnlyMs: number;
  seekOnlyMs: number;
  seekThenPlayMs: number;
  sampleCount: number;
};

export type SyncEngineV2Policy = {
  playingState: number;
  pausedState: number;
  bufferingState: number;
  endedState: number;
  noOpDriftMs: number;
  softSyncMaxDriftMs: number;
  hardSyncDriftMs: number;
  severeDriftWhilePendingMs: number;
  pendingSettleMs: number;
  commandTimeoutMs: number;
  softSyncCooldownMs: number;
  maxLatencyCompensationMs: number;
  mobileSeekThenPlaySeedMs: number;
  latencySmoothing: number;
};

export type SyncDecision =
  | { type: 'setOriginalVolume'; volume: number }
  | { type: 'setReactionVolume'; volume: number }
  | { type: 'setOriginalPlaybackRate'; rate: number }
  | { type: 'applySoftSync'; rate: number; durationMs: number; driftMs: number; resetRate: number }
  | { type: 'seekOriginal'; targetTimeMs: number; force?: boolean; allowSeekAhead?: boolean }
  | { type: 'playOriginal' }
  | { type: 'pauseOriginal' }
  | { type: 'seekThenPlayOriginal'; targetTimeMs: number; compensationMs: number }
  | { type: 'setFullscreenOverlayVisible'; visible: boolean };

export type ReconcileResult = {
  decisions: SyncDecision[];
  commandState: OriginalCommandState | null;
  latencyEstimate: IframeLatencyEstimate;
  driftMs: number | null;
  suppressedByPendingCommand: boolean;
};

export const DEFAULT_SYNC_ENGINE_V2_POLICY: SyncEngineV2Policy = {
  playingState: 1,
  pausedState: 2,
  bufferingState: 3,
  endedState: 0,
  noOpDriftMs: 120,
  softSyncMaxDriftMs: 2000,
  hardSyncDriftMs: 2500,
  severeDriftWhilePendingMs: 3000,
  pendingSettleMs: 1200,
  commandTimeoutMs: 2200,
  softSyncCooldownMs: 750,
  maxLatencyCompensationMs: 1000,
  mobileSeekThenPlaySeedMs: 500,
  latencySmoothing: 0.25
};

export const createIframeLatencyEstimate = (
  options: { isMobilePlaybackDevice?: boolean; policy?: SyncEngineV2Policy } = {}
): IframeLatencyEstimate => {
  const policy = options.policy ?? DEFAULT_SYNC_ENGINE_V2_POLICY;
  return {
    playOnlyMs: 0,
    seekOnlyMs: 0,
    seekThenPlayMs: options.isMobilePlaybackDevice ? policy.mobileSeekThenPlaySeedMs : 0,
    sampleCount: 0
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getLatencyForCommand = (
  commandKind: OriginalCommandKind,
  latencyEstimate: IframeLatencyEstimate,
  policy: SyncEngineV2Policy
): number => {
  if (commandKind === 'seekThenPlay') {
    return clamp(latencyEstimate.seekThenPlayMs, 0, policy.maxLatencyCompensationMs);
  }
  if (commandKind === 'play') {
    return clamp(latencyEstimate.playOnlyMs, 0, policy.maxLatencyCompensationMs);
  }
  if (commandKind === 'seek') {
    return clamp(latencyEstimate.seekOnlyMs, 0, policy.maxLatencyCompensationMs);
  }
  return 0;
};

export function updateIframeLatencyEstimate({
  estimate,
  command,
  observedAtMs,
  policy = DEFAULT_SYNC_ENGINE_V2_POLICY
}: {
  estimate: IframeLatencyEstimate;
  command: OriginalCommandState;
  observedAtMs: number;
  policy?: SyncEngineV2Policy;
}): IframeLatencyEstimate {
  const sampleMs = clamp(observedAtMs - command.issuedAtMs, 0, policy.maxLatencyCompensationMs);
  const alpha = clamp(policy.latencySmoothing, 0.05, 1);
  const next = { ...estimate, sampleCount: estimate.sampleCount + 1 };

  if (command.kind === 'seekThenPlay') {
    next.seekThenPlayMs = Math.round(next.seekThenPlayMs * (1 - alpha) + sampleMs * alpha);
  } else if (command.kind === 'play') {
    next.playOnlyMs = Math.round(next.playOnlyMs * (1 - alpha) + sampleMs * alpha);
  } else if (command.kind === 'seek') {
    next.seekOnlyMs = Math.round(next.seekOnlyMs * (1 - alpha) + sampleMs * alpha);
  }

  return next;
}

export function settleOriginalCommandState({
  commandState,
  observation,
  latencyEstimate,
  policy = DEFAULT_SYNC_ENGINE_V2_POLICY
}: {
  commandState: OriginalCommandState | null;
  observation: PlayerObservation;
  latencyEstimate: IframeLatencyEstimate;
  policy?: SyncEngineV2Policy;
}): { commandState: OriginalCommandState | null; latencyEstimate: IframeLatencyEstimate } {
  if (!commandState || commandState.status !== 'pending') {
    return { commandState, latencyEstimate };
  }

  const timedOut = observation.nowMs - commandState.issuedAtMs >= policy.commandTimeoutMs;
  const observedExpectedState =
    typeof commandState.expectedState !== 'number'
    || observation.originalPlayerState === commandState.expectedState;
  const observedExpectedTime =
    typeof commandState.targetTimeMs !== 'number'
    || typeof observation.originalCurrentTimeMs !== 'number'
    || Math.abs(observation.originalCurrentTimeMs - commandState.targetTimeMs) <= policy.hardSyncDriftMs;

  if (observedExpectedState && observedExpectedTime) {
    return {
      commandState: { ...commandState, status: 'observed' },
      latencyEstimate: updateIframeLatencyEstimate({
        estimate: latencyEstimate,
        command: commandState,
        observedAtMs: observation.nowMs,
        policy
      })
    };
  }

  if (timedOut) {
    return {
      commandState: { ...commandState, status: 'timedOut' },
      latencyEstimate
    };
  }

  return { commandState, latencyEstimate };
}

const createCommandState = ({
  kind,
  nowMs,
  targetTimeMs,
  expectedState
}: {
  kind: OriginalCommandKind;
  nowMs: number;
  targetTimeMs?: number;
  expectedState?: number;
}): OriginalCommandState => ({
  id: `${kind}-${nowMs}-${Math.round(targetTimeMs ?? 0)}`,
  kind,
  status: 'pending',
  issuedAtMs: nowMs,
  targetTimeMs,
  expectedState
});

export function reconcileOriginalPlayer({
  desired,
  observation,
  commandState,
  latencyEstimate,
  lastSoftSyncAtMs,
  forceHardSync = false,
  policy = DEFAULT_SYNC_ENGINE_V2_POLICY
}: {
  desired: DesiredTwinPlayersState;
  observation: PlayerObservation;
  commandState: OriginalCommandState | null;
  latencyEstimate: IframeLatencyEstimate;
  lastSoftSyncAtMs: number;
  forceHardSync?: boolean;
  policy?: SyncEngineV2Policy;
}): ReconcileResult {
  const decisions: SyncDecision[] = [];
  let nextCommandState = commandState?.status === 'pending' ? commandState : null;
  const actualOriginalTimeMs =
    typeof observation.originalCurrentTimeMs === 'number' ? observation.originalCurrentTimeMs : null;
  const driftMs = actualOriginalTimeMs === null ? null : actualOriginalTimeMs - desired.originalTargetTimeMs;
  const absDriftMs = driftMs === null ? Number.POSITIVE_INFINITY : Math.abs(driftMs);
  const pendingAgeMs = nextCommandState ? observation.nowMs - nextCommandState.issuedAtMs : 0;
  const pendingCommandIsSettling =
    Boolean(nextCommandState)
    && pendingAgeMs < policy.pendingSettleMs
    && absDriftMs < policy.severeDriftWhilePendingMs
    && !forceHardSync;

  if (pendingCommandIsSettling) {
    return {
      decisions,
      commandState: nextCommandState,
      latencyEstimate,
      driftMs,
      suppressedByPendingCommand: true
    };
  }

  if (Math.abs((observation.originalVolume ?? desired.originalVolume) - desired.originalVolume) > 0.5) {
    decisions.push({ type: 'setOriginalVolume', volume: desired.originalVolume });
  }

  if (Math.abs((observation.reactionVolume ?? desired.reactionVolume) - desired.reactionVolume) > 0.5) {
    decisions.push({ type: 'setReactionVolume', volume: desired.reactionVolume });
  }

  if (observation.fullscreenOverlayVisible !== desired.fullscreenOverlayVisible) {
    decisions.push({
      type: 'setFullscreenOverlayVisible',
      visible: desired.fullscreenOverlayVisible
    });
  }

  const originalIsPlaying = observation.originalPlayerState === policy.playingState;
  const desiredIsPlaying = desired.originalState === policy.playingState;
  const desiredIsPaused = desired.originalState !== policy.playingState;
  const originalStateMismatch =
    typeof observation.originalPlayerState === 'number'
    && observation.originalPlayerState !== desired.originalState;

  if (desiredIsPlaying) {
    const needsPlayCommand = !originalIsPlaying || originalStateMismatch;
    const shouldHardSeek =
      forceHardSync
      || absDriftMs > policy.hardSyncDriftMs
      || (needsPlayCommand && absDriftMs > policy.noOpDriftMs);

    if (needsPlayCommand) {
      const compensationMs = getLatencyForCommand('seekThenPlay', latencyEstimate, policy);
      const targetTimeMs = desired.originalTargetTimeMs + compensationMs;
      decisions.push({ type: 'seekThenPlayOriginal', targetTimeMs, compensationMs });
      nextCommandState = createCommandState({
        kind: 'seekThenPlay',
        nowMs: observation.nowMs,
        targetTimeMs,
        expectedState: policy.playingState
      });
      return {
        decisions,
        commandState: nextCommandState,
        latencyEstimate,
        driftMs,
        suppressedByPendingCommand: false
      };
    }

    if (shouldHardSeek) {
      const compensationMs = getLatencyForCommand('seek', latencyEstimate, policy);
      const targetTimeMs = desired.originalTargetTimeMs + compensationMs;
      decisions.push({ type: 'seekOriginal', targetTimeMs, force: forceHardSync, allowSeekAhead: true });
      nextCommandState = createCommandState({
        kind: 'seek',
        nowMs: observation.nowMs,
        targetTimeMs,
        expectedState: policy.playingState
      });
    } else if (
      driftMs !== null
      && absDriftMs > policy.noOpDriftMs
      && absDriftMs <= policy.softSyncMaxDriftMs
      && observation.nowMs - lastSoftSyncAtMs >= policy.softSyncCooldownMs
    ) {
      const driftSeconds = driftMs / 1000;
      if (decideSyncMode(driftSeconds) === 'soft-sync') {
        decisions.push({
          type: 'applySoftSync',
          rate: computePlaybackRate(driftSeconds),
          durationMs: computeSoftSyncDuration(driftSeconds),
          driftMs,
          resetRate: desired.playbackRate
        });
      }
    }
  } else if (desiredIsPaused) {
    if (forceHardSync || absDriftMs > policy.noOpDriftMs) {
      decisions.push({
        type: 'seekOriginal',
        targetTimeMs: desired.originalTargetTimeMs,
        force: forceHardSync,
        allowSeekAhead: true
      });
      nextCommandState = createCommandState({
        kind: 'seek',
        nowMs: observation.nowMs,
        targetTimeMs: desired.originalTargetTimeMs,
        expectedState: policy.pausedState
      });
    }

    if (observation.originalPlayerState !== policy.pausedState) {
      decisions.push({ type: 'pauseOriginal' });
      nextCommandState = createCommandState({
        kind: 'pause',
        nowMs: observation.nowMs,
        expectedState: policy.pausedState
      });
    }
  }

  const hasSoftSync = decisions.some((decision) => decision.type === 'applySoftSync');
  if (
    !hasSoftSync
    && Math.abs((observation.currentPlaybackRate ?? desired.playbackRate) - desired.playbackRate) > 0.001
  ) {
    decisions.push({ type: 'setOriginalPlaybackRate', rate: desired.playbackRate });
  }

  return {
    decisions,
    commandState: nextCommandState,
    latencyEstimate,
    driftMs,
    suppressedByPendingCommand: false
  };
}
