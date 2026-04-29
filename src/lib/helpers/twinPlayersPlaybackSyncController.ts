import {
  getCurrentPlaybackRateFromConfigs,
  getCurrentStateFromStateConfigs,
  getCurrentVolumeFromVolumeConfigs,
  integratePlaybackRate
} from '$lib/helpers/reaction';
import { applyTwinPlayersSyncActions } from '$lib/helpers/twinPlayersSyncApply';
import {
  computeNextSyncDelayMs,
  getNextTimelineEventReactionTime
} from '$lib/helpers/twinPlayersSyncScheduling';
import {
  computeTwinPlayersSyncTick,
  type TwinPlayersPlayerState,
  type TwinPlayersSyncTracking
} from '$lib/helpers/twinPlayersSyncTick';
import {
  createSyncEngineV2,
  type SyncEngineV2
} from '$lib/helpers/twinPlayersSyncEngineV2';
import type {
  SyncDecision,
  PlayerObservation
} from '$lib/helpers/twinPlayersSyncReconcileV2';
import {
  compileSyncPlan,
  syncPlanTimeMsToSeconds
} from '$lib/helpers/twinPlayersSyncPlanV2';
import type { TwinPlayersState } from '$lib/helpers/twinPlayersStateController';

declare const YT: any;

export type TwinPlayersPlaybackProgressionHooks = {
  loadNextReactionInPlaylist: () => void;
  loadNextReactionInQueue: () => void;
};

type TwinPlayersDebugClickGate = (
  label: string,
  details?: Record<string, any>,
  includeStack?: boolean
) => void;

type TwinPlayersGateState = {
  originalVideoClicked: boolean;
  reactionVideoClicked: boolean;
};

type CreateTwinPlayersPlaybackSyncControllerOptions = {
  getSnapshot: () => TwinPlayersState;
  updateState: (patch: Partial<TwinPlayersState>) => void;
  getProgressionHooks: () => TwinPlayersPlaybackProgressionHooks | null;
  getPlayerDebugInfo: (target: any) => Record<string, any>;
  debugClickGate: TwinPlayersDebugClickGate;
  enableGateDebug?: boolean;
  lazySyncRequested: boolean;
  enableSyncEngineV2?: boolean;
  isLiveInstance: () => boolean;
  isInstanceDestroyed: () => boolean;
  getActiveInstanceId: () => string | null;
  isSwitchingReactionInPlace: () => boolean;
  getGateState: () => TwinPlayersGateState;
  markOriginalVideoClicked: () => boolean;
  markReactionVideoClicked: () => boolean;
  getLastUserResumeAt: () => number;
  setLastUserResumeAt: (value: number) => void;
  markPlayerReady: () => void;
};

const isMobileAudioEnvironment = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const ua = String(navigator.userAgent || '');
  if (/iPhone|iPad|iPod|Android/i.test(ua)) {
    return true;
  }

  const isIpadOs = /Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1;
  return isIpadOs;
};

export function createTwinPlayersPlaybackSyncController({
  getSnapshot,
  updateState,
  getProgressionHooks,
  getPlayerDebugInfo,
  debugClickGate,
  enableGateDebug = false,
  lazySyncRequested,
  enableSyncEngineV2 = false,
  isLiveInstance,
  isInstanceDestroyed,
  getActiveInstanceId,
  isSwitchingReactionInPlace,
  getGateState,
  markOriginalVideoClicked,
  markReactionVideoClicked,
  getLastUserResumeAt,
  setLastUserResumeAt,
  markPlayerReady,
}: CreateTwinPlayersPlaybackSyncControllerOptions) {
  let syncTimeout: ReturnType<typeof setTimeout> | undefined;
  let durationProbeTimeout: ReturnType<typeof setTimeout> | undefined;
  let durationProbeAttempts = 0;
  let changingVolume = false;
  let changingReactionVolume = false;
  let changingSpeed = false;

  const syncTracking: TwinPlayersSyncTracking = {
    lastOriginalSeekAt: 0,
    mobileAudioWinner: null,
    stateTimelineIndex: 0,
    lastSoftSyncAt: 0,
    softSyncIsActive: false,
    softSyncResetTimeoutId: undefined
  };
  let syncEngineV2: SyncEngineV2 | null = null;
  let syncEngineV2PlanKey = '';

  const stateName = (value: number | undefined) => {
    switch (value) {
      case YT?.PlayerState?.UNSTARTED:
        return 'UNSTARTED';
      case YT?.PlayerState?.ENDED:
        return 'ENDED';
      case YT?.PlayerState?.PLAYING:
        return 'PLAYING';
      case YT?.PlayerState?.PAUSED:
        return 'PAUSED';
      case YT?.PlayerState?.BUFFERING:
        return 'BUFFERING';
      case YT?.PlayerState?.CUED:
        return 'CUED';
      default:
        return typeof value === 'number' ? `UNKNOWN(${value})` : 'UNKNOWN';
    }
  };

  const getPlayerStateSafely = (player: any) => {
    if (!player || typeof player.getPlayerState !== 'function') {
      return undefined;
    }
    try {
      return Number(player.getPlayerState());
    } catch {
      return undefined;
    }
  };

  const verifyStateSoon = (label: string, target: any) => {
    if (!enableGateDebug || typeof window === 'undefined') {
      return;
    }
    window.setTimeout(() => {
      const snapshot = getSnapshot();
      const gateState = getGateState();
      debugClickGate(`[TwinPlayers] ${label} VERIFY`, {
        ...getPlayerDebugInfo(target),
        playerState: stateName(getPlayerStateSafely(target)),
        currentTime: typeof target?.getCurrentTime === 'function' ? target.getCurrentTime() : undefined,
        gateSatisfied: gateState.originalVideoClicked && gateState.reactionVideoClicked,
        bothVideosStarted: snapshot.bothVideosStarted
      });
    }, 120);
  };

  const pausePlayerWithTrace = (which: 'original' | 'reaction', target: any, reason: string, retryCount = 0) => {
    if (!enableGateDebug) {
      try {
        target?.pauseVideo?.();
      } catch {
        // ignore
      }
      return;
    }

    const playerInfo = getPlayerDebugInfo(target);
    debugClickGate(`[TwinPlayers] ${which} pauseVideo()`, {
      reason,
      retryCount,
      ...playerInfo,
      playerState: stateName(getPlayerStateSafely(target))
    }, true);

    try {
      target?.pauseVideo?.();
    } catch (error) {
      debugClickGate(`[TwinPlayers] ${which} pauseVideo() threw`, {
        reason,
        error: String(error),
        ...playerInfo
      }, true);
    }

    if (typeof window !== 'undefined' && retryCount < 3) {
      window.setTimeout(() => {
        const currentState = getPlayerStateSafely(target);
        if (currentState === YT.PlayerState.PLAYING || currentState === YT.PlayerState.BUFFERING) {
          debugClickGate(`[TwinPlayers] ${which} pauseVideo() failed, retrying`, {
            reason,
            retryCount,
            currentState: stateName(currentState),
            ...playerInfo
          }, true);
          pausePlayerWithTrace(which, target, reason, retryCount + 1);
        } else {
          verifyStateSoon(`${which} pause`, target);
        }
      }, 150);
    } else {
      verifyStateSoon(`${which} pause`, target);
    }
  };

  const playWithTrace = (which: 'original' | 'reaction', target: any, reason: string) => {
    if (!enableGateDebug) {
      try {
        target?.playVideo?.();
      } catch {
        // ignore
      }
      return;
    }

    const playerInfo = getPlayerDebugInfo(target);
    debugClickGate(`[TwinPlayers] ${which} playVideo()`, {
      reason,
      ...playerInfo,
      playerState: stateName(getPlayerStateSafely(target))
    }, true);

    try {
      target?.playVideo?.();
    } catch (error) {
      debugClickGate(`[TwinPlayers] ${which} playVideo() threw`, {
        reason,
        error: String(error),
        ...playerInfo
      }, true);
    }

    verifyStateSoon(`${which} play`, target);
  };

  const startReactionVideo = () => {
    const { playerReaction } = getSnapshot();
    playWithTrace('reaction', playerReaction, 'startReactionVideo');
  };

  const startOriginalVideo = () => {
    const snapshot = getSnapshot();
    if (snapshot.playerOriginal) {
      snapshot.playerOriginal.setPlaybackRate(snapshot.currentPlaybackRate);
      playWithTrace('original', snapshot.playerOriginal, 'startOriginalVideo');
    }
  };

  const pauseOriginalVideo = () => {
    pausePlayerWithTrace('original', getSnapshot().playerOriginal, 'pauseOriginalVideo');
  };

  const pauseReactionVideo = () => {
    pausePlayerWithTrace('reaction', getSnapshot().playerReaction, 'pauseReactionVideo');
  };

  const muteReactionAudio = (player?: any) => {
    const reactionPlayer = player ?? getSnapshot().playerReaction;
    if (!reactionPlayer) {
      return false;
    }
    try {
      if (typeof reactionPlayer.mute === 'function') {
        reactionPlayer.mute();
      } else if (typeof reactionPlayer.setVolume === 'function') {
        reactionPlayer.setVolume(0);
      }
      return true;
    } catch (error) {
      console.error('Failed to mute reaction player', error);
      return false;
    }
  };

  const unmuteReactionAudio = (player?: any) => {
    const reactionPlayer = player ?? getSnapshot().playerReaction;
    if (!reactionPlayer) {
      return false;
    }
    try {
      if (typeof reactionPlayer.unMute === 'function') {
        reactionPlayer.unMute();
      } else if (typeof reactionPlayer.setVolume === 'function') {
        reactionPlayer.setVolume(100);
      }
      return true;
    } catch (error) {
      console.error('Failed to unmute reaction player', error);
      return false;
    }
  };

  const setVolumeForOriginalVideo = (volume: number) => {
    getSnapshot().playerOriginal?.setVolume?.(volume);
  };

  const setVolumeForReactionVideo = (volume: number) => {
    getSnapshot().playerReaction?.setVolume?.(volume);
  };

  const setPlaybackRateForOriginalVideo = (rate: number) => {
    const original = getSnapshot().playerOriginal;
    if (original && typeof original.setPlaybackRate === 'function') {
      original.setPlaybackRate(rate);
    }
  };

  const enforceReactionMuteMode = (overrideOriginalState?: number) => {
    if (isMobileAudioEnvironment()) {
      return;
    }

    const snapshot = getSnapshot();
    const reactionPlayer = snapshot.playerReaction;
    if (!reactionPlayer) {
      if (snapshot.isReactionAutoMuted) {
        updateState({ isReactionAutoMuted: false });
      }
      return;
    }

    const playingState = typeof YT !== 'undefined' && typeof YT?.PlayerState?.PLAYING === 'number'
      ? YT.PlayerState.PLAYING
      : 1;

    let originalState = typeof overrideOriginalState === 'number'
      ? overrideOriginalState
      : snapshot.currentStateOriginalVideo;

    if (typeof originalState !== 'number' || Number.isNaN(originalState)) {
      const rawPlayerState = typeof snapshot.playerOriginal?.getPlayerState === 'function'
        ? snapshot.playerOriginal.getPlayerState()
        : undefined;
      if (typeof rawPlayerState === 'number') {
        originalState = rawPlayerState;
      }
    }

    const shouldMute = snapshot.isReactionMuteModeEnabled && originalState === playingState;
    const isCurrentlyMuted = typeof reactionPlayer.isMuted === 'function'
      ? reactionPlayer.isMuted()
      : undefined;

    if (shouldMute) {
      if (!isCurrentlyMuted) {
        const muted = muteReactionAudio(reactionPlayer);
        if (muted && !snapshot.isReactionAutoMuted) {
          updateState({ isReactionAutoMuted: true });
        }
      }
      return;
    }

    if (snapshot.isReactionAutoMuted) {
      const unmuted = unmuteReactionAudio(reactionPlayer);
      if (unmuted) {
        updateState({ isReactionAutoMuted: false });
        const reactionCurrentTime = Number(snapshot.playerReaction?.getCurrentTime?.().toFixed?.(1));
        if (Number.isFinite(reactionCurrentTime)) {
          const timeInReaction = reactionCurrentTime;
          if (
            timeInReaction >= snapshot.seekMin
            && (!Number.isFinite(snapshot.seekMax) || timeInReaction <= snapshot.seekMax)
          ) {
            const newVolume = getCurrentVolumeFromVolumeConfigs(
              reactionCurrentTime,
              snapshot.reactionVolumeConfigs,
              1.0,
              snapshot.timeOffset
            );
            if (!changingReactionVolume && snapshot.currentVolumeReactionVideo !== newVolume) {
              changingReactionVolume = true;
              setVolumeForReactionVideo(newVolume);
              updateState({ currentVolumeReactionVideo: newVolume });
              changingReactionVolume = false;
            }
          }
        }
      }
    }
  };

  const resetOriginalStateTracking = () => {
    syncTracking.lastOriginalTargetTime = undefined;
    syncTracking.lastOriginalSeekTarget = undefined;
    syncTracking.lastOriginalSeekAt = 0;
  };

  const goToSecondsInOriginalVideo = (
    seconds: number,
    options: { allowSeekAhead?: boolean; throttleMs?: number; force?: boolean } = {}
  ) => {
    const normalized = Number(seconds);
    if (!Number.isFinite(normalized)) {
      return false;
    }

    const { playerOriginal } = getSnapshot();
    if (playerOriginal && typeof playerOriginal.seekTo === 'function') {
      const now = Date.now();
      const throttleMs = Number(options.throttleMs ?? 0);
      if (!options.force && throttleMs > 0 && now - syncTracking.lastOriginalSeekAt < throttleMs) {
        return false;
      }
      if (
        !options.force
        && typeof syncTracking.lastOriginalSeekTarget === 'number'
        && Math.abs(syncTracking.lastOriginalSeekTarget - normalized) < 0.25
        && now - syncTracking.lastOriginalSeekAt < Math.max(throttleMs, 1200)
      ) {
        return false;
      }

      const allowSeekAhead = options.allowSeekAhead !== false;
      playerOriginal.seekTo(normalized, allowSeekAhead);
      syncTracking.lastOriginalTargetTime = normalized;
      syncTracking.lastOriginalSeekTarget = normalized;
      syncTracking.lastOriginalSeekAt = now;
      return true;
    }

    return false;
  };

  const getYtStates = (): TwinPlayersPlayerState => ({
    PLAYING: typeof YT?.PlayerState?.PLAYING === 'number' ? YT.PlayerState.PLAYING : 1,
    PAUSED: typeof YT?.PlayerState?.PAUSED === 'number' ? YT.PlayerState.PAUSED : 2,
    BUFFERING: typeof YT?.PlayerState?.BUFFERING === 'number' ? YT.PlayerState.BUFFERING : 3,
    CUED: typeof YT?.PlayerState?.CUED === 'number' ? YT.PlayerState.CUED : 5,
    ENDED: typeof YT?.PlayerState?.ENDED === 'number' ? YT.PlayerState.ENDED : 0
  });

  const isMobilePlaybackDevice = () => {
    const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
    return /iPhone|iPad|iPod|Android/i.test(ua);
  };

  const buildSyncEngineV2PlanInput = (snapshot: TwinPlayersState) => ({
    offsetStartTime: snapshot.offsetStartTime,
    reactionFinishTime: snapshot.reactionFinishTime,
    timeOffset: snapshot.timeOffset,
    globalGain: snapshot.globalGain,
    playerConfigs: snapshot.playerConfigs,
    volumeConfigs: snapshot.volumeConfigs,
    reactionVolumeConfigs: snapshot.reactionVolumeConfigs,
    playbackRateConfigs: snapshot.playbackRateConfigs,
    stateTimeline: snapshot.stateTimeline,
    volumeTimeline: snapshot.volumeTimeline,
    reactionVolumeTimeline: snapshot.reactionVolumeTimeline,
    playbackRateTimeline: snapshot.playbackRateTimeline,
    overlayVisibilityTimeline: snapshot.overlayVisibilityTimeline
  });

  const getSyncEngineV2PlanKey = (snapshot: TwinPlayersState) =>
    JSON.stringify(buildSyncEngineV2PlanInput(snapshot));

  const getOrCreateSyncEngineV2 = (snapshot: TwinPlayersState) => {
    const planKey = getSyncEngineV2PlanKey(snapshot);
    if (syncEngineV2 && syncEngineV2PlanKey === planKey) {
      return syncEngineV2;
    }

    const ytStates = getYtStates();
    syncEngineV2 = createSyncEngineV2({
      plan: compileSyncPlan(buildSyncEngineV2PlanInput(snapshot)),
      isMobilePlaybackDevice: isMobilePlaybackDevice(),
      policy: {
        playingState: ytStates.PLAYING,
        pausedState: ytStates.PAUSED,
        bufferingState: ytStates.BUFFERING,
        endedState: ytStates.ENDED
      }
    });
    syncEngineV2PlanKey = planKey;
    return syncEngineV2;
  };

  const readPlayerTimeMs = (player: any): number | undefined => {
    if (!player || typeof player.getCurrentTime !== 'function') {
      return undefined;
    }
    const value = Number(player.getCurrentTime());
    return Number.isFinite(value) ? Math.round(value * 1000) : undefined;
  };

  const readPlayerDurationMs = (player: any): number | undefined => {
    if (!player || typeof player.getDuration !== 'function') {
      return undefined;
    }
    const value = Number(player.getDuration());
    return Number.isFinite(value) && value > 0 ? Math.round(value * 1000) : undefined;
  };

  const createSyncEngineV2Observation = (
    snapshot: TwinPlayersState,
    reactionCurrentTime: number,
    reactionPlayerState: number,
    nowMs: number
  ): PlayerObservation => ({
    nowMs,
    reactionCurrentTimeMs: Math.round(Number(reactionCurrentTime || 0) * 1000),
    reactionPlayerState,
    originalCurrentTimeMs: readPlayerTimeMs(snapshot.playerOriginal),
    originalDurationMs: readPlayerDurationMs(snapshot.playerOriginal),
    originalPlayerState: getPlayerStateSafely(snapshot.playerOriginal),
    originalVolume: snapshot.currentVolumeOriginalVideo,
    reactionVolume: snapshot.currentVolumeReactionVideo,
    currentPlaybackRate: snapshot.currentPlaybackRate,
    fullscreenOverlayVisible: snapshot.fullscreenOverlayVisible,
    isUserPaused: snapshot.isUserPaused
  });

  const logSyncEngineV2Decision = (engine: SyncEngineV2, decisions: SyncDecision[]) => {
    if (typeof window === 'undefined') {
      return;
    }
    const diagnostics = engine.getLastDiagnostics();
    (window as any).__twinPlayersLog = (window as any).__twinPlayersLog || [];
    (window as any).__twinPlayersLog.push({
      ts: Date.now(),
      msg: '[TwinPlayersV2] sync decision',
      data: {
        ...diagnostics,
        decisions
      }
    });
  };

  const applySyncEngineV2Decisions = (
    decisions: SyncDecision[],
    snapshot: TwinPlayersState
  ) => {
    for (const decision of decisions) {
      switch (decision.type) {
        case 'setOriginalVolume': {
          const resolvedVolume = snapshot.originalVideoPlatform === 'tiktok'
            ? (decision.volume >= 100 ? 100 : 0)
            : decision.volume;
          if (!changingVolume && snapshot.currentVolumeOriginalVideo !== resolvedVolume) {
            changingVolume = true;
            setVolumeForOriginalVideo(resolvedVolume);
            updateState({ currentVolumeOriginalVideo: resolvedVolume });
            changingVolume = false;
          }
          break;
        }
        case 'setReactionVolume': {
          if (!changingReactionVolume && snapshot.currentVolumeReactionVideo !== decision.volume) {
            changingReactionVolume = true;
            setVolumeForReactionVideo(decision.volume);
            updateState({ currentVolumeReactionVideo: decision.volume });
            changingReactionVolume = false;
          }
          break;
        }
        case 'setOriginalPlaybackRate': {
          if (snapshot.originalVideoPlatform === 'tiktok') {
            break;
          }
          if (!changingSpeed && Math.abs(snapshot.currentPlaybackRate - decision.rate) > 0.001) {
            changingSpeed = true;
            setPlaybackRateForOriginalVideo(decision.rate);
            updateState({ currentPlaybackRate: decision.rate });
            changingSpeed = false;
          }
          break;
        }
        case 'applySoftSync': {
          if (snapshot.originalVideoPlatform === 'tiktok') {
            break;
          }
          if (typeof syncTracking.softSyncResetTimeoutId === 'number') {
            clearTimeout(syncTracking.softSyncResetTimeoutId);
            syncTracking.softSyncResetTimeoutId = undefined;
          }
          if (!changingSpeed) {
            changingSpeed = true;
            setPlaybackRateForOriginalVideo(decision.rate);
            changingSpeed = false;
          }
          syncTracking.softSyncIsActive = true;
          syncTracking.softSyncResetTimeoutId = setTimeout(() => {
            if (!changingSpeed) {
              changingSpeed = true;
              setPlaybackRateForOriginalVideo(decision.resetRate);
              updateState({ currentPlaybackRate: decision.resetRate });
              changingSpeed = false;
            }
            syncTracking.softSyncIsActive = false;
            syncTracking.softSyncResetTimeoutId = undefined;
          }, decision.durationMs) as any;
          break;
        }
        case 'seekOriginal': {
          goToSecondsInOriginalVideo(syncPlanTimeMsToSeconds(decision.targetTimeMs), {
            allowSeekAhead: decision.allowSeekAhead,
            force: decision.force
          });
          break;
        }
        case 'playOriginal': {
          startOriginalVideo();
          break;
        }
        case 'pauseOriginal': {
          pauseOriginalVideo();
          break;
        }
        case 'seekThenPlayOriginal': {
          goToSecondsInOriginalVideo(syncPlanTimeMsToSeconds(decision.targetTimeMs), {
            allowSeekAhead: true,
            force: true
          });
          startOriginalVideo();
          break;
        }
        case 'setFullscreenOverlayVisible': {
          updateState({ fullscreenOverlayVisible: decision.visible });
          break;
        }
      }
    }
  };

  const applySyncEngineV2MobileAudio = (
    desired: { originalState: number; originalVolume: number; reactionVolume: number },
    snapshot: TwinPlayersState
  ) => {
    if (!isMobileAudioEnvironment()) {
      return;
    }

    const ytStates = getYtStates();
    const delta = desired.originalVolume - desired.reactionVolume;
    const hysteresis = 3;
    let originalWins = desired.originalState === ytStates.PLAYING
      ? desired.originalVolume >= desired.reactionVolume
      : desired.originalVolume > desired.reactionVolume;

    if (syncTracking.mobileAudioWinner && Math.abs(delta) <= hysteresis) {
      originalWins = syncTracking.mobileAudioWinner === 'original';
    }

    syncTracking.mobileAudioWinner = originalWins ? 'original' : 'reaction';

    if (originalWins) {
      if (!changingVolume && snapshot.currentVolumeOriginalVideo !== desired.originalVolume) {
        changingVolume = true;
        setVolumeForOriginalVideo(desired.originalVolume);
        updateState({ currentVolumeOriginalVideo: desired.originalVolume });
        changingVolume = false;
      }
      snapshot.playerOriginal?.unMute?.();
      muteReactionAudio(snapshot.playerReaction);
      return;
    }

    if (!changingReactionVolume && snapshot.currentVolumeReactionVideo !== desired.reactionVolume) {
      changingReactionVolume = true;
      setVolumeForReactionVideo(desired.reactionVolume);
      updateState({ currentVolumeReactionVideo: desired.reactionVolume });
      changingReactionVolume = false;
    }
    snapshot.playerOriginal?.mute?.();
    unmuteReactionAudio(snapshot.playerReaction);
  };

  const runSyncEngineV2Cycle = ({
    snapshot,
    reactionCurrentTime,
    reactionPlayerState,
    force = false
  }: {
    snapshot: TwinPlayersState;
    reactionCurrentTime: number;
    reactionPlayerState: number;
    force?: boolean;
  }) => {
    const engine = getOrCreateSyncEngineV2(snapshot);
    const nowMs = Date.now();
    engine.observePlayers(
      createSyncEngineV2Observation(snapshot, reactionCurrentTime, reactionPlayerState, nowMs)
    );
    if (force) {
      engine.handleManualSync();
    }
    const decisions = engine.tick(nowMs);
    applySyncEngineV2Decisions(decisions, snapshot);

    const desired = engine.getLastDesiredState();
    if (desired) {
      applySyncEngineV2MobileAudio(desired, snapshot);
      updateState({
        currentStateOriginalVideo: desired.originalState,
        currentPlaybackRate: desired.playbackRate
      });
      enforceReactionMuteMode(desired.originalState);
    }

    logSyncEngineV2Decision(engine, decisions);
    return engine;
  };

  const goToSecondsInReactionVideo = (seconds: number, options?: { skipOriginalSync?: boolean }) => {
    const normalized = Number(seconds);
    if (!Number.isFinite(normalized)) {
      return;
    }

    const snapshot = getSnapshot();
    const seekMin = Number.isFinite(snapshot.seekMin) && snapshot.seekMin >= 0 ? snapshot.seekMin : 0;
    const rawFinish = Number(snapshot.reactionFinishTime);
    const finishCap = Number.isFinite(rawFinish) && rawFinish > 0 ? rawFinish : Number.POSITIVE_INFINITY;

    let effectiveSeekMax = Number(snapshot.seekMax);
    if (!Number.isFinite(effectiveSeekMax) || effectiveSeekMax <= seekMin) {
      const durationFromPlayer =
        typeof snapshot.playerReaction?.getDuration === 'function'
          ? Number(snapshot.playerReaction.getDuration())
          : Number.NaN;
      const durationFallback = Number(snapshot.reactionDuration);
      const durationCap = Number.isFinite(durationFromPlayer) && durationFromPlayer > 0
        ? durationFromPlayer
        : (Number.isFinite(durationFallback) && durationFallback > 0 ? durationFallback : Number.POSITIVE_INFINITY);
      effectiveSeekMax = durationCap;
    }

    effectiveSeekMax = Math.max(seekMin, Math.min(effectiveSeekMax, finishCap));

    const clamped = effectiveSeekMax === Number.POSITIVE_INFINITY
      ? Math.max(normalized, seekMin)
      : Math.min(Math.max(normalized, seekMin), effectiveSeekMax);

    snapshot.playerReaction?.seekTo?.(clamped, true);
    updateState({ reactionCurrentTime: clamped });

    if (!options?.skipOriginalSync && enableSyncEngineV2) {
      const engine = getOrCreateSyncEngineV2(snapshot);
      engine.handleScrub(Math.round(clamped * 1000), Date.now());
      runSyncEngineV2Cycle({
        snapshot,
        reactionCurrentTime: clamped,
        reactionPlayerState: getPlayerStateSafely(snapshot.playerReaction) ?? YT?.PlayerState?.PAUSED ?? 2,
        force: true
      });
      return;
    }

    if (!options?.skipOriginalSync) {
      applyOriginalPlaybackForReactionTime(clamped, snapshot, { forceSeek: true });
    }
  };

  const stopSyncScheduler = () => {
    clearTimeout(syncTimeout);
    syncTimeout = undefined;
  };

  const scheduleNextSync = (delayMs: number, run: () => void) => {
    stopSyncScheduler();
    const normalized = Math.max(0, Math.min(10_000, Math.round(delayMs)));
    syncTimeout = setTimeout(run, normalized);
  };

  const getDesiredOriginalPlaybackAtReactionTime = (
    reactionTime: number,
    snapshot = getSnapshot()
  ) => {
    const normalizedReactionTime = Number.isFinite(reactionTime)
      ? reactionTime
      : Number(snapshot.reactionCurrentTime);

    const config = getCurrentStateFromStateConfigs(
      Number.isFinite(normalizedReactionTime) ? normalizedReactionTime : 0,
      snapshot.playerConfigs,
      snapshot.timeOffset
    );

    const rawDesiredState = Number(config.state);
    const desiredState = Number.isFinite(rawDesiredState) ? rawDesiredState : -1;
    const baseTargetTime = Number(config.time ?? 0);
    const anchorTime = Number(config.closestSmallerTimeCode ?? normalizedReactionTime);

    let targetTime = Number.isFinite(baseTargetTime) ? baseTargetTime : 0;

    if (
      desiredState === YT.PlayerState.PLAYING
      && Number.isFinite(anchorTime)
      && Number.isFinite(normalizedReactionTime)
    ) {
      // Integrate playback rate from anchor to current reaction time so that
      // non-1x speed cues are correctly reflected in the scrub target position.
      const timeOffsetAdjustedReactionTime = normalizedReactionTime - Number(snapshot.timeOffset || 0);
      targetTime += integratePlaybackRate(anchorTime, timeOffsetAdjustedReactionTime, snapshot.playbackRateTimeline ?? []);
    }

    return {
      desiredState,
      targetTime,
      reactionTime: Number.isFinite(normalizedReactionTime) ? normalizedReactionTime : 0
    };
  };

  const handleStateChangeInOriginalVideo = (
    previousState: number,
    nextState: number,
    targetTime: number,
    options: { allowSeekAhead?: boolean; throttleMs?: number; forceSeek?: boolean } = {}
  ) => {
    const resolvedState = typeof nextState === 'number' ? nextState : -1;
    const normalizedTarget = Number(targetTime);
    const targetChanged = Number.isFinite(normalizedTarget)
      && (typeof syncTracking.lastOriginalTargetTime !== 'number' || Math.abs(syncTracking.lastOriginalTargetTime - normalizedTarget) > 0.01);

    const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
    const isMobilePlaybackDevice = /iPhone|iPad|iPod|Android/i.test(ua);
    const isMobileLazySyncEnabled = lazySyncRequested && isMobilePlaybackDevice;
    const originalStateNow = getPlayerStateSafely(getSnapshot().playerOriginal);
    const shouldSuppressSeek =
      isMobileLazySyncEnabled
      && originalStateNow === YT?.PlayerState?.BUFFERING;

    if (targetChanged && !shouldSuppressSeek) {
      goToSecondsInOriginalVideo(normalizedTarget, {
        allowSeekAhead: options.allowSeekAhead,
        throttleMs: options.throttleMs,
        force: options.forceSeek
      });
    }

    if (resolvedState === YT.PlayerState.PLAYING) {
      startOriginalVideo();
    } else if (
      resolvedState === YT.PlayerState.PAUSED
      || resolvedState === YT.PlayerState.BUFFERING
      || resolvedState === YT.PlayerState.CUED
      || resolvedState === YT.PlayerState.ENDED
    ) {
      pauseOriginalVideo();
    }

    void previousState;
  };

  const applyOriginalPlaybackForReactionTime = (
    reactionTime: number,
    snapshot = getSnapshot(),
    options: {
      syncTargetTime?: boolean;
      allowSeekAhead?: boolean;
      throttleMs?: number;
      forceSeek?: boolean;
    } = {}
  ) => {
    const { desiredState, targetTime } = getDesiredOriginalPlaybackAtReactionTime(reactionTime, snapshot);

    if (options.syncTargetTime === false) {
      if (desiredState === YT.PlayerState.PLAYING) {
        startOriginalVideo();
      } else {
        pauseOriginalVideo();
      }
    } else {
      handleStateChangeInOriginalVideo(snapshot.currentStateOriginalVideo, desiredState, targetTime, {
        allowSeekAhead: options.allowSeekAhead,
        throttleMs: options.throttleMs,
        forceSeek: options.forceSeek
      });
    }

    if (snapshot.currentStateOriginalVideo !== desiredState) {
      updateState({ currentStateOriginalVideo: desiredState });
    }

    return { desiredState, targetTime };
  };

  const pollVideoCurrentTime = () => {
    stopSyncScheduler();
    let reactionPlayerState = YT?.PlayerState?.UNSTARTED ?? -1;

    const runSyncCycle = () => {
      const snapshot = getSnapshot();
      if (isSwitchingReactionInPlace()) {
        scheduleNextSync(250, runSyncCycle);
        return;
      }

      const {
        playerReaction,
        playerOriginal,
        reactionFinishTime,
        hasNextIndexInPlaylist,
        isPlaylistAutoPlay,
        isQueueAutoPlay
      } = snapshot;

      if (!playerReaction || !playerOriginal) {
        scheduleNextSync(250, runSyncCycle);
        return;
      }

      if (snapshot.isUserPaused) {
        const originalState = getPlayerStateSafely(playerOriginal);
        if (originalState === YT.PlayerState.PLAYING || originalState === YT.PlayerState.BUFFERING) {
          pausePlayerWithTrace('original', playerOriginal, 'userPaused override');
        }
        const reactionState = getPlayerStateSafely(playerReaction);
        if (reactionState === YT.PlayerState.PLAYING || reactionState === YT.PlayerState.BUFFERING) {
          pausePlayerWithTrace('reaction', playerReaction, 'userPaused override');
        }

        if (typeof reactionState === 'number') {
          reactionPlayerState = reactionState;
        }

        scheduleNextSync(500, runSyncCycle);
        return;
      }

      const newReactionState = playerReaction.getPlayerState();
      if (reactionPlayerState !== newReactionState) {
        handleStateChangeInReactionVideo(reactionPlayerState, newReactionState);
        reactionPlayerState = newReactionState;
      }

      if (newReactionState === YT?.PlayerState?.UNSTARTED || newReactionState === YT?.PlayerState?.CUED) {
        const originalState = getPlayerStateSafely(playerOriginal);
        if (originalState === YT.PlayerState.PLAYING || originalState === YT.PlayerState.BUFFERING) {
          pausePlayerWithTrace('original', playerOriginal, 'reaction UNSTARTED/CUED during sync loop');
        }
        scheduleNextSync(250, runSyncCycle);
        return;
      }

      // If the reaction video has naturally ended, stop the sync cycle so the
      // original video can continue playing freely until it finishes on its own.
      // Playlist/queue transitions and mid-playlist pause are handled by the
      // ENDED event handler in onStateChangeReaction.
      if (newReactionState === YT?.PlayerState?.ENDED) {
        return;
      }

      const previousReactionTime = snapshot.reactionCurrentTime;
      const reactionCurrentTime = parseFloat(playerReaction.getCurrentTime().toFixed(1));
      const rawDuration = typeof playerReaction.getDuration === 'function' ? Number(playerReaction.getDuration()) : Number.NaN;
      const reactionDuration = Number.isFinite(rawDuration) ? rawDuration : snapshot.reactionDuration;
      if (reactionCurrentTime !== snapshot.reactionCurrentTime || Math.abs(reactionDuration - snapshot.reactionDuration) > 0.1) {
        const rawMin = Number(snapshot.offsetStartTime);
        const seekMin = Number.isFinite(rawMin) && rawMin >= 0 ? rawMin : 0;
        const rawDurationCap = Number.isFinite(reactionDuration) && reactionDuration > 0 ? reactionDuration : Number.POSITIVE_INFINITY;
        const rawFinish = Number(snapshot.reactionFinishTime);
        const finishCap = Number.isFinite(rawFinish) && rawFinish > 0 ? rawFinish : Number.POSITIVE_INFINITY;
        const seekMax = Math.max(seekMin, Math.min(rawDurationCap, finishCap));

        updateState({ reactionCurrentTime, reactionDuration, seekMin, seekMax });
      }

      if (reactionFinishTime > 0 && reactionCurrentTime > reactionFinishTime) {
        pauseOriginalVideo();

        if (!isPlaylistAutoPlay && !isQueueAutoPlay) {
          pauseReactionVideo();
        }

        stopSyncScheduler();
        const progressionHooks = getProgressionHooks();
        if (isPlaylistAutoPlay && hasNextIndexInPlaylist) {
          progressionHooks?.loadNextReactionInPlaylist();
        }
        if (isQueueAutoPlay) {
          progressionHooks?.loadNextReactionInQueue();
        }
        return;
      }

      if (enableSyncEngineV2) {
        const engine = runSyncEngineV2Cycle({
          snapshot,
          reactionCurrentTime,
          reactionPlayerState
        });
        const nextBoundaryMs = engine.getLastDesiredState()?.nextBoundaryMs ?? null;
        const delayMs = computeNextSyncDelayMs({
          reactionCurrentTime,
          reactionPlayerState,
          ytPlayingState: YT.PlayerState.PLAYING,
          ytBufferingState: YT.PlayerState.BUFFERING,
          nextBoundaryReactionTime: typeof nextBoundaryMs === 'number'
            ? syncPlanTimeMsToSeconds(nextBoundaryMs)
            : null
        });
        scheduleNextSync(delayMs, runSyncCycle);
        return;
      }

      const ytStates: TwinPlayersPlayerState = {
        PLAYING: typeof YT?.PlayerState?.PLAYING === 'number' ? YT.PlayerState.PLAYING : 1,
        PAUSED: typeof YT?.PlayerState?.PAUSED === 'number' ? YT.PlayerState.PAUSED : 2,
        BUFFERING: typeof YT?.PlayerState?.BUFFERING === 'number' ? YT.PlayerState.BUFFERING : 3,
        CUED: typeof YT?.PlayerState?.CUED === 'number' ? YT.PlayerState.CUED : 5,
        ENDED: typeof YT?.PlayerState?.ENDED === 'number' ? YT.PlayerState.ENDED : 0
      };

      const isMobileAudio = isMobileAudioEnvironment();
      const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
      const isMobilePlaybackDevice = /iPhone|iPad|iPod|Android/i.test(ua);
      const isMobileLazySyncEnabled = lazySyncRequested && isMobilePlaybackDevice;

      const originalIsMuted = typeof playerOriginal?.isMuted === 'function' ? Boolean(playerOriginal.isMuted()) : undefined;
      const reactionIsMuted = typeof playerReaction?.isMuted === 'function' ? Boolean(playerReaction.isMuted()) : undefined;

      const originalCurrentTime = typeof playerOriginal?.getCurrentTime === 'function' ? Number(playerOriginal.getCurrentTime()) : undefined;
      const originalDuration = typeof playerOriginal?.getDuration === 'function' ? Number(playerOriginal.getDuration()) : undefined;
      const originalPlayerState = typeof playerOriginal?.getPlayerState === 'function' ? Number(playerOriginal.getPlayerState()) : undefined;

      const result = computeTwinPlayersSyncTick(
        {
          reactionCurrentTime,
          previousReactionTime,
          seekMin: snapshot.seekMin,
          seekMax: snapshot.seekMax,
          timeOffset: snapshot.timeOffset,
          globalGain: snapshot.globalGain,
          isFineTuneModeOn: snapshot.isFineTuneModeOn,
          isFullscreen: snapshot.isFullscreen,
          currentStateOriginalVideo: snapshot.currentStateOriginalVideo,
          currentPlaybackRate: snapshot.currentPlaybackRate,
          currentVolumeOriginalVideo: snapshot.currentVolumeOriginalVideo,
          currentVolumeReactionVideo: snapshot.currentVolumeReactionVideo,
          currentFullscreenOverlayVisible: snapshot.fullscreenOverlayVisible,
          isReactionMuteModeEnabled: snapshot.isReactionMuteModeEnabled,
          isReactionAutoMuted: snapshot.isReactionAutoMuted,
          isMobileAudioEnvironment: isMobileAudio,
          isMobilePlaybackDevice,
          isMobileLazySyncEnabled,
          playerConfigs: snapshot.playerConfigs,
          volumeConfigs: snapshot.volumeConfigs,
          reactionVolumeConfigs: snapshot.reactionVolumeConfigs,
          playbackRateConfigs: snapshot.playbackRateConfigs,
          playbackRateTimeline: snapshot.playbackRateTimeline,
          overlayVisibilityTimeline: snapshot.overlayVisibilityTimeline,
          stateTimeline: snapshot.stateTimeline,
          reactionPlayerState,
          originalPlayerState,
          originalCurrentTime,
          originalDuration,
          originalIsMuted,
          reactionIsMuted,
          now: Date.now(),
          yt: ytStates
        },
        syncTracking
      );

      Object.assign(syncTracking, result.nextTracking);

      const softSyncAction = result.actions.find((action: any) => action.type === 'applySoftSync');
      const speedCueAction = result.actions.find((action: any) => action.type === 'setOriginalPlaybackRate');

      // A speed cue (playback-rate change from the timeline) must take priority over an active
      // soft sync. Cancel any in-flight soft sync so the new rate applies immediately and
      // subsequent state cues (play/pause) use the correct rate.
      if (speedCueAction && (softSyncAction || syncTracking.softSyncIsActive)) {
        if (typeof syncTracking.softSyncResetTimeoutId === 'number') {
          clearTimeout(syncTracking.softSyncResetTimeoutId);
          syncTracking.softSyncResetTimeoutId = undefined;
        }
        syncTracking.softSyncIsActive = false;
      }

      const filteredActions = !speedCueAction && (softSyncAction || syncTracking.softSyncIsActive)
        ? result.actions.filter((action: any) => action.type !== 'setOriginalPlaybackRate')
        : result.actions;

      const { nextGuards, nextWorkingState } = applyTwinPlayersSyncActions(filteredActions, {
        snapshot,
        guards: {
          changingVolume,
          changingReactionVolume,
          changingSpeed
        },
        workingState: snapshot.currentStateOriginalVideo,
        ytEndedState: ytStates.ENDED,
        deps: {
          setVolumeForOriginalVideo,
          setVolumeForReactionVideo,
          setPlaybackRateForOriginalVideo,
          pauseOriginalVideo,
          handleStateChangeInOriginalVideo,
          muteReactionAudio,
          unmuteReactionAudio,
          updateState
        },
        options: {
          isTikTokOriginal: snapshot.originalVideoPlatform === 'tiktok'
        }
      });

      changingVolume = nextGuards.changingVolume;
      changingReactionVolume = nextGuards.changingReactionVolume;
      changingSpeed = nextGuards.changingSpeed;

      if (softSyncAction && 'rate' in softSyncAction && 'durationMs' in softSyncAction && !speedCueAction) {
        if (typeof syncTracking.softSyncResetTimeoutId === 'number') {
          clearTimeout(syncTracking.softSyncResetTimeoutId);
          syncTracking.softSyncResetTimeoutId = undefined;
        }

        if (!changingSpeed && playerOriginal) {
          changingSpeed = true;
          setPlaybackRateForOriginalVideo(softSyncAction.rate);
          changingSpeed = false;

          syncTracking.softSyncResetTimeoutId = setTimeout(() => {
            if (!changingSpeed && playerOriginal) {
              // Compute the desired rate freshly at reset time so that any speed cue that fired
              // during the soft-sync window is honoured rather than being overwritten with the
              // rate that was active when the soft sync started.
              const resetSnapshot = getSnapshot();
              const freshRate = getCurrentPlaybackRateFromConfigs(
                Number(resetSnapshot.reactionCurrentTime),
                resetSnapshot.playbackRateTimeline,
                resetSnapshot.timeOffset
              );
              changingSpeed = true;
              setPlaybackRateForOriginalVideo(freshRate);
              updateState({ currentPlaybackRate: freshRate });
              changingSpeed = false;
            }
            syncTracking.softSyncIsActive = false;
            syncTracking.softSyncResetTimeoutId = undefined;
          }, softSyncAction.durationMs) as any;
        }
      } else if (syncTracking.softSyncIsActive && !softSyncAction) {
        if (typeof syncTracking.softSyncResetTimeoutId === 'number') {
          clearTimeout(syncTracking.softSyncResetTimeoutId);
          syncTracking.softSyncResetTimeoutId = undefined;
        }

        // Use playbackRateTimeline (always correct) instead of playbackRateConfigs which may be
        // empty when only the new array-format timeline is present in the reaction document.
        const desiredRate = getCurrentPlaybackRateFromConfigs(
          reactionCurrentTime,
          snapshot.playbackRateTimeline,
          snapshot.timeOffset
        );

        if (!changingSpeed && playerOriginal && Math.abs(snapshot.currentPlaybackRate - desiredRate) > 0.001) {
          changingSpeed = true;
          setPlaybackRateForOriginalVideo(desiredRate);
          updateState({ currentPlaybackRate: desiredRate });
          changingSpeed = false;
        }

        syncTracking.softSyncIsActive = false;
      }

      if (typeof result.stateUpdates.currentStateOriginalVideo === 'number') {
        if (snapshot.currentStateOriginalVideo !== result.stateUpdates.currentStateOriginalVideo) {
          updateState({ currentStateOriginalVideo: result.stateUpdates.currentStateOriginalVideo });
        }
      } else if (nextWorkingState !== snapshot.currentStateOriginalVideo) {
        updateState({ currentStateOriginalVideo: nextWorkingState });
      }

      if (!isMobileAudio && typeof result.enforceMuteModeWithOriginalState === 'number') {
        enforceReactionMuteMode(result.enforceMuteModeWithOriginalState);
      }

      if (typeof result.stateUpdates.fullscreenOverlayVisible === 'boolean') {
        updateState({ fullscreenOverlayVisible: result.stateUpdates.fullscreenOverlayVisible });
      }

      const nextBoundaries = [
        result.nextBoundaryReactionTime ?? null,
        getNextTimelineEventReactionTime(snapshot.volumeTimeline, {
          reactionCurrentTime,
          timeOffset: snapshot.timeOffset,
          seekMin: snapshot.seekMin,
          seekMax: snapshot.seekMax
        }),
        getNextTimelineEventReactionTime(snapshot.reactionVolumeTimeline, {
          reactionCurrentTime,
          timeOffset: snapshot.timeOffset,
          seekMin: snapshot.seekMin,
          seekMax: snapshot.seekMax
        }),
        getNextTimelineEventReactionTime(snapshot.playbackRateTimeline, {
          reactionCurrentTime,
          timeOffset: snapshot.timeOffset,
          seekMin: snapshot.seekMin,
          seekMax: snapshot.seekMax
        }),
        getNextTimelineEventReactionTime(snapshot.overlayVisibilityTimeline, {
          reactionCurrentTime,
          timeOffset: snapshot.timeOffset,
          seekMin: snapshot.seekMin,
          seekMax: snapshot.seekMax
        }),
        getNextTimelineEventReactionTime(snapshot.stateTimeline, {
          reactionCurrentTime,
          timeOffset: snapshot.timeOffset,
          seekMin: snapshot.seekMin,
          seekMax: snapshot.seekMax
        })
      ].filter((time): time is number => typeof time === 'number');

      const nextBoundaryReactionTime = nextBoundaries.length
        ? Math.min(...nextBoundaries)
        : null;

      const delayMs = computeNextSyncDelayMs({
        reactionCurrentTime,
        reactionPlayerState,
        ytPlayingState: YT.PlayerState.PLAYING,
        ytBufferingState: YT.PlayerState.BUFFERING,
        nextBoundaryReactionTime
      });

      scheduleNextSync(delayMs, runSyncCycle);
    };

    runSyncCycle();
  };

  const resetReactionDurationProbe = () => {
    clearTimeout(durationProbeTimeout);
    durationProbeTimeout = undefined;
    durationProbeAttempts = 0;
  };

  const probeReactionDuration = () => {
    durationProbeAttempts += 1;
    const { playerReaction } = getSnapshot();
    const measuredDuration = typeof playerReaction?.getDuration === 'function' ? Number(playerReaction.getDuration()) : Number.NaN;
    if (Number.isFinite(measuredDuration) && measuredDuration > 0) {
      updateState({ reactionDuration: measuredDuration });
      resetReactionDurationProbe();
      return;
    }
    if (durationProbeAttempts < 10) {
      durationProbeTimeout = setTimeout(probeReactionDuration, 400);
    } else {
      resetReactionDurationProbe();
    }
  };

  const handleStateChangeInReactionVideo = (previousState: number, nextState: number) => {
    if (
      previousState !== YT.PlayerState.PAUSED
      && previousState !== YT.PlayerState.BUFFERING
      && (nextState === YT.PlayerState.PAUSED || nextState === YT.PlayerState.BUFFERING)
    ) {
      pauseOriginalVideo();
    }

    if (nextState === YT.PlayerState.PLAYING && previousState !== YT.PlayerState.PLAYING) {
      const snapshot = getSnapshot();
      const reactionNow = typeof snapshot.playerReaction?.getCurrentTime === 'function'
        ? Number(snapshot.playerReaction.getCurrentTime())
        : Number(snapshot.reactionCurrentTime);

      if (Date.now() - getLastUserResumeAt() < 1200) {
        try {
          const currentOriginalTime = typeof snapshot.playerOriginal?.getCurrentTime === 'function'
            ? Number(snapshot.playerOriginal.getCurrentTime())
            : 0;
          if (Number.isFinite(currentOriginalTime)) {
            syncTracking.lastOriginalTargetTime = currentOriginalTime;
            syncTracking.lastOriginalSeekTarget = currentOriginalTime;
            syncTracking.lastOriginalSeekAt = Date.now();
          }
        } catch {
          // ignore
        }

        applyOriginalPlaybackForReactionTime(reactionNow, snapshot, {
          syncTargetTime: false
        });
        return;
      }

      applyOriginalPlaybackForReactionTime(reactionNow, snapshot);
    }
  };

  const onPlayerReady = (event: any) => {
    if (!isLiveInstance()) {
      debugClickGate('[TwinPlayers] onPlayerReady IGNORED (instance superseded)', {
        isDestroyed: isInstanceDestroyed(),
        globalActiveInstanceId: getActiveInstanceId()
      });
      return;
    }
    markPlayerReady();
    const snapshot = getSnapshot();
    const playerInfo = getPlayerDebugInfo(event?.target);
    if (event?.target === snapshot.playerOriginal) {
      debugClickGate('[TwinPlayers] original player READY', {
        ...playerInfo
      });
      setPlaybackRateForOriginalVideo(snapshot.currentPlaybackRate);
      if (typeof event.target.setVolume === 'function') {
        event.target.setVolume(snapshot.currentVolumeOriginalVideo);
      }
    }
    if (event?.target === snapshot.playerReaction) {
      debugClickGate('[TwinPlayers] reaction player READY', {
        ...playerInfo
      });
      if (typeof event?.target?.setPlaybackRate === 'function') {
        event.target.setPlaybackRate(1);
      }
      if (typeof event.target.setVolume === 'function') {
        event.target.setVolume(snapshot.currentVolumeReactionVideo);
      }
      if (!durationProbeTimeout) {
        resetReactionDurationProbe();
        probeReactionDuration();
      }
    }

    enforceReactionMuteMode();
  };

  const startVideos = () => {
    const snapshot = getSnapshot();
    debugClickGate('[TwinPlayers] startVideos invoked', { reactionVideoId: snapshot.reactionVideoId }, true);
    if (!snapshot.playerReaction) {
      debugClickGate('[TwinPlayers] startVideos aborted (missing reaction player)', {
        reactionVideoId: snapshot.reactionVideoId
      });
      return;
    }

    updateState({ bothVideosStarted: true });
    debugClickGate('[TwinPlayers] bothVideosStarted set true via startVideos gate release', {
      offsetStartTime: snapshot.offsetStartTime,
      playbackRate: snapshot.currentPlaybackRate
    });

    const startTime = snapshot.offsetStartTime || 0;
    syncTracking.mobileAudioWinner = null;

    if (enableSyncEngineV2) {
      const engine = getOrCreateSyncEngineV2(snapshot);
      engine.handleScrub(Math.round(startTime * 1000), Date.now());
      runSyncEngineV2Cycle({
        snapshot,
        reactionCurrentTime: startTime,
        reactionPlayerState: typeof snapshot.playerReaction?.getPlayerState === 'function'
          ? Number(snapshot.playerReaction.getPlayerState())
          : YT.PlayerState.PAUSED,
        force: true
      });

      goToSecondsInReactionVideo(startTime, { skipOriginalSync: true });
      debugClickGate('[TwinPlayers] startVideos forced reaction seek (v2)', { startTime });

      setPlaybackRateForOriginalVideo(snapshot.currentPlaybackRate);
      startReactionVideo();
      pollVideoCurrentTime();
      return;
    }

    const initialConfig = getCurrentStateFromStateConfigs(
      startTime,
      snapshot.playerConfigs,
      snapshot.timeOffset
    );

    const rawInitialState = Number(initialConfig.state);
    const initialState = Number.isFinite(rawInitialState) ? rawInitialState : -1;
    const initialTargetTime = Number(initialConfig.time ?? 0);

    const ytStates: TwinPlayersPlayerState = {
      PLAYING: typeof YT?.PlayerState?.PLAYING === 'number' ? YT.PlayerState.PLAYING : 1,
      PAUSED: typeof YT?.PlayerState?.PAUSED === 'number' ? YT.PlayerState.PAUSED : 2,
      BUFFERING: typeof YT?.PlayerState?.BUFFERING === 'number' ? YT.PlayerState.BUFFERING : 3,
      CUED: typeof YT?.PlayerState?.CUED === 'number' ? YT.PlayerState.CUED : 5,
      ENDED: typeof YT?.PlayerState?.ENDED === 'number' ? YT.PlayerState.ENDED : 0
    };

    const isMobileAudio = isMobileAudioEnvironment();
    const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
    const isMobilePlaybackDevice = /iPhone|iPad|iPod|Android/i.test(ua);
    const isMobileLazySyncEnabled = lazySyncRequested && isMobilePlaybackDevice;

    const originalIsMuted = typeof snapshot.playerOriginal?.isMuted === 'function'
      ? Boolean(snapshot.playerOriginal.isMuted())
      : undefined;
    const reactionIsMuted = typeof snapshot.playerReaction?.isMuted === 'function'
      ? Boolean(snapshot.playerReaction.isMuted())
      : undefined;

    const initialTick = computeTwinPlayersSyncTick(
      {
        reactionCurrentTime: startTime,
        previousReactionTime: startTime,
        seekMin: snapshot.seekMin,
        seekMax: snapshot.seekMax,
        timeOffset: snapshot.timeOffset,
        globalGain: snapshot.globalGain,
        isFineTuneModeOn: snapshot.isFineTuneModeOn,
        isFullscreen: snapshot.isFullscreen,
        currentStateOriginalVideo: initialState,
        currentPlaybackRate: snapshot.currentPlaybackRate,
        currentVolumeOriginalVideo: snapshot.currentVolumeOriginalVideo,
        currentVolumeReactionVideo: snapshot.currentVolumeReactionVideo,
        currentFullscreenOverlayVisible: snapshot.fullscreenOverlayVisible,
        isReactionMuteModeEnabled: snapshot.isReactionMuteModeEnabled,
        isReactionAutoMuted: snapshot.isReactionAutoMuted,
        isMobileAudioEnvironment: isMobileAudio,
        isMobilePlaybackDevice,
        isMobileLazySyncEnabled,
        playerConfigs: snapshot.playerConfigs,
        volumeConfigs: snapshot.volumeConfigs,
        reactionVolumeConfigs: snapshot.reactionVolumeConfigs,
        playbackRateConfigs: snapshot.playbackRateConfigs,
        playbackRateTimeline: snapshot.playbackRateTimeline,
        overlayVisibilityTimeline: snapshot.overlayVisibilityTimeline,
        stateTimeline: snapshot.stateTimeline,
        reactionPlayerState: typeof snapshot.playerReaction?.getPlayerState === 'function'
          ? Number(snapshot.playerReaction.getPlayerState())
          : undefined,
        originalPlayerState: typeof snapshot.playerOriginal?.getPlayerState === 'function'
          ? Number(snapshot.playerOriginal.getPlayerState())
          : undefined,
        originalCurrentTime: typeof snapshot.playerOriginal?.getCurrentTime === 'function'
          ? Number(snapshot.playerOriginal.getCurrentTime())
          : undefined,
        originalDuration: typeof snapshot.playerOriginal?.getDuration === 'function'
          ? Number(snapshot.playerOriginal.getDuration())
          : undefined,
        originalIsMuted,
        reactionIsMuted,
        now: Date.now(),
        yt: ytStates
      },
      syncTracking
    );

    Object.assign(syncTracking, initialTick.nextTracking);

    const initialApplied = applyTwinPlayersSyncActions(initialTick.actions, {
      snapshot,
      guards: {
        changingVolume,
        changingReactionVolume,
        changingSpeed
      },
      workingState: initialState,
      ytEndedState: ytStates.ENDED,
      deps: {
        setVolumeForOriginalVideo,
        setVolumeForReactionVideo,
        setPlaybackRateForOriginalVideo,
        pauseOriginalVideo,
        handleStateChangeInOriginalVideo,
        muteReactionAudio,
        unmuteReactionAudio,
        updateState
      },
      options: {
        allowStateActions: false,
        allowPlaybackRate: false,
        isTikTokOriginal: snapshot.originalVideoPlatform === 'tiktok'
      }
    });

    changingVolume = initialApplied.nextGuards.changingVolume;
    changingReactionVolume = initialApplied.nextGuards.changingReactionVolume;
    changingSpeed = initialApplied.nextGuards.changingSpeed;

    if (Number.isFinite(initialTargetTime)) {
      goToSecondsInOriginalVideo(initialTargetTime);
    }

    updateState({ currentStateOriginalVideo: initialState });

    if (initialState === YT.PlayerState.PLAYING) {
      startOriginalVideo();
    } else {
      pauseOriginalVideo();
    }

    goToSecondsInReactionVideo(startTime, { skipOriginalSync: true });
    debugClickGate('[TwinPlayers] startVideos forced reaction seek', { startTime });

    setPlaybackRateForOriginalVideo(snapshot.currentPlaybackRate);
    startReactionVideo();
    pollVideoCurrentTime();
  };

  const onStateChangeOriginal = (event: any) => {
    if (!isLiveInstance()) {
      debugClickGate('[TwinPlayers] original stateChange IGNORED (instance superseded)', {
        state: event?.data,
        stateName: stateName(event?.data),
        isDestroyed: isInstanceDestroyed(),
        globalActiveInstanceId: getActiveInstanceId()
      });
      try {
        event?.target?.pauseVideo?.();
      } catch {
        // ignore
      }
      return;
    }

    if (getSnapshot().isUserPaused && (event?.data === YT.PlayerState.PLAYING || event?.data === YT.PlayerState.BUFFERING)) {
      pausePlayerWithTrace('original', event?.target ?? getSnapshot().playerOriginal, 'userPaused override (stateChange)');
      return;
    }

    enforceReactionMuteMode(typeof event?.data === 'number' ? event.data : undefined);
    debugClickGate('[TwinPlayers] original stateChange', {
      state: event?.data,
      stateName: stateName(event?.data),
      ...getPlayerDebugInfo(event?.target)
    }, true);

    if (event.data === YT.PlayerState.PLAYING) {
      const snapshot = getSnapshot();
      const playerInfo = getPlayerDebugInfo(event?.target);
      const clickedFlagChanged = markOriginalVideoClicked();
      const gateState = getGateState();

      debugClickGate('[TwinPlayers] original PLAYING event', {
        state: event.data,
        stateName: stateName(event.data),
        clickedFlagChanged,
        targetIsStatePlayer: event?.target === snapshot.playerOriginal,
        ...playerInfo
      }, true);

      if (!snapshot.bothVideosStarted) {
        const gateSatisfied = gateState.originalVideoClicked && gateState.reactionVideoClicked;

        if (!gateSatisfied) {
          pausePlayerWithTrace('original', event?.target ?? snapshot.playerOriginal, 'click-gate (bothVideosStarted=false)');
          debugClickGate('[TwinPlayers] original paused for click gate', {
            gateSatisfied,
            ...playerInfo,
            playerState: stateName(getPlayerStateSafely(event?.target ?? snapshot.playerOriginal))
          });
          return;
        }

        debugClickGate('[TwinPlayers] original triggers startVideos (gate satisfied)', {
          ...playerInfo
        });
        startVideos();
      }
    }
  };

  const onStateChangeReaction = (event: any) => {
    if (!isLiveInstance()) {
      debugClickGate('[TwinPlayers] reaction stateChange IGNORED (instance superseded)', {
        state: event?.data,
        stateName: stateName(event?.data),
        isDestroyed: isInstanceDestroyed(),
        globalActiveInstanceId: getActiveInstanceId()
      });
      try {
        event?.target?.pauseVideo?.();
      } catch {
        // ignore
      }
      return;
    }

    if (getSnapshot().isUserPaused && (event?.data === YT.PlayerState.PLAYING || event?.data === YT.PlayerState.BUFFERING)) {
      pausePlayerWithTrace('reaction', event?.target ?? getSnapshot().playerReaction, 'userPaused override (stateChange)');
      return;
    }

    const snapshot = getSnapshot();
    const isCurrentReactionPlayer = event?.target === snapshot.playerReaction;
    if (!isCurrentReactionPlayer) {
      debugClickGate('[TwinPlayers] reaction stateChange IGNORED (stale player)', {
        state: event?.data,
        stateName: stateName(event?.data),
        ...getPlayerDebugInfo(event?.target)
      }, true);
      return;
    }

    if (isSwitchingReactionInPlace()) {
      debugClickGate('[TwinPlayers] reaction stateChange IGNORED (switching)', {
        state: event?.data,
        stateName: stateName(event?.data),
        ...getPlayerDebugInfo(event?.target)
      }, true);
      return;
    }

    debugClickGate('[TwinPlayers] reaction stateChange', {
      state: event?.data,
      stateName: stateName(event?.data),
      ...getPlayerDebugInfo(event?.target)
    }, true);

    const progressionHooks = getProgressionHooks();
    if (event.data === YT.PlayerState.ENDED) {
      if (snapshot.isPlaylistAutoPlay && snapshot.hasNextIndexInPlaylist) {
        // Mid-playlist with autoplay: advance to the next reaction
        progressionHooks?.loadNextReactionInPlaylist();
      } else if (snapshot.isQueueAutoPlay) {
        // Queue autoplay: advance to the next queue item
        progressionHooks?.loadNextReactionInQueue();
      } else if (snapshot.playlistDocumentId && snapshot.hasNextIndexInPlaylist) {
        // Mid-playlist without autoplay: stop both players
        pauseOriginalVideo();
        stopSyncScheduler();
      } else {
        // Individual reaction, or last item in playlist/queue:
        // stop the sync scheduler so the original can finish naturally.
        stopSyncScheduler();
      }
    }

    if (event.data === YT.PlayerState.PLAYING) {
      const playerInfo = getPlayerDebugInfo(event?.target);
      const clickedFlagChanged = markReactionVideoClicked();
      const gateState = getGateState();

      debugClickGate('[TwinPlayers] reaction PLAYING event', {
        state: event.data,
        stateName: stateName(event.data),
        clickedFlagChanged,
        targetIsStatePlayer: event?.target === snapshot.playerReaction,
        ...playerInfo
      }, true);

      if (!snapshot.bothVideosStarted) {
        const gateSatisfied = gateState.originalVideoClicked && gateState.reactionVideoClicked;
        if (!gateSatisfied) {
          pausePlayerWithTrace('reaction', event?.target ?? snapshot.playerReaction, 'click-gate (bothVideosStarted=false)');
          debugClickGate('[TwinPlayers] reaction paused for click gate', {
            gateSatisfied,
            ...playerInfo,
            playerState: stateName(getPlayerStateSafely(event?.target ?? snapshot.playerReaction))
          });
          return;
        }

        debugClickGate('[TwinPlayers] reaction triggers startVideos (gate satisfied)', {
          ...playerInfo
        });
        startVideos();
        return;
      }

      if (snapshot.playerReaction && snapshot.playerOriginal) {
        pollVideoCurrentTime();
      }
    }
  };

  const handlePlayStateChange = (isPlaying: boolean) => {
    debugClickGate('[TwinPlayers] handlePlayStateChange called', { isPlaying }, true);
    if (isPlaying) {
      const wasUserPaused = getSnapshot().isUserPaused;
      if (wasUserPaused) {
        updateState({ isUserPaused: false });
      }
      const snapshot = getSnapshot();
      if (!snapshot.bothVideosStarted) {
        const gateState = getGateState();
        debugClickGate('[TwinPlayers] handlePlayStateChange releasing gate', {
          gateSatisfied: gateState.originalVideoClicked && gateState.reactionVideoClicked,
          offsetStartTime: snapshot.offsetStartTime,
          playbackRate: snapshot.currentPlaybackRate
        }, true);
        goToSecondsInReactionVideo(snapshot.offsetStartTime || 0, { skipOriginalSync: true });
        setPlaybackRateForOriginalVideo(snapshot.currentPlaybackRate);
        updateState({ bothVideosStarted: true });
        debugClickGate('[TwinPlayers] bothVideosStarted set true via handlePlayStateChange gate release', {
          offsetStartTime: snapshot.offsetStartTime,
          playbackRate: snapshot.currentPlaybackRate
        });
      }

      if (wasUserPaused) {
        setLastUserResumeAt(Date.now());
      }
      const reactionNow = typeof snapshot.playerReaction?.getCurrentTime === 'function'
        ? Number(snapshot.playerReaction.getCurrentTime())
        : Number(snapshot.reactionCurrentTime);

      if (enableSyncEngineV2) {
        runSyncEngineV2Cycle({
          snapshot,
          reactionCurrentTime: reactionNow,
          reactionPlayerState: YT.PlayerState.PLAYING,
          force: wasUserPaused
        });
        startReactionVideo();
        return;
      }

      applyOriginalPlaybackForReactionTime(reactionNow, snapshot, {
        syncTargetTime: false
      });
      startReactionVideo();
      return;
    }

    updateState({ isUserPaused: true });
    pauseOriginalVideo();
    pauseReactionVideo();
  };

  const syncVideos = () => {
    debugClickGate('[TwinPlayers] syncVideos called', {}, true);
    if (getSnapshot().isUserPaused) {
      updateState({ isUserPaused: false });
    }
    const snapshot = getSnapshot();
    if (!snapshot.bothVideosStarted) {
      const gateState = getGateState();
      debugClickGate('[TwinPlayers] syncVideos releasing gate', {
        gateSatisfied: gateState.originalVideoClicked && gateState.reactionVideoClicked,
        offsetStartTime: snapshot.offsetStartTime,
        playbackRate: snapshot.currentPlaybackRate
      }, true);
      goToSecondsInReactionVideo(snapshot.offsetStartTime || 0, { skipOriginalSync: true });
      setPlaybackRateForOriginalVideo(snapshot.currentPlaybackRate);
      updateState({ bothVideosStarted: true });
      debugClickGate('[TwinPlayers] bothVideosStarted set true via syncVideos gate release', {
        offsetStartTime: snapshot.offsetStartTime,
        playbackRate: snapshot.currentPlaybackRate
      });
    }

    pauseOriginalVideo();
    pauseReactionVideo();

    const reactionNow = typeof snapshot.playerReaction?.getCurrentTime === 'function'
      ? Number(snapshot.playerReaction.getCurrentTime())
      : Number(snapshot.reactionCurrentTime);

    if (enableSyncEngineV2) {
      runSyncEngineV2Cycle({
        snapshot,
        reactionCurrentTime: reactionNow,
        reactionPlayerState: getPlayerStateSafely(snapshot.playerReaction) ?? YT.PlayerState.PAUSED,
        force: true
      });
      startReactionVideo();
      return;
    }

    applyOriginalPlaybackForReactionTime(reactionNow, snapshot);
    startReactionVideo();
  };

  const dispose = () => {
    stopSyncScheduler();
    resetReactionDurationProbe();
    if (typeof syncTracking.softSyncResetTimeoutId === 'number') {
      clearTimeout(syncTracking.softSyncResetTimeoutId);
      syncTracking.softSyncResetTimeoutId = undefined;
    }
    syncTracking.softSyncIsActive = false;
    resetOriginalStateTracking();
    syncEngineV2 = null;
    syncEngineV2PlanKey = '';
  };

  return {
    enforceReactionMuteMode,
    resetOriginalStateTracking,
    resetReactionDurationProbe,
    seekReactionTo: goToSecondsInReactionVideo,
    setPlaybackRateForOriginalVideo,
    stopSyncScheduler,
    pollVideoCurrentTime,
    handleStateChangeInReactionVideo,
    handlePlayStateChange,
    syncVideos,
    onPlayerReady,
    onStateChangeOriginal,
    onStateChangeReaction,
    dispose,
  };
}
