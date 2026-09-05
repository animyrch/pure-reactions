import { getReaction } from '$lib/helpers/firebase';
import {
  buildTwinPlayersInPlaceStatePatch,
  buildTwinPlayersInPlaceTransitionPlan
} from '$lib/helpers/twinPlayersInPlaceTransition';
import {
  DEFAULT_FULLSCREEN_OVERLAY_CORNER,
  DEFAULT_FULLSCREEN_OVERLAY_WIDTH_PERCENT,
  DEFAULT_FULLSCREEN_PRIMARY_VIDEO,
  deriveTwinPlayersReactionData
} from '$lib/helpers/twinPlayersReactionData';
import { buildTwinPlayersSetupStatePatch } from '$lib/helpers/twinPlayersSetupState';
import type { VerifyAndSyncTwinPlayersMetadataParams } from '$lib/helpers/twinPlayersMetadata';
import type { TwinPlayersState } from '$lib/helpers/twinPlayersStateController';
import { restoreEmbeddedPlayerContainer } from '$lib/helpers/twinPlayersTikTokOriginal';

declare const YT: any;

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

export type TwinPlayersLoadReactionInPlaceOptions = {
  preserveReactionTime?: boolean;
  autoPlay?: boolean;
};

export type TwinPlayersOrchestrationNavigationHooks = {
  buildInterface: (slugValue: string, options?: { isUpdate?: boolean }) => Promise<void>;
  setPlaylistData: (
    playlistId: string | null | undefined,
    youtubePlaylistId?: string,
    currentReactionDocumentId?: string,
    currentOriginalVideoId?: string,
  ) => Promise<void>;
};

type TwinPlayersDebugClickGate = (
  label: string,
  details?: Record<string, any>,
  includeStack?: boolean
) => void;

type TwinPlayersLog = (message: string, data?: any) => void;

type CreateTwinPlayersOrchestrationControllerOptions = {
  getSnapshot: () => TwinPlayersState;
  updateState: (patch: Partial<TwinPlayersState>) => void;
  userId?: string | null;
  viewerDisplayName?: string | null;
  getNavigationHooks: () => TwinPlayersOrchestrationNavigationHooks | null;
  isCurrentInstance: () => boolean;
  getActiveInstanceId: () => string | null;
  waitForDomTick: () => Promise<void>;
  injectYoutubeIframeApiScript: () => void;
  waitForYoutubeIframeApiReady: () => Promise<void>;
  createTikTokOriginalPlayer: (videoId: string) => any;
  destroyTikTokOriginalPlayer: () => void;
  setExpectedPlayerReadyCount: (count: number) => void;
  finalizeLoadingState: () => void;
  arePlayersActuallyReady: () => boolean;
  onPlayerReady: (event: any) => void;
  onStateChangeOriginal: (event: any) => void;
  onStateChangeReaction: (event: any) => void;
  enforceReactionMuteMode: (overrideOriginalState?: number) => void;
  resetReactionDurationProbe: () => void;
  resetOriginalStateTracking: () => void;
  stopSyncScheduler: () => void;
  pollVideoCurrentTime: () => void;
  syncVideos: () => void;
  handleStateChangeInReactionVideo: (previousState: number, nextState: number) => void;
  verifyAndSyncMetadata: (params: VerifyAndSyncTwinPlayersMetadataParams) => Promise<void>;
  seekReactionTo: (seconds: number) => void;
  setSwitchingReactionInPlace: (value: boolean) => void;
  resetClickGateForSetup: (params: { reactionVideoId: string; originalVideoId?: string }) => void;
  primeClickGateFromAutoplay: (autoPlay: boolean) => void;
  satisfyClickGateForAutoplay: () => void;
  debugClickGate: TwinPlayersDebugClickGate;
  log: TwinPlayersLog;
};

const assignTimelineSourcesToWindow = (timelineSources: ReturnType<typeof deriveTwinPlayersReactionData>['timelineSources']) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.playerConfigs = timelineSources.playerConfigs;
  window.volumeConfigs = timelineSources.volumeConfigs;
  (window as any).reactionVolumeConfigs = timelineSources.reactionVolumeConfigs;
  window.playbackRateConfigs = timelineSources.playbackRateConfigs;
};

const syncCurrentReactionDocumentId = (
  slugValue: string,
  updateState: (patch: Partial<TwinPlayersState>) => void
) => {
  updateState({ pageSlug: slugValue });
  if (typeof window !== 'undefined') {
    (window as any).currentReactionDocumentId = slugValue;
  }
};

const waitForReactionPlayerReadiness = async (
  arePlayersActuallyReady: () => boolean,
  waitForDomTick: () => Promise<void>
) => {
  let readyAttempts = 0;
  while (!arePlayersActuallyReady() && readyAttempts < 40) {
    await waitForDomTick();
    await new Promise((resolve) => setTimeout(resolve, 50));
    readyAttempts++;
  }
};

export function createTwinPlayersOrchestrationController({
  getSnapshot,
  updateState,
  userId,
  viewerDisplayName,
  getNavigationHooks,
  isCurrentInstance,
  getActiveInstanceId,
  waitForDomTick,
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
  seekReactionTo,
  setSwitchingReactionInPlace,
  resetClickGateForSetup,
  primeClickGateFromAutoplay,
  satisfyClickGateForAutoplay,
  debugClickGate,
  log
}: CreateTwinPlayersOrchestrationControllerOptions) {
  const requireNavigationHooks = () => {
    const hooks = getNavigationHooks();
    if (!hooks) {
      throw new Error('Twin players navigation hooks are not ready');
    }
    return hooks;
  };

  const setUpVideos = async (reactionData: any) => {
    log('setUpVideos called', { reactionDataExists: !!reactionData });
    if (!isCurrentInstance()) {
      debugClickGate('[TwinPlayers] setUpVideos aborted (instance superseded)', {
        globalActiveInstanceId: getActiveInstanceId(),
        reactionVideoId: reactionData?.reactionVideoId
      });
      log('setUpVideos aborted: instance superseded', {
        globalActiveInstanceId: getActiveInstanceId()
      });
      return;
    }

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
        isReactionAutoMuted: false,
        fullscreenPrimaryVideo: DEFAULT_FULLSCREEN_PRIMARY_VIDEO,
        fullscreenPrimaryVideoDefault: DEFAULT_FULLSCREEN_PRIMARY_VIDEO,
        fullscreenOverlayWidthPercent: DEFAULT_FULLSCREEN_OVERLAY_WIDTH_PERCENT,
        fullscreenOverlayCorner: DEFAULT_FULLSCREEN_OVERLAY_CORNER
      });
      return;
    }

    const reactionVideoId = reactionData.reactionVideoId;
    const originalVideoId = reactionData.originalVideoId;
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
        isReactionAutoMuted: false,
        fullscreenPrimaryVideo: DEFAULT_FULLSCREEN_PRIMARY_VIDEO,
        fullscreenPrimaryVideoDefault: DEFAULT_FULLSCREEN_PRIMARY_VIDEO,
        fullscreenOverlayWidthPercent: DEFAULT_FULLSCREEN_OVERLAY_WIDTH_PERCENT,
        fullscreenOverlayCorner: DEFAULT_FULLSCREEN_OVERLAY_CORNER
      });
      return;
    }

    const derivedReactionData = deriveTwinPlayersReactionData({
      reactionData,
      viewerUserId: userId,
      viewerDisplayName,
      reactionFinishTimeFallback: 0
    });

    const {
      reactionVideoId: normalizedReactionVideoId,
      youtubePlaylistId,
      offsetStartTime,
      reactionFinishTime,
      timeOffset,
      globalGain,
      soundLevel,
      fullscreenPrimaryVideo,
      fullscreenOverlayWidthPercent,
      fullscreenOverlayCorner,
      playerConfigs,
      volumeConfigs,
      reactionVolumeConfigs,
      playbackRateConfigs,
      stateTimeline,
      volumeTimeline,
      reactionVolumeTimeline,
      playbackRateTimeline,
      overlayVisibilityTimeline,
      playerEventTimeline,
      timelineSources,
      initialTargetTime,
      currentPlaybackRate,
      resolvedReactorId,
      resolvedReactorDisplayName,
      reactionVideoDescription,
      normalizedOriginalMetadata,
      originalVideoPlatform,
      isReactionMissing,
      isUsersOwnVideo,
      canShowEditModeButton,
      isReactionMuteModeEnabled,
      isPublished
    } = derivedReactionData;

    assignTimelineSourcesToWindow(timelineSources);

    const playerOriginal = getSnapshot().playerOriginal;
    const playerReaction = getSnapshot().playerReaction;

    try {
      playerOriginal?.pauseVideo?.();
    } catch {
      // ignore
    }
    try {
      playerReaction?.pauseVideo?.();
    } catch {
      // ignore
    }
    playerOriginal?.destroy?.();
    playerReaction?.destroy?.();

    destroyTikTokOriginalPlayer();
    restoreEmbeddedPlayerContainer('player-original');
    restoreEmbeddedPlayerContainer('player-reaction');

    resetClickGateForSetup({
      reactionVideoId: normalizedReactionVideoId,
      originalVideoId
    });

    resetReactionDurationProbe();
    resetOriginalStateTracking();

    updateState({
      isPublished,
      isReactionMissing,
      reactorId: resolvedReactorId,
      isUsersOwnVideo,
      canShowEditModeButton,
      playerConfigs,
      volumeConfigs,
      reactionVolumeConfigs,
      playbackRateConfigs,
      stateTimeline,
      volumeTimeline,
      reactionVolumeTimeline,
      playbackRateTimeline,
      overlayVisibilityTimeline,
      playerEventTimeline,
      reactionVideoId: normalizedReactionVideoId,
      originalVideoId,
      reactionVideoAuthor: reactionData?.reactionVideoAuthor,
      reactorDisplayName: resolvedReactorDisplayName,
      reactionVideoTitle: reactionData?.reactionVideoTitle,
      reactionVideoDescription,
      originalVideoAuthor: normalizedOriginalMetadata.author,
      originalVideoAuthorUrl: normalizedOriginalMetadata.authorUrl,
      originalVideoTitle: normalizedOriginalMetadata.title,
      originalVideoDescription: normalizedOriginalMetadata.description,
      youtubePlaylistId,
      offsetStartTime,
      reactionFinishTime,
      timeOffset,
      globalGain,
      introBufferTime: timeOffset,
      soundLevel,
      isReactionMuteModeEnabled,
      isReactionAutoMuted: false,
      fullscreenPrimaryVideo,
      fullscreenOverlayWidthPercent,
      fullscreenOverlayCorner,
      currentPlaybackRate,
      originalVideoPlatform,
    });

    await waitForDomTick();

    if (!isCurrentInstance()) {
      debugClickGate('[TwinPlayers] setUpVideos aborted before player creation (instance superseded)', {
        globalActiveInstanceId: getActiveInstanceId(),
        reactionVideoId: normalizedReactionVideoId,
        originalVideoId
      });
      setExpectedPlayerReadyCount(0);
      return;
    }

    const expectedPlayers = 1 + (normalizedReactionVideoId ? 1 : 0);
    setExpectedPlayerReadyCount(expectedPlayers);

    let newPlayerReaction: any = null;
    let newPlayerOriginal: any = null;

    try {
      if (normalizedReactionVideoId) {
        newPlayerReaction = new YT.Player('player-reaction', {
          videoId: normalizedReactionVideoId,
          playerVars: {
            ...playerOptions,
            start: Math.round(offsetStartTime)
          },
          ...iframeOptionDefault,
          events: {
            onReady: onPlayerReady,
            onStateChange: onStateChangeReaction
          }
        });
      }

      if (originalVideoPlatform === 'tiktok') {
        newPlayerOriginal = createTikTokOriginalPlayer(originalVideoId);
      } else {
        newPlayerOriginal = new YT.Player('player-original', {
          videoId: originalVideoId,
          playerVars: {
            ...playerOptions,
            start: Math.round(initialTargetTime)
          },
          ...iframeOptionDefault,
          events: {
            onReady: onPlayerReady,
            onStateChange: onStateChangeOriginal
          }
        });
      }
    } catch (error) {
      console.error('Failed to initialise players', error);
      finalizeLoadingState();
      return;
    }

    if (!isCurrentInstance()) {
      debugClickGate('[TwinPlayers] setUpVideos aborting after player creation (instance superseded)', {
        globalActiveInstanceId: getActiveInstanceId(),
        reactionVideoId: normalizedReactionVideoId,
        originalVideoId
      });
      try {
        newPlayerOriginal?.destroy?.();
        newPlayerReaction?.destroy?.();
      } catch {
        // ignore
      }
      setExpectedPlayerReadyCount(0);
      return;
    }

    updateState(buildTwinPlayersSetupStatePatch({
      derived: derivedReactionData,
      reactionVideoAuthor: reactionData?.reactionVideoAuthor,
      reactionVideoTitle: reactionData?.reactionVideoTitle,
      reactionVideoDescription,
      nextPlayerOriginal: newPlayerOriginal,
      nextPlayerReaction: newPlayerReaction,
      momentFeedLoopEnabled: getSnapshot().momentFeedLoopEnabled
    }));

    console.debug('[TwinPlayers] state reset after setUpVideos', {
      bothVideosStarted: false,
      reactionVideoId: normalizedReactionVideoId,
      originalVideoId
    });

    enforceReactionMuteMode();

    await requireNavigationHooks().setPlaylistData(
      getSnapshot().playlistDocumentId,
      youtubePlaylistId,
      typeof reactionData?.id === 'string' ? reactionData.id : undefined,
      originalVideoId,
    );

    await verifyAndSyncMetadata({
      documentId: typeof reactionData?.id === 'string' ? reactionData.id : undefined,
      originalVideoId,
      originalVideoPlatform,
      originalVideoUrl: reactionData?.originalVideoUrl,
      reactionVideoId: normalizedReactionVideoId,
      currentOriginalTitle: normalizedOriginalMetadata.title,
      currentOriginalAuthor: normalizedOriginalMetadata.author,
      currentOriginalAuthorUrl: normalizedOriginalMetadata.authorUrl,
      currentOriginalDescription: normalizedOriginalMetadata.description,
      currentReactionTitle: reactionData?.reactionVideoTitle,
      currentReactionAuthor: reactionData?.reactionVideoAuthor
    });
  };

  const loadReactionInPlace = async (
    nextReactionDocumentId: string,
    options: TwinPlayersLoadReactionInPlaceOptions = {}
  ) => {
    if (!nextReactionDocumentId || typeof window === 'undefined') {
      return;
    }

    setSwitchingReactionInPlace(true);
    stopSyncScheduler();

    try {
      await waitForDomTick();
      injectYoutubeIframeApiScript();
      await waitForYoutubeIframeApiReady();

      const snapshotBefore = getSnapshot();
      const preserveReactionTime = Boolean(options.preserveReactionTime);
      const previousReactionTime =
        preserveReactionTime && typeof snapshotBefore.playerReaction?.getCurrentTime === 'function'
          ? Number(snapshotBefore.playerReaction.getCurrentTime()) || 0
          : undefined;
      const previousReactionVideoId = snapshotBefore.reactionVideoId;

      if (!preserveReactionTime) {
        primeClickGateFromAutoplay(Boolean(options.autoPlay));
      }

      const navigationHooks = requireNavigationHooks();

      if (!snapshotBefore.playerOriginal || !document.getElementById('player-original')) {
        await navigationHooks.buildInterface(nextReactionDocumentId, { isUpdate: true });
        syncCurrentReactionDocumentId(nextReactionDocumentId, updateState);
        return;
      }

      (window as any).currentReactionDocumentId = nextReactionDocumentId;
      const reactionData = await getReaction(nextReactionDocumentId);
      if (!reactionData) {
        await setUpVideos(reactionData);
        syncCurrentReactionDocumentId(nextReactionDocumentId, updateState);
        return;
      }

      const derivedReactionData = deriveTwinPlayersReactionData({
        reactionData,
        viewerUserId: userId,
        viewerDisplayName,
        reactionFinishTimeFallback: 100000
      });

      const {
        reactionVideoId: normalizedReactionVideoId,
        originalVideoId,
        youtubePlaylistId,
        initialState,
        initialTargetTime,
        initialOriginalVolume,
        initialReactionVolume,
        normalizedOriginalMetadata,
        originalVideoPlatform: nextOriginalVideoPlatform,
        timelineSources,
      } = derivedReactionData;

      assignTimelineSourcesToWindow(timelineSources);

      if (normalizedReactionVideoId && !document.getElementById('player-reaction')) {
        log('loadReactionInPlace fallback to buildInterface: missing reaction container', {
          nextReactionDocumentId,
          reactionVideoId: normalizedReactionVideoId
        });
        await navigationHooks.buildInterface(nextReactionDocumentId, { isUpdate: true });
        syncCurrentReactionDocumentId(nextReactionDocumentId, updateState);
        return;
      }

      const isPlaylistPage = window.location?.pathname?.startsWith('/playlist/');
      const platformChanged = snapshotBefore.originalVideoPlatform !== nextOriginalVideoPlatform;
      if (isPlaylistPage && platformChanged) {
        window.location.assign(window.location.href);
        return;
      }

      const transitionPlan = buildTwinPlayersInPlaceTransitionPlan({
        snapshotBefore,
        derived: derivedReactionData,
        previousReactionVideoId,
        previousReactionTime,
        preserveReactionTime,
        autoPlay: options.autoPlay,
        hasReactionElement: Boolean(document.getElementById('player-reaction')),
        hasOriginalElement: Boolean(document.getElementById('player-original'))
      });

      const {
        isSameReactionVideo,
        canReuseReactionPlayer,
        canReuseOriginalPlayer,
        shouldResetGate,
        effectivePreviousReactionTime,
        shouldCreateReactionPlayer,
        shouldCreateOriginalPlayer,
        expectedPlayerReadyCount,
      } = transitionPlan;

      if (!canReuseReactionPlayer && snapshotBefore.playerReaction?.destroy) {
        snapshotBefore.playerReaction.destroy();
      }

      if (!canReuseOriginalPlayer) {
        try {
          snapshotBefore.playerOriginal?.pauseVideo?.();
        } catch {
          // ignore
        }
        snapshotBefore.playerOriginal?.destroy?.();
        destroyTikTokOriginalPlayer();
      }

      setExpectedPlayerReadyCount(expectedPlayerReadyCount);

      let nextPlayerReaction: any = snapshotBefore.playerReaction;
      let nextPlayerOriginal: any = snapshotBefore.playerOriginal;

      if (shouldCreateReactionPlayer) {
        try {
          nextPlayerReaction = new YT.Player('player-reaction', {
            videoId: normalizedReactionVideoId,
            playerVars: {
              ...playerOptions,
              start: Math.round(derivedReactionData.offsetStartTime)
            },
            ...iframeOptionDefault,
            events: {
              onReady: onPlayerReady,
              onStateChange: onStateChangeReaction
            }
          });
        } catch (error) {
          console.error('Failed to initialise reaction YouTube player', error);
          nextPlayerReaction = null;
          setExpectedPlayerReadyCount(shouldCreateOriginalPlayer ? 1 : 0);
        }
      }

      if (shouldCreateOriginalPlayer) {
        updateState({ originalVideoPlatform: nextOriginalVideoPlatform, playerOriginal: null });
        await waitForDomTick();
        restoreEmbeddedPlayerContainer('player-original');

        try {
          if (nextOriginalVideoPlatform === 'tiktok') {
            nextPlayerOriginal = createTikTokOriginalPlayer(originalVideoId);
          } else {
            nextPlayerOriginal = new YT.Player('player-original', {
              videoId: originalVideoId,
              playerVars: {
                ...playerOptions,
                start: Math.round(initialTargetTime)
              },
              ...iframeOptionDefault,
              events: {
                onReady: onPlayerReady,
                onStateChange: onStateChangeOriginal
              }
            });
          }
        } catch (error) {
          console.error('Failed to initialise original player during in-place transition', error);
          nextPlayerOriginal = null;
          setExpectedPlayerReadyCount(shouldCreateReactionPlayer ? 1 : 0);
        }
      } else if (originalVideoId && typeof snapshotBefore.playerOriginal?.loadVideoById === 'function') {
        try {
          const shouldCueOriginalAtLoad = initialState !== YT.PlayerState.PLAYING;

          if (!isSameReactionVideo) {
            if (typeof snapshotBefore.playerOriginal.cueVideoById === 'function') {
              snapshotBefore.playerOriginal.cueVideoById({
                videoId: originalVideoId,
                startSeconds: initialTargetTime
              });
              console.debug('[TwinPlayers] Cued original video (different reaction video)', {
                originalVideoId,
                initialTargetTime
              });
            } else {
              snapshotBefore.playerOriginal.loadVideoById({
                videoId: originalVideoId,
                startSeconds: initialTargetTime
              });
            }
          } else if (shouldCueOriginalAtLoad && typeof snapshotBefore.playerOriginal.cueVideoById === 'function') {
            snapshotBefore.playerOriginal.cueVideoById({
              videoId: originalVideoId,
              startSeconds: initialTargetTime
            });
            console.debug('[TwinPlayers] Cued original video (same reaction video, timeline paused at entry)', {
              originalVideoId,
              initialTargetTime,
              initialState
            });
          } else {
            snapshotBefore.playerOriginal.loadVideoById({
              videoId: originalVideoId,
              startSeconds: initialTargetTime
            });
          }
        } catch (error) {
          console.error('Failed to load original video by id', error);
        }
      }

      updateState(buildTwinPlayersInPlaceStatePatch({
        snapshotBefore,
        derived: derivedReactionData,
        reactionVideoAuthor: reactionData?.reactionVideoAuthor,
        reactionVideoTitle: reactionData?.reactionVideoTitle,
        nextPlayerOriginal,
        nextPlayerReaction,
        transitionPlan,
      }));

      if (shouldCreateReactionPlayer) {
        await waitForReactionPlayerReadiness(arePlayersActuallyReady, waitForDomTick);
      }

      console.debug('[TwinPlayers] state updated in updateReactionVideo', {
        isSameReactionVideo,
        preserveReactionTime,
        bothVideosStarted: isSameReactionVideo && preserveReactionTime ? snapshotBefore.bothVideosStarted : Boolean(options.autoPlay),
        initialOriginalVolume,
        initialReactionVolume,
        reactionVideoId: normalizedReactionVideoId,
        previousReactionVideoId
      });

      enforceReactionMuteMode();
      await navigationHooks.setPlaylistData(
        getSnapshot().playlistDocumentId,
        youtubePlaylistId,
        nextReactionDocumentId,
        originalVideoId,
      );

      if (typeof nextPlayerOriginal?.setVolume === 'function') {
        try {
          nextPlayerOriginal.setVolume(initialOriginalVolume);
          console.debug('[TwinPlayers] Applied original volume after transition', { initialOriginalVolume });
        } catch (error) {
          console.error('[TwinPlayers] Failed to set original volume', error);
        }
      }
      if (typeof nextPlayerReaction?.setVolume === 'function') {
        try {
          nextPlayerReaction.setVolume(initialReactionVolume);
          console.debug('[TwinPlayers] Applied reaction volume after transition', { initialReactionVolume });
        } catch (error) {
          console.error('[TwinPlayers] Failed to set reaction volume', error);
        }
      }

      if (!isSameReactionVideo && typeof nextPlayerOriginal?.stopVideo === 'function') {
        try {
          await waitForDomTick();
          nextPlayerOriginal.stopVideo();
          console.debug('[TwinPlayers] Stopped original video after volume application (different reaction)');
        } catch (error) {
          console.error('[TwinPlayers] Failed to stop original video', error);
        }
      }

      if (!preserveReactionTime && canReuseReactionPlayer && typeof nextPlayerReaction?.seekTo === 'function') {
        try {
          nextPlayerReaction.seekTo(Number(derivedReactionData.offsetStartTime) || 0, true);
        } catch {
          // ignore
        }
      }

      if (
        typeof effectivePreviousReactionTime === 'number'
        && typeof nextPlayerReaction?.seekTo === 'function'
        && !canReuseReactionPlayer
      ) {
        try {
          nextPlayerReaction.seekTo(effectivePreviousReactionTime, true);
        } catch {
          // ignore
        }
      }

      try {
        await waitForDomTick();

        if (shouldResetGate && Boolean(options.autoPlay)) {
          satisfyClickGateForAutoplay();
        }

        if (preserveReactionTime && getSnapshot().bothVideosStarted) {
          handleStateChangeInReactionVideo(YT.PlayerState.BUFFERING, YT.PlayerState.PLAYING);
          pollVideoCurrentTime();
        } else if ((isSameReactionVideo && snapshotBefore.bothVideosStarted) || Boolean(options.autoPlay)) {
          syncVideos();
          if (getSnapshot().bothVideosStarted) {
            pollVideoCurrentTime();
          }
        }
      } catch {
        // ignore
      }

      syncCurrentReactionDocumentId(nextReactionDocumentId, updateState);

      await verifyAndSyncMetadata({
        documentId: typeof reactionData?.id === 'string' ? reactionData.id : undefined,
        originalVideoId,
        originalVideoPlatform: nextOriginalVideoPlatform,
        originalVideoUrl: reactionData?.originalVideoUrl,
        reactionVideoId: normalizedReactionVideoId,
        currentOriginalTitle: normalizedOriginalMetadata.title,
        currentOriginalAuthor: normalizedOriginalMetadata.author,
        currentOriginalAuthorUrl: normalizedOriginalMetadata.authorUrl,
        currentOriginalDescription: normalizedOriginalMetadata.description,
        currentReactionTitle: reactionData?.reactionVideoTitle,
        currentReactionAuthor: reactionData?.reactionVideoAuthor
      });
    } finally {
      setSwitchingReactionInPlace(false);
    }
  };

  return {
    setUpVideos,
    loadReactionInPlace,
  };
}
