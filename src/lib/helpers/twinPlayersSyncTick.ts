import {
  getCurrentPlaybackRateFromConfigs,
  getCurrentStateFromStateConfigs,
  getCurrentVolumeFromVolumeConfigs,
  getCurrentOverlayVisibilityFromConfigs
} from '$lib/helpers/reaction';

export type TwinPlayersSyncTracking = {
  lastOriginalTargetTime?: number;
  lastOriginalSeekAt: number;
  lastOriginalSeekTarget?: number;
  mobileAudioWinner: 'original' | 'reaction' | null;
  stateTimelineIndex?: number;
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
  | { type: 'pauseOriginal' };

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
    stateTimelineIndex: Number.isFinite(tracking.stateTimelineIndex) ? tracking.stateTimelineIndex : 0
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

  // 2.5) Overlay visibility (fullscreen only)
  if (input.isFullscreen) {
    const desiredOverlayVisible = getCurrentOverlayVisibilityFromConfigs(
      reactionCurrentTime,
      input.overlayVisibilityTimeline,
      timeOffset
    );

    if (desiredOverlayVisible !== input.currentFullscreenOverlayVisible) {
      stateUpdates.fullscreenOverlayVisible = desiredOverlayVisible;
    }
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

  if (Number.isFinite(computedTargetTime)) {
    if (Number.isFinite(actualOriginalTime)) {
      driftAbs = Math.abs(actualOriginalTime - computedTargetTime);
      if (effectiveConfigState === yt.PLAYING) {
        const quantize = (value: number, step: number) => Math.round(value / step) * step;
        targetMismatch =
          Math.abs(quantize(actualOriginalTime, 0.5) - quantize(computedTargetTime, 0.5)) > tolerance;
      } else {
        targetMismatch = driftAbs > tolerance;
      }
    } else if (typeof nextTracking.lastOriginalTargetTime === 'number') {
      driftAbs = Math.abs(nextTracking.lastOriginalTargetTime - computedTargetTime);
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

  const nextBoundaryReactionTime = (() => {
    if (!timeline.length) {
      return undefined;
    }
    const idx = Number.isFinite(nextTracking.stateTimelineIndex) ? Number(nextTracking.stateTimelineIndex) : 0;
    const next = timeline[Math.max(0, Math.min(idx, timeline.length - 1))];
    const nextEffective = Number(next?.t);
    if (!Number.isFinite(nextEffective)) {
      return undefined;
    }
    const nextReaction = nextEffective + timeOffset;
    return Number.isFinite(nextReaction) ? nextReaction : undefined;
  })();

  return {
    actions,
    nextTracking,
    stateUpdates,
    enforceMuteModeWithOriginalState: workingState,
    nextBoundaryReactionTime
  };
}
