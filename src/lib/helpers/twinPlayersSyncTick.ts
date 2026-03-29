import {
  getCurrentPlaybackRateFromConfigs,
  getCurrentStateFromStateConfigs,
  getCurrentVolumeFromVolumeConfigs,
  getCurrentOverlayVisibilityFromConfigs
} from '$lib/helpers/reaction';
import {
  decideSyncMode,
  isSoftSyncAllowed,
  computePlaybackRate,
  computeSoftSyncDuration,
  DEFAULT_SOFT_SYNC_CONFIG
} from '$lib/sync/softSync/logic.js';

export type TwinPlayersSyncTracking = {
  lastOriginalTargetTime?: number;
  lastOriginalSeekAt: number;
  lastOriginalSeekTarget?: number;
  mobileAudioWinner: 'original' | 'reaction' | null;
  stateTimelineIndex?: number;
  reactionTransportTrackIndex?: number;
  lastSoftSyncAt: number;
  softSyncIsActive: boolean;
  softSyncResetTimeoutId?: number;
};

export type TwinPlayersPlayerState = {
  PLAYING: number;
  PAUSED: number;
  BUFFERING: number;
  CUED: number;
  ENDED: number;
};

export type TwinPlayersSyncTickInput = {
  reactionCurrentTime: number;
  previousReactionTime: number;

  seekMin: number;
  seekMax: number;

  timeOffset: number;
  globalGain: number;

  isFineTuneModeOn: boolean;
  isFullscreen: boolean;

  currentStateOriginalVideo: number;
  currentPlaybackRate: number;
  currentVolumeOriginalVideo: number;
  currentVolumeReactionVideo: number;
  currentFullscreenOverlayVisible: boolean;

  isReactionMuteModeEnabled: boolean;
  isReactionAutoMuted: boolean;

  isMobileAudioEnvironment: boolean;
  isMobilePlaybackDevice: boolean;
  isMobileLazySyncEnabled?: boolean;

  playerConfigs: any;
  volumeConfigs: any;
  reactionVolumeConfigs: any;
  playbackRateConfigs: any;
  overlayVisibilityTimeline: any[];
  stateTimeline: any[];
  reactionTransportTrack: any[];

  reactionPlayerState?: number;
  originalPlayerState?: number;
  originalCurrentTime?: number;
  originalDuration?: number;
  originalIsMuted?: boolean;
  reactionIsMuted?: boolean;

  now: number;
  yt: TwinPlayersPlayerState;
};

export type TwinPlayersSyncAction =
  | { type: 'setOriginalVolume'; volume: number }
  | { type: 'setReactionVolume'; volume: number }
  | { type: 'setOriginalPlaybackRate'; rate: number }
  | { type: 'applySoftSync'; rate: number; durationMs: number; drift: number }
  | { type: 'muteOriginal' }
  | { type: 'unmuteOriginal' }
  | { type: 'muteReaction' }
  | { type: 'unmuteReaction' }
  | {
      type: 'applyOriginalStateChange';
      nextState: number;
      targetTime: number;
      options?: { allowSeekAhead?: boolean; throttleMs?: number; forceSeek?: boolean };
    }
  | { type: 'pauseOriginal' }
  | { type: 'applyReactionStateChange'; nextState: number };

export type TwinPlayersSyncTickResult = {
  actions: TwinPlayersSyncAction[];
  nextTracking: TwinPlayersSyncTracking;
  stateUpdates: {
    currentStateOriginalVideo?: number;
    currentPlaybackRate?: number;
    currentVolumeOriginalVideo?: number;
    currentVolumeReactionVideo?: number;
    fullscreenOverlayVisible?: boolean;
  };
  enforceMuteModeWithOriginalState?: number;
  nextBoundaryReactionTime?: number;
};

const upperBoundByT = (timeline: any[], time: number): number => {
  let low = 0;
  let high = timeline.length;

  while (low < high) {
    const mid = (low + high) >> 1;
    const midTime = Number(timeline[mid]?.t);
    if (Number.isFinite(midTime) && midTime <= time) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
};

const hasAnyConfig = (configs: any) => {
  if (!configs) {
    return false;
  }
  if (Array.isArray(configs)) {
    return configs.length > 0;
  }
  if (typeof configs === 'object') {
    return Object.keys(configs).length > 0;
  }
  return false;
};

export function computeTwinPlayersSyncTick(
  input: TwinPlayersSyncTickInput,
  tracking: TwinPlayersSyncTracking
): TwinPlayersSyncTickResult {
  const actions: TwinPlayersSyncAction[] = [];
  const stateUpdates: TwinPlayersSyncTickResult['stateUpdates'] = {};

  const yt = input.yt;
  const timeOffset = Number(input.timeOffset || 0);

  let nextTracking: TwinPlayersSyncTracking = {
    ...tracking,
    lastOriginalSeekAt: Number.isFinite(tracking.lastOriginalSeekAt) ? tracking.lastOriginalSeekAt : 0,
    mobileAudioWinner: tracking.mobileAudioWinner ?? null,
    stateTimelineIndex: Number.isFinite(tracking.stateTimelineIndex) ? tracking.stateTimelineIndex : 0,
    reactionTransportTrackIndex: Number.isFinite(tracking.reactionTransportTrackIndex) ? tracking.reactionTransportTrackIndex : 0,
    lastSoftSyncAt: Number.isFinite(tracking.lastSoftSyncAt) ? tracking.lastSoftSyncAt : 0,
    softSyncIsActive: Boolean(tracking.softSyncIsActive),
    softSyncResetTimeoutId: tracking.softSyncResetTimeoutId
  };

  const reactionCurrentTime = Number(input.reactionCurrentTime);
  const previousReactionTime = Number.isFinite(input.previousReactionTime)
    ? Number(input.previousReactionTime)
    : reactionCurrentTime;

  // 1) Volume + mobile arbitration
  if (input.isMobileAudioEnvironment) {
    const intendedOriginalVolume = getCurrentVolumeFromVolumeConfigs(
      reactionCurrentTime,
      input.volumeConfigs,
      input.globalGain,
      timeOffset
    );

    const intendedReactionVolume = getCurrentVolumeFromVolumeConfigs(
      reactionCurrentTime,
      input.reactionVolumeConfigs,
      1.0,
      timeOffset
    );

    const hasOriginalVolumeConfigs = hasAnyConfig(input.volumeConfigs);
    const hasReactionVolumeConfigs = hasAnyConfig(input.reactionVolumeConfigs);

    if (!hasOriginalVolumeConfigs && !hasReactionVolumeConfigs) {
      const originalWins = input.currentStateOriginalVideo === yt.PLAYING;
      nextTracking = {
        ...nextTracking,
        mobileAudioWinner: originalWins ? 'original' : 'reaction'
      };

      if (originalWins) {
        if (input.originalIsMuted || input.currentVolumeOriginalVideo !== intendedOriginalVolume) {
          actions.push({ type: 'setOriginalVolume', volume: intendedOriginalVolume });
          actions.push({ type: 'unmuteOriginal' });
          stateUpdates.currentVolumeOriginalVideo = intendedOriginalVolume;
        }
        if (!input.reactionIsMuted) {
          actions.push({ type: 'muteReaction' });
        }
      } else {
        if (input.reactionIsMuted || input.currentVolumeReactionVideo !== intendedReactionVolume) {
          actions.push({ type: 'setReactionVolume', volume: intendedReactionVolume });
          actions.push({ type: 'unmuteReaction' });
          stateUpdates.currentVolumeReactionVideo = intendedReactionVolume;
        }
        if (!input.originalIsMuted) {
          actions.push({ type: 'muteOriginal' });
        }
      }

      // Do not return here: state/time sync (including pause configs) must still run.
    }

    const delta = intendedOriginalVolume - intendedReactionVolume;
    const HYSTERESIS = 3;
    let originalWins = intendedOriginalVolume > intendedReactionVolume;

    if (nextTracking.mobileAudioWinner) {
      if (Math.abs(delta) <= HYSTERESIS) {
        originalWins = nextTracking.mobileAudioWinner === 'original';
      }
    } else if (intendedOriginalVolume === intendedReactionVolume) {
      originalWins = false;
    }

    const nextWinner: 'original' | 'reaction' = originalWins ? 'original' : 'reaction';
    nextTracking = {
      ...nextTracking,
      mobileAudioWinner: nextWinner
    };

    if (originalWins) {
      if (input.originalIsMuted || input.currentVolumeOriginalVideo !== intendedOriginalVolume) {
        actions.push({ type: 'setOriginalVolume', volume: intendedOriginalVolume });
        actions.push({ type: 'unmuteOriginal' });
        stateUpdates.currentVolumeOriginalVideo = intendedOriginalVolume;
      }
      if (!input.reactionIsMuted) {
        actions.push({ type: 'muteReaction' });
      }
    } else {
      if (input.reactionIsMuted || input.currentVolumeReactionVideo !== intendedReactionVolume) {
        actions.push({ type: 'setReactionVolume', volume: intendedReactionVolume });
        actions.push({ type: 'unmuteReaction' });
        stateUpdates.currentVolumeReactionVideo = intendedReactionVolume;
      }
      if (!input.originalIsMuted) {
        actions.push({ type: 'muteOriginal' });
      }
    }
  } else {
    const intendedOriginalVolume = getCurrentVolumeFromVolumeConfigs(
      reactionCurrentTime,
      input.volumeConfigs,
      input.globalGain,
      timeOffset
    );

    if (input.currentVolumeOriginalVideo !== intendedOriginalVolume) {
      actions.push({ type: 'setOriginalVolume', volume: intendedOriginalVolume });
      stateUpdates.currentVolumeOriginalVideo = intendedOriginalVolume;
    }

    const playingState = yt.PLAYING;
    const shouldMuteReaction =
      input.isReactionMuteModeEnabled && input.currentStateOriginalVideo === playingState;

    if (!shouldMuteReaction && !input.isReactionAutoMuted) {
      const intendedReactionVolume = getCurrentVolumeFromVolumeConfigs(
        reactionCurrentTime,
        input.reactionVolumeConfigs,
        1.0,
        timeOffset
      );

      const timeInReaction = reactionCurrentTime;
      if (
        timeInReaction >= input.seekMin
        && (!Number.isFinite(input.seekMax) || timeInReaction <= input.seekMax)
        && input.currentVolumeReactionVideo !== intendedReactionVolume
      ) {
        actions.push({ type: 'setReactionVolume', volume: intendedReactionVolume });
        stateUpdates.currentVolumeReactionVideo = intendedReactionVolume;
      }
    }
  }

  // 2) Playback rate (original)
  const desiredPlaybackRate = getCurrentPlaybackRateFromConfigs(
    reactionCurrentTime,
    input.playbackRateConfigs,
    timeOffset
  );

  if (
    reactionCurrentTime >= input.seekMin
    && (!Number.isFinite(input.seekMax) || reactionCurrentTime <= input.seekMax)
    && Math.abs(desiredPlaybackRate - input.currentPlaybackRate) > 0.001
  ) {
    actions.push({ type: 'setOriginalPlaybackRate', rate: desiredPlaybackRate });
    stateUpdates.currentPlaybackRate = desiredPlaybackRate;
  }

  // 2.5) Overlay visibility (applies in overlay layout mode)
  const desiredOverlayVisible = getCurrentOverlayVisibilityFromConfigs(
    reactionCurrentTime,
    input.overlayVisibilityTimeline,
    timeOffset
  );

  if (desiredOverlayVisible !== input.currentFullscreenOverlayVisible) {
    stateUpdates.fullscreenOverlayVisible = desiredOverlayVisible;
  }

  // 3) State/time sync (original)
  const reactionPlayerState = input.reactionPlayerState;
  const isReactionPlaying = reactionPlayerState === yt.PLAYING;
  const shouldHoldOriginalWhilePaused = input.isFineTuneModeOn && !isReactionPlaying;

  const timeline = Array.isArray(input.stateTimeline) ? input.stateTimeline : [];

  const previousEffective = Number(previousReactionTime) - timeOffset;
  const currentEffective = Number(reactionCurrentTime) - timeOffset;
  const movingForward = currentEffective >= previousEffective - 0.0001;

  let workingState = input.currentStateOriginalVideo;

  if (movingForward && timeline.length) {
    let idx = Number.isFinite(nextTracking.stateTimelineIndex) ? Number(nextTracking.stateTimelineIndex) : 0;
    if (idx < 0 || idx > timeline.length) {
      idx = 0;
    }

    // If we jumped backwards or the cursor is stale, re-seek it.
    const cursorTime = Number(timeline[Math.max(0, Math.min(idx, timeline.length - 1))]?.t);
    if (!Number.isFinite(cursorTime) || cursorTime > currentEffective + 0.0001) {
      idx = upperBoundByT(timeline, previousEffective);
    }

    while (idx < timeline.length) {
      const entry = timeline[idx];
      const eventTime = Number(entry?.t);
      if (!Number.isFinite(eventTime)) {
        idx += 1;
        continue;
      }
      if (eventTime > currentEffective) {
        break;
      }

      if (eventTime > previousEffective && eventTime <= currentEffective) {
        const rawState = Number(entry?.state);
        let desiredState = Number.isFinite(rawState) ? rawState : -1;
        if (shouldHoldOriginalWhilePaused && desiredState === yt.PLAYING) {
          desiredState = yt.PAUSED;
        }
        const desiredTarget = Number(entry?.targetTime ?? entry?.time ?? 0);
        actions.push({
          type: 'applyOriginalStateChange',
          nextState: desiredState,
          targetTime: desiredTarget
        });
        workingState = desiredState;
      }

      idx += 1;
    }

    nextTracking = {
      ...nextTracking,
      stateTimelineIndex: idx
    };
  }

  const config = getCurrentStateFromStateConfigs(reactionCurrentTime, input.playerConfigs, timeOffset);
  const rawConfigState = Number(config.state);
  const configState = Number.isFinite(rawConfigState) ? rawConfigState : -1;
  const effectiveConfigState =
    shouldHoldOriginalWhilePaused && configState === yt.PLAYING ? yt.PAUSED : configState;

  const baseTargetTime = Number(config.time ?? 0);
  const anchorTime = Number(config.closestSmallerTimeCode ?? currentEffective);
  const actualOriginalTime = Number.isFinite(input.originalCurrentTime) ? Number(input.originalCurrentTime) : Number.NaN;
  const originalDuration = Number.isFinite(input.originalDuration) && Number(input.originalDuration) > 0
    ? Number(input.originalDuration)
    : Number.NaN;

  let computedTargetTime = Number.isFinite(baseTargetTime) ? baseTargetTime : Number.NaN;

  if (Number.isFinite(computedTargetTime) && Number.isFinite(anchorTime)) {
    const deltaSinceAnchor = currentEffective - anchorTime;
    if (effectiveConfigState === yt.PLAYING && Number.isFinite(deltaSinceAnchor)) {
      computedTargetTime += Math.max(deltaSinceAnchor, 0);
    }
  }

  const ORIGINAL_END_EPSILON = 0.25;
  const targetPastOriginalEnd =
    Number.isFinite(originalDuration)
    && Number.isFinite(computedTargetTime)
    && computedTargetTime >= Math.max(originalDuration - ORIGINAL_END_EPSILON, 0);

  if (targetPastOriginalEnd) {
    actions.push({ type: 'pauseOriginal' });
    workingState = yt.ENDED;
    stateUpdates.currentStateOriginalVideo = workingState;
    const enforceState = workingState;
    if (Number.isFinite(actualOriginalTime)) {
      nextTracking = {
        ...nextTracking,
        lastOriginalTargetTime: actualOriginalTime
      };
    }
    return {
      actions,
      nextTracking,
      stateUpdates,
      enforceMuteModeWithOriginalState: enforceState
    };
  }

  const isMobileLazySyncEnabled = Boolean(input.isMobileLazySyncEnabled);

  const tolerance = isMobileLazySyncEnabled
    ? 2.0
    : (effectiveConfigState === yt.PLAYING
        ? 0.9
        : 0.05);

  let targetMismatch = false;
  let driftAbs = Number.NaN;
  let drift = 0;

  if (Number.isFinite(computedTargetTime)) {
    if (Number.isFinite(actualOriginalTime)) {
      drift = actualOriginalTime - computedTargetTime;
      driftAbs = Math.abs(drift);
      if (effectiveConfigState === yt.PLAYING) {
        const quantize = (value: number, step: number) => Math.round(value / step) * step;
        targetMismatch =
          Math.abs(quantize(actualOriginalTime, 0.5) - quantize(computedTargetTime, 0.5)) > tolerance;
      } else {
        targetMismatch = driftAbs > tolerance;
      }
    } else if (typeof nextTracking.lastOriginalTargetTime === 'number') {
      drift = nextTracking.lastOriginalTargetTime - computedTargetTime;
      driftAbs = Math.abs(drift);
      targetMismatch = driftAbs > tolerance;
    } else {
      targetMismatch = true;
    }
  }

  const closestSmaller = Number(config.closestSmallerTimeCode);
  const configIsInRange =
    closestSmaller >= input.seekMin
    && (!Number.isFinite(input.seekMax) || closestSmaller <= input.seekMax);

  const originalHasEnded = input.originalPlayerState === yt.ENDED;
  const configWantsToPlay = effectiveConfigState === yt.PLAYING;
  const shouldApplySync = !originalHasEnded || configWantsToPlay;

  const now = input.now;
  const shouldApplyState = workingState !== effectiveConfigState;

  // Soft-sync logic: use playback rate adjustment for small drift when playing
  const isPlaying = effectiveConfigState === yt.PLAYING && input.originalPlayerState === yt.PLAYING;
  const isBuffering = input.originalPlayerState === yt.BUFFERING;
  const canUseSoftSync = isPlaying && !isBuffering && !shouldApplyState && Number.isFinite(driftAbs);
  
  // Decide sync mode
  const syncMode = canUseSoftSync ? decideSyncMode(drift, DEFAULT_SOFT_SYNC_CONFIG) : 'hard-sync';
  const isSoftSyncCooledDown = isSoftSyncAllowed(nextTracking.lastSoftSyncAt, now, DEFAULT_SOFT_SYNC_CONFIG);
  
  // Apply soft-sync for small drift if cooled down
  if (canUseSoftSync && syncMode === 'soft-sync' && targetMismatch && isSoftSyncCooledDown) {
    const rate = computePlaybackRate(drift, DEFAULT_SOFT_SYNC_CONFIG);
    const durationMs = computeSoftSyncDuration(drift, DEFAULT_SOFT_SYNC_CONFIG);
    
    actions.push({
      type: 'applySoftSync',
      rate,
      durationMs,
      drift
    });
    
    nextTracking = {
      ...nextTracking,
      lastSoftSyncAt: now,
      softSyncIsActive: true
    };
    
    workingState = effectiveConfigState;
  } else if (syncMode === 'no-op' && nextTracking.softSyncIsActive) {
    // If we're now in sync and soft-sync is active, we'll let the orchestrator reset it
    // No action needed here
  } else {
    // Hard-sync: use existing seek logic for large drift or when soft-sync not applicable
    const shouldApplySeek = targetMismatch && (
      isMobileLazySyncEnabled
        ? (Number.isFinite(driftAbs)
            && driftAbs > 2.0
            && now - nextTracking.lastOriginalSeekAt > 3500)
        : (Number.isFinite(driftAbs) && (driftAbs > 2.5 || now - nextTracking.lastOriginalSeekAt > 3500))
    );

    if (shouldApplySync && configIsInRange && (shouldApplyState || shouldApplySeek)) {
      if (
        reactionCurrentTime >= input.seekMin
        && (!Number.isFinite(input.seekMax) || reactionCurrentTime <= input.seekMax)
      ) {
        actions.push({
          type: 'applyOriginalStateChange',
          nextState: effectiveConfigState,
          targetTime: computedTargetTime,
          options: {
            throttleMs: 3500,
            allowSeekAhead: !(Number.isFinite(driftAbs) && driftAbs < 1.25),
            forceSeek: shouldApplyState
          }
        });

        workingState = effectiveConfigState;
      }
    }
  }

  if (originalHasEnded && !configWantsToPlay) {
    if (input.currentStateOriginalVideo !== yt.ENDED) {
      workingState = yt.ENDED;
    }
  }

  if (workingState !== input.currentStateOriginalVideo) {
    stateUpdates.currentStateOriginalVideo = workingState;
  }

  if (Number.isFinite(actualOriginalTime)) {
    nextTracking = {
      ...nextTracking,
      lastOriginalTargetTime: actualOriginalTime
    };
  }

  // 3.5) Reaction transport track: control reaction video play/pause state
  const reactionTransportTimeline = Array.isArray(input.reactionTransportTrack) ? input.reactionTransportTrack : [];
  const movingForwardRT = reactionCurrentTime >= previousReactionTime - 0.0001;

  if (reactionTransportTimeline.length) {
    let rtIdx = Number.isFinite(nextTracking.reactionTransportTrackIndex)
      ? Number(nextTracking.reactionTransportTrackIndex)
      : 0;

    // Determine if the cursor is stale: index past end, or entry at cursor is ahead of current time.
    const clampedForCheck = Math.max(0, Math.min(rtIdx, reactionTransportTimeline.length - 1));
    const cursorRTTime = Number(reactionTransportTimeline[clampedForCheck]?.t);
    const cursorIsStale = rtIdx >= reactionTransportTimeline.length
      || !Number.isFinite(cursorRTTime)
      || cursorRTTime > reactionCurrentTime + 0.0001;

    if (cursorIsStale) {
      // Re-position cursor to upperBound of previousReactionTime, then enforce state.
      rtIdx = upperBoundByT(reactionTransportTimeline, previousReactionTime);
      const lastEntry = reactionTransportTimeline[Math.max(0, rtIdx - 1)];
      if (lastEntry && Number.isFinite(Number(lastEntry?.t)) && Number(lastEntry.t) <= reactionCurrentTime) {
        const rawRTState = Number(lastEntry?.state);
        const desiredRTState = Number.isFinite(rawRTState) ? rawRTState : -1;
        const currentRTState = input.reactionPlayerState;
        if (
          desiredRTState !== -1
          && typeof currentRTState === 'number'
          && currentRTState !== desiredRTState
          && currentRTState !== yt.BUFFERING
        ) {
          actions.push({ type: 'applyReactionStateChange', nextState: desiredRTState });
        }
      }
    }

    if (movingForwardRT) {
      while (rtIdx < reactionTransportTimeline.length) {
        const entry = reactionTransportTimeline[rtIdx];
        const eventTime = Number(entry?.t);
        if (!Number.isFinite(eventTime)) {
          rtIdx += 1;
          continue;
        }
        if (eventTime > reactionCurrentTime) {
          break;
        }

        if (eventTime > previousReactionTime && eventTime <= reactionCurrentTime) {
          const rawRTState = Number(entry?.state);
          const desiredRTState = Number.isFinite(rawRTState) ? rawRTState : -1;
          if (desiredRTState !== -1) {
            actions.push({ type: 'applyReactionStateChange', nextState: desiredRTState });
          }
        }

        rtIdx += 1;
      }
    }

    nextTracking = {
      ...nextTracking,
      reactionTransportTrackIndex: rtIdx
    };
  }

  const nextBoundaryReactionTime = (() => {
    const stateIdx = Number.isFinite(nextTracking.stateTimelineIndex) ? Number(nextTracking.stateTimelineIndex) : 0;
    const stateNext = timeline[Math.max(0, Math.min(stateIdx, timeline.length - 1))];
    const stateNextEffective = Number(stateNext?.t);
    const stateNextReaction = Number.isFinite(stateNextEffective) ? stateNextEffective + timeOffset : undefined;

    const rtIdx2 = Number.isFinite(nextTracking.reactionTransportTrackIndex) ? Number(nextTracking.reactionTransportTrackIndex) : 0;
    const rtNext = reactionTransportTimeline[Math.max(0, Math.min(rtIdx2, reactionTransportTimeline.length - 1))];
    const rtNextTime = Number(rtNext?.t);
    const rtNextReaction = Number.isFinite(rtNextTime) ? rtNextTime : undefined;

    const candidates = [stateNextReaction, rtNextReaction].filter(
      (t): t is number => typeof t === 'number' && Number.isFinite(t)
    );
    return candidates.length ? Math.min(...candidates) : undefined;
  })();

  return {
    actions,
    nextTracking,
    stateUpdates,
    enforceMuteModeWithOriginalState: workingState,
    nextBoundaryReactionTime
  };
}
