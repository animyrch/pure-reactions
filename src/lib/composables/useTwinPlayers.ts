import { onDestroy, onMount, tick } from 'svelte';
import { get, writable } from 'svelte/store';
import { goto } from '$app/navigation';
import {
  getCurrentPlaybackRateFromConfigs,
  getCurrentStateFromStateConfigs,
  getCurrentVolumeFromVolumeConfigs
} from '$lib/helpers/reaction';
import {
  getReaction,
  updateFirebaseDocument,
  getPlaylist,
  getQueueBySlug
} from '$lib/helpers/firebase';
import {
  downloadBasicVideoDetails,
  extractYouTubeVideoId,
  fetchFirstPlaylistVideos
} from '$lib/helpers/youtube';
import {
  deriveTimelines,
  readAutoPlayCookie,
  toggleFullscreenBodyClass,
  writeAutoPlayCookie
} from '$lib/helpers/reactionPlayer';

declare const YT: any;

declare global {
  interface Window {
    playerConfigs: Record<string, any> | any[];
    volumeConfigs: Record<string, any> | any[];
    reactionVolumeConfigs: Record<string, any> | any[];
    playbackRateConfigs: Record<string, any> | any[];
  }
}

type Nullable<T> = T | null | undefined;

type TwinPlayersState = {
  isLoading: boolean;
  isReactionMissing: boolean;
  isEditModeOn: boolean;
  isFineTuneModeOn: boolean;
  canShowEditModeButton: boolean;
  canShowCloseEditModeButton: boolean;
  isUsersOwnVideo: boolean;
  isPublished: boolean;
  reactionVideoId: string;
  reactionVideoAuthor?: string;
  reactionVideoTitle?: string;
  originalVideoAuthor?: string;
  originalVideoTitle?: string;
  originalVideoId?: string;
  reactorId?: string;
  youtubePlaylistId?: string;
  playlistDocumentId?: string | null;
  playlistItems: any[];
  playlistDocument?: any;
  hasNextIndexInPlaylist: boolean;
  currentIndexInPlaylist: number;
  isPlaylistAutoPlay: boolean;
  queueSlug?: string | null;
  queueIndex: number;
  isQueueAutoPlay: boolean;
  showCinematicBars: boolean;
  isFullscreen: boolean;
  isControlSurfaceVisible: boolean;
  isExitButtonExpanded: boolean;
  playerOriginal: any;
  playerReaction: any;
  bothVideosStarted: boolean;
  playerConfigs: Record<string, any>;
  volumeConfigs: Record<string, any>;
  reactionVolumeConfigs: Record<string, any>;
  playbackRateConfigs: Record<string, any>;
  stateTimeline: any[];
  volumeTimeline: any[];
  reactionVolumeTimeline: any[];
  playbackRateTimeline: any[];
  playerEventTimeline: any[];
  currentPlaybackRate: number;
  currentStateOriginalVideo: number;
  currentVolumeOriginalVideo: number;
  currentVolumeReactionVideo: number;
  reactionCurrentTime: number;
  reactionDuration: number;
  offsetStartTime: number;
  reactionFinishTime: number;
  timeOffset: number;
  globalGain: number;
  introBufferTime: number;
  soundLevel: number;
  isReactionMuteModeEnabled: boolean;
  isReactionAutoMuted: boolean;
  pageSlug: string;
  isOutOfSync: boolean;
};

type UseTwinPlayersOptions = {
  data: {
    slug: string;
    userId?: string | null;
  };
};

type LoadReactionInPlaceOptions = {
  preserveReactionTime?: boolean;
};

type CreatePlayerConfigParams = {
  timeInReaction: number;
  targetTime: number;
  state: number;
};

type CreateVolumeConfigParams = {
  timeInReaction: number;
  volume: number;
};

type CreateReactionVolumeConfigParams = {
  timeInReaction: number;
  volume: number;
};

type CreatePlaybackRateConfigParams = {
  timeInReaction: number;
  rate: number;
};

type UpdatePlayerConfigParams = {
  timeInReaction: number;
  targetTime?: number;
  state?: number;
  previousTimeInReaction?: number;
};

type UpdateVolumeConfigParams = {
  timeInReaction: number;
  volume?: number;
  previousTimeInReaction?: number;
};

type UpdateReactionVolumeConfigParams = {
  timeInReaction: number;
  volume?: number;
  previousTimeInReaction?: number;
};

type DeleteVolumeConfigParams = {
  timeInReaction: number;
};

type DeleteReactionVolumeConfigParams = {
  timeInReaction: number;
};

type UpdatePlaybackRateConfigParams = {
  timeInReaction: number;
  rate?: number;
  previousTimeInReaction?: number;
};

type DeletePlaybackRateConfigParams = {
  timeInReaction: number;
};

type DeletePlayerConfigParams = {
  timeInReaction: number;
};

type ReactionMetadataField =
  | 'originalVideoTitle'
  | 'reactionVideoTitle'
  | 'originalVideoAuthor'
  | 'reactionVideoAuthor';

type VerifyVideoDetailsOptions = {
  videoId?: string;
  currentTitle?: string | null;
  currentAuthor?: string | null;
  titleField: 'originalVideoTitle' | 'reactionVideoTitle';
  authorField: 'originalVideoAuthor' | 'reactionVideoAuthor';
};

type VerifyVideoDetailsResult = {
  updates: Partial<Record<ReactionMetadataField, string>>;
  title?: string;
  author?: string;
};

type VerifyAndSyncMetadataParams = {
  documentId?: string;
  originalVideoId?: string;
  reactionVideoId?: string;
  currentOriginalTitle?: string | null;
  currentOriginalAuthor?: string | null;
  currentReactionTitle?: string | null;
  currentReactionAuthor?: string | null;
};

export const CONTROLS_FADE_CLASS = 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100';

const playerOptions = {
  autoplay: 0,
  controls: 1,
  disablekb: 1,
  modestbranding: 1,
  rel: 0
};

const iframeOptionDefault = {
  width: '100%',
  height: '100%'
};

const buildPlayerEventTimeline = (timeline: any[] = []) =>
  timeline
    .map((event: any, index: number) => ({
      id: `player-array-${index}-${Number(event?.t ?? index)}`,
      type: 'player',
      timeInReaction: Number(event?.t) || 0,
      state: Number(event?.state) || 0,
      targetTime: Number(event?.targetTime ?? 0)
    }))
    .sort(
      (
        a: { timeInReaction: number },
        b: { timeInReaction: number }
      ) => a.timeInReaction - b.timeInReaction
    );

export function useTwinPlayers({ data }: UseTwinPlayersOptions) {
  const { slug, userId } = data;
  const initialUrlState = getInitialUrlState();
  // console.log('Initial URL State:', initialUrlState);
  const state = writable<TwinPlayersState>({
    isLoading: true,
    isReactionMissing: false,
    isEditModeOn: false,
    isFineTuneModeOn: false,
    canShowEditModeButton: false,
    canShowCloseEditModeButton: false,
    isUsersOwnVideo: false,
    isPublished: false,
    reactionVideoId: '',
    originalVideoAuthor: undefined,
    originalVideoTitle: undefined,
    reactionVideoAuthor: undefined,
    reactionVideoTitle: undefined,
    originalVideoId: undefined,
    reactorId: undefined,
    youtubePlaylistId: undefined,
    playlistDocumentId: initialUrlState.playlistId,
    playlistItems: [],
    playlistDocument: undefined,
    hasNextIndexInPlaylist: false,
    currentIndexInPlaylist: 0,
    isPlaylistAutoPlay: false,
    queueSlug: initialUrlState.queueSlug,
    queueIndex: Number.isFinite(initialUrlState.queueIndex as number) ? (initialUrlState.queueIndex as number) : 0,
    isQueueAutoPlay: Boolean(initialUrlState.queueAutoPlay),
    showCinematicBars: true,
    isFullscreen: initialUrlState.isFullscreen,
    isControlSurfaceVisible: false,
    isExitButtonExpanded: false,
    playerOriginal: null,
    playerReaction: null,
    bothVideosStarted: false,
    playerConfigs: {},
    volumeConfigs: {},
    reactionVolumeConfigs: {},
    playbackRateConfigs: {},
    stateTimeline: [],
    volumeTimeline: [],
    reactionVolumeTimeline: [],
    playbackRateTimeline: [],
    playerEventTimeline: [],
    currentPlaybackRate: 1,
    currentStateOriginalVideo: -1,
    currentVolumeOriginalVideo: 100,
    currentVolumeReactionVideo: 100,
    reactionCurrentTime: 0,
    reactionDuration: 0,
    offsetStartTime: 0,
    reactionFinishTime: 100000,
    timeOffset: 0,
    globalGain: 1,
    introBufferTime: 0,
    soundLevel: 100,
    isReactionMuteModeEnabled: false,
    isReactionAutoMuted: false,
    pageSlug: slug,
    isOutOfSync: false
  });

  let overlayElement: HTMLDivElement | undefined;
  let controlHideTimeout: ReturnType<typeof setTimeout> | undefined;
  let overlayPointerRestoreTimeout: ReturnType<typeof setTimeout> | undefined;
  let exitButtonCollapseTimeout: ReturnType<typeof setTimeout> | undefined;
  let pollInterval: ReturnType<typeof setInterval> | undefined;
  let durationProbeTimeout: ReturnType<typeof setTimeout> | undefined;
  let durationProbeAttempts = 0;
  let escListener: ((event: KeyboardEvent) => void) | undefined;
  let pendingPlayerReadyCount = 0;
  let playerReadyTimeout: ReturnType<typeof setTimeout> | undefined;

  const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';
  let youtubeApiReadyPromise: Promise<void> | null = null;

  let originalVideoClicked = false;
  let reactionVideoClicked = false;
  let playlistFetchPromise: Promise<void> | undefined;
  let changingVolume = false;
  let changingReactionVolume = false;
  let changingState = false;
  let changingSpeed = false;
  let lastOriginalTargetTime: number | undefined;

  toggleFullscreenBodyClass(initialUrlState.isFullscreen);

  const updateState = (partial: Partial<TwinPlayersState> | ((value: TwinPlayersState) => Partial<TwinPlayersState>)) => {
    state.update((value) => {
      const patch = typeof partial === 'function' ? partial(value) : partial;
      return {
        ...value,
        ...patch
      };
    });
  };

  const finalizeLoadingState = () => {
    pendingPlayerReadyCount = 0;
    clearTimeout(playerReadyTimeout);
    playerReadyTimeout = undefined;
    updateState({ isLoading: false });
  };

  const scheduleLoadingFallback = () => {
    clearTimeout(playerReadyTimeout);
    if (pendingPlayerReadyCount === 0) {
      return;
    }
    playerReadyTimeout = setTimeout(() => {
      finalizeLoadingState();
    }, 8000);
  };

  const setExpectedPlayerReadyCount = (count: number) => {
    pendingPlayerReadyCount = count;
    if (count === 0) {
      finalizeLoadingState();
      return;
    }
    updateState({ isLoading: true });
    scheduleLoadingFallback();
  };

  const markPlayerReady = () => {
    if (pendingPlayerReadyCount === 0) {
      return;
    }
    pendingPlayerReadyCount -= 1;
    if (pendingPlayerReadyCount === 0) {
      finalizeLoadingState();
    }
  };

  const startReactionVideo = () => {
    const { playerReaction } = get(state);
    playerReaction?.playVideo();
  };

  const startOriginalVideo = () => {
    const snapshot = get(state);
    if (snapshot.playerOriginal) {
      snapshot.playerOriginal.setPlaybackRate(snapshot.currentPlaybackRate);
      snapshot.playerOriginal.playVideo();
    }
  };

  const pauseOriginalVideo = () => {
    get(state).playerOriginal?.pauseVideo();
  };

  const pauseReactionVideo = () => {
    get(state).playerReaction?.pauseVideo();
  };

  const muteReactionAudio = (player?: any) => {
    const reactionPlayer = player ?? get(state).playerReaction;
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
    const reactionPlayer = player ?? get(state).playerReaction;
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

  const enforceReactionMuteMode = (overrideOriginalState?: number) => {
    const snapshot = get(state);
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
          handleReactionVideoVolume(reactionCurrentTime);
        }
      }
    }
  };

  const resetOriginalStateTracking = () => {
    lastOriginalTargetTime = undefined;
  };

  const goToSecondsInOriginalVideo = (seconds: number) => {
    const normalized = Number(seconds);
    if (!Number.isFinite(normalized)) {
      return;
    }
    const { playerOriginal } = get(state);
    if (playerOriginal && typeof playerOriginal.seekTo === 'function') {
      playerOriginal.seekTo(normalized, true);
      lastOriginalTargetTime = normalized;
    }
  };

  const goToSecondsInReactionVideo = (seconds: number) => {
    const normalized = Number(seconds);
    if (!Number.isFinite(normalized)) {
      return;
    }

    const snapshot = get(state);
    const rawMin = Number(snapshot.offsetStartTime);
    const seekMin = Number.isFinite(rawMin) && rawMin >= 0 ? rawMin : 0;

    const rawDuration = Number(snapshot.reactionDuration);
    const durationCap = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : Number.POSITIVE_INFINITY;

    const rawFinish = Number(snapshot.reactionFinishTime);
    const finishCap = Number.isFinite(rawFinish) && rawFinish > 0 ? rawFinish : Number.POSITIVE_INFINITY;

    const seekMax = Math.max(seekMin, Math.min(durationCap, finishCap));
    const clamped = seekMax === Number.POSITIVE_INFINITY
      ? Math.max(normalized, seekMin)
      : Math.min(Math.max(normalized, seekMin), seekMax);

    snapshot.playerReaction?.seekTo?.(clamped, true);
  };

  const setVolumeForOriginalVideo = (volume: number) => {
    get(state).playerOriginal?.setVolume?.(volume);
  };

  const setVolumeForReactionVideo = (volume: number) => {
    get(state).playerReaction?.setVolume?.(volume);
  };

  const setPlaybackRateForOriginalVideo = (rate: number) => {
    const original = get(state).playerOriginal;
    if (original && typeof original.setPlaybackRate === 'function') {
      original.setPlaybackRate(rate);
    }
  };

  const handleOriginalVideoVolume = (reactionCurrentTime: number) => {
    const snapshot = get(state);
    const newVolume = getCurrentVolumeFromVolumeConfigs(
      reactionCurrentTime,
      window.volumeConfigs,
      snapshot.globalGain,
      snapshot.timeOffset
    );
    if (!changingVolume && snapshot.currentVolumeOriginalVideo !== newVolume) {
      changingVolume = true;
      setVolumeForOriginalVideo(newVolume);
      updateState({ currentVolumeOriginalVideo: newVolume });
      changingVolume = false;
    }
  };

  const handleReactionVideoVolume = (reactionCurrentTime: number) => {
    const snapshot = get(state);
    const reactionPlayer = snapshot.playerReaction;
    if (!reactionPlayer) {
      return;
    }

    const playingState = typeof YT !== 'undefined' && typeof YT?.PlayerState?.PLAYING === 'number'
      ? YT.PlayerState.PLAYING
      : 1;

    const shouldMute = snapshot.isReactionMuteModeEnabled && snapshot.currentStateOriginalVideo === playingState;
    if (shouldMute || snapshot.isReactionAutoMuted) {
      return;
    }

    const newVolume = getCurrentVolumeFromVolumeConfigs(
      reactionCurrentTime,
      (window as any).reactionVolumeConfigs,
      1.0,
      snapshot.timeOffset
    );

    if (!changingReactionVolume && snapshot.currentVolumeReactionVideo !== newVolume) {
      changingReactionVolume = true;
      setVolumeForReactionVideo(newVolume);
      updateState({ currentVolumeReactionVideo: newVolume });
      changingReactionVolume = false;
    }
  };

  const handleOriginalVideoSpeed = (reactionCurrentTime: number) => {
    const snapshot = get(state);
    const desiredPlaybackRate = getCurrentPlaybackRateFromConfigs(
      reactionCurrentTime,
      window.playbackRateConfigs,
      snapshot.timeOffset
    );
    if (!changingSpeed && Math.abs(desiredPlaybackRate - snapshot.currentPlaybackRate) > 0.001) {
      changingSpeed = true;
      setPlaybackRateForOriginalVideo(desiredPlaybackRate);
      updateState({ currentPlaybackRate: desiredPlaybackRate });
      changingSpeed = false;
    }
  };

  const handleStateChangeInOriginalVideo = (previousState: number, nextState: number, targetTime: number) => {
    const resolvedState = typeof nextState === 'number' ? nextState : -1;
    const normalizedTarget = Number(targetTime);
    const targetChanged = Number.isFinite(normalizedTarget)
      && (typeof lastOriginalTargetTime !== 'number' || Math.abs(lastOriginalTargetTime - normalizedTarget) > 0.01);

    if (targetChanged) {
      goToSecondsInOriginalVideo(normalizedTarget);
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

    if (Number.isFinite(normalizedTarget)) {
      lastOriginalTargetTime = normalizedTarget;
    }
  };

  const handleOriginalVideoState = (reactionCurrentTime: number, previousReactionTime: number) => {
    if (changingState) {
      return;
    }

    changingState = true;
    try {
      const snapshot = get(state);
      const reactionPlayerState = typeof snapshot.playerReaction?.getPlayerState === 'function'
        ? snapshot.playerReaction.getPlayerState()
        : undefined;
      const isReactionPlaying = reactionPlayerState === YT?.PlayerState?.PLAYING;
      const shouldHoldOriginalWhilePaused = snapshot.isFineTuneModeOn && !isReactionPlaying;
      const timeline = Array.isArray(snapshot.stateTimeline) ? snapshot.stateTimeline : [];
      const timeOffset = Number(snapshot.timeOffset || 0);
      const previousEffective = Number.isFinite(previousReactionTime)
        ? Number(previousReactionTime) - timeOffset
        : Number(reactionCurrentTime) - timeOffset;
      const currentEffective = Number(reactionCurrentTime) - timeOffset;
      const movingForward = currentEffective >= previousEffective - 0.0001;

      let workingState = snapshot.currentStateOriginalVideo;

      if (movingForward && timeline.length) {
        // Process every state event that fired between the previous and current samples.
        const eventsInRange = timeline.filter((entry) => {
          const eventTime = Number(entry?.t);
          if (!Number.isFinite(eventTime)) {
            return false;
          }
          return eventTime > previousEffective && eventTime <= currentEffective;
        });

        for (const entry of eventsInRange) {
          const rawState = Number(entry?.state);
          let desiredState = Number.isFinite(rawState) ? rawState : -1;
          if (shouldHoldOriginalWhilePaused && desiredState === YT.PlayerState.PLAYING) {
            desiredState = YT.PlayerState.PAUSED;
          }
          const desiredTarget = Number(entry?.targetTime ?? entry?.time ?? 0);
          handleStateChangeInOriginalVideo(workingState, desiredState, desiredTarget);
          workingState = desiredState;
        }
      }

      const config = getCurrentStateFromStateConfigs(
        reactionCurrentTime,
        window.playerConfigs,
        snapshot.timeOffset
      );
      const rawConfigState = Number(config.state);
      const configState = Number.isFinite(rawConfigState) ? rawConfigState : -1;
      const effectiveConfigState =
        shouldHoldOriginalWhilePaused && configState === YT.PlayerState.PLAYING
          ? YT.PlayerState.PAUSED
          : configState;
      const baseTargetTime = Number(config.time ?? 0);
      const anchorTime = Number(config.closestSmallerTimeCode ?? currentEffective);
      const actualOriginalTime = typeof snapshot.playerOriginal?.getCurrentTime === 'function'
        ? Number(snapshot.playerOriginal.getCurrentTime())
        : Number.NaN;
      let computedTargetTime = Number.isFinite(baseTargetTime) ? baseTargetTime : Number.NaN;

      if (Number.isFinite(computedTargetTime) && Number.isFinite(anchorTime)) {
        const deltaSinceAnchor = currentEffective - anchorTime;
        if (effectiveConfigState === YT.PlayerState.PLAYING && Number.isFinite(deltaSinceAnchor)) {
          computedTargetTime += Math.max(deltaSinceAnchor, 0);
        }
      }

      const tolerance = effectiveConfigState === YT.PlayerState.PLAYING ? 0.35 : 0.01;

      let targetMismatch = false;
      if (Number.isFinite(computedTargetTime)) {
        if (Number.isFinite(actualOriginalTime)) {
          targetMismatch = Math.abs(actualOriginalTime - computedTargetTime) > tolerance;
        } else if (typeof lastOriginalTargetTime === 'number') {
          targetMismatch = Math.abs(lastOriginalTargetTime - computedTargetTime) > tolerance;
        } else {
          targetMismatch = true;
        }
      }

      if (workingState !== effectiveConfigState || targetMismatch) {
        handleStateChangeInOriginalVideo(workingState, effectiveConfigState, computedTargetTime);
        workingState = effectiveConfigState;
      }

      if (workingState !== snapshot.currentStateOriginalVideo) {
        updateState({ currentStateOriginalVideo: workingState });
      }

      enforceReactionMuteMode(workingState);

      if (Number.isFinite(actualOriginalTime)) {
        lastOriginalTargetTime = actualOriginalTime;
      }
    } finally {
      changingState = false;
    }
  };

  const pollVideoCurrentTime = () => {
    clearInterval(pollInterval);
    const interval = 500;
    let reactionPlayerState = YT?.PlayerState?.UNSTARTED ?? -1;
    pollInterval = setInterval(() => {
      const snapshot = get(state);
      const {
        playerReaction,
        playerOriginal,
        reactionFinishTime,
        hasNextIndexInPlaylist,
        isPlaylistAutoPlay,
        isQueueAutoPlay
      } = snapshot;
      if (!playerReaction || !playerOriginal) {
        return;
      }
      const newReactionState = playerReaction.getPlayerState();
      if (reactionPlayerState !== newReactionState) {
        handleStateChangeInReactionVideo(reactionPlayerState, newReactionState);
        reactionPlayerState = newReactionState;
      }
      const previousReactionTime = snapshot.reactionCurrentTime;
      const reactionCurrentTime = parseFloat(playerReaction.getCurrentTime().toFixed(1));
      const rawDuration = typeof playerReaction.getDuration === 'function' ? Number(playerReaction.getDuration()) : Number.NaN;
      console.log('Polling reaction time:', reactionCurrentTime, 'of', rawDuration);
      const reactionDuration = Number.isFinite(rawDuration) ? rawDuration : snapshot.reactionDuration;
      if (reactionCurrentTime !== snapshot.reactionCurrentTime || Math.abs(reactionDuration - snapshot.reactionDuration) > 0.1) {
        updateState({ reactionCurrentTime, reactionDuration });
      }
      if (reactionCurrentTime > reactionFinishTime) {
        pauseOriginalVideo();
        pauseReactionVideo();
        clearInterval(pollInterval);
        if (isPlaylistAutoPlay && hasNextIndexInPlaylist) {
          loadNextReactionInPlaylist();
        }
        if (isQueueAutoPlay) {
          loadNextReactionInQueue();
        }
        return;
      }
      handleOriginalVideoVolume(reactionCurrentTime);
      handleReactionVideoVolume(reactionCurrentTime);
      handleOriginalVideoSpeed(reactionCurrentTime);
      handleOriginalVideoState(reactionCurrentTime, previousReactionTime);
    }, interval);
  };

  const resetReactionDurationProbe = () => {
    clearTimeout(durationProbeTimeout);
    durationProbeTimeout = undefined;
    durationProbeAttempts = 0;
  };

  const probeReactionDuration = () => {
    durationProbeAttempts += 1;
    const { playerReaction } = get(state);
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
      previousState !== YT.PlayerState.PAUSED &&
      previousState !== YT.PlayerState.BUFFERING &&
      (nextState === YT.PlayerState.PAUSED || nextState === YT.PlayerState.BUFFERING)
    ) {
      pauseOriginalVideo();
    }
    if (previousState === YT.PlayerState.BUFFERING && nextState === YT.PlayerState.PLAYING) {
      const snapshot = get(state);
      const reactionCurrentTime = Number(snapshot.playerReaction?.getCurrentTime().toFixed(1));
      const closestConfig = getCurrentStateFromStateConfigs(
        reactionCurrentTime,
        window.playerConfigs,
        snapshot.timeOffset
      );
      const rawDesiredState = Number(closestConfig.state);
      const desiredState = Number.isFinite(rawDesiredState)
        ? rawDesiredState
        : -1;
      const calculatedTimeForOriginalVideo = (reactionCurrentTime - closestConfig.closestSmallerTimeCode) + parseFloat(String(closestConfig.time ?? 0));
      handleStateChangeInOriginalVideo(snapshot.currentStateOriginalVideo, desiredState, calculatedTimeForOriginalVideo);
      if (snapshot.currentStateOriginalVideo !== desiredState) {
        updateState({ currentStateOriginalVideo: desiredState });
      }
    }
  };

  const onPlayerReady = (event: any) => {
    markPlayerReady();
    console.log('Player ready event for', event?.target);
    const snapshot = get(state);
    if (event?.target === snapshot.playerOriginal) {
      setPlaybackRateForOriginalVideo(snapshot.currentPlaybackRate);
    }
    if (event?.target === snapshot.playerReaction) {
      if (typeof event?.target?.setPlaybackRate === 'function') {
        event.target.setPlaybackRate(1);
      }
      if (!durationProbeTimeout) {
        resetReactionDurationProbe();
        probeReactionDuration();
      }
    }

    enforceReactionMuteMode();
  };

  const startVideos = () => {
    const snapshot = get(state);
    if (!snapshot.playerReaction) {
      return;
    }
    goToSecondsInReactionVideo(snapshot.offsetStartTime || 0);
    setPlaybackRateForOriginalVideo(snapshot.currentPlaybackRate);
    startReactionVideo();
    pollVideoCurrentTime();
    updateState({ bothVideosStarted: true });
  };

  const onStateChangeOriginal = (event: any) => {
    enforceReactionMuteMode(typeof event?.data === 'number' ? event.data : undefined);
    if (event.data === YT.PlayerState.PLAYING) {
      console.log('Original video started playing');
      if (!originalVideoClicked) {
        // Pause the actual player instance that emitted the event.
        // On fast client-side navigations, state.playerOriginal may not yet be updated
        // when the first PLAYING event fires, which can bypass the "click both players" gate.
        event?.target?.pauseVideo?.();
        originalVideoClicked = true;
      }
      const snapshot = get(state);
      if (!snapshot.bothVideosStarted) {
        if (originalVideoClicked && reactionVideoClicked) {
          startVideos();
        }
        // Do not allow syncing/polling before the gate is satisfied.
        return;
      }
    }
  };

  const onStateChangeReaction = async (event: any) => {
    if (event.data === YT.PlayerState.ENDED && get(state).isPlaylistAutoPlay) {
      if (get(state).hasNextIndexInPlaylist) {
        loadNextReactionInPlaylist();
      }
    }
    if (event.data === YT.PlayerState.ENDED && get(state).isQueueAutoPlay) {
      loadNextReactionInQueue();
    }
    if (event.data === YT.PlayerState.PLAYING) {
      if (!reactionVideoClicked) {
        // Same reasoning as original player: pause the emitting instance.
        event?.target?.pauseVideo?.();
        reactionVideoClicked = true;
      }
      const snapshot = get(state);
      if (!snapshot.bothVideosStarted) {
        if (originalVideoClicked && reactionVideoClicked) {
          startVideos();
        }
        // Do not start polling until both videos are explicitly started.
        return;
      }

      if (snapshot.playerReaction && snapshot.playerOriginal) {
        pollVideoCurrentTime();
      }
    }
  };

  const toggleAutoPlaylist = () => {
    const snapshot = get(state);
    const nextValue = !snapshot.isPlaylistAutoPlay;
    updateState({ isPlaylistAutoPlay: nextValue });
    writeAutoPlayCookie(nextValue, snapshot.playlistDocumentId);
  };

  const injectYoutubeIframeApiScript = () => {
    if (typeof document === 'undefined') {
      return;
    }
    const existingScript = document.querySelector(`script[src="${YOUTUBE_IFRAME_API_SRC}"]`);
    if (existingScript) {
      return;
    }
    const tag = document.createElement('script');
    tag.src = YOUTUBE_IFRAME_API_SRC;
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag?.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      document.head.appendChild(tag);
    }
  };

  const waitForYoutubeIframeApiReady = () => {
    if (typeof window === 'undefined') {
      return Promise.resolve();
    }

    if (window.YT && typeof window.YT.Player === 'function') {
      return Promise.resolve();
    }

    if (youtubeApiReadyPromise) {
      return youtubeApiReadyPromise;
    }

    youtubeApiReadyPromise = new Promise((resolve, reject) => {
      const previousCallback = (window as any).onYouTubeIframeAPIReady;
      let intervalId: ReturnType<typeof setInterval>;
      let timeoutId: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if ((window as any).onYouTubeIframeAPIReady === handleReady) {
          (window as any).onYouTubeIframeAPIReady = previousCallback;
        }
      };

      const resolveReady = () => {
        cleanup();
        resolve();
      };

      const handleReady = () => {
        if (typeof previousCallback === 'function') {
          previousCallback();
        }
        resolveReady();
      };

      (window as any).onYouTubeIframeAPIReady = handleReady;

      intervalId = setInterval(() => {
        if (window.YT && typeof window.YT.Player === 'function') {
          resolveReady();
        }
      }, 50);

      timeoutId = setTimeout(() => {
        cleanup();
        youtubeApiReadyPromise = null;
        reject(new Error('YouTube Iframe API failed to load.'));
      }, 10000);
    });

    return youtubeApiReadyPromise;
  };

  const setPlaylistData = async (playlistId: string | null | undefined, youtubePlaylistId?: string) => {
    if (!playlistId || !youtubePlaylistId) {
      updateState({ playlistItems: [], playlistDocument: undefined, hasNextIndexInPlaylist: false });
      return;
    }
    playlistFetchPromise = (async () => {
      const playlistItems = await fetchFirstPlaylistVideos(youtubePlaylistId);
      const playlistDocument = await getPlaylist(playlistId);
      const filteredItems = playlistItems.filter((item: any) => playlistDocument.originalVideoIds.includes(item.snippet.resourceId.videoId));
      const snapshot = get(state);
      const currentIndex = filteredItems.findIndex((item: any) => item.snippet.resourceId.videoId === snapshot.originalVideoId);
      updateState({
        playlistItems: filteredItems,
        playlistDocument,
        hasNextIndexInPlaylist: currentIndex < filteredItems.length - 1,
        currentIndexInPlaylist: currentIndex
      });
    })();
    await playlistFetchPromise;
  };

  const setPlaylistDocumentId = async (playlistDocumentId: string | null) => {
    updateState({ playlistDocumentId });
    const snapshot = get(state);
    await setPlaylistData(playlistDocumentId, snapshot.youtubePlaylistId);
  };

  const updateUIElements = (slugValue: string) => {
    updateState({ pageSlug: slugValue });
    if (typeof window !== 'undefined') {
      (window as any).currentReactionDocumentId = slugValue;
    }
  };

  const setUpVideos = async (reactionData: Record<string, any>) => {
    if (!reactionData) {
      setExpectedPlayerReadyCount(0);
      resetReactionDurationProbe();
      resetOriginalStateTracking();
      updateState({
        isReactionMissing: true,
        playerOriginal: null,
        playerReaction: null,
        reactionCurrentTime: 0,
        reactionDuration: 0,
        playerEventTimeline: [],
        isReactionMuteModeEnabled: false,
        isReactionAutoMuted: false
      });
      return;
    }

    const {
      playerConfigs,
      volumeConfigs,
      reactionVolumeConfigs,
      playbackRateConfigs,
      stateTimeline,
      volumeTimeline,
      reactionVolumeTimeline,
      playbackRateTimeline
    } = deriveTimelines(reactionData);

    window.playerConfigs = reactionData['stateTimeline'] || reactionData['reactionConfigs'];
    window.volumeConfigs = reactionData['volumeTimeline'] || reactionData['volumeConfigs'];
    (window as any).reactionVolumeConfigs = reactionData['reactionVolumeTimeline'] || reactionData['reactionVolumeConfigs'];
    window.playbackRateConfigs = reactionData['playbackTimeline'] || reactionData['playbackRateConfigs'];

    const normalizedPlayerEvents = buildPlayerEventTimeline(stateTimeline);

    const reactionVideoId = reactionData['reactionVideoId'];
    const originalVideoId = reactionData['originalVideoId'];
    if (!originalVideoId) {
      setExpectedPlayerReadyCount(0);
      resetReactionDurationProbe();
      resetOriginalStateTracking();
      updateState({
        isReactionMissing: true,
        reactionVideoId: reactionVideoId ?? '',
        originalVideoId: undefined,
        playerOriginal: null,
        playerReaction: null,
        reactionCurrentTime: 0,
        reactionDuration: 0,
        playerEventTimeline: [],
        isReactionMuteModeEnabled: Boolean(reactionData?.muteReactionWhileOriginalPlays),
        isReactionAutoMuted: false
      });
      return;
    }
    const youtubePlaylistId = reactionData['youtubePlaylistId'];
    const offsetStartTime = reactionData['offsetStartTime'] ?? 0;
    const reactionFinishTime = parseFloat(reactionData['reactionFinishTime']) || 100000;
    const timeOffset = reactionData['timeOffset'] || 0;
    const globalGainValue = reactionData['globalGain'];
    const globalGain = typeof globalGainValue === 'number' && !Number.isNaN(globalGainValue) ? globalGainValue : 1.0;
    const soundLevel = Math.max(0, Math.min(200, Math.round(globalGain * 100)));
    const currentPlaybackRate = getCurrentPlaybackRateFromConfigs(offsetStartTime || 0, window.playbackRateConfigs, timeOffset);

    const playerOriginal = get(state).playerOriginal;
    const playerReaction = get(state).playerReaction;
    playerOriginal?.destroy?.();
    playerReaction?.destroy?.();

    // Reset the click-to-start gate whenever we recreate players.
    originalVideoClicked = false;
    reactionVideoClicked = false;

    resetReactionDurationProbe();
    resetOriginalStateTracking();

    const expectedPlayers = 1 + (reactionVideoId ? 1 : 0);
    setExpectedPlayerReadyCount(expectedPlayers);

    let newPlayerReaction: any = null;
    let newPlayerOriginal: any = null;

    try {
      if (reactionVideoId) {
        newPlayerReaction = new YT.Player('player-reaction', {
          videoId: reactionVideoId,
          playerVars: playerOptions,
          ...iframeOptionDefault,
          events: {
            onReady: onPlayerReady,
            onStateChange: onStateChangeReaction
          }
        });
      }

      newPlayerOriginal = new YT.Player('player-original', {
        videoId: originalVideoId,
        playerVars: playerOptions,
        ...iframeOptionDefault,
        events: {
          onReady: onPlayerReady,
          onStateChange: onStateChangeOriginal
        }
      });
    } catch (error) {
      console.error('Failed to initialise YouTube players', error);
      finalizeLoadingState();
      return;
    }

    updateState({
      isPublished: reactionData.isPublished,
      isReactionMissing: !reactionVideoId,
      reactorId: reactionData['reactorId'],
      isUsersOwnVideo: reactionData['reactorId'] === userId,
      canShowEditModeButton: reactionData['reactorId'] === userId,
      playerConfigs,
      volumeConfigs,
      reactionVolumeConfigs,
      playbackRateConfigs,
      stateTimeline,
      volumeTimeline,
      reactionVolumeTimeline,
      playbackRateTimeline,
      playerEventTimeline: normalizedPlayerEvents,
      reactionVideoId,
      originalVideoId,
      reactionVideoAuthor: reactionData?.reactionVideoAuthor,
      reactionVideoTitle: reactionData?.reactionVideoTitle,
      originalVideoAuthor: reactionData?.originalVideoAuthor,
      originalVideoTitle: reactionData?.originalVideoTitle,
      youtubePlaylistId,
      offsetStartTime,
      reactionFinishTime,
      timeOffset,
      globalGain,
      introBufferTime: timeOffset,
      soundLevel,
      isReactionMuteModeEnabled: Boolean(reactionData?.muteReactionWhileOriginalPlays),
      isReactionAutoMuted: false,
      currentPlaybackRate,
      playerOriginal: newPlayerOriginal,
      playerReaction: newPlayerReaction,
      currentStateOriginalVideo: -1,
      currentVolumeOriginalVideo: 100,
      bothVideosStarted: false,
      reactionCurrentTime: offsetStartTime || 0,
      reactionDuration: typeof newPlayerReaction?.getDuration === 'function' ? Number(newPlayerReaction.getDuration()) || 0 : 0
    });

    enforceReactionMuteMode();

    await setPlaylistData(get(state).playlistDocumentId, youtubePlaylistId);

    await verifyAndSyncMetadata({
      documentId: typeof reactionData?.id === 'string' ? reactionData.id : undefined,
      originalVideoId,
      reactionVideoId,
      currentOriginalTitle: reactionData?.originalVideoTitle,
      currentOriginalAuthor: reactionData?.originalVideoAuthor,
      currentReactionTitle: reactionData?.reactionVideoTitle,
      currentReactionAuthor: reactionData?.reactionVideoAuthor
    });
  };

  const buildInterface = async (slugValue: string, { isUpdate = false }: { isUpdate?: boolean } = {}) => {
    if (isUpdate) {
      (window as any).currentReactionDocumentId = slugValue;
      const reaction = await getReaction(slugValue);
      await setUpVideos(reaction);
      updateUIElements(slugValue);
    } else {
      (window as any).currentReactionDocumentId = slugValue;
      const reaction = await getReaction(slugValue);
      await setUpVideos(reaction);
    }
  };

  const loadReactionInPlace = async (nextReactionDocumentId: string, options: LoadReactionInPlaceOptions = {}) => {
    if (!nextReactionDocumentId) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    await tick();
    injectYoutubeIframeApiScript();
    await waitForYoutubeIframeApiReady();

    const snapshotBefore = get(state);
    const preserveReactionTime = Boolean(options.preserveReactionTime);
    const previousReactionTime =
      preserveReactionTime && typeof snapshotBefore.playerReaction?.getCurrentTime === 'function'
        ? Number(snapshotBefore.playerReaction.getCurrentTime()) || 0
        : undefined;
    const previousReactionVideoId = snapshotBefore.reactionVideoId;

    if (!preserveReactionTime) {
      originalVideoClicked = false;
      reactionVideoClicked = false;
    }

    if (!snapshotBefore.playerOriginal || !document.getElementById('player-original')) {
      await buildInterface(nextReactionDocumentId, { isUpdate: true });
      updateUIElements(nextReactionDocumentId);
      return;
    }

    (window as any).currentReactionDocumentId = nextReactionDocumentId;
    const reactionData = await getReaction(nextReactionDocumentId);
    if (!reactionData) {
      await setUpVideos(reactionData);
      updateUIElements(nextReactionDocumentId);
      return;
    }

    const {
      playerConfigs,
      volumeConfigs,
      reactionVolumeConfigs,
      playbackRateConfigs,
      stateTimeline,
      volumeTimeline,
      reactionVolumeTimeline,
      playbackRateTimeline
    } = deriveTimelines(reactionData);

    window.playerConfigs = reactionData['stateTimeline'] || reactionData['reactionConfigs'];
    window.volumeConfigs = reactionData['volumeTimeline'] || reactionData['volumeConfigs'];
    (window as any).reactionVolumeConfigs = reactionData['reactionVolumeTimeline'] || reactionData['reactionVolumeConfigs'];
    window.playbackRateConfigs = reactionData['playbackTimeline'] || reactionData['playbackRateConfigs'];

    const normalizedPlayerEvents = buildPlayerEventTimeline(stateTimeline);

    const reactionVideoId = reactionData['reactionVideoId'] ?? '';
    const originalVideoId = reactionData['originalVideoId'];
    const youtubePlaylistId = reactionData['youtubePlaylistId'];

    const offsetStartTime = reactionData['offsetStartTime'] ?? 0;
    const reactionFinishTime = parseFloat(reactionData['reactionFinishTime']) || 100000;
    const timeOffset = reactionData['timeOffset'] || 0;
    const globalGainValue = reactionData['globalGain'];
    const globalGain = typeof globalGainValue === 'number' && !Number.isNaN(globalGainValue) ? globalGainValue : 1.0;
    const soundLevel = Math.max(0, Math.min(200, Math.round(globalGain * 100)));
    const currentPlaybackRate = getCurrentPlaybackRateFromConfigs(offsetStartTime || 0, window.playbackRateConfigs, timeOffset);

    const canReuseReactionPlayer =
      Boolean(snapshotBefore.playerReaction) &&
      Boolean(reactionVideoId) &&
      reactionVideoId === previousReactionVideoId &&
      Boolean(document.getElementById('player-reaction'));

    if (!canReuseReactionPlayer && snapshotBefore.playerReaction?.destroy) {
      snapshotBefore.playerReaction.destroy();
    }

    const shouldCreateReactionPlayer = Boolean(reactionVideoId) && !canReuseReactionPlayer;
    setExpectedPlayerReadyCount(shouldCreateReactionPlayer ? 1 : 0);

    let nextPlayerReaction: any = snapshotBefore.playerReaction;
    if (shouldCreateReactionPlayer) {
      try {
        nextPlayerReaction = new YT.Player('player-reaction', {
          videoId: reactionVideoId,
          playerVars: playerOptions,
          ...iframeOptionDefault,
          events: {
            onReady: onPlayerReady,
            onStateChange: onStateChangeReaction
          }
        });
      } catch (error) {
        console.error('Failed to initialise reaction YouTube player', error);
        nextPlayerReaction = null;
        setExpectedPlayerReadyCount(0);
      }
    }

    if (originalVideoId && typeof snapshotBefore.playerOriginal?.loadVideoById === 'function') {
      try {
        snapshotBefore.playerOriginal.loadVideoById(originalVideoId);
      } catch (error) {
        console.error('Failed to load original video by id', error);
      }
    }

    updateState({
      isPublished: reactionData.isPublished,
      isReactionMissing: !reactionVideoId,
      reactorId: reactionData['reactorId'],
      isUsersOwnVideo: reactionData['reactorId'] === userId,
      canShowEditModeButton: reactionData['reactorId'] === userId,
      playerConfigs,
      volumeConfigs,
      reactionVolumeConfigs,
      playbackRateConfigs,
      stateTimeline,
      volumeTimeline,
      reactionVolumeTimeline,
      playbackRateTimeline,
      playerEventTimeline: normalizedPlayerEvents,
      reactionVideoId,
      originalVideoId,
      reactionVideoAuthor: reactionData?.reactionVideoAuthor,
      reactionVideoTitle: reactionData?.reactionVideoTitle,
      originalVideoAuthor: reactionData?.originalVideoAuthor,
      originalVideoTitle: reactionData?.originalVideoTitle,
      youtubePlaylistId,
      offsetStartTime,
      reactionFinishTime,
      timeOffset,
      globalGain,
      introBufferTime: timeOffset,
      soundLevel,
      isReactionMuteModeEnabled: Boolean(reactionData?.muteReactionWhileOriginalPlays),
      isReactionAutoMuted: false,
      currentPlaybackRate,
      playerOriginal: snapshotBefore.playerOriginal,
      playerReaction: nextPlayerReaction,
      currentStateOriginalVideo: -1,
      currentVolumeOriginalVideo: 100,
      currentVolumeReactionVideo: 100,
      bothVideosStarted: preserveReactionTime ? snapshotBefore.bothVideosStarted : false,
      reactionCurrentTime: typeof previousReactionTime === 'number' ? previousReactionTime : offsetStartTime || 0,
      reactionDuration:
        typeof nextPlayerReaction?.getDuration === 'function' ? Number(nextPlayerReaction.getDuration()) || 0 : snapshotBefore.reactionDuration
    });

    enforceReactionMuteMode();
    await setPlaylistData(get(state).playlistDocumentId, youtubePlaylistId);

    if (!preserveReactionTime && canReuseReactionPlayer && typeof nextPlayerReaction?.seekTo === 'function') {
      try {
        nextPlayerReaction.seekTo(Number(offsetStartTime) || 0, true);
      } catch {
        // ignore
      }
    }

    if (typeof previousReactionTime === 'number' && typeof nextPlayerReaction?.seekTo === 'function' && !canReuseReactionPlayer) {
      try {
        nextPlayerReaction.seekTo(previousReactionTime, true);
      } catch {
        // ignore
      }
    }

    try {
      await tick();
      syncVideos();
    } catch {
      // ignore
    }

    updateUIElements(nextReactionDocumentId);

    await verifyAndSyncMetadata({
      documentId: typeof reactionData?.id === 'string' ? reactionData.id : undefined,
      originalVideoId,
      reactionVideoId,
      currentOriginalTitle: reactionData?.originalVideoTitle,
      currentOriginalAuthor: reactionData?.originalVideoAuthor,
      currentReactionTitle: reactionData?.reactionVideoTitle,
      currentReactionAuthor: reactionData?.reactionVideoAuthor
    });
  };

  const loadNextReactionInPlaylist = () => {
    const snapshot = get(state);
    const { hasNextIndexInPlaylist, playlistDocument, currentIndexInPlaylist, playlistItems } = snapshot;
    if (!hasNextIndexInPlaylist || !playlistDocument) {
      return;
    }
    const nextIndex = currentIndexInPlaylist + 1;
    const nextReactionDocumentId = playlistDocument.reactionBinomeIds[nextIndex];

    const isPlaylistPage = typeof window !== 'undefined' && window.location?.pathname?.startsWith('/playlist/');
    if (isPlaylistPage) {
      const nextOriginalVideoId = playlistDocument.originalVideoIds?.[nextIndex];
      loadReactionInPlace(nextReactionDocumentId, { preserveReactionTime: false }).then(() => {
        const updatedIndex = nextIndex;
        const hasNext = updatedIndex < playlistItems.length - 1;
        updateState({
          currentIndexInPlaylist: updatedIndex,
          hasNextIndexInPlaylist: hasNext
        });

        if (typeof nextOriginalVideoId === 'string' && typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('item', nextOriginalVideoId);
          window.history.pushState(window.history.state, '', url.toString());
        }

        originalVideoClicked = false;
        reactionVideoClicked = false;
      });
      return;
    }

    buildInterface(nextReactionDocumentId, { isUpdate: true }).then(() => {
      const updatedIndex = nextIndex;
      const hasNext = updatedIndex < playlistItems.length - 1;
      updateState({
        currentIndexInPlaylist: updatedIndex,
        hasNextIndexInPlaylist: hasNext
      });
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.pathname = `/reaction/${nextReactionDocumentId}`;
        window.history.pushState(window.history.state, '', url.toString());
      }
      originalVideoClicked = false;
      reactionVideoClicked = false;
      updateState({
        bothVideosStarted: false,
        currentStateOriginalVideo: -1,
        currentVolumeOriginalVideo: 100,
        reactionCurrentTime: 0,
        reactionDuration: 0
      });
    });
  };

  const getNextReactionIdInQueue = async (queueSlug: string, nextIndex: number) => {
    const queueDefinition = await getQueueBySlug(queueSlug);
    const items = Array.isArray(queueDefinition?.data?.items) ? queueDefinition.data.items : [];
    if (!items.length) {
      return null;
    }

    const queue: string[] = [];
    for (const item of items) {
      if (item?.type === 'reaction' && item?.id) {
        queue.push(item.id);
        continue;
      }
      if (item?.type === 'playlist' && item?.id) {
        const playlistDoc = await getPlaylist(item.id);
        const ids = Array.isArray(playlistDoc?.reactionBinomeIds) ? playlistDoc.reactionBinomeIds : [];
        ids.filter(Boolean).forEach((reactionId: string) => queue.push(reactionId));
      }
    }

    return typeof queue[nextIndex] === 'string' ? queue[nextIndex] : null;
  };

  const hasNextInQueue = async () => {
    const snapshot = get(state);
    if (!snapshot.queueSlug) return false;
    const nextIndex = (Number(snapshot.queueIndex) || 0) + 1;
    const nextId = await getNextReactionIdInQueue(snapshot.queueSlug, nextIndex);
    return Boolean(nextId);
  };

  const navigateToNextReactionInQueue = async () => {
    const snapshot = get(state);
    const queueSlug = snapshot.queueSlug;
    if (!queueSlug) {
      return { ok: false as const, reason: 'missing-queue' as const };
    }

    const nextIndex = (Number(snapshot.queueIndex) || 0) + 1;
    const nextReactionDocumentId = await getNextReactionIdInQueue(queueSlug, nextIndex);
    if (!nextReactionDocumentId) {
      return { ok: false as const, reason: 'end-of-queue' as const };
    }

    const url = new URL(typeof window !== 'undefined' ? window.location.href : 'https://purereactions.com');
    url.pathname = `/reaction/${nextReactionDocumentId}`;
    url.searchParams.set('queueSlug', queueSlug);
    url.searchParams.set('queueIndex', String(nextIndex));
    url.searchParams.set('queueReactionId', nextReactionDocumentId);
    url.searchParams.set('queueAutoPlay', 'true');
    url.searchParams.delete('isFullscreen');
    await goto(url.pathname + url.search);
    return { ok: true as const, reason: 'navigated' as const };
  };

  const loadNextReactionInQueue = () => {
    const snapshot = get(state);
    const queueSlug = snapshot.queueSlug;
    if (!snapshot.isQueueAutoPlay || !queueSlug) {
      return;
    }

    const nextIndex = (Number(snapshot.queueIndex) || 0) + 1;
    getNextReactionIdInQueue(queueSlug, nextIndex)
      .then((nextReactionDocumentId) => {
        if (!nextReactionDocumentId) {
          return;
        }

        buildInterface(nextReactionDocumentId, { isUpdate: true }).then(() => {
          updateState({ queueIndex: nextIndex });
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.pathname = `/reaction/${nextReactionDocumentId}`;
            url.searchParams.set('queueSlug', queueSlug);
            url.searchParams.set('queueIndex', String(nextIndex));
            url.searchParams.set('queueReactionId', nextReactionDocumentId);
            url.searchParams.set('queueAutoPlay', 'true');
            window.history.pushState(window.history.state, '', url.toString());
          }
          originalVideoClicked = false;
          reactionVideoClicked = false;
          updateState({
            bothVideosStarted: false,
            currentStateOriginalVideo: -1,
            currentVolumeOriginalVideo: 100,
            reactionCurrentTime: 0,
            reactionDuration: 0
          });
        });
      })
      .catch((error) => {
        console.error('Failed to load next reaction in queue', error);
      });
  };

  const getBasicDetailsReaction = async (videoId: string) => {
    const { videoAuthor, videoTitle } = await downloadBasicVideoDetails(videoId);
    return { videoAuthor, videoTitle };
  };

  const verifyVideoDetails = async ({
    videoId,
    currentTitle,
    currentAuthor,
    titleField,
    authorField
  }: VerifyVideoDetailsOptions): Promise<VerifyVideoDetailsResult> => {
    const result: VerifyVideoDetailsResult = {
      updates: {},
      title: typeof currentTitle === 'string' ? currentTitle : undefined,
      author: typeof currentAuthor === 'string' ? currentAuthor : undefined
    };

    if (!videoId) {
      return result;
    }

    try {
      const { videoAuthor, videoTitle } = await downloadBasicVideoDetails(videoId);
      const sanitizedTitle = typeof videoTitle === 'string' ? videoTitle.trim() : undefined;
      const sanitizedAuthor = typeof videoAuthor === 'string' ? videoAuthor.trim() : undefined;
      const storedTitle = typeof currentTitle === 'string' ? currentTitle.trim() : undefined;
      const storedAuthor = typeof currentAuthor === 'string' ? currentAuthor.trim() : undefined;

      if (sanitizedTitle) {
        result.title = sanitizedTitle;
        if (sanitizedTitle !== storedTitle) {
          result.updates[titleField] = sanitizedTitle;
        }
      }

      if (sanitizedAuthor) {
        result.author = sanitizedAuthor;
        if (sanitizedAuthor !== storedAuthor) {
          result.updates[authorField] = sanitizedAuthor;
        }
      }
    } catch (error) {
      console.error(`Failed to verify metadata for video ${videoId}`, error);
    }

    return result;
  };

  const verifyAndSyncMetadata = async ({
    documentId,
    originalVideoId,
    reactionVideoId,
    currentOriginalTitle,
    currentOriginalAuthor,
    currentReactionTitle,
    currentReactionAuthor
  }: VerifyAndSyncMetadataParams) => {
    const resolvedDocumentId =
      documentId ?? (typeof window !== 'undefined' ? (window as any)?.currentReactionDocumentId : undefined);

    if (!resolvedDocumentId) {
      return;
    }

    const [originalVerification, reactionVerification] = await Promise.all([
      verifyVideoDetails({
        videoId: originalVideoId,
        currentTitle: currentOriginalTitle,
        currentAuthor: currentOriginalAuthor,
        titleField: 'originalVideoTitle',
        authorField: 'originalVideoAuthor'
      }),
      verifyVideoDetails({
        videoId: reactionVideoId,
        currentTitle: currentReactionTitle,
        currentAuthor: currentReactionAuthor,
        titleField: 'reactionVideoTitle',
        authorField: 'reactionVideoAuthor'
      })
    ]);

    const metadataUpdates: Record<string, string> = {
      ...originalVerification.updates,
      ...reactionVerification.updates
    };

    if (Object.keys(metadataUpdates).length > 0) {
      try {
        await updateFirebaseDocument(metadataUpdates, resolvedDocumentId);
      } catch (error) {
        console.error('Failed to update reaction metadata in Firestore', error);
      }
    }

    const snapshot = get(state);
    if (snapshot.pageSlug !== resolvedDocumentId) {
      return;
    }

    const partialUpdate: Partial<TwinPlayersState> = {};
    const normalizedOriginalTitle = typeof currentOriginalTitle === 'string' ? currentOriginalTitle.trim() : undefined;
    const normalizedOriginalAuthor = typeof currentOriginalAuthor === 'string' ? currentOriginalAuthor.trim() : undefined;
    const normalizedReactionTitle = typeof currentReactionTitle === 'string' ? currentReactionTitle.trim() : undefined;
    const normalizedReactionAuthor = typeof currentReactionAuthor === 'string' ? currentReactionAuthor.trim() : undefined;

    const nextOriginalTitle = typeof originalVerification.title === 'string' ? originalVerification.title.trim() : undefined;
    if (nextOriginalTitle && nextOriginalTitle !== normalizedOriginalTitle) {
      partialUpdate.originalVideoTitle = nextOriginalTitle;
    }

    const nextOriginalAuthor = typeof originalVerification.author === 'string' ? originalVerification.author.trim() : undefined;
    if (nextOriginalAuthor && nextOriginalAuthor !== normalizedOriginalAuthor) {
      partialUpdate.originalVideoAuthor = nextOriginalAuthor;
    }

    const nextReactionTitle = typeof reactionVerification.title === 'string' ? reactionVerification.title.trim() : undefined;
    if (nextReactionTitle && nextReactionTitle !== normalizedReactionTitle) {
      partialUpdate.reactionVideoTitle = nextReactionTitle;
    }

    const nextReactionAuthor = typeof reactionVerification.author === 'string' ? reactionVerification.author.trim() : undefined;
    if (nextReactionAuthor && nextReactionAuthor !== normalizedReactionAuthor) {
      partialUpdate.reactionVideoAuthor = nextReactionAuthor;
    }

    if (Object.keys(partialUpdate).length > 0) {
      updateState(partialUpdate);
    }
  };

  const setReactionVideoId = async (value: string) => {
    const cleanedId = extractYouTubeVideoId(value);
    const { videoAuthor, videoTitle } = await getBasicDetailsReaction(cleanedId);
    await updateFirebaseDocument({
      reactionVideoId: cleanedId,
      reactionVideoAuthor: videoAuthor,
      reactionVideoTitle: videoTitle
    });
    updateState({
      reactionVideoId: cleanedId,
      reactionVideoAuthor: videoAuthor,
      reactionVideoTitle: videoTitle
    });
  };

  const setOffsetStartTime = async (value: number) => {
    const parsed = Math.max(0, Math.floor(Number(value)));
    if (!Number.isFinite(parsed)) {
      return;
    }
    await updateFirebaseDocument({ offsetStartTime: parsed });
    updateState({ offsetStartTime: parsed, reactionCurrentTime: parsed });
  };

  const setIntroBufferTime = async (value: number) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }
    await updateFirebaseDocument({ timeOffset: parsed });
    updateState({ timeOffset: parsed, introBufferTime: parsed });
  };

  const setReactionFinishTime = async (value: number) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }
    const snapshot = get(state);
    if (!snapshot.youtubePlaylistId) {
      return;
    }
    await updateFirebaseDocument({ reactionFinishTime: parsed });
    updateState({ reactionFinishTime: parsed });
  };

  const setSoundLevel = async (value: number) => {
    const gain = Number(value) / 100;
    await updateFirebaseDocument({ globalGain: Number.isNaN(gain) ? 1.0 : gain });
    updateState({ globalGain: Number.isNaN(gain) ? 1.0 : gain, soundLevel: value });
  };

  const setReactionMuteMode = async (value: boolean) => {
    const nextValue = Boolean(value);
    await updateFirebaseDocument({ muteReactionWhileOriginalPlays: nextValue });
    updateState({ isReactionMuteModeEnabled: nextValue });
    enforceReactionMuteMode();
  };

  const roundReactionTime = (value: number) => Math.round(value * 10) / 10;
  const roundTargetTime = (value: number) => Math.round(value * 100) / 100;

  const roundVolume = (value: number) => Math.round(Math.min(Math.max(value, 0), 100));
  const roundPlaybackRate = (value: number) => Math.round(value * 100) / 100;

  const timelineArrayToMap = (timeline: any[] = []) => {
    const map = new Map<string, { t: number; state: number; targetTime: number }>();
    for (const entry of timeline) {
      if (!entry) continue;
      const rawReactionTime = Number(entry?.t);
      if (!Number.isFinite(rawReactionTime)) continue;
      const roundedReactionTime = roundReactionTime(Math.max(0, rawReactionTime));
      const rawStateValue = Number(entry?.state);
      const sanitizedState = Number.isFinite(rawStateValue) ? rawStateValue : 2;
      const rawTarget = Number(entry?.targetTime ?? entry?.time);
      const sanitizedTarget = Number.isFinite(rawTarget) ? Math.max(0, rawTarget) : 0;
      const roundedTarget = roundTargetTime(sanitizedTarget);
      map.set(roundedReactionTime.toFixed(3), {
        t: roundedReactionTime,
        state: sanitizedState,
        targetTime: roundedTarget
      });
    }
    return map;
  };

  const persistPlayerTimelineMap = async (
    map: Map<string, { t: number; state: number; targetTime: number }>
  ) => {
    const normalizedTimeline = Array.from(map.values()).sort((a, b) => a.t - b.t);
    const nextPlayerConfigs = Object.fromEntries(
      normalizedTimeline.map((entry) => [
        Number(entry.t).toFixed(1),
        {
          state: Number(entry.state),
          time: Number(entry.targetTime ?? 0).toFixed(2)
        }
      ])
    );

    await updateFirebaseDocument({
      stateTimeline: normalizedTimeline.map((entry) => ({
        t: Number(entry.t),
        state: Number(entry.state),
        targetTime: Number(entry.targetTime ?? 0)
      })),
      reactionConfigs: nextPlayerConfigs
    });

    if (typeof window !== 'undefined') {
      (window as any).playerConfigs = normalizedTimeline;
    }

    updateState({
      stateTimeline: normalizedTimeline,
      playerConfigs: nextPlayerConfigs,
      playerEventTimeline: buildPlayerEventTimeline(normalizedTimeline)
    });
  };

  const volumeTimelineArrayToMap = (timeline: any[] = []) => {
    const map = new Map<string, { t: number; volume: number }>();
    for (const entry of timeline) {
      if (!entry) continue;
      const rawReactionTime = Number(entry?.t);
      if (!Number.isFinite(rawReactionTime)) continue;
      const roundedReactionTime = roundReactionTime(Math.max(0, rawReactionTime));
      const rawVolumeValue = Number(entry?.volume ?? entry?.value);
      const sanitizedVolume = Number.isFinite(rawVolumeValue) ? roundVolume(rawVolumeValue) : 100;
      map.set(roundedReactionTime.toFixed(3), {
        t: roundedReactionTime,
        volume: sanitizedVolume
      });
    }
    return map;
  };

  const persistVolumeTimelineMap = async (map: Map<string, { t: number; volume: number }>) => {
    const normalizedTimeline = Array.from(map.values()).sort((a, b) => a.t - b.t);
    const nextVolumeConfigs = Object.fromEntries(
      normalizedTimeline.map((entry) => [
        Number(entry.t).toFixed(1),
        {
          volume: roundVolume(Number(entry.volume ?? 100))
        }
      ])
    );

    await updateFirebaseDocument({
      volumeTimeline: normalizedTimeline.map((entry) => ({
        t: Number(entry.t),
        volume: roundVolume(Number(entry.volume ?? 100))
      })),
      volumeConfigs: nextVolumeConfigs
    });

    if (typeof window !== 'undefined') {
      (window as any).volumeConfigs = normalizedTimeline;
    }

    updateState({
      volumeTimeline: normalizedTimeline,
      volumeConfigs: nextVolumeConfigs
    });
  };

  const persistReactionVolumeTimelineMap = async (map: Map<string, { t: number; volume: number }>) => {
    const normalizedTimeline = Array.from(map.values()).sort((a, b) => a.t - b.t);
    const nextVolumeConfigs = Object.fromEntries(
      normalizedTimeline.map((entry) => [
        Number(entry.t).toFixed(1),
        {
          volume: roundVolume(Number(entry.volume ?? 100))
        }
      ])
    );

    await updateFirebaseDocument({
      reactionVolumeTimeline: normalizedTimeline.map((entry) => ({
        t: Number(entry.t),
        volume: roundVolume(Number(entry.volume ?? 100))
      })),
      reactionVolumeConfigs: nextVolumeConfigs
    });

    if (typeof window !== 'undefined') {
      (window as any).reactionVolumeConfigs = normalizedTimeline;
    }

    updateState({
      reactionVolumeTimeline: normalizedTimeline,
      reactionVolumeConfigs: nextVolumeConfigs
    });
  };

  const playbackTimelineArrayToMap = (timeline: any[] = []) => {
    const map = new Map<string, { t: number; rate: number }>();
    for (const entry of timeline) {
      if (!entry) continue;
      const rawReactionTime = Number(entry?.t);
      if (!Number.isFinite(rawReactionTime)) continue;
      const roundedReactionTime = roundReactionTime(Math.max(0, rawReactionTime));
      const rawRateValue = Number(entry?.rate ?? entry?.value);
      const sanitizedRate =
        Number.isFinite(rawRateValue) && rawRateValue > 0 ? roundPlaybackRate(rawRateValue) : 1;
      map.set(roundedReactionTime.toFixed(3), {
        t: roundedReactionTime,
        rate: sanitizedRate
      });
    }
    return map;
  };

  const persistPlaybackTimelineMap = async (map: Map<string, { t: number; rate: number }>) => {
    const normalizedTimeline = Array.from(map.values()).sort((a, b) => a.t - b.t);
    const nextPlaybackRateConfigs = Object.fromEntries(
      normalizedTimeline.map((entry) => [
        Number(entry.t).toFixed(1),
        {
          rate: roundPlaybackRate(Number(entry.rate ?? 1))
        }
      ])
    );

    await updateFirebaseDocument({
      playbackTimeline: normalizedTimeline.map((entry) => ({
        t: Number(entry.t),
        rate: roundPlaybackRate(Number(entry.rate ?? 1))
      })),
      playbackRateConfigs: nextPlaybackRateConfigs
    });

    if (typeof window !== 'undefined') {
      (window as any).playbackRateConfigs = normalizedTimeline;
    }

    updateState({
      playbackRateTimeline: normalizedTimeline,
      playbackRateConfigs: nextPlaybackRateConfigs
    });
  };

  const createPlayerConfig = async ({ timeInReaction, targetTime, state: rawState }: CreatePlayerConfigParams) => {
    const snapshot = get(state);
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const sanitizedTargetTime = Number.isFinite(targetTime) ? Math.max(0, targetTime) : 0;
    const sanitizedState = Number.isFinite(rawState) ? rawState : 2;

    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const roundedTargetTime = roundTargetTime(sanitizedTargetTime);

    const existingTimeline = Array.isArray(snapshot.stateTimeline) ? snapshot.stateTimeline : [];
    const timelineMap = timelineArrayToMap(existingTimeline);
    timelineMap.set(roundedReactionTime.toFixed(3), {
      t: roundedReactionTime,
      state: sanitizedState,
      targetTime: roundedTargetTime
    });

    try {
      await persistPlayerTimelineMap(timelineMap);
    } catch (error) {
      console.error('Failed to create player config', error);
      throw error;
    }
  };

  const createVolumeConfig = async ({ timeInReaction, volume }: CreateVolumeConfigParams) => {
    const snapshot = get(state);
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const roundedVolume = roundVolume(Number.isFinite(volume) ? volume : 100);

    const existingTimeline = Array.isArray(snapshot.volumeTimeline) ? snapshot.volumeTimeline : [];
    const timelineMap = volumeTimelineArrayToMap(existingTimeline);
    timelineMap.set(roundedReactionTime.toFixed(3), {
      t: roundedReactionTime,
      volume: roundedVolume
    });

    try {
      await persistVolumeTimelineMap(timelineMap);
    } catch (error) {
      console.error('Failed to create volume config', error);
      throw error;
    }
  };

  const createReactionVolumeConfig = async ({ timeInReaction, volume }: CreateReactionVolumeConfigParams) => {
    const snapshot = get(state);
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const roundedVolume = roundVolume(Number.isFinite(volume) ? volume : 100);

    const existingTimeline = Array.isArray(snapshot.reactionVolumeTimeline) ? snapshot.reactionVolumeTimeline : [];
    const timelineMap = volumeTimelineArrayToMap(existingTimeline);
    timelineMap.set(roundedReactionTime.toFixed(3), {
      t: roundedReactionTime,
      volume: roundedVolume
    });

    try {
      await persistReactionVolumeTimelineMap(timelineMap);
    } catch (error) {
      console.error('Failed to create reaction volume config', error);
      throw error;
    }
  };

  const createPlaybackRateConfig = async ({ timeInReaction, rate }: CreatePlaybackRateConfigParams) => {
    const snapshot = get(state);
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
    const roundedRate = roundPlaybackRate(sanitizedRate);

    const existingTimeline = Array.isArray(snapshot.playbackRateTimeline) ? snapshot.playbackRateTimeline : [];
    const timelineMap = playbackTimelineArrayToMap(existingTimeline);
    timelineMap.set(roundedReactionTime.toFixed(3), {
      t: roundedReactionTime,
      rate: roundedRate
    });

    try {
      await persistPlaybackTimelineMap(timelineMap);
    } catch (error) {
      console.error('Failed to create playback rate config', error);
      throw error;
    }
  };

  const updatePlayerConfig = async ({
    timeInReaction,
    targetTime,
    state: rawState,
    previousTimeInReaction
  }: UpdatePlayerConfigParams) => {
    const snapshot = get(state);
    const existingTimeline = Array.isArray(snapshot.stateTimeline) ? snapshot.stateTimeline : [];
    const timelineMap = timelineArrayToMap(existingTimeline);

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedPreviousTime =
      typeof previousTimeInReaction === 'number' && Number.isFinite(previousTimeInReaction)
        ? Math.max(0, previousTimeInReaction)
        : sanitizedReactionTime;
    const roundedPreviousTime = roundReactionTime(sanitizedPreviousTime);
    const previousKey = roundedPreviousTime.toFixed(3);
    const nextKey = roundedReactionTime.toFixed(3);

    const currentEntry = timelineMap.get(previousKey);
    if (!currentEntry) {
      return;
    }

    const resolvedState =
      typeof rawState === 'number' && Number.isFinite(rawState)
        ? rawState
        : Number(currentEntry?.state ?? 2);
    const resolvedTarget =
      typeof targetTime === 'number' && Number.isFinite(targetTime)
        ? Math.max(0, targetTime)
        : Number(currentEntry?.targetTime ?? 0);
    const roundedTargetTime = roundTargetTime(resolvedTarget);

    if (nextKey !== previousKey) {
      timelineMap.delete(previousKey);
    }

    timelineMap.set(nextKey, {
      t: roundedReactionTime,
      state: resolvedState,
      targetTime: roundedTargetTime
    });

    try {
      await persistPlayerTimelineMap(timelineMap);
    } catch (error) {
      console.error('Failed to update player config', error);
      throw error;
    }
  };

  const deletePlayerConfig = async ({ timeInReaction }: DeletePlayerConfigParams) => {
    const snapshot = get(state);
    const existingTimeline = Array.isArray(snapshot.stateTimeline) ? snapshot.stateTimeline : [];
    const timelineMap = timelineArrayToMap(existingTimeline);

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const key = roundReactionTime(sanitizedReactionTime).toFixed(3);

    if (!timelineMap.has(key)) {
      return;
    }

    timelineMap.delete(key);

    try {
      await persistPlayerTimelineMap(timelineMap);
    } catch (error) {
      console.error('Failed to delete player config', error);
      throw error;
    }
  };

  const updateVolumeConfig = async ({ timeInReaction, volume, previousTimeInReaction }: UpdateVolumeConfigParams) => {
    const snapshot = get(state);
    const existingTimeline = Array.isArray(snapshot.volumeTimeline) ? snapshot.volumeTimeline : [];
    const timelineMap = volumeTimelineArrayToMap(existingTimeline);

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedPreviousTime =
      typeof previousTimeInReaction === 'number' && Number.isFinite(previousTimeInReaction)
        ? Math.max(0, previousTimeInReaction)
        : sanitizedReactionTime;
    const roundedPreviousTime = roundReactionTime(sanitizedPreviousTime);
    const previousKey = roundedPreviousTime.toFixed(3);
    const nextKey = roundedReactionTime.toFixed(3);

    const currentEntry = timelineMap.get(previousKey);
    if (!currentEntry) {
      return;
    }

    const resolvedVolume =
      typeof volume === 'number' && Number.isFinite(volume)
        ? volume
        : Number(currentEntry?.volume ?? 100);
    const roundedVolume = roundVolume(resolvedVolume);

    if (nextKey !== previousKey) {
      timelineMap.delete(previousKey);
    }

    timelineMap.set(nextKey, {
      t: roundedReactionTime,
      volume: roundedVolume
    });

    try {
      await persistVolumeTimelineMap(timelineMap);
    } catch (error) {
      console.error('Failed to update volume config', error);
      throw error;
    }
  };

  const updateReactionVolumeConfig = async ({
    timeInReaction,
    volume,
    previousTimeInReaction
  }: UpdateReactionVolumeConfigParams) => {
    const snapshot = get(state);
    const existingTimeline = Array.isArray(snapshot.reactionVolumeTimeline) ? snapshot.reactionVolumeTimeline : [];
    const timelineMap = volumeTimelineArrayToMap(existingTimeline);

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedPreviousTime =
      typeof previousTimeInReaction === 'number' && Number.isFinite(previousTimeInReaction)
        ? Math.max(0, previousTimeInReaction)
        : sanitizedReactionTime;
    const roundedPreviousTime = roundReactionTime(sanitizedPreviousTime);
    const previousKey = roundedPreviousTime.toFixed(3);
    const nextKey = roundedReactionTime.toFixed(3);

    const currentEntry = timelineMap.get(previousKey);
    if (!currentEntry) {
      return;
    }

    const resolvedVolume =
      typeof volume === 'number' && Number.isFinite(volume)
        ? volume
        : Number(currentEntry?.volume ?? 100);
    const roundedVolume = roundVolume(resolvedVolume);

    if (nextKey !== previousKey) {
      timelineMap.delete(previousKey);
    }

    timelineMap.set(nextKey, {
      t: roundedReactionTime,
      volume: roundedVolume
    });

    try {
      await persistReactionVolumeTimelineMap(timelineMap);
    } catch (error) {
      console.error('Failed to update reaction volume config', error);
      throw error;
    }
  };

  const deleteVolumeConfig = async ({ timeInReaction }: DeleteVolumeConfigParams) => {
    const snapshot = get(state);
    const existingTimeline = Array.isArray(snapshot.volumeTimeline) ? snapshot.volumeTimeline : [];
    const timelineMap = volumeTimelineArrayToMap(existingTimeline);

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const key = roundReactionTime(sanitizedReactionTime).toFixed(3);

    if (!timelineMap.has(key)) {
      return;
    }

    timelineMap.delete(key);

    try {
      await persistVolumeTimelineMap(timelineMap);
    } catch (error) {
      console.error('Failed to delete volume config', error);
      throw error;
    }
  };

  const deleteReactionVolumeConfig = async ({ timeInReaction }: DeleteReactionVolumeConfigParams) => {
    const snapshot = get(state);
    const existingTimeline = Array.isArray(snapshot.reactionVolumeTimeline) ? snapshot.reactionVolumeTimeline : [];
    const timelineMap = volumeTimelineArrayToMap(existingTimeline);

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const key = roundReactionTime(sanitizedReactionTime).toFixed(3);

    if (!timelineMap.has(key)) {
      return;
    }

    timelineMap.delete(key);

    try {
      await persistReactionVolumeTimelineMap(timelineMap);
    } catch (error) {
      console.error('Failed to delete reaction volume config', error);
      throw error;
    }
  };

  const updatePlaybackRateConfig = async ({
    timeInReaction,
    rate,
    previousTimeInReaction
  }: UpdatePlaybackRateConfigParams) => {
    const snapshot = get(state);
    const existingTimeline = Array.isArray(snapshot.playbackRateTimeline) ? snapshot.playbackRateTimeline : [];
    const timelineMap = playbackTimelineArrayToMap(existingTimeline);

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedPreviousTime =
      typeof previousTimeInReaction === 'number' && Number.isFinite(previousTimeInReaction)
        ? Math.max(0, previousTimeInReaction)
        : sanitizedReactionTime;
    const roundedPreviousTime = roundReactionTime(sanitizedPreviousTime);
    const previousKey = roundedPreviousTime.toFixed(3);
    const nextKey = roundedReactionTime.toFixed(3);

    const currentEntry = timelineMap.get(previousKey);
    if (!currentEntry) {
      return;
    }

    const resolvedRate =
      typeof rate === 'number' && Number.isFinite(rate) && rate > 0
        ? rate
        : Number(currentEntry?.rate ?? 1);
    const roundedRate = roundPlaybackRate(resolvedRate);

    if (nextKey !== previousKey) {
      timelineMap.delete(previousKey);
    }

    timelineMap.set(nextKey, {
      t: roundedReactionTime,
      rate: roundedRate
    });

    try {
      await persistPlaybackTimelineMap(timelineMap);
    } catch (error) {
      console.error('Failed to update playback rate config', error);
      throw error;
    }
  };

  const deletePlaybackRateConfig = async ({ timeInReaction }: DeletePlaybackRateConfigParams) => {
    const snapshot = get(state);
    const existingTimeline = Array.isArray(snapshot.playbackRateTimeline) ? snapshot.playbackRateTimeline : [];
    const timelineMap = playbackTimelineArrayToMap(existingTimeline);

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const key = roundReactionTime(sanitizedReactionTime).toFixed(3);

    if (!timelineMap.has(key)) {
      return;
    }

    timelineMap.delete(key);

    try {
      await persistPlaybackTimelineMap(timelineMap);
    } catch (error) {
      console.error('Failed to delete playback rate config', error);
      throw error;
    }
  };

  const setIsPublished = async () => {
    await updateFirebaseDocument({ isPublished: true });
    if (typeof location !== 'undefined') {
      location.reload();
    }
  };

  const setIsUnpublished = async () => {
    await updateFirebaseDocument({ isPublished: false });
    if (typeof location !== 'undefined') {
      location.reload();
    }
  };

  const enterEditMode = () => {
    updateState({ canShowCloseEditModeButton: true, isEditModeOn: true, canShowEditModeButton: false });
  };

  const closeEditMode = () => {
    updateState({ isEditModeOn: false, canShowEditModeButton: true, canShowCloseEditModeButton: false });
  };

  const toggleFineTuneMode = () => {
    const snapshot = get(state);
    updateState({ isFineTuneModeOn: !snapshot.isFineTuneModeOn });
  };

  const toggleCinematicBars = () => {
    const snapshot = get(state);
    updateState({ showCinematicBars: !snapshot.showCinematicBars });
  };

  const handlePlayStateChange = (isPlaying: boolean) => {
    if (isPlaying) {
      const snapshot = get(state);
      if (!snapshot.bothVideosStarted) {
        goToSecondsInReactionVideo(snapshot.offsetStartTime || 0);
        setPlaybackRateForOriginalVideo(snapshot.currentPlaybackRate);
        updateState({ bothVideosStarted: true });
      }
      startReactionVideo();
      handleStateChangeInReactionVideo(YT.PlayerState.PAUSED, YT.PlayerState.PLAYING);
      return;
    }

    pauseOriginalVideo();
    pauseReactionVideo();
  };

  const syncVideos = () => {
    const snapshot = get(state);
    if (!snapshot.bothVideosStarted) {
      goToSecondsInReactionVideo(snapshot.offsetStartTime || 0);
      setPlaybackRateForOriginalVideo(snapshot.currentPlaybackRate);
      updateState({ bothVideosStarted: true });
    }
    pauseOriginalVideo();
    pauseReactionVideo();
    startReactionVideo();
    handleStateChangeInReactionVideo(YT.PlayerState.PAUSED, YT.PlayerState.PLAYING);
  };

  const showControls = () => {
    clearTimeout(controlHideTimeout);
    updateState({ isControlSurfaceVisible: true });
  };

  const collapseExitButton = (force = false) => {
    clearTimeout(exitButtonCollapseTimeout);
    if (force) {
      updateState({ isExitButtonExpanded: false });
      return;
    }
    exitButtonCollapseTimeout = setTimeout(() => {
      updateState({ isExitButtonExpanded: false });
    }, 120);
  };

  const scheduleHideControls = () => {
    clearTimeout(controlHideTimeout);
    const snapshot = get(state);
    if (!snapshot.isFullscreen) {
      updateState({ isControlSurfaceVisible: false, isExitButtonExpanded: false });
      return;
    }
    controlHideTimeout = setTimeout(() => {
      updateState({ isControlSurfaceVisible: false, isExitButtonExpanded: false });
    }, 3000);
  };

  const handleFullscreenMouseMove = () => {
    if (!get(state).isFullscreen) {
      return;
    }
    showControls();
    scheduleHideControls();
  };

  const temporarilyDisableOverlayPointerEvents = () => {
    if (!overlayElement) {
      return;
    }
    overlayElement.style.pointerEvents = 'none';
    clearTimeout(overlayPointerRestoreTimeout);
    overlayPointerRestoreTimeout = setTimeout(() => {
      if (overlayElement) {
        overlayElement.style.pointerEvents = 'auto';
      }
      overlayPointerRestoreTimeout = undefined;
    }, 1500);
  };

  const handleFullscreenPointerMove = () => {
    handleFullscreenMouseMove();
  };

  const handleFullscreenPointerDown = () => {
    handleFullscreenMouseMove();
    temporarilyDisableOverlayPointerEvents();
  };

  const expandExitButton = () => {
    clearTimeout(exitButtonCollapseTimeout);
    updateState({ isExitButtonExpanded: true });
  };

  const handleExitButtonEnter = () => {
    showControls();
    expandExitButton();
  };

  const handleExitButtonLeave = () => {
    scheduleHideControls();
    collapseExitButton();
  };

  const setVideoScene = (value: boolean) => {
    if (typeof window === 'undefined') {
      return;
    }
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    params.set('isFullscreen', String(value));
    url.search = params.toString();
    window.location.href = url.toString();
  };

  const openWithFullscreen = () => {
    setVideoScene(true);
  };

  const openWithHalfscreen = () => {
    setVideoScene(false);
  };

  const handleExitFullscreenClick = () => {
    openWithHalfscreen();
    updateState({ isControlSurfaceVisible: false });
    clearTimeout(controlHideTimeout);
    collapseExitButton(true);
  };

  const editActionEntryPoint = async (callback: () => Promise<void>) => {
    await callback();
    await setIsUnpublished();
  };

  const handleSlugChange = async (nextSlug: string) => {
    const snapshot = get(state);
    if (nextSlug === snapshot.pageSlug) {
      return;
    }
    updateState({ pageSlug: nextSlug });
    await buildInterface(nextSlug, { isUpdate: false });
  };

  const registerOverlayRef = (element: HTMLDivElement | undefined) => {
    overlayElement = element;
  };

  onMount(() => {
    const isAutoPlay = readAutoPlayCookie();
    updateState({ isPlaylistAutoPlay: isAutoPlay });

    escListener = (event: KeyboardEvent) => {
      if (get(state).isFullscreen && event.key === 'Escape') {
        event.preventDefault();
        openWithHalfscreen();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', escListener);
      window.addEventListener('mousemove', handleFullscreenMouseMove);
    }

    if (get(state).isFullscreen) {
      showControls();
      scheduleHideControls();
    }

    const init = async () => {
      try {
        await tick();
        injectYoutubeIframeApiScript();
        await waitForYoutubeIframeApiReady();
        if (!document.getElementById('player-original')) {
          console.warn('Player element not found, skipping initialization');
          return;
        }
        const initialSlug = get(state).pageSlug;
        if (!initialSlug) {
          finalizeLoadingState();
          return;
        }
        await buildInterface(initialSlug);
      } catch (error) {
        console.error('Failed to initialize reaction player:', error);
      }
    };

    init();
  });

  onDestroy(() => {
    // Ensure embedded YouTube players are torn down when leaving the route.
    // Without this, client-side navigation from edit -> reaction can leave behind
    // active player instances and cause inconsistent start/sync behavior.
    try {
      const snapshot = get(state);
      snapshot.playerOriginal?.destroy?.();
      snapshot.playerReaction?.destroy?.();
    } catch (error) {
      console.warn('Failed to destroy YouTube players on teardown', error);
    }

    if (typeof document !== 'undefined') {
      document.body.classList.remove('reaction-fullscreen');
    }
    if (typeof window !== 'undefined') {
      if (escListener) {
        window.removeEventListener('keydown', escListener);
      }
      window.removeEventListener('mousemove', handleFullscreenMouseMove);
    }
    clearTimeout(controlHideTimeout);
    clearTimeout(overlayPointerRestoreTimeout ?? undefined);
    clearTimeout(exitButtonCollapseTimeout);
    clearTimeout(playerReadyTimeout);
    clearInterval(pollInterval);
    resetReactionDurationProbe();
    resetOriginalStateTracking();
    if (overlayElement) {
      overlayElement.style.pointerEvents = 'auto';
    }
  });

  return {
    state,
    actions: {
      hasNextInQueue,
      navigateToNextReactionInQueue,
      toggleAutoPlaylist,
      toggleCinematicBars,
      handlePlayStateChange,
      syncVideos,
      showControls,
      scheduleHideControls,
      handleFullscreenPointerMove,
      handleFullscreenPointerDown,
      handleExitButtonEnter,
      handleExitButtonLeave,
      handleExitFullscreenClick,
      enterEditMode,
      closeEditMode,
      toggleFineTuneMode,
      setReactionVideoId,
      setOffsetStartTime,
      seekTo: goToSecondsInReactionVideo,
      setIntroBufferTime,
      setReactionFinishTime,
      setSoundLevel,
      setReactionMuteMode,
      createPlayerConfig,
      createVolumeConfig,
      createReactionVolumeConfig,
      createPlaybackRateConfig,
      updatePlayerConfig,
      deletePlayerConfig,
      updateVolumeConfig,
      deleteVolumeConfig,
      updateReactionVolumeConfig,
      deleteReactionVolumeConfig,
      updatePlaybackRateConfig,
      deletePlaybackRateConfig,
      setIsPublished,
      setIsUnpublished,
      openWithFullscreen,
      openWithHalfscreen,
      editActionEntryPoint,
      handleSlugChange,
      loadReactionInPlace,
      setPlaylistDocumentId,
      registerOverlayRef
    }
  };
}

function getInitialUrlState() {
  if (typeof window === 'undefined') {
    return {
      isFullscreen: false,
      playlistId: null as string | null,
      queueSlug: null as string | null,
      queueIndex: null as number | null,
      queueAutoPlay: false
    };
  }
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  const queueSlug = params.get('queueSlug');
  const queueIndexRaw = params.get('queueIndex');
  const queueAutoPlayRaw = params.get('queueAutoPlay');
  return {
    isFullscreen: params.get('isFullscreen') === 'true',
    playlistId: params.get('playlistId'),
    queueSlug,
    queueIndex: queueIndexRaw ? Number(queueIndexRaw) : null,
    queueAutoPlay: queueAutoPlayRaw === 'true'
  };
}
