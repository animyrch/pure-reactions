import { onDestroy, onMount, tick } from 'svelte';
import { env } from '$env/dynamic/public';
import { get } from 'svelte/store';
import {
  readAutoPlayCookie,
  readCinematicBarsCookie,
  toggleFullscreenBodyClass,
  writeCinematicBarsCookie
} from '$lib/helpers/reactionPlayer';
import {
  verifyAndSyncTwinPlayersMetadata,
  type VerifyAndSyncTwinPlayersMetadataParams
} from '$lib/helpers/twinPlayersMetadata';
import { createTikTokOriginalPlayerAdapter } from '$lib/helpers/twinPlayersTikTokOriginal';
import {
  injectYoutubeIframeApiScript,
  waitForTwinPlayerElements,
  waitForYoutubeIframeApiReady
} from '$lib/helpers/twinPlayersBootstrap';
import { runTwinPlayersBootstrapSequence } from '$lib/helpers/twinPlayersInitialization';
import { createTwinPlayersLoadingController } from '$lib/helpers/twinPlayersLoadingController';
import {
  createTwinPlayersFullscreenWindowBindings,
  createTwinPlayersGateWatchdog,
  destroyTwinPlayersPlayers
} from '$lib/helpers/twinPlayersLifecycleController';
import { createTwinPlayersInstanceController } from '$lib/helpers/twinPlayersInstanceController';
import { createTwinPlayersControlSurfaceController } from '$lib/helpers/twinPlayersControlSurface';
import { createTwinPlayersEditorController } from '$lib/helpers/twinPlayersEditorController';
import { createTwinPlayersNavigationController } from '$lib/helpers/twinPlayersNavigationController';
import {
  createTwinPlayersPlaybackSyncController,
  type TwinPlayersPlaybackProgressionHooks
} from '$lib/helpers/twinPlayersPlaybackSyncController';
import {
  createTwinPlayersOrchestrationController,
  type TwinPlayersOrchestrationNavigationHooks
} from '$lib/helpers/twinPlayersOrchestrationController';
import {
  createTwinPlayersStateController,
  type TwinPlayersState
} from '$lib/helpers/twinPlayersStateController';

declare const YT: any;

declare global {
  interface Window {
    YT?: any;
    playerConfigs: Record<string, any> | any[];
    volumeConfigs: Record<string, any> | any[];
    reactionVolumeConfigs: Record<string, any> | any[];
    playbackRateConfigs: Record<string, any> | any[];
    __players: { original: any; reaction: any };
  }
}

type Nullable<T> = T | null | undefined;

type UseTwinPlayersOptions = {
  data: {
    slug: string;
    userId?: string | null;
    displayName?: string | null;
  };
  enableAutoPlay?: boolean;
  momentFeedLoopEnabled?: boolean;
};

export const CONTROLS_FADE_CLASS = 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100';

// Debug toggles
const ENABLE_GATE_DEBUG = false;
const ENABLE_WATCHDOG = false;

export function useTwinPlayers({
  data,
  enableAutoPlay = true,
  momentFeedLoopEnabled = false
}: UseTwinPlayersOptions) {
  const { slug, userId } = data;

  if (typeof window !== 'undefined') {
    // Proactively initialize __actions so that E2E tests waiting for it 
    // don't timeout even if the main body takes a few ticks to complete.
    (window as any).__actions = (window as any).__actions || {};
    (window as any).__twinPlayersLog = (window as any).__twinPlayersLog || [];
  }

  const log = (msg: string, data?: any) => {
    if (typeof window !== 'undefined') {
      (window as any).__twinPlayersLog.push({ ts: Date.now(), msg, data });
    }
  };

  const initialUrlState = getInitialUrlState();
  const lazySyncRequested = Boolean(initialUrlState.mobileLazySync);
  const enableSyncEngineV2 = initialUrlState.syncEngine === 'v2'
    || (initialUrlState.syncEngine !== 'v1' && env.PUBLIC_SYNC_ENGINE_V2 === 'true');
  // console.log('Initial URL State:', initialUrlState);
  let initRetryCount = 0;
  const MAX_INIT_RETRIES = 3;
  const INIT_RETRY_DELAY = 4000;

  let originalVideoClicked = false;
  let reactionVideoClicked = false;
  let clickGateSessionId = 0;
  let clickGateEventSeq = 0;
  const instanceController = createTwinPlayersInstanceController();
  const { instanceId } = instanceController;
  const getActiveInstanceId = () => instanceController.getActiveInstanceId();
  const isCurrentInstance = () => instanceController.isCurrent();
  const isLiveInstance = () => instanceController.isAlive();
  const isInstanceDestroyed = () => instanceController.isDestroyed();

  const {
    state,
    getSnapshot: getStateSnapshot,
    patchState,
  } = createTwinPlayersStateController({
    pageSlug: slug,
    playlistDocumentId: initialUrlState.playlistId,
    queueSlug: initialUrlState.queueSlug,
    queueIndex: Number.isFinite(initialUrlState.queueIndex as number) ? (initialUrlState.queueIndex as number) : 0,
    isQueueAutoPlay: Boolean(initialUrlState.queueAutoPlay),
    showCinematicBars: readCinematicBarsCookie(),
    isFullscreen: initialUrlState.isFullscreen,
    momentFeedLoopEnabled
  });

  let initSeq = 0;
  let isSwitchingReactionInPlace = false;
  let lastUserResumeAt = 0;

  const getPlayerDebugInfo = (target: any) => {
    let iframeId: string | undefined;
    let videoId: string | undefined;
    try {
      const iframe = target?.getIframe?.();
      if (iframe && typeof iframe.id === 'string') {
        iframeId = iframe.id;
      }
    } catch {
      // ignore
    }

    try {
      const data = target?.getVideoData?.();
      if (data && typeof data.video_id === 'string') {
        videoId = data.video_id;
      }
    } catch {
      // ignore
    }

    return { iframeId, videoId };
  };

  const debugClickGate = (label: string, details: Record<string, any> = {}, includeStack = false) => {
    if (!ENABLE_GATE_DEBUG || typeof console === 'undefined') {
      return;
    }
    const snapshot = get(state);
    const base = {
      ts: Date.now(),
      seq: ++clickGateEventSeq,
      session: clickGateSessionId,
      instanceId,
      slug: snapshot.pageSlug,
      bothVideosStarted: snapshot.bothVideosStarted,
      originalVideoClicked,
      reactionVideoClicked,
      ...details
    };

    if (includeStack) {
      console.debug(label, { ...base, stack: new Error().stack });
      return;
    }

    console.debug(label, base);
  };
  toggleFullscreenBodyClass(initialUrlState.isFullscreen);

  const updateState = (partial: Partial<TwinPlayersState> | ((value: TwinPlayersState) => Partial<TwinPlayersState>)) => {
    const value = getStateSnapshot();
    const patch = typeof partial === 'function' ? partial(value) : partial;
    const nextValue = patchState(patch);

    if (ENABLE_GATE_DEBUG && value.bothVideosStarted !== nextValue.bothVideosStarted) {
      console.debug('[TwinPlayers] bothVideosStarted changed', {
        ts: Date.now(),
        seq: ++clickGateEventSeq,
        session: clickGateSessionId,
        instanceId,
        slug: nextValue.pageSlug,
        from: value.bothVideosStarted,
        to: nextValue.bothVideosStarted,
        originalVideoClicked,
        reactionVideoClicked,
        stack: new Error().stack
      });
    }

    if (typeof window !== 'undefined') {
      (window as any).__players = {
        original: nextValue.playerOriginal,
        reaction: nextValue.playerReaction,
        bothVideosStarted: nextValue.bothVideosStarted
      };
    }
  };

  const arePlayersActuallyReady = (): boolean => {
    const snapshot = get(state);
    const { playerOriginal, playerReaction, isReactionMissing } = snapshot;

    // Check if original player is functional
    if (!playerOriginal) return false;
    try {
      // Try to call a method - if it throws or returns undefined, player isn't ready
      const originalState = playerOriginal.getPlayerState?.();
      if (typeof originalState !== 'number') return false;
    } catch {
      return false;
    }

    // If reaction is expected, check it too
    if (!isReactionMissing && playerReaction) {
      try {
        const reactionState = playerReaction.getPlayerState?.();
        if (typeof reactionState !== 'number') return false;
      } catch {
        return false;
      }
    }

    return true;
  };

  const {
    finalizeLoadingState,
    setExpectedPlayerReadyCount,
    markPlayerReady,
    dispose: disposeLoadingController,
  } = createTwinPlayersLoadingController({
    setLoadingState: (isLoading: boolean) => {
      updateState({ isLoading });
    },
    arePlayersActuallyReady,
    canRetry: () => initRetryCount < MAX_INIT_RETRIES && isLiveInstance(),
    onRetryRequested: () => {
      console.warn(`[TwinPlayers] Players not ready after ${INIT_RETRY_DELAY}ms, retrying (attempt ${initRetryCount + 1}/${MAX_INIT_RETRIES})`);
      initRetryCount++;

      const snapshot = get(state);
      try {
        snapshot.playerOriginal?.destroy?.();
        snapshot.playerReaction?.destroy?.();
      } catch {
        // ignore
      }

      updateState({ playerOriginal: null, playerReaction: null });
      setTimeout(async () => {
        if (isLiveInstance()) {
          const slug = get(state).pageSlug;
          if (slug) {
            await buildInterface(slug, { isUpdate: true });
          }
        }
      }, 500);
    },
    retryDelayMs: INIT_RETRY_DELAY,
  });

  let navigationHooks: (TwinPlayersOrchestrationNavigationHooks & TwinPlayersPlaybackProgressionHooks) | null = null;

  const getGateState = () => ({ originalVideoClicked, reactionVideoClicked });

  const markOriginalVideoClicked = () => {
    const didChange = !originalVideoClicked;
    originalVideoClicked = true;
    return didChange;
  };

  const markReactionVideoClicked = () => {
    const didChange = !reactionVideoClicked;
    reactionVideoClicked = true;
    return didChange;
  };

  const {
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
    dispose: disposePlaybackSyncController,
  } = createTwinPlayersPlaybackSyncController({
    getSnapshot: () => get(state),
    updateState,
    getProgressionHooks: () => navigationHooks,
    getPlayerDebugInfo,
    debugClickGate,
    enableGateDebug: ENABLE_GATE_DEBUG,
    lazySyncRequested,
    enableSyncEngineV2,
    isLiveInstance,
    isInstanceDestroyed,
    getActiveInstanceId,
    isSwitchingReactionInPlace: () => isSwitchingReactionInPlace,
    getGateState,
    markOriginalVideoClicked,
    markReactionVideoClicked,
    getLastUserResumeAt: () => lastUserResumeAt,
    setLastUserResumeAt: (value: number) => {
      lastUserResumeAt = value;
    },
    markPlayerReady,
  });

  const {
    createPlayer: createTikTokOriginalPlayer,
    destroyPlayer: destroyTikTokOriginalPlayer
  } = createTikTokOriginalPlayerAdapter({
    containerId: 'player-original',
    markPlayerReady,
    onStateChange: (event: { data: number; target: any }) => {
      onStateChangeOriginal(event);
    }
  });

  const gateWatchdog = createTwinPlayersGateWatchdog({
    enabled: ENABLE_WATCHDOG,
    getSnapshot: () => get(state),
    getPlayingStateValue: () => YT?.PlayerState?.PLAYING,
    getPlayerDebugInfo,
    isGateSatisfied: () => getGateState().originalVideoClicked && getGateState().reactionVideoClicked,
    debugClickGate
  });

  const setSwitchingReactionInPlace = (value: boolean) => {
    isSwitchingReactionInPlace = value;
  };

  const resetClickGateForSetup = ({
    reactionVideoId,
    originalVideoId
  }: {
    reactionVideoId: string;
    originalVideoId?: string;
  }) => {
    originalVideoClicked = false;
    reactionVideoClicked = false;
    clickGateSessionId += 1;
    debugClickGate('[TwinPlayers] click gate reset', {
      source: 'setUpVideos',
      reactionVideoId,
      originalVideoId
    }, true);
  };

  const primeClickGateFromAutoplay = (autoPlay: boolean) => {
    originalVideoClicked = autoPlay;
    reactionVideoClicked = autoPlay;
    clickGateSessionId += 1;
    debugClickGate('[TwinPlayers] click gate state from loadReactionInPlace autoPlay', {
      autoPlay
    }, true);
  };

  const satisfyClickGateForAutoplay = () => {
    originalVideoClicked = true;
    reactionVideoClicked = true;
  };

  const resetStandaloneTransition = ({
    nextReactionDocumentId,
    source
  }: {
    nextReactionDocumentId: string;
    source: 'playlist' | 'queue';
  }) => {
    originalVideoClicked = false;
    reactionVideoClicked = false;
    clickGateSessionId += 1;
    debugClickGate(`[TwinPlayers] click gate reset when loading next ${source} reaction`, {
      nextReactionDocumentId
    }, true);
    updateState({
      bothVideosStarted: false,
      isUserPaused: false,
      currentStateOriginalVideo: -1,
      currentVolumeOriginalVideo: 100,
      reactionCurrentTime: 0,
      reactionDuration: 0
    });
  };

  const verifyAndSyncMetadata = async ({
    documentId,
    originalVideoId,
    originalVideoPlatform,
    originalVideoUrl,
    reactionVideoId,
    currentOriginalTitle,
    currentOriginalAuthor,
    currentOriginalAuthorUrl,
    currentOriginalDescription,
    currentReactionTitle,
    currentReactionAuthor
  }: VerifyAndSyncTwinPlayersMetadataParams) => {
    const { resolvedDocumentId, statePatch } = await verifyAndSyncTwinPlayersMetadata({
      documentId,
      fallbackDocumentId: typeof window !== 'undefined' ? (window as any)?.currentReactionDocumentId : undefined,
      originalVideoId,
      originalVideoPlatform,
      originalVideoUrl,
      reactionVideoId,
      currentOriginalTitle,
      currentOriginalAuthor,
      currentOriginalAuthorUrl,
      currentOriginalDescription,
      currentReactionTitle,
      currentReactionAuthor
    });

    if (!resolvedDocumentId) {
      return;
    }

    const snapshot = get(state);
    if (snapshot.pageSlug !== resolvedDocumentId) {
      return;
    }

    if (Object.keys(statePatch).length > 0) {
      updateState(statePatch);
    }
  };

  const {
    setUpVideos,
    loadReactionInPlace,
  } = createTwinPlayersOrchestrationController({
    getSnapshot: () => get(state),
    updateState,
    userId,
    viewerDisplayName: data?.displayName,
    getNavigationHooks: () => navigationHooks,
    isCurrentInstance,
    getActiveInstanceId,
    waitForDomTick: tick,
    injectYoutubeIframeApiScript,
    waitForYoutubeIframeApiReady,
    createTikTokOriginalPlayer,
    destroyTikTokOriginalPlayer,
    setExpectedPlayerReadyCount,
    finalizeLoadingState,
    arePlayersActuallyReady,
    onPlayerReady,
    onStateChangeOriginal,
    onStateChangeReaction,
    enforceReactionMuteMode,
    resetReactionDurationProbe,
    resetOriginalStateTracking,
    stopSyncScheduler,
    pollVideoCurrentTime,
    syncVideos,
    handleStateChangeInReactionVideo,
    verifyAndSyncMetadata,
    seekReactionTo: goToSecondsInReactionVideo,
    setSwitchingReactionInPlace,
    resetClickGateForSetup,
    primeClickGateFromAutoplay,
    satisfyClickGateForAutoplay,
    debugClickGate,
    log
  });

  const {
    buildInterface,
    toggleAutoPlaylist,
    setPlaylistData,
    setPlaylistDocumentId,
    setPlaylistSelectionIndex,
    loadNextReactionInPlaylist,
    hasNextInQueue,
    navigateToNextReactionInQueue,
    loadNextReactionInQueue,
    handleSlugChange,
  } = createTwinPlayersNavigationController({
    getSnapshot: () => get(state),
    updateState,
    userId,
    setUpVideos,
    loadReactionInPlace,
    onResetStandaloneTransition: resetStandaloneTransition,
    debugClickGate,
    log
  });

  navigationHooks = {
    buildInterface,
    setPlaylistData,
    loadNextReactionInPlaylist,
    loadNextReactionInQueue,
  };

  const {
    setReactionVideoId,
    setOffsetStartTime,
    setIntroBufferTime,
    setReactionFinishTime,
    setSoundLevel,
    setReactionMuteMode,
    setFullscreenPrimaryVideo,
    setFullscreenOverlayWidthPercent,
    setFullscreenOverlayCorner,
    createPlayerConfig,
    createVolumeConfig,
    createReactionVolumeConfig,
    createPlaybackRateConfig,
    createOverlayVisibilityConfig,
    updatePlayerConfig,
    deletePlayerConfig,
    updateVolumeConfig,
    updateReactionVolumeConfig,
    deleteVolumeConfig,
    deleteReactionVolumeConfig,
    updatePlaybackRateConfig,
    deletePlaybackRateConfig,
    updateOverlayVisibilityConfig,
    deleteOverlayVisibilityConfig,
    setIsPublished,
    setIsUnpublished,
    enterEditMode,
    closeEditMode,
    editActionEntryPoint,
  } = createTwinPlayersEditorController({
    getSnapshot: () => get(state),
    updateState,
    seekReactionTo: goToSecondsInReactionVideo,
    enforceReactionMuteMode,
  });

  const toggleFineTuneMode = () => {
    const snapshot = get(state);
    updateState({ isFineTuneModeOn: !snapshot.isFineTuneModeOn });
  };

  const toggleCinematicBars = () => {
    const snapshot = get(state);
    const nextValue = !snapshot.showCinematicBars;
    updateState({ showCinematicBars: nextValue });
    writeCinematicBarsCookie(nextValue);
  };

  const setVideoScene = (value: boolean) => {
    if (typeof window === 'undefined') {
      return;
    }
    // Update state reactively instead of refreshing
    updateState({
      isFullscreen: value,
      isControlSurfaceVisible: !value,
      isExitButtonExpanded: false,
      fullscreenOverlayVisible: true
    });

    // Update URL for shareability/refresh persistence using History API
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    params.set('isFullscreen', String(value));
    url.search = params.toString();
    window.history.replaceState(window.history.state, '', url.toString());

    // Toggle body class for overflow control
    if (value) {
      document.body.classList.add('reaction-fullscreen');
    } else {
      document.body.classList.remove('reaction-fullscreen');
    }
  };

  const openWithFullscreen = () => {
    setVideoScene(true);
  };

  const openWithHalfscreen = () => {
    setVideoScene(false);
  };

  const {
    showControls,
    scheduleHideControls,
    handleFullscreenMouseMove,
    handleFullscreenPointerMove,
    handleFullscreenPointerDown,
    handleExitButtonEnter,
    handleExitButtonLeave,
    handleExitFullscreenClick,
    registerOverlayElement: registerOverlayRef,
    syncWithFullscreenState,
    dispose: disposeControlSurface,
  } = createTwinPlayersControlSurfaceController({
    getSnapshot: () => get(state),
    updateState: (patch) => updateState(patch),
    onExitFullscreen: openWithHalfscreen
  });

  const fullscreenWindowBindings = createTwinPlayersFullscreenWindowBindings({
    getIsFullscreen: () => get(state).isFullscreen,
    onExitFullscreen: openWithHalfscreen,
    onFullscreenMouseMove: handleFullscreenMouseMove
  });

  const scheduleInitRetry = (message: string) => {
    if (initRetryCount >= MAX_INIT_RETRIES || !isLiveInstance()) {
      return false;
    }

    initRetryCount++;
    console.log(`[TwinPlayers] ${message} (attempt ${initRetryCount}/${MAX_INIT_RETRIES})`);
    setTimeout(() => {
      if (isLiveInstance()) {
        init();
      }
    }, INIT_RETRY_DELAY);

    return true;
  };

  const init = async () => {
    const seq = (initSeq += 1);
    log('init start', { seq, retryCount: initRetryCount, instanceId });
    debugClickGate('[TwinPlayers] init start', { seq, retryCount: initRetryCount }, true);

    try {
      const bootstrapResult = await runTwinPlayersBootstrapSequence({
        seq,
        log,
        debugClickGate,
        isCurrentInstance,
        getActiveInstanceId,
        waitForDomTick: tick,
        injectYoutubeIframeApiScript,
        waitForYoutubeIframeApiReady,
        waitForTwinPlayerElements: () => waitForTwinPlayerElements(150, 100),
        getPageSlug: () => get(state).pageSlug
      });

      if (bootstrapResult.status === 'superseded') {
        return;
      }

      if (bootstrapResult.status === 'elements-not-ready') {
        console.warn('Player elements not found after waiting');
        debugClickGate('[TwinPlayers] init: player elements not ready', { seq, retryCount: initRetryCount });

        if (!scheduleInitRetry('Auto-retrying initialization')) {
          console.error('[TwinPlayers] Max retries exceeded, giving up');
          finalizeLoadingState();
        }
        return;
      }

      if (bootstrapResult.status === 'missing-slug') {
        finalizeLoadingState();
        return;
      }

      await buildInterface(bootstrapResult.slug);
      log('buildInterface called from init', { initialSlug: bootstrapResult.slug });
    } catch (error) {
      log('init failed', { error: String(error) });
      console.error('Failed to initialize reaction player:', error);
      scheduleInitRetry('Auto-retrying after error');
    } finally {
      debugClickGate('[TwinPlayers] init done', { seq });
    }
  };

  onMount(() => {
    log('onMount started', { enableAutoPlay, instanceId });
    debugClickGate('[TwinPlayers] instance mounted', { enableAutoPlay }, true);
    gateWatchdog.start();

    const isAutoPlay = enableAutoPlay ? readAutoPlayCookie() : false;
    updateState({ isPlaylistAutoPlay: isAutoPlay });

    fullscreenWindowBindings.mount();
    syncWithFullscreenState();

    init();
  });

  onDestroy(() => {
    instanceController.markDestroyed();
    debugClickGate('[TwinPlayers] instance destroyed', {}, true);
    // Ensure embedded YouTube players are torn down when leaving the route.
    // Without this, client-side navigation from edit -> reaction can leave behind
    // active player instances and cause inconsistent start/sync behavior.
    destroyTwinPlayersPlayers({
      snapshot: get(state),
      destroyTikTokOriginalPlayer,
      onDestroyError: (error) => {
        console.warn('Failed to destroy YouTube players on teardown', error);
      }
    });

    if (typeof document !== 'undefined') {
      document.body.classList.remove('reaction-fullscreen');
    }
    fullscreenWindowBindings.unmount();
    disposeControlSurface();
    disposeLoadingController();
    disposePlaybackSyncController();
    gateWatchdog.stop();
  });

  const result = {
    state: {
      subscribe: state.subscribe
    },
    actions: {
      hasNextInQueue,
      navigateToNextReactionInQueue,
      toggleAutoPlaylist,
      setPlaylistSelectionIndex,
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
      setFullscreenPrimaryVideo,
      setFullscreenOverlayWidthPercent,
      setFullscreenOverlayCorner,
      createPlayerConfig,
      createVolumeConfig,
      createReactionVolumeConfig,
      createPlaybackRateConfig,
      createOverlayVisibilityConfig,
      updatePlayerConfig,
      deletePlayerConfig,
      updateVolumeConfig,
      deleteVolumeConfig,
      updateReactionVolumeConfig,
      deleteReactionVolumeConfig,
      updatePlaybackRateConfig,
      deletePlaybackRateConfig,
      updateOverlayVisibilityConfig,
      deleteOverlayVisibilityConfig,
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

  if (typeof window !== 'undefined') {
    // Populate the proactively created __actions object with the real actions.
    Object.assign((window as any).__actions, result.actions);
  }

  return result;
}

function getInitialUrlState() {
  if (typeof window === 'undefined') {
    return {
      isFullscreen: false,
      playlistId: null as string | null,
      queueSlug: null as string | null,
      queueIndex: null as number | null,
      queueAutoPlay: false,
      mobileLazySync: false,
      syncEngine: null as string | null
    };
  }
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  const queueSlug = params.get('queueSlug');
  const queueIndexRaw = params.get('queueIndex');
  const queueAutoPlayRaw = params.get('queueAutoPlay');
  const mobileLazySyncRaw = params.get('mobileLazySync') ?? params.get('lazySync');
  const mobileLazySync = mobileLazySyncRaw === 'true' || mobileLazySyncRaw === '1' || params.has('mobileLazySync') || params.has('lazySync');
  return {
    isFullscreen: params.get('isFullscreen') === 'true',
    playlistId: params.get('playlistId'),
    queueSlug,
    queueIndex: queueIndexRaw ? Number(queueIndexRaw) : null,
    queueAutoPlay: queueAutoPlayRaw === 'true',
    mobileLazySync,
    syncEngine: params.get('syncEngine')
  };
}
