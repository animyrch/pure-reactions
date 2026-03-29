import { onDestroy, onMount, tick } from 'svelte';
import { get, writable } from 'svelte/store';
import { goto } from '$app/navigation';
import { env } from '$env/dynamic/public';
import {
  getCurrentPlaybackRateFromConfigs,
  getCurrentStateFromStateConfigs,
  getCurrentVolumeFromVolumeConfigs
} from '$lib/helpers/reaction';
import { normalizeOriginalVideoPlatform, getTikTokEmbedUrl } from '$lib/helpers/platform';
import {
  getReaction,
  updateFirebaseDocument,
  firestoreDeleteField,
  getPlaylist,
  getQueueBySlug
} from '$lib/helpers/firebase';
import { writeQueueProgress } from '$lib/helpers/queueProgress';
import {
  downloadBasicVideoDetails,
  extractYouTubeVideoId,
  fetchFirstPlaylistVideos
} from '$lib/helpers/youtube';
import {
  findPlaylistCurrentIndex,
  getPlaylistSequenceItems,
  toPlaylistQueueItem,
} from '$lib/helpers/reactionSequence';
import {
  fetchOriginalVideoMetadata,
  normalizeOriginalVideoMetadata,
  originalVideoMetadataToFirestoreFields,
} from '$lib/helpers/originalVideo';
import {
  deriveTimelines,
  readAutoPlayCookie,
  readCinematicBarsCookie,
  toggleFullscreenBodyClass,
  writeAutoPlayCookie,
  writeCinematicBarsCookie
} from '$lib/helpers/reactionPlayer';
import {
  buildPlayerEventTimeline,
  playbackTimelineArrayToMap,
  roundPlaybackRate,
  roundReactionTime,
  roundTargetTime,
  roundVolume,
  timelineArrayToMap,
  volumeTimelineArrayToMap
} from '$lib/helpers/twinPlayersTimeline';
import {
  computeTwinPlayersSyncTick,
  type TwinPlayersPlayerState,
  type TwinPlayersSyncTracking
} from '$lib/helpers/twinPlayersSyncTick';
import { applyTwinPlayersSyncActions } from '$lib/helpers/twinPlayersSyncApply';
import {
  computeNextSyncDelayMs,
  getNextTimelineEventReactionTime
} from '$lib/helpers/twinPlayersSyncScheduling';

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

type FullscreenPrimaryVideo = 'original' | 'reaction';
type FullscreenOverlayCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-center';

const DISABLE_YOUTUBE_METADATA_SYNC = env.PUBLIC_DISABLE_YOUTUBE_METADATA_SYNC === 'true';

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
  reactorDisplayName?: string;
  reactionVideoTitle?: string;
  reactionVideoDescription?: string;
  originalVideoAuthor?: string;
  originalVideoAuthorUrl?: string;
  originalVideoTitle?: string;
  originalVideoDescription?: string;
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
  isUserPaused: boolean;
  playerConfigs: Record<string, any>;
  volumeConfigs: Record<string, any>;
  reactionVolumeConfigs: Record<string, any>;
  playbackRateConfigs: Record<string, any>;
  stateTimeline: any[];
  volumeTimeline: any[];
  reactionVolumeTimeline: any[];
  playbackRateTimeline: any[];
  overlayVisibilityTimeline: any[];
  reactionTransportTrack: any[];
  playerEventTimeline: any[];
  currentPlaybackRate: number;
  currentStateOriginalVideo: number;
  currentVolumeOriginalVideo: number;
  currentVolumeReactionVideo: number;
  fullscreenOverlayVisible: boolean;
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
  fullscreenPrimaryVideo: FullscreenPrimaryVideo;
  fullscreenOverlayWidthPercent: number;
  fullscreenOverlayCorner: FullscreenOverlayCorner;
  pageSlug: string;
  isOutOfSync: boolean;
  seekMin: number;
  seekMax: number;
  originalVideoPlatform: 'youtube' | 'tiktok';
};

type UseTwinPlayersOptions = {
  data: {
    slug: string;
    userId?: string | null;
    displayName?: string | null;
  };
  enableAutoPlay?: boolean;
};

type LoadReactionInPlaceOptions = {
  preserveReactionTime?: boolean;
  autoPlay?: boolean;
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

type CreateOverlayVisibilityConfigParams = {
  timeInReaction: number;
  visible: boolean;
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

type UpdateOverlayVisibilityConfigParams = {
  timeInReaction: number;
  visible?: boolean;
  previousTimeInReaction?: number;
};

type DeleteOverlayVisibilityConfigParams = {
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
  originalVideoPlatform?: 'youtube' | 'tiktok';
  originalVideoUrl?: string | null;
  reactionVideoId?: string;
  currentOriginalTitle?: string | null;
  currentOriginalAuthor?: string | null;
  currentOriginalAuthorUrl?: string | null;
  currentOriginalDescription?: string | null;
  currentReactionTitle?: string | null;
  currentReactionAuthor?: string | null;
};

export const CONTROLS_FADE_CLASS = 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100';

// Debug toggles
const ENABLE_GATE_DEBUG = false;
const ENABLE_WATCHDOG = false;

// Global tracker for the currently active instance. Only the active instance should handle events.
let globalActiveInstanceId: string | null = null;

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

const DEFAULT_FULLSCREEN_PRIMARY_VIDEO: FullscreenPrimaryVideo = 'original';
const DEFAULT_FULLSCREEN_OVERLAY_WIDTH_PERCENT = 35;
const DEFAULT_FULLSCREEN_OVERLAY_CORNER: FullscreenOverlayCorner = 'top-right';
const FULLSCREEN_OVERLAY_WIDTH_MIN = 5;
const FULLSCREEN_OVERLAY_WIDTH_MAX = 50;
const FULLSCREEN_OVERLAY_WIDTH_STEP = 5;

const normalizeFullscreenPrimaryVideo = (value: unknown): FullscreenPrimaryVideo =>
  value === 'reaction' ? 'reaction' : 'original';

const normalizeFullscreenOverlayCorner = (value: unknown): FullscreenOverlayCorner => {
  if (value === 'top-left' || value === 'top-right' || value === 'bottom-left' || value === 'bottom-right' || value === 'bottom-center') {
    return value;
  }
  return DEFAULT_FULLSCREEN_OVERLAY_CORNER;
};

const normalizeFullscreenOverlayWidthPercent = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_FULLSCREEN_OVERLAY_WIDTH_PERCENT;
  }
  const snapped = Math.round(parsed / FULLSCREEN_OVERLAY_WIDTH_STEP) * FULLSCREEN_OVERLAY_WIDTH_STEP;
  return Math.max(FULLSCREEN_OVERLAY_WIDTH_MIN, Math.min(FULLSCREEN_OVERLAY_WIDTH_MAX, snapped));
};

export function useTwinPlayers({ data, enableAutoPlay = true }: UseTwinPlayersOptions) {
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
    originalVideoAuthorUrl: undefined,
    originalVideoTitle: undefined,
    reactionVideoAuthor: undefined,
    reactorDisplayName: undefined,
    reactionVideoTitle: undefined,
    reactionVideoDescription: undefined,
    originalVideoDescription: undefined,
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
    showCinematicBars: readCinematicBarsCookie(),
    isFullscreen: initialUrlState.isFullscreen,
    isControlSurfaceVisible: false,
    isExitButtonExpanded: false,
    playerOriginal: null,
    playerReaction: null,
    bothVideosStarted: false,
    isUserPaused: false,
    playerConfigs: {},
    volumeConfigs: {},
    reactionVolumeConfigs: {},
    playbackRateConfigs: {},
    stateTimeline: [],
    volumeTimeline: [],
    reactionVolumeTimeline: [],
    playbackRateTimeline: [],
    overlayVisibilityTimeline: [],
    reactionTransportTrack: [],
    playerEventTimeline: [],
    currentPlaybackRate: 1,
    currentStateOriginalVideo: -1,
    currentVolumeOriginalVideo: 100,
    currentVolumeReactionVideo: 100,
    fullscreenOverlayVisible: true,
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
    fullscreenPrimaryVideo: DEFAULT_FULLSCREEN_PRIMARY_VIDEO,
    fullscreenOverlayWidthPercent: DEFAULT_FULLSCREEN_OVERLAY_WIDTH_PERCENT,
    fullscreenOverlayCorner: DEFAULT_FULLSCREEN_OVERLAY_CORNER,
    pageSlug: slug,
    isOutOfSync: false,
    seekMin: 0,
    seekMax: 100000,
    originalVideoPlatform: 'youtube'
  });

  let overlayElement: HTMLDivElement | undefined;
  let controlHideTimeout: ReturnType<typeof setTimeout> | undefined;
  let overlayPointerRestoreTimeout: ReturnType<typeof setTimeout> | undefined;
  let exitButtonCollapseTimeout: ReturnType<typeof setTimeout> | undefined;
  let syncTimeout: ReturnType<typeof setTimeout> | undefined;
  let durationProbeTimeout: ReturnType<typeof setTimeout> | undefined;
  let durationProbeAttempts = 0;
  let escListener: ((event: KeyboardEvent) => void) | undefined;
  let pendingPlayerReadyCount = 0;
  let playerReadyTimeout: ReturnType<typeof setTimeout> | undefined;
  let initRetryCount = 0;
  const MAX_INIT_RETRIES = 3;
  const INIT_RETRY_DELAY = 4000;

  const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';
  let youtubeApiReadyPromise: Promise<void> | null = null;

  let originalVideoClicked = false;
  let reactionVideoClicked = false;
  let clickGateSessionId = 0;
  let clickGateEventSeq = 0;
  const instanceId = (() => {
    if (typeof window === 'undefined') {
      return 'ssr';
    }
    const key = '__twinPlayersInstanceCounter';
    const w = window as any;
    w[key] = (Number(w[key]) || 0) + 1;
    return String(w[key]);
  })();

  // Claim this instance as the active one. Previous instances will be superseded.
  globalActiveInstanceId = instanceId;

  let gateWatchdogInterval: ReturnType<typeof setInterval> | undefined;
  let lastGateWatchdogLogAt = 0;

  let buildInterfaceSeq = 0;
  let initSeq = 0;

  let isDestroyed = false;
  let isSwitchingReactionInPlace = false;
  let lastUserResumeAt = 0;

  // TikTok original-player state (lives alongside the YouTube playerOriginal concept)
  const TIKTOK_ORIGIN = 'https://www.tiktok.com';
  let tiktokOriginalIframe: HTMLIFrameElement | null = null;
  let tiktokOriginalUnlisten: (() => void) | null = null;
  let tiktokOriginalPlayerState = -1; // -1 = unstarted, 1 = playing, 2 = paused

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
  let playlistFetchPromise: Promise<void> | undefined;
  let changingVolume = false;
  let changingReactionVolume = false;
  let changingSpeed = false;
  const syncTracking: TwinPlayersSyncTracking = {
    lastOriginalTargetTime: undefined,
    lastOriginalSeekAt: 0,
    lastOriginalSeekTarget: undefined,
    mobileAudioWinner: null,
    lastSoftSyncAt: 0,
    softSyncIsActive: false,
    softSyncResetTimeoutId: undefined
  };

  const isMobileAudioEnvironment = () => {
    if (typeof navigator === 'undefined') {
      return false;
    }
    const ua = String(navigator.userAgent || '');
    if (/iPhone|iPad|iPod|Android/i.test(ua)) {
      return true;
    }
    // iPadOS can masquerade as macOS (Safari reports Macintosh) but still behaves like mobile for autoplay/audio.
    const isIpadOs = /Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1;
    return isIpadOs;
  };

  toggleFullscreenBodyClass(initialUrlState.isFullscreen);

  const updateState = (partial: Partial<TwinPlayersState> | ((value: TwinPlayersState) => Partial<TwinPlayersState>)) => {
    state.update((value) => {
      const patch = typeof partial === 'function' ? partial(value) : partial;
      const nextValue = {
        ...value,
        ...patch
      };

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

      return nextValue;
    });
  };

  const finalizeLoadingState = () => {
    pendingPlayerReadyCount = 0;
    clearTimeout(playerReadyTimeout);
    playerReadyTimeout = undefined;
    updateState({ isLoading: false });
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

  const scheduleLoadingFallback = () => {
    clearTimeout(playerReadyTimeout);
    if (pendingPlayerReadyCount === 0) {
      return;
    }
    playerReadyTimeout = setTimeout(() => {
      // Check if players are actually functional
      if (!arePlayersActuallyReady() && initRetryCount < MAX_INIT_RETRIES && globalActiveInstanceId === instanceId && !isDestroyed) {
        console.warn(`[TwinPlayers] Players not ready after ${INIT_RETRY_DELAY}ms, retrying (attempt ${initRetryCount + 1}/${MAX_INIT_RETRIES})`);
        initRetryCount++;
        // Destroy current players and rebuild
        const snapshot = get(state);
        try {
          snapshot.playerOriginal?.destroy?.();
          snapshot.playerReaction?.destroy?.();
        } catch {
          // ignore
        }
        updateState({ playerOriginal: null, playerReaction: null });
        // Rebuild after a short delay
        setTimeout(async () => {
          if (globalActiveInstanceId === instanceId && !isDestroyed) {
            const slug = get(state).pageSlug;
            if (slug) {
              await buildInterface(slug, { isUpdate: true });
            }
          }
        }, 500);
      } else {
        finalizeLoadingState();
      }
    }, INIT_RETRY_DELAY);
  };

  const waitForPlayerElements = async (maxAttempts = 10, delayMs = 100): Promise<boolean> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (document.getElementById('player-original') && document.getElementById('player-reaction')) {
        return true;
      }
      // Only player-original is required (reaction video element might not exist for some edge cases)
      if (document.getElementById('player-original')) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return document.getElementById('player-original') !== null;
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
    playWithTrace('reaction', playerReaction, 'startReactionVideo');
  };

  const startOriginalVideo = () => {
    const snapshot = get(state);
    if (snapshot.playerOriginal) {
      snapshot.playerOriginal.setPlaybackRate(snapshot.currentPlaybackRate);
      playWithTrace('original', snapshot.playerOriginal, 'startOriginalVideo');
    }
  };

  const pauseOriginalVideo = () => {
    console.debug('[TwinPlayers] pauseOriginalVideo called', new Error().stack?.split('\n').slice(1, 4).join(' | '));
    pausePlayerWithTrace('original', get(state).playerOriginal, 'pauseOriginalVideo');
  };

  const pauseReactionVideo = () => {
    pausePlayerWithTrace('reaction', get(state).playerReaction, 'pauseReactionVideo');
  };

  const controlReactionVideo = (nextState: number) => {
    const ytPlaying = typeof YT?.PlayerState?.PLAYING === 'number' ? YT.PlayerState.PLAYING : 1;
    const ytPaused = typeof YT?.PlayerState?.PAUSED === 'number' ? YT.PlayerState.PAUSED : 2;
    if (nextState === ytPlaying) {
      startReactionVideo();
    } else if (nextState === ytPaused) {
      pauseReactionVideo();
    }
  };

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
    if (!ENABLE_GATE_DEBUG || typeof window === 'undefined') {
      return;
    }
    window.setTimeout(() => {
      const snapshot = get(state);
      debugClickGate(`[TwinPlayers] ${label} VERIFY`, {
        ...getPlayerDebugInfo(target),
        playerState: stateName(getPlayerStateSafely(target)),
        currentTime: typeof target?.getCurrentTime === 'function' ? target.getCurrentTime() : undefined,
        gateSatisfied: originalVideoClicked && reactionVideoClicked,
        bothVideosStarted: snapshot.bothVideosStarted
      });
    }, 120);
  };

  const pausePlayerWithTrace = (which: 'original' | 'reaction', target: any, reason: string, retryCount = 0) => {
    if (!ENABLE_GATE_DEBUG) {
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
    if (!ENABLE_GATE_DEBUG) {
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
    if (isMobileAudioEnvironment()) {
      return;
    }

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
    const { playerOriginal } = get(state);
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

  const goToSecondsInReactionVideo = (seconds: number) => {
    const normalized = Number(seconds);
    if (!Number.isFinite(normalized)) {
      return;
    }

    const snapshot = get(state);

    // Defensive bounds handling:
    // During early player lifecycle (or some in-place loads), seekMax can temporarily equal seekMin
    // (e.g., when duration is still 0). If we clamp against that, every seek snaps back to start.
    const seekMin = Number.isFinite(snapshot.seekMin) && snapshot.seekMin >= 0 ? snapshot.seekMin : 0;
    const rawFinish = Number(snapshot.reactionFinishTime);
    const finishCap = Number.isFinite(rawFinish) && rawFinish > 0 ? rawFinish : Number.POSITIVE_INFINITY;

    let effectiveSeekMax = Number(snapshot.seekMax);
    if (!Number.isFinite(effectiveSeekMax) || effectiveSeekMax <= seekMin) {
      const durationFromPlayer =
        typeof snapshot.playerReaction?.getDuration === 'function' ? Number(snapshot.playerReaction.getDuration()) : Number.NaN;
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
    snapshot = get(state)
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
      targetTime += Math.max(normalizedReactionTime - anchorTime, 0);
    }

    return {
      desiredState,
      targetTime,
      reactionTime: Number.isFinite(normalizedReactionTime) ? normalizedReactionTime : 0
    };
  };

  const applyOriginalPlaybackForReactionTime = (
    reactionTime: number,
    snapshot = get(state),
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
    const originalStateNow = getPlayerStateSafely(get(state).playerOriginal);
    const shouldSuppressSeek =
      isMobileLazySyncEnabled
      && originalStateNow === YT?.PlayerState?.BUFFERING;

    if (targetChanged) {
      if (!shouldSuppressSeek) {
        goToSecondsInOriginalVideo(normalizedTarget, {
          allowSeekAhead: options.allowSeekAhead,
          throttleMs: options.throttleMs,
          force: options.forceSeek
        });
      }
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

    // Do not update lastOriginalTargetTime here unless a seek was actually applied.
    // lastOriginalTargetTime is updated in goToSecondsInOriginalVideo() and via actual player time sampling.
  };

  const pollVideoCurrentTime = () => {
    stopSyncScheduler();
    let reactionPlayerState = YT?.PlayerState?.UNSTARTED ?? -1;

    const runSyncCycle = () => {
      const snapshot = get(state);
      if (isSwitchingReactionInPlace) {
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

      // User pause override: while paused, do NOT run sync/state logic.
      // We still enforce pausing in case a player continues playing due to missed events.
      if (snapshot.isUserPaused) {
        const originalState = getPlayerStateSafely(playerOriginal);
        if (originalState === YT.PlayerState.PLAYING || originalState === YT.PlayerState.BUFFERING) {
          pausePlayerWithTrace('original', playerOriginal, 'userPaused override');
        }
        const reactionState = getPlayerStateSafely(playerReaction);
        if (reactionState === YT.PlayerState.PLAYING || reactionState === YT.PlayerState.BUFFERING) {
          pausePlayerWithTrace('reaction', playerReaction, 'userPaused override');
        }

        // Keep the local state tracker aligned while paused so we don't interpret
        // a stale PLAYING -> PAUSED transition on resume and unnecessarily re-pause.
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
      
      // If the reaction video is UNSTARTED or CUED (e.g., after autoplay transition),
      // pause the original video and wait for user interaction to start both videos
      if (newReactionState === YT?.PlayerState?.UNSTARTED || newReactionState === YT?.PlayerState?.CUED) {
        const originalState = getPlayerStateSafely(playerOriginal);
        if (originalState === YT.PlayerState.PLAYING || originalState === YT.PlayerState.BUFFERING) {
          pausePlayerWithTrace('original', playerOriginal, 'reaction UNSTARTED/CUED during sync loop');
        }
        scheduleNextSync(250, runSyncCycle);
        return;
      }      

      const previousReactionTime = snapshot.reactionCurrentTime;
      const reactionCurrentTime = parseFloat(playerReaction.getCurrentTime().toFixed(1));
      const rawDuration = typeof playerReaction.getDuration === 'function' ? Number(playerReaction.getDuration()) : Number.NaN;
      // console.log('Polling reaction time:', reactionCurrentTime, 'of', rawDuration);
      const reactionDuration = Number.isFinite(rawDuration) ? rawDuration : snapshot.reactionDuration;
      if (reactionCurrentTime !== snapshot.reactionCurrentTime || Math.abs(reactionDuration - snapshot.reactionDuration) > 0.1) {
        // Re-calculate seekMin/seekMax whenever duration/time updates significantly
        const rawMin = Number(snapshot.offsetStartTime);
        const seekMin = Number.isFinite(rawMin) && rawMin >= 0 ? rawMin : 0;
        const rawDuration = Number.isFinite(reactionDuration) && reactionDuration > 0 ? reactionDuration : Number.POSITIVE_INFINITY;
        const rawFinish = Number(snapshot.reactionFinishTime);
        const finishCap = Number.isFinite(rawFinish) && rawFinish > 0 ? rawFinish : Number.POSITIVE_INFINITY;
        const seekMax = Math.max(seekMin, Math.min(rawDuration, finishCap));

        updateState({ reactionCurrentTime, reactionDuration, seekMin, seekMax });
      }
      if (reactionFinishTime > 0 && reactionCurrentTime > reactionFinishTime) {
        pauseOriginalVideo();

        if (!isPlaylistAutoPlay && !isQueueAutoPlay) {
          pauseReactionVideo();
        }

        stopSyncScheduler();
        if (isPlaylistAutoPlay && hasNextIndexInPlaylist) {
          loadNextReactionInPlaylist();
        }
        if (isQueueAutoPlay) {
          loadNextReactionInQueue();
        }
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
          overlayVisibilityTimeline: snapshot.overlayVisibilityTimeline,
          stateTimeline: snapshot.stateTimeline,
          reactionTransportTrack: snapshot.reactionTransportTrack,
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

      // Debug: log any actions that affect the original's state
      const pausingOriginalActions = result.actions.filter(
        (a: any) => (a.type === 'pauseOriginal') ||
          (a.type === 'applyOriginalStateChange' && Number(a.nextState) !== (typeof YT?.PlayerState?.PLAYING === 'number' ? YT.PlayerState.PLAYING : 1))
      );
      if (pausingOriginalActions.length > 0) {
        console.debug('[TwinPlayers] sync tick emitting actions that may pause original', {
          actions: pausingOriginalActions,
          reactionPlayerState,
          isFineTuneModeOn: snapshot.isFineTuneModeOn,
          reactionCurrentTime,
          currentStateOriginalVideo: snapshot.currentStateOriginalVideo
        });
      }

      // Handle soft-sync actions separately
      const softSyncAction = result.actions.find((a: any) => a.type === 'applySoftSync');
      
      // Filter out playback rate actions if soft-sync is active or being applied
      // to prevent conflicts
      const filteredActions = softSyncAction || syncTracking.softSyncIsActive
        ? result.actions.filter((a: any) => a.type !== 'setOriginalPlaybackRate')
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
          controlReactionVideo,
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

      // Apply soft-sync action if present
      if (softSyncAction && 'rate' in softSyncAction && 'durationMs' in softSyncAction) {
        // Clear any existing soft-sync timeout
        if (typeof syncTracking.softSyncResetTimeoutId === 'number') {
          clearTimeout(syncTracking.softSyncResetTimeoutId);
          syncTracking.softSyncResetTimeoutId = undefined;
        }

        // Apply the playback rate for soft-sync
        if (!changingSpeed && playerOriginal) {
          changingSpeed = true;
          setPlaybackRateForOriginalVideo(softSyncAction.rate);
          changingSpeed = false;
          
          // Schedule reset to desired playback rate from configs
          const desiredRate = getCurrentPlaybackRateFromConfigs(
            reactionCurrentTime,
            snapshot.playbackRateConfigs,
            snapshot.timeOffset
          );

          syncTracking.softSyncResetTimeoutId = setTimeout(() => {
            if (!changingSpeed && playerOriginal) {
              changingSpeed = true;
              setPlaybackRateForOriginalVideo(desiredRate);
              updateState({ currentPlaybackRate: desiredRate });
              changingSpeed = false;
            }
            syncTracking.softSyncIsActive = false;
            syncTracking.softSyncResetTimeoutId = undefined;
          }, softSyncAction.durationMs) as any;
        }
      } else if (syncTracking.softSyncIsActive && !softSyncAction) {
        // Soft-sync was active but no longer needed - reset immediately
        if (typeof syncTracking.softSyncResetTimeoutId === 'number') {
          clearTimeout(syncTracking.softSyncResetTimeoutId);
          syncTracking.softSyncResetTimeoutId = undefined;
        }
        
        const desiredRate = getCurrentPlaybackRateFromConfigs(
          reactionCurrentTime,
          snapshot.playbackRateConfigs,
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

      // Apply overlay visibility state updates
      if (typeof result.stateUpdates.fullscreenOverlayVisible === 'boolean') {
        updateState({ fullscreenOverlayVisible: result.stateUpdates.fullscreenOverlayVisible });
      }

      // Boundary-aware scheduling: wake up near the next relevant timeline change.
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
        }),
        // Reaction transport track uses raw reaction time (no offset)
        getNextTimelineEventReactionTime(snapshot.reactionTransportTrack, {
          reactionCurrentTime,
          timeOffset: 0,
          seekMin: snapshot.seekMin,
          seekMax: snapshot.seekMax
        })
      ].filter((t): t is number => typeof t === 'number');

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
      // If the reactionTransportTrack intends the reaction to be paused at the current
      // reaction time, the original should keep playing independently — that's the whole
      // purpose of the transport track. Only cascade the pause to the original when the
      // transport track does NOT account for this pause (i.e., it's user-initiated).
      const snapshot = get(state);
      const ytPaused = typeof YT?.PlayerState?.PAUSED === 'number' ? YT.PlayerState.PAUSED : 2;
      const rtTrack = Array.isArray(snapshot.reactionTransportTrack) ? snapshot.reactionTransportTrack : [];
      const reactionTime = typeof snapshot.playerReaction?.getCurrentTime === 'function'
        ? Number(snapshot.playerReaction.getCurrentTime())
        : Number(snapshot.reactionCurrentTime);

      // Find the last transport track entry at or before the current reaction time.
      let transportTrackIntendsPause = false;
      if (rtTrack.length > 0 && Number.isFinite(reactionTime)) {
        for (let i = rtTrack.length - 1; i >= 0; i--) {
          const entryTime = Number(rtTrack[i]?.t);
          // Allow a small window (0.5s) so that detection-lag doesn't cause false negatives.
          if (Number.isFinite(entryTime) && entryTime <= reactionTime + 0.5) {
            transportTrackIntendsPause = Number(rtTrack[i]?.state) === ytPaused;
            console.debug('[TwinPlayers] handleStateChangeInReactionVideo — transport track check', {
              reactionTime,
              entryTime,
              entryState: rtTrack[i]?.state,
              transportTrackIntendsPause,
              previousState,
              nextState
            });
            break;
          }
        }
      }

      if (transportTrackIntendsPause) {
        // Programmatic pause — let the original keep playing.
        console.debug('[TwinPlayers] handleStateChangeInReactionVideo — skipping pauseOriginal (transport track)');
      } else {
        console.debug('[TwinPlayers] handleStateChangeInReactionVideo — cascading pauseOriginal (user pause)');
        pauseOriginalVideo();
      }
    }

    // When reaction playback begins (including resume), bring the original into the
    // desired state/position. Previously we only handled BUFFERING -> PLAYING which can miss
    // PAUSED/CUED -> PLAYING transitions and lead to multi-second desync.
    if (nextState === YT.PlayerState.PLAYING && previousState !== YT.PlayerState.PLAYING) {
      const snapshot = get(state);
      const reactionNow = typeof snapshot.playerReaction?.getCurrentTime === 'function'
        ? Number(snapshot.playerReaction.getCurrentTime())
        : Number(snapshot.reactionCurrentTime);

      // Fast-resume path: seeking the original immediately on resume can trigger buffering that
      // makes it start noticeably later than the reaction. Start it ASAP, then let the polling
      // sync loop correct drift on subsequent ticks.
      if (Date.now() - lastUserResumeAt < 1200) {
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
    if (isDestroyed || globalActiveInstanceId !== instanceId) {
      debugClickGate('[TwinPlayers] onPlayerReady IGNORED (instance superseded)', {
        isDestroyed,
        globalActiveInstanceId
      });
      return;
    }
    markPlayerReady();
    // console.log('Player ready event for', event?.target);
    const snapshot = get(state);
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
    const snapshot = get(state);
    debugClickGate('[TwinPlayers] startVideos invoked', { reactionVideoId: snapshot.reactionVideoId }, true);
    if (!snapshot.playerReaction) {
      debugClickGate('[TwinPlayers] startVideos aborted (missing reaction player)', {
        reactionVideoId: snapshot.reactionVideoId
      });
      return;
    }

    // Set the gate flag BEFORE triggering playVideo().
    // Otherwise, YT can emit PLAYING synchronously, and the stateChange handler may re-pause.
    updateState({ bothVideosStarted: true });
    debugClickGate('[TwinPlayers] bothVideosStarted set true via startVideos gate release', {
      offsetStartTime: snapshot.offsetStartTime,
      playbackRate: snapshot.currentPlaybackRate
    });

    // Initialize the original video to the correct state and position
    // based on the timeline config at offsetStartTime
    const startTime = snapshot.offsetStartTime || 0;
    const initialConfig = getCurrentStateFromStateConfigs(
      startTime,
      snapshot.playerConfigs,
      snapshot.timeOffset
    );

    const rawInitialState = Number(initialConfig.state);
    const initialState = Number.isFinite(rawInitialState) ? rawInitialState : -1;
    const initialTargetTime = Number(initialConfig.time ?? 0);

    // Apply initial volume/mute BEFORE any playVideo() to prevent an audible blip.
    // This is also where mobile audio arbitration is decided.
    syncTracking.mobileAudioWinner = null;

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
        overlayVisibilityTimeline: snapshot.overlayVisibilityTimeline,
        stateTimeline: snapshot.stateTimeline,
        reactionTransportTrack: snapshot.reactionTransportTrack,
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
        controlReactionVideo,
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

    // Set the original video to the correct starting position and state
    if (Number.isFinite(initialTargetTime)) {
      goToSecondsInOriginalVideo(initialTargetTime);
    }

    // Initialize state tracking
    updateState({ currentStateOriginalVideo: initialState });

    // Set the original video to play or pause based on the config
    if (initialState === YT.PlayerState.PLAYING) {
      startOriginalVideo();
    } else {
      pauseOriginalVideo();
    }


    // Force the reaction video to the correct time BEFORE starting playback.
    // This addresses the drift issue where one player might have progressed slightly
    // while waiting for the other in the click gate.
    goToSecondsInReactionVideo(startTime);
    debugClickGate('[TwinPlayers] startVideos forced reaction seek', { startTime });

    setPlaybackRateForOriginalVideo(snapshot.currentPlaybackRate);
    startReactionVideo();
    pollVideoCurrentTime();
  };

  const onStateChangeOriginal = (event: any) => {
    if (isDestroyed || globalActiveInstanceId !== instanceId) {
      debugClickGate('[TwinPlayers] original stateChange IGNORED (instance superseded)', {
        state: event?.data,
        stateName: stateName(event?.data),
        isDestroyed,
        globalActiveInstanceId
      });
      // Force pause the player since this instance is no longer active
      try {
        event?.target?.pauseVideo?.();
      } catch {
        // ignore
      }
      return;
    }

    // If the user explicitly paused, ignore any attempt to (re)start playback.
    if (get(state).isUserPaused && (event?.data === YT.PlayerState.PLAYING || event?.data === YT.PlayerState.BUFFERING)) {
      pausePlayerWithTrace('original', event?.target ?? get(state).playerOriginal, 'userPaused override (stateChange)');
      return;
    }

    enforceReactionMuteMode(typeof event?.data === 'number' ? event.data : undefined);
    debugClickGate('[TwinPlayers] original stateChange', {
      state: event?.data,
      stateName: stateName(event?.data),
      ...getPlayerDebugInfo(event?.target)
    }, true);
    if (event.data === YT.PlayerState.PLAYING) {
      const snapshot = get(state);
      const playerInfo = getPlayerDebugInfo(event?.target);
      const wasClicked = originalVideoClicked;
      if (!originalVideoClicked) {
        originalVideoClicked = true;
      }

      debugClickGate('[TwinPlayers] original PLAYING event', {
        state: event.data,
        stateName: stateName(event.data),
        clickedFlagChanged: !wasClicked,
        targetIsStatePlayer: event?.target === snapshot.playerOriginal,
        ...playerInfo
      }, true);

      if (!snapshot.bothVideosStarted) {
        const gateSatisfied = originalVideoClicked && reactionVideoClicked;

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
        return;
      }
    }
  };

  const onStateChangeReaction = async (event: any) => {
    if (isDestroyed || globalActiveInstanceId !== instanceId) {
      debugClickGate('[TwinPlayers] reaction stateChange IGNORED (instance superseded)', {
        state: event?.data,
        stateName: stateName(event?.data),
        isDestroyed,
        globalActiveInstanceId
      });
      // Force pause the player since this instance is no longer active
      try {
        event?.target?.pauseVideo?.();
      } catch {
        // ignore
      }
      return;
    }

    // If the user explicitly paused, ignore any attempt to (re)start playback.
    if (get(state).isUserPaused && (event?.data === YT.PlayerState.PLAYING || event?.data === YT.PlayerState.BUFFERING)) {
      pausePlayerWithTrace('reaction', event?.target ?? get(state).playerReaction, 'userPaused override (stateChange)');
      return;
    }

    const snapshot = get(state);
    const isCurrentReactionPlayer = event?.target === snapshot.playerReaction;
    if (!isCurrentReactionPlayer) {
      debugClickGate('[TwinPlayers] reaction stateChange IGNORED (stale player)', {
        state: event?.data,
        stateName: stateName(event?.data),
        ...getPlayerDebugInfo(event?.target)
      }, true);
      return;
    }

    if (isSwitchingReactionInPlace) {
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
    if (event.data === YT.PlayerState.ENDED && get(state).isPlaylistAutoPlay) {
      if (get(state).hasNextIndexInPlaylist) {
        loadNextReactionInPlaylist();
      }
    }
    if (event.data === YT.PlayerState.ENDED && get(state).isQueueAutoPlay) {
      loadNextReactionInQueue();
    }
    if (event.data === YT.PlayerState.PLAYING) {
      const snapshot = get(state);
      const playerInfo = getPlayerDebugInfo(event?.target);
      const wasClicked = reactionVideoClicked;
      if (!reactionVideoClicked) {
        reactionVideoClicked = true;
      }

      debugClickGate('[TwinPlayers] reaction PLAYING event', {
        state: event.data,
        stateName: stateName(event.data),
        clickedFlagChanged: !wasClicked,
        targetIsStatePlayer: event?.target === snapshot.playerReaction,
        ...playerInfo
      }, true);

      if (!snapshot.bothVideosStarted) {
        const gateSatisfied = originalVideoClicked && reactionVideoClicked;
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

  const setPlaylistData = async (
    playlistId: string | null | undefined,
    youtubePlaylistId?: string,
    currentReactionDocumentId?: string,
    currentOriginalVideoId?: string,
  ) => {
    if (!playlistId) {
      updateState({ playlistItems: [], playlistDocument: undefined, hasNextIndexInPlaylist: false });
      return;
    }
    playlistFetchPromise = (async () => {
      const playlistDocument = await getPlaylist(playlistId);
      const snapshot = get(state);
      const sequenceItems = getPlaylistSequenceItems(playlistDocument);
      if (sequenceItems.length) {
        const playlistItems = sequenceItems.map((item: any, index: number) =>
          toPlaylistQueueItem(item, index),
        );
        const currentIndex = findPlaylistCurrentIndex({
          playlistDocument,
          reactionDocumentId: currentReactionDocumentId ?? snapshot.pageSlug,
          originalVideoId: currentOriginalVideoId ?? snapshot.originalVideoId,
        });
        updateState({
          playlistItems,
          playlistDocument,
          hasNextIndexInPlaylist: currentIndex >= 0 && currentIndex < playlistItems.length - 1,
          currentIndexInPlaylist: currentIndex >= 0 ? currentIndex : 0
        });
        return;
      }
      if (!youtubePlaylistId) {
        updateState({ playlistItems: [], playlistDocument, hasNextIndexInPlaylist: false, currentIndexInPlaylist: 0 });
        return;
      }
      const playlistItems = await fetchFirstPlaylistVideos(youtubePlaylistId);
      const filteredItems = playlistItems.filter((item: any) => playlistDocument.originalVideoIds.includes(item.snippet.resourceId.videoId));
      const targetOriginalVideoId = currentOriginalVideoId ?? snapshot.originalVideoId;
      const currentIndex = filteredItems.findIndex((item: any) => item.snippet.resourceId.videoId === targetOriginalVideoId);
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
    await setPlaylistData(
      playlistDocumentId,
      snapshot.youtubePlaylistId,
      snapshot.pageSlug,
      snapshot.originalVideoId,
    );
  };

  const updateUIElements = (slugValue: string) => {
    updateState({ pageSlug: slugValue });
    if (typeof window !== 'undefined') {
      (window as any).currentReactionDocumentId = slugValue;
    }
  };

  /**
   * Destroys any currently active TikTok original-player iframe and listener.
   * Called at the start of setUpVideos so a fresh iframe can be injected.
   */
  const destroyTikTokOriginalPlayer = () => {
    if (tiktokOriginalUnlisten) {
      tiktokOriginalUnlisten();
      tiktokOriginalUnlisten = null;
    }
    if (tiktokOriginalIframe) {
      tiktokOriginalIframe.remove();
      tiktokOriginalIframe = null;
    }
    tiktokOriginalPlayerState = -1;
  };

  const restorePlayerContainer = (containerId: string) => {
    const container = document.getElementById(containerId);
    if (container && container.tagName === 'IFRAME') {
      const parent = container.parentElement;
      if (parent) {
        const newDiv = document.createElement('div');
        newDiv.id = containerId;
        newDiv.className = container.className;
        parent.replaceChild(newDiv, container);
      }
    }
  };

  /**
   * Creates a TikTok iframe inside #player-original and returns a YouTube-like
   * mock player object so the rest of the composable can treat it uniformly.
   */
  const createTikTokOriginalPlayer = (videoId: string) => {
    const container = document.getElementById('player-original');
    if (!container) return null;

    // Clear any previous content (e.g. stale TikTok iframes)
    container.innerHTML = '';

    const iframe = document.createElement('iframe');
    iframe.src = getTikTokEmbedUrl(videoId);
    iframe.title = `TikTok video ${videoId}`;
    iframe.style.cssText = 'width:100%;height:100%;border:0;';
    iframe.allow = 'autoplay; encrypted-media; fullscreen';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    container.appendChild(iframe);
    tiktokOriginalIframe = iframe;
    tiktokOriginalPlayerState = -1;

    const postToTikTok = (type: string, value?: any) => {
      iframe.contentWindow?.postMessage(
        { type, value, 'x-tiktok-player': true },
        TIKTOK_ORIGIN,
      );
    };

    let mockPlayer: any;

    const forwardTikTokStateChange = (stateValue: number) => {
      if (!mockPlayer) {
        return;
      }

      onStateChangeOriginal({
        data: stateValue,
        target: mockPlayer
      });
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== TIKTOK_ORIGIN) return;
      const message = event.data;
      if (!message || typeof message !== 'object') return;

      if (message.type === 'onPlayerReady') {
        tiktokOriginalPlayerState = -1; // unstarted (ready but not yet playing)
        markPlayerReady();
        // Send the first unmute immediately. A second attempt fires after 250 ms because
        // TikTok's player sometimes processes the first command before its internal audio
        // context is fully initialised and silently drops it.
        postToTikTok('unMute');
        setTimeout(() => postToTikTok('unMute'), 250);
      }

      if (message.type === 'onStateChange') {
        if (message.value === 1) {
          tiktokOriginalPlayerState = 1; // playing
          forwardTikTokStateChange(1);
        } else if (message.value === 2) {
          tiktokOriginalPlayerState = 2; // paused
          forwardTikTokStateChange(2);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    tiktokOriginalUnlisten = () => window.removeEventListener('message', handleMessage);

    // Return a YouTube-like mock so all sync/control paths work without branching.
    //
    // TikTok platform limitations (enforced here and in twinPlayersSyncApply.ts):
    //  - getCurrentTime / getDuration always return 0: TikTok's player/v1 postMessage API
    //    does not expose playback position or duration, so sync drift-correction is disabled
    //    for the original video. The reaction video timeline still drives the sync scheduler.
    //  - seekTo is a no-op: TikTok does not expose a seek command via postMessage.
    //  - setPlaybackRate is a no-op: speed changes for TikTok originals are already suppressed
    //    by the isTikTokOriginal flag passed to applyTwinPlayersSyncActions.
    //  - setVolume is binary (mute/unmute): TikTok volume is 0 or 100. Values in between are
    //    snapped by the applyTwinPlayersSyncActions layer before reaching this mock.
    mockPlayer = {
      getPlayerState: () => tiktokOriginalPlayerState,
      getCurrentTime: () => 0,
      getDuration: () => 0,
      isMuted: () => false,
      seekTo: () => {},
      setVolume: (v: number) => {
        if (v >= 100) {
          postToTikTok('unMute');
        } else {
          postToTikTok('mute');
        }
      },
      setPlaybackRate: () => {},
      playVideo: () => {
        postToTikTok('unMute');
        postToTikTok('play');
        tiktokOriginalPlayerState = 1;
      },
      pauseVideo: () => {
        postToTikTok('pause');
        tiktokOriginalPlayerState = 2;
      },
      stopVideo: () => {
        postToTikTok('pause');
        tiktokOriginalPlayerState = 2;
      },
      cueVideoById: () => {},
      loadVideoById: () => {},
      getIframe: () => iframe,
      destroy: () => {
        destroyTikTokOriginalPlayer();
      },
    };

    return mockPlayer;
  };

  const setUpVideos = async (reactionData: any) => {


    log('setUpVideos called', { reactionDataExists: !!reactionData });
    // CRITICAL: Abort if this instance has been superseded
    if (globalActiveInstanceId !== instanceId) {
      debugClickGate('[TwinPlayers] setUpVideos aborted (instance superseded)', {
        globalActiveInstanceId,
        reactionVideoId: reactionData?.reactionVideoId
      });
      log('setUpVideos aborted: instance superseded', { globalActiveInstanceId, instanceId });
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
        fullscreenOverlayWidthPercent: DEFAULT_FULLSCREEN_OVERLAY_WIDTH_PERCENT,
        fullscreenOverlayCorner: DEFAULT_FULLSCREEN_OVERLAY_CORNER
      });
      return;
    }

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
        isReactionAutoMuted: false,
        fullscreenPrimaryVideo: DEFAULT_FULLSCREEN_PRIMARY_VIDEO,
        fullscreenOverlayWidthPercent: DEFAULT_FULLSCREEN_OVERLAY_WIDTH_PERCENT,
        fullscreenOverlayCorner: DEFAULT_FULLSCREEN_OVERLAY_CORNER
      });
      return;
    }
    const youtubePlaylistId = reactionData['youtubePlaylistId'];
    const rawOffsetStartTime = Number(reactionData['offsetStartTime'] ?? 0);
    const offsetStartTime = Number.isFinite(rawOffsetStartTime) && rawOffsetStartTime >= 0
      ? Math.round(rawOffsetStartTime * 10) / 10
      : 0;
    const reactionFinishTime = parseFloat(reactionData['reactionFinishTime']) || 0;
    const timeOffset = reactionData['timeOffset'] || 0;
    const globalGainValue = reactionData['globalGain'];
    const globalGain = typeof globalGainValue === 'number' && !Number.isNaN(globalGainValue) ? globalGainValue : 1.0;
    const soundLevel = Math.max(0, Math.min(200, Math.round(globalGain * 100)));
    const fullscreenPrimaryVideo = normalizeFullscreenPrimaryVideo(reactionData['fullscreenPrimaryVideo']);
    const fullscreenOverlayWidthPercent = normalizeFullscreenOverlayWidthPercent(reactionData['fullscreenOverlayWidthPercent']);
    const fullscreenOverlayCorner = normalizeFullscreenOverlayCorner(reactionData['fullscreenOverlayCorner']);

    const {
      playerConfigs,
      volumeConfigs,
      reactionVolumeConfigs,
      playbackRateConfigs,
      stateTimeline,
      volumeTimeline,
      reactionVolumeTimeline,
      playbackRateTimeline,
      overlayVisibilityTimeline,
      reactionTransportTrack
    } = deriveTimelines(reactionData);

    window.playerConfigs = reactionData['stateTimeline'] || reactionData['reactionConfigs'];
    window.volumeConfigs = reactionData['volumeTimeline'] || reactionData['volumeConfigs'];
    (window as any).reactionVolumeConfigs = reactionData['reactionVolumeTimeline'] || reactionData['reactionVolumeConfigs'];
    window.playbackRateConfigs = reactionData['playbackTimeline'] || reactionData['playbackRateConfigs'];

    const normalizedPlayerEvents = buildPlayerEventTimeline(stateTimeline);

    // Compute initial target time for the original video based on state configs at offsetStartTime
    const initialConfig = getCurrentStateFromStateConfigs(
      offsetStartTime || 0,
      stateTimeline,
      timeOffset
    );
    const initialTargetTime = Number(initialConfig.time ?? 0);

    // Compute initial volumes from the configurations at offsetStartTime
    const initialOriginalVolume = getCurrentVolumeFromVolumeConfigs(
      offsetStartTime || 0,
      volumeConfigs,
      globalGain,
      timeOffset
    );
    const initialReactionVolume = getCurrentVolumeFromVolumeConfigs(
      offsetStartTime || 0,
      reactionVolumeConfigs,
      1.0,
      timeOffset
    );

    const currentPlaybackRate = getCurrentPlaybackRateFromConfigs(offsetStartTime || 0, playbackRateConfigs, timeOffset);

    const playerOriginal = get(state).playerOriginal;
    const playerReaction = get(state).playerReaction;

    // Properly destroy existing players
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

    // Clean up any existing TikTok iframe before (re)creating players
    destroyTikTokOriginalPlayer();

    // Clean up any orphaned iframes that YouTube may have left behind
    // This can happen during client-side navigation if the player wasn't properly destroyed
    restorePlayerContainer('player-original');
    restorePlayerContainer('player-reaction');

    // Reset the click-to-start gate whenever we recreate players.
    originalVideoClicked = false;
    reactionVideoClicked = false;
    clickGateSessionId += 1;
    debugClickGate('[TwinPlayers] click gate reset', {
      source: 'setUpVideos',
      reactionVideoId,
      originalVideoId
    }, true);

    resetReactionDurationProbe();
    resetOriginalStateTracking();

    // --- Compute metadata from Firestore data BEFORE player creation ---
    // This ensures metadata (author, reactor, titles) is in state even if YT
    // player initialization fails (e.g. mobile CI environments).
    const resolvedReactorId =
      typeof reactionData?.reactorId === 'string'
        ? reactionData.reactorId
        : typeof reactionData?.userId === 'string'
          ? reactionData.userId
          : undefined;
    const rawReactorDisplayName =
      typeof reactionData?.reactorDisplayName === 'string' ? reactionData.reactorDisplayName.trim() : '';
    const viewerDisplayName = typeof data?.displayName === 'string' ? data.displayName.trim() : '';
    const resolvedReactorDisplayName =
      rawReactorDisplayName || (reactionData?.reactorId === userId ? viewerDisplayName : '');
    const reactionVideoDescription =
      (typeof reactionData?.reactionVideoDescription === 'string'
        ? reactionData.reactionVideoDescription.trim()
        : '') ||
      (typeof reactionData?.youtube?.meta?.description === 'string'
        ? reactionData.youtube.meta.description.trim()
        : '') ||
      undefined;
    const normalizedOriginalMetadata = normalizeOriginalVideoMetadata(reactionData);

    // Set metadata + timeline state before attempting player creation so the
    // UI always has Firestore-sourced data (attribution, creator details, etc.)
    // regardless of whether YouTube players initialise successfully.
    updateState({
      isPublished: reactionData.isPublished,
      isReactionMissing: !reactionVideoId,
      reactorId: resolvedReactorId,
      isUsersOwnVideo: resolvedReactorId === userId,
      canShowEditModeButton: resolvedReactorId === userId,
      playerConfigs,
      volumeConfigs,
      reactionVolumeConfigs,
      playbackRateConfigs,
      stateTimeline,
      volumeTimeline,
      reactionVolumeTimeline,
      playbackRateTimeline,
      overlayVisibilityTimeline,
      reactionTransportTrack,
      playerEventTimeline: normalizedPlayerEvents,
      reactionVideoId,
      originalVideoId,
      reactionVideoAuthor: reactionData?.reactionVideoAuthor,
      reactorDisplayName: resolvedReactorDisplayName || undefined,
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
      isReactionMuteModeEnabled: Boolean(reactionData?.muteReactionWhileOriginalPlays),
      isReactionAutoMuted: false,
      fullscreenPrimaryVideo,
      fullscreenOverlayWidthPercent,
      fullscreenOverlayCorner,
      currentPlaybackRate,
      originalVideoPlatform: normalizeOriginalVideoPlatform(reactionData?.originalVideoPlatform),
    });

    // Let Svelte flush any layout changes driven by the updated platform state
    // before we attach iframe-based players to #player-original / #player-reaction.
    await tick();

    // Final guard before creating players - abort if superseded
    if (globalActiveInstanceId !== instanceId) {
      debugClickGate('[TwinPlayers] setUpVideos aborted before player creation (instance superseded)', {
        globalActiveInstanceId,
        reactionVideoId,
        originalVideoId
      });
      setExpectedPlayerReadyCount(0);
      return;
    }

    const expectedPlayers = 1 + (reactionVideoId ? 1 : 0);
    setExpectedPlayerReadyCount(expectedPlayers);

    let newPlayerReaction: any = null;
    let newPlayerOriginal: any = null;

    const isTikTokOriginalVideo = normalizeOriginalVideoPlatform(reactionData?.originalVideoPlatform) === 'tiktok';

    try {
      if (reactionVideoId) {
        newPlayerReaction = new YT.Player('player-reaction', {
          videoId: reactionVideoId,
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

      if (isTikTokOriginalVideo) {
        // TikTok original: inject iframe and return a YouTube-compatible mock so the
        // rest of the composable can interact with it without additional branching.
        // markPlayerReady() is called inside createTikTokOriginalPlayer when the
        // TikTok player fires onPlayerReady via postMessage.
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

    // Post-creation check - if superseded during player creation, destroy what we just made
    if (globalActiveInstanceId !== instanceId) {
      debugClickGate('[TwinPlayers] setUpVideos aborting after player creation (instance superseded)', {
        globalActiveInstanceId,
        reactionVideoId,
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

    // Player-specific state update (metadata was already set before player creation)
    updateState({
      playerOriginal: newPlayerOriginal,
      playerReaction: newPlayerReaction,
      currentStateOriginalVideo: -1,
      currentVolumeOriginalVideo: initialOriginalVolume,
      fullscreenOverlayVisible: true,
      bothVideosStarted: false,
      isUserPaused: false,
      currentVolumeReactionVideo: initialReactionVolume,
      reactionCurrentTime: offsetStartTime || 0,
      reactionDuration: typeof newPlayerReaction?.getDuration === 'function' ? Number(newPlayerReaction.getDuration()) || 0 : 0
    });
    console.debug('[TwinPlayers] state reset after setUpVideos', {
      bothVideosStarted: false,
      reactionVideoId,
      originalVideoId
    });

    enforceReactionMuteMode();

    await setPlaylistData(
      get(state).playlistDocumentId,
      youtubePlaylistId,
      typeof reactionData?.id === 'string' ? reactionData.id : undefined,
      originalVideoId,
    );

    await verifyAndSyncMetadata({
      documentId: typeof reactionData?.id === 'string' ? reactionData.id : undefined,
      originalVideoId,
      originalVideoPlatform: normalizeOriginalVideoPlatform(reactionData?.originalVideoPlatform),
      originalVideoUrl: reactionData?.originalVideoUrl,
      reactionVideoId,
      currentOriginalTitle: normalizedOriginalMetadata.title,
      currentOriginalAuthor: normalizedOriginalMetadata.author,
      currentOriginalAuthorUrl: normalizedOriginalMetadata.authorUrl,
      currentOriginalDescription: normalizedOriginalMetadata.description,
      currentReactionTitle: reactionData?.reactionVideoTitle,
      currentReactionAuthor: reactionData?.reactionVideoAuthor
    });
  };

  const buildInterface = async (slugValue: string, { isUpdate = false }: { isUpdate?: boolean } = {}) => {
    const seq = (buildInterfaceSeq += 1);
    debugClickGate('[TwinPlayers] buildInterface start', { seq, slugValue, isUpdate }, true);
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

    debugClickGate('[TwinPlayers] buildInterface done', { seq, slugValue, isUpdate });

    // Persist queue progress for the Resume button (client-only).
    try {
      const snapshot = get(state);
      if (typeof window !== 'undefined' && userId && snapshot.queueSlug) {
        writeQueueProgress(userId, snapshot.queueSlug, {
          reactionId: slugValue,
          index: Number(snapshot.queueIndex) || 0
        });
      }
    } catch (error) {
      console.warn('[TwinPlayers] failed to persist queue progress', error);
    }
  };

  const loadReactionInPlace = async (nextReactionDocumentId: string, options: LoadReactionInPlaceOptions = {}) => {
    if (!nextReactionDocumentId) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    isSwitchingReactionInPlace = true;
    stopSyncScheduler();

    try {

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
        originalVideoClicked = Boolean(options.autoPlay);
        reactionVideoClicked = Boolean(options.autoPlay);
        clickGateSessionId += 1;
        debugClickGate('[TwinPlayers] click gate state from loadReactionInPlace autoPlay', {
          autoPlay: Boolean(options.autoPlay)
        }, true);
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
        playbackRateTimeline,
        overlayVisibilityTimeline,
        reactionTransportTrack
      } = deriveTimelines(reactionData);

      window.playerConfigs = reactionData['stateTimeline'] || reactionData['reactionConfigs'];
      window.volumeConfigs = reactionData['volumeTimeline'] || reactionData['volumeConfigs'];
      (window as any).reactionVolumeConfigs = reactionData['reactionVolumeTimeline'] || reactionData['reactionVolumeConfigs'];
      window.playbackRateConfigs = reactionData['playbackTimeline'] || reactionData['playbackRateConfigs'];

      const normalizedPlayerEvents = buildPlayerEventTimeline(stateTimeline);

      const reactionVideoId = reactionData['reactionVideoId'] ?? '';
      const originalVideoId = reactionData['originalVideoId'];
      const youtubePlaylistId = reactionData['youtubePlaylistId'];
      const nextOriginalVideoPlatform = normalizeOriginalVideoPlatform(reactionData?.originalVideoPlatform);
      const normalizedOriginalMetadata = normalizeOriginalVideoMetadata(reactionData);

      const isPlaylistPage = typeof window !== 'undefined' && window.location?.pathname?.startsWith('/playlist/');
      const platformChanged = snapshotBefore.originalVideoPlatform !== nextOriginalVideoPlatform;
      if (isPlaylistPage && platformChanged) {
        // Mixed original platforms (YouTube <-> TikTok) can leave stale player DOM/state.
        // Force a full document reload for a clean player bootstrap.
        window.location.assign(window.location.href);
        return;
      }

      const isSameReactionVideo = reactionVideoId === previousReactionVideoId;

      const rawOffsetStartTime = Number(reactionData['offsetStartTime'] ?? 0);
      const offsetStartTime = Number.isFinite(rawOffsetStartTime) && rawOffsetStartTime >= 0
        ? Math.round(rawOffsetStartTime * 10) / 10
        : 0;

      const reactionFinishTime = parseFloat(reactionData['reactionFinishTime']) || 100000;
      const timeOffset = reactionData['timeOffset'] || 0;

      // Compute initial target time for the original video based on state configs at offsetStartTime
      const initialConfig = getCurrentStateFromStateConfigs(
        offsetStartTime || 0,
        stateTimeline,
        timeOffset
      );
      const rawInitialState = Number(initialConfig.state);
      const initialState = Number.isFinite(rawInitialState) ? rawInitialState : -1;
      const initialTargetTime = Number(initialConfig.time ?? 0);

      const globalGainValue = reactionData['globalGain'];
      const globalGain = typeof globalGainValue === 'number' && !Number.isNaN(globalGainValue) ? globalGainValue : 1.0;
      const soundLevel = Math.max(0, Math.min(200, Math.round(globalGain * 100)));
      const fullscreenPrimaryVideo = normalizeFullscreenPrimaryVideo(reactionData['fullscreenPrimaryVideo']);
      const fullscreenOverlayWidthPercent = normalizeFullscreenOverlayWidthPercent(reactionData['fullscreenOverlayWidthPercent']);
      const fullscreenOverlayCorner = normalizeFullscreenOverlayCorner(reactionData['fullscreenOverlayCorner']);
      const currentPlaybackRate = getCurrentPlaybackRateFromConfigs(offsetStartTime || 0, playbackRateConfigs, timeOffset);

      const canReuseReactionPlayer =
        Boolean(snapshotBefore.playerReaction) &&
        Boolean(reactionVideoId) &&
        isSameReactionVideo &&
        Boolean(document.getElementById('player-reaction'));
      const canReuseOriginalPlayer =
        Boolean(snapshotBefore.playerOriginal) &&
        Boolean(originalVideoId) &&
        snapshotBefore.originalVideoPlatform === 'youtube' &&
        nextOriginalVideoPlatform === 'youtube' &&
        Boolean(document.getElementById('player-original')) &&
        typeof snapshotBefore.playerOriginal?.loadVideoById === 'function';

      // If resetting to a different video, we MUST reset bothVideosStarted so the gate
      // can be re-evaluated (or auto-satisfied) for the new pair.
      const shouldResetGate = !isSameReactionVideo;
      const effectivePreviousReactionTime = isSameReactionVideo ? previousReactionTime : undefined;

      // Compute initial volumes from the configurations at offsetStartTime
      const initialOriginalVolume = getCurrentVolumeFromVolumeConfigs(
        offsetStartTime || 0,
        volumeConfigs,
        globalGain,
        timeOffset
      );
      const initialReactionVolume = getCurrentVolumeFromVolumeConfigs(
        offsetStartTime || 0,
        reactionVolumeConfigs,
        1.0,
        timeOffset
      );

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

      const shouldCreateReactionPlayer = Boolean(reactionVideoId) && !canReuseReactionPlayer;
      const shouldCreateOriginalPlayer = Boolean(originalVideoId) && !canReuseOriginalPlayer;
      setExpectedPlayerReadyCount(
        (shouldCreateReactionPlayer ? 1 : 0) + (shouldCreateOriginalPlayer ? 1 : 0)
      );

      let nextPlayerReaction: any = snapshotBefore.playerReaction;
      let nextPlayerOriginal: any = snapshotBefore.playerOriginal;
      if (shouldCreateReactionPlayer) {
        try {
          nextPlayerReaction = new YT.Player('player-reaction', {
            videoId: reactionVideoId,
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
        } catch (error) {
          console.error('Failed to initialise reaction YouTube player', error);
          nextPlayerReaction = null;
          setExpectedPlayerReadyCount(shouldCreateOriginalPlayer ? 1 : 0);
        }
      }

      if (shouldCreateOriginalPlayer) {
        updateState({ originalVideoPlatform: nextOriginalVideoPlatform, playerOriginal: null });
        await tick();
        restorePlayerContainer('player-original');

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

          // When switching to a different reaction video, cue (don't play) the original video
          // so it waits for the reaction video to be started by the user
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
          } else {
            if (shouldCueOriginalAtLoad && typeof snapshotBefore.playerOriginal.cueVideoById === 'function') {
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
          }
        } catch (error) {
          console.error('Failed to load original video by id', error);
        }
      }

      const resolvedReactorId =
        typeof reactionData?.reactorId === 'string'
          ? reactionData.reactorId
          : typeof reactionData?.userId === 'string'
            ? reactionData.userId
            : undefined;
      const rawReactorDisplayName =
        typeof reactionData?.reactorDisplayName === 'string' ? reactionData.reactorDisplayName.trim() : '';
      const viewerDisplayName = typeof data?.displayName === 'string' ? data.displayName.trim() : '';
      const resolvedReactorDisplayName =
        rawReactorDisplayName || (reactionData?.reactorId === userId ? viewerDisplayName : '');

      updateState({
        isPublished: reactionData.isPublished,
        isReactionMissing: !reactionVideoId,
        reactorId: resolvedReactorId,
        isUsersOwnVideo: resolvedReactorId === userId,
        canShowEditModeButton: resolvedReactorId === userId,
        playerConfigs,
        volumeConfigs,
        reactionVolumeConfigs,
        playbackRateConfigs,
        stateTimeline,
        volumeTimeline,
        reactionVolumeTimeline,
        playbackRateTimeline,
        overlayVisibilityTimeline,
        reactionTransportTrack,
        playerEventTimeline: normalizedPlayerEvents,
        reactionVideoId,
        originalVideoId,
        reactionVideoAuthor: reactionData?.reactionVideoAuthor,
        reactorDisplayName: resolvedReactorDisplayName || undefined,
        reactionVideoTitle: reactionData?.reactionVideoTitle,
        youtubePlaylistId,
        offsetStartTime,
        reactionFinishTime,
        timeOffset,
        globalGain,
        introBufferTime: timeOffset,
        soundLevel,
        isReactionMuteModeEnabled: Boolean(reactionData?.muteReactionWhileOriginalPlays),
        isReactionAutoMuted: false,
        fullscreenPrimaryVideo,
        fullscreenOverlayWidthPercent,
        fullscreenOverlayCorner,
        currentPlaybackRate,
        originalVideoAuthor: normalizedOriginalMetadata.author,
        originalVideoAuthorUrl: normalizedOriginalMetadata.authorUrl,
        originalVideoTitle: normalizedOriginalMetadata.title,
        originalVideoDescription: normalizedOriginalMetadata.description,
        originalVideoPlatform: nextOriginalVideoPlatform,
        playerOriginal: nextPlayerOriginal,
        playerReaction: nextPlayerReaction,
        currentStateOriginalVideo: -1,
        currentVolumeOriginalVideo: initialOriginalVolume,
        fullscreenOverlayVisible: true,
        currentVolumeReactionVideo: initialReactionVolume,
        bothVideosStarted: shouldResetGate ? false : (isSameReactionVideo && preserveReactionTime ? snapshotBefore.bothVideosStarted : Boolean(options.autoPlay)),
        reactionCurrentTime: typeof effectivePreviousReactionTime === 'number' ? effectivePreviousReactionTime : offsetStartTime || 0,
        reactionDuration:
          typeof nextPlayerReaction?.getDuration === 'function' ? Number(nextPlayerReaction.getDuration()) || 0 : snapshotBefore.reactionDuration,
        seekMin: offsetStartTime || 0,
        seekMax: (() => {
          const seekMin = offsetStartTime || 0;
          const rawDuration = typeof nextPlayerReaction?.getDuration === 'function'
            ? Number(nextPlayerReaction.getDuration())
            : Number(snapshotBefore.reactionDuration);
          const durationCap = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : Number.POSITIVE_INFINITY;
          const rawFinish = Number(reactionFinishTime);
          const finishCap = Number.isFinite(rawFinish) && rawFinish > 0 ? rawFinish : Number.POSITIVE_INFINITY;
          return Math.max(seekMin, Math.min(durationCap, finishCap));
        })()
      });

      // Wait for the new player to be actually ready before proceeding with volume/seek/sync.
      if (shouldCreateReactionPlayer) {
        let readyAttempts = 0;
        while (!arePlayersActuallyReady() && readyAttempts < 40) {
          await tick();
          await new Promise((r) => setTimeout(r, 50));
          readyAttempts++;
        }
      }

      console.debug('[TwinPlayers] state updated in updateReactionVideo', {
        isSameReactionVideo,
        preserveReactionTime,
        bothVideosStarted: isSameReactionVideo && preserveReactionTime ? snapshotBefore.bothVideosStarted : Boolean(options.autoPlay),
        initialOriginalVolume,
        initialReactionVolume,
        reactionVideoId,
        previousReactionVideoId
      });

      enforceReactionMuteMode();
      await setPlaylistData(
        get(state).playlistDocumentId,
        youtubePlaylistId,
        nextReactionDocumentId,
        originalVideoId,
      );

      // Explicitly apply the computed volumes to the players
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

      // When switching to a different reaction video, explicitly stop the original video
      // AFTER all volume and state operations to prevent it from auto-playing
      if (!isSameReactionVideo && typeof nextPlayerOriginal?.stopVideo === 'function') {
        try {
          await tick(); // Let all previous operations complete
          nextPlayerOriginal.stopVideo();
          console.debug('[TwinPlayers] Stopped original video after volume application (different reaction)');
        } catch (error) {
          console.error('[TwinPlayers] Failed to stop original video', error);
        }
      }

      if (!preserveReactionTime && canReuseReactionPlayer && typeof nextPlayerReaction?.seekTo === 'function') {
        try {
          nextPlayerReaction.seekTo(Number(offsetStartTime) || 0, true);
        } catch {
          // ignore
        }
      }

      if (typeof effectivePreviousReactionTime === 'number' && typeof nextPlayerReaction?.seekTo === 'function' && !canReuseReactionPlayer) {
        try {
          nextPlayerReaction.seekTo(effectivePreviousReactionTime, true);
        } catch {
          // ignore
        }
      }
      // Note: for new players with a different video, the `start` playerVar in playerVars
      // already handles the initial seek position. An explicit seekTo here would cause the
      // player to load video frames early (visible "cuing") before the user has clicked.

      try {
        await tick();

        // If we reset the gate but autoPlay is desired, satisfy the gate now and sync.
        if (shouldResetGate && Boolean(options.autoPlay)) {
          originalVideoClicked = true;
          reactionVideoClicked = true;
          // We don't set bothVideosStarted here because syncVideos below will handle
          // the transition from false to true, which triggers the necessary seekTo logic.
        }

        // When preserving time with the same reaction video and both videos were already started,
        // resume playback immediately
        if (preserveReactionTime && get(state).bothVideosStarted) {
          handleStateChangeInReactionVideo(YT.PlayerState.BUFFERING, YT.PlayerState.PLAYING);
          pollVideoCurrentTime();
        } else if ((isSameReactionVideo && snapshotBefore.bothVideosStarted) || Boolean(options.autoPlay)) {
          // Only sync/start videos if:
          // 1. Same reaction video AND the user had already satisfied the gate before
          //    this transition (i.e. they were actively watching). Do NOT auto-start if
          //    the gate was still closed — the user must click to begin the new pair.
          // 2. AutoPlay is explicitly enabled (e.g. queue/playlist auto-advance).
          syncVideos();
          if (get(state).bothVideosStarted) {
            pollVideoCurrentTime();
          }
        }
      } catch {
        // ignore
      }

      updateUIElements(nextReactionDocumentId);

      await verifyAndSyncMetadata({
        documentId: typeof reactionData?.id === 'string' ? reactionData.id : undefined,
        originalVideoId,
        originalVideoPlatform: normalizeOriginalVideoPlatform(reactionData?.originalVideoPlatform),
        originalVideoUrl: reactionData?.originalVideoUrl,
        reactionVideoId,
        currentOriginalTitle: normalizedOriginalMetadata.title,
        currentOriginalAuthor: normalizedOriginalMetadata.author,
        currentOriginalAuthorUrl: normalizedOriginalMetadata.authorUrl,
        currentOriginalDescription: normalizedOriginalMetadata.description,
        currentReactionTitle: reactionData?.reactionVideoTitle,
        currentReactionAuthor: reactionData?.reactionVideoAuthor
      });
    } finally {
      isSwitchingReactionInPlace = false;
    }
  };

  const setPlaylistSelectionIndex = (index: number) => {
    const snapshot = get(state);
    const totalFromDoc = Array.isArray(snapshot.playlistDocument?.reactionBinomeIds)
      ? snapshot.playlistDocument.reactionBinomeIds.length
      : 0;
    const totalFromItems = Array.isArray(snapshot.playlistItems) ? snapshot.playlistItems.length : 0;
    const total = Math.max(totalFromDoc, totalFromItems);
    if (!total) {
      updateState({ currentIndexInPlaylist: 0, hasNextIndexInPlaylist: false });
      return;
    }
    const clamped = Math.max(0, Math.min(total - 1, Math.trunc(Number(index) || 0)));
    updateState({
      currentIndexInPlaylist: clamped,
      hasNextIndexInPlaylist: clamped < total - 1
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

    if (nextReactionDocumentId === snapshot.pageSlug || (typeof window !== 'undefined' && (window as any).currentReactionDocumentId === nextReactionDocumentId)) {
      return;
    }

    const isPlaylistPage = typeof window !== 'undefined' && window.location?.pathname?.startsWith('/playlist/');
    const sequenceItems = getPlaylistSequenceItems(playlistDocument);
    const currentSequenceItem = sequenceItems[currentIndexInPlaylist];
    const nextSequenceItem = sequenceItems[nextIndex];
    const shouldPreserveReactionTime = Boolean(
      currentSequenceItem &&
      nextSequenceItem &&
      currentSequenceItem.originalVideoId === nextSequenceItem.originalVideoId &&
      currentSequenceItem.originalVideoPlatform === nextSequenceItem.originalVideoPlatform,
    );
    if (isPlaylistPage) {
      const nextOriginalVideoId = nextSequenceItem?.originalVideoId || playlistDocument.originalVideoIds?.[nextIndex];
      if (typeof nextOriginalVideoId === 'string' && typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('item', nextOriginalVideoId);
        window.history.pushState(window.history.state, '', url.toString());
      }

      loadReactionInPlace(nextReactionDocumentId, { preserveReactionTime: shouldPreserveReactionTime, autoPlay: true }).then(() => {
        const updatedIndex = nextIndex;
        const hasNext = updatedIndex < playlistItems.length - 1;
        updateState({
          currentIndexInPlaylist: updatedIndex,
          hasNextIndexInPlaylist: hasNext
        });
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
      clickGateSessionId += 1;
      debugClickGate('[TwinPlayers] click gate reset when loading next playlist reaction', {
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
    });
  };

  const getNextReactionIdInQueue = async (queueSlug: string, nextIndex: number) => {
    if (!userId) {
      return null;
    }
    const queueDefinition = await getQueueBySlug(queueSlug, userId);
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

    if (typeof window !== 'undefined' && userId) {
      writeQueueProgress(userId, queueSlug, { reactionId: nextReactionDocumentId, index: nextIndex });
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
          if (typeof window !== 'undefined' && userId) {
            writeQueueProgress(userId, queueSlug, { reactionId: nextReactionDocumentId, index: nextIndex });
          }
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
          clickGateSessionId += 1;
          debugClickGate('[TwinPlayers] click gate reset when loading next queue reaction', {
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

  const verifyOriginalVideoDetails = async ({
    platform,
    videoId,
    videoUrl,
    currentTitle,
    currentAuthor,
    currentAuthorUrl,
    currentDescription
  }: {
    platform?: 'youtube' | 'tiktok';
    videoId?: string;
    videoUrl?: string | null;
    currentTitle?: string | null;
    currentAuthor?: string | null;
    currentAuthorUrl?: string | null;
    currentDescription?: string | null;
  }) => {
    const result: {
      metadata?: ReturnType<typeof normalizeOriginalVideoMetadata>;
      updates: Record<string, string | number>;
    } = {
      updates: {}
    };

    if (!videoId) {
      return result;
    }

    try {
      const metadata = await fetchOriginalVideoMetadata({
        platform,
        videoId,
        videoUrl: videoUrl || undefined
      });
      const normalizedFields = originalVideoMetadataToFirestoreFields(metadata);
      const currentComparison = {
        originalVideoTitle: typeof currentTitle === 'string' ? currentTitle.trim() : undefined,
        originalVideoAuthor: typeof currentAuthor === 'string' ? currentAuthor.trim() : undefined,
        originalVideoAuthorUrl:
          typeof currentAuthorUrl === 'string' ? currentAuthorUrl.trim() : undefined,
        originalVideoDescription:
          typeof currentDescription === 'string' ? currentDescription.trim() : undefined
      };

      for (const [key, value] of Object.entries(normalizedFields)) {
        if (typeof value !== 'string' && typeof value !== 'number') {
          continue;
        }

        const nextValue = typeof value === 'string' ? value.trim() : value;
        const currentValue = currentComparison[key as keyof typeof currentComparison];
        if (nextValue && nextValue !== currentValue) {
          result.updates[key] = value;
        }
      }

      result.metadata = metadata;
    } catch (error) {
      console.error(`Failed to verify original metadata for video ${videoId}`, error);
    }

    return result;
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
    originalVideoPlatform,
    originalVideoUrl,
    reactionVideoId,
    currentOriginalTitle,
    currentOriginalAuthor,
    currentOriginalAuthorUrl,
    currentOriginalDescription,
    currentReactionTitle,
    currentReactionAuthor
  }: VerifyAndSyncMetadataParams) => {
    if (DISABLE_YOUTUBE_METADATA_SYNC) {
      return;
    }

    const resolvedDocumentId =
      documentId ?? (typeof window !== 'undefined' ? (window as any)?.currentReactionDocumentId : undefined);

    if (!resolvedDocumentId) {
      return;
    }

    const [originalVerification, reactionVerification] = await Promise.all([
      verifyOriginalVideoDetails({
        platform: originalVideoPlatform,
        videoId: originalVideoId,
        videoUrl: originalVideoUrl,
        currentTitle: currentOriginalTitle,
        currentAuthor: currentOriginalAuthor,
        currentAuthorUrl: currentOriginalAuthorUrl,
        currentDescription: currentOriginalDescription
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
    const normalizedOriginalAuthorUrl =
      typeof currentOriginalAuthorUrl === 'string' ? currentOriginalAuthorUrl.trim() : undefined;
    const normalizedOriginalDescription =
      typeof currentOriginalDescription === 'string' ? currentOriginalDescription.trim() : undefined;
    const normalizedReactionTitle = typeof currentReactionTitle === 'string' ? currentReactionTitle.trim() : undefined;
    const normalizedReactionAuthor = typeof currentReactionAuthor === 'string' ? currentReactionAuthor.trim() : undefined;

    const nextOriginalTitle =
      typeof originalVerification.metadata?.title === 'string'
        ? originalVerification.metadata.title.trim()
        : undefined;
    if (nextOriginalTitle && nextOriginalTitle !== normalizedOriginalTitle) {
      partialUpdate.originalVideoTitle = nextOriginalTitle;
    }

    const nextOriginalAuthor =
      typeof originalVerification.metadata?.author === 'string'
        ? originalVerification.metadata.author.trim()
        : undefined;
    if (nextOriginalAuthor && nextOriginalAuthor !== normalizedOriginalAuthor) {
      partialUpdate.originalVideoAuthor = nextOriginalAuthor;
    }

    const nextOriginalAuthorUrl =
      typeof originalVerification.metadata?.authorUrl === 'string'
        ? originalVerification.metadata.authorUrl.trim()
        : undefined;
    if (nextOriginalAuthorUrl && nextOriginalAuthorUrl !== normalizedOriginalAuthorUrl) {
      partialUpdate.originalVideoAuthorUrl = nextOriginalAuthorUrl;
    }

    const nextOriginalDescription =
      typeof originalVerification.metadata?.description === 'string'
        ? originalVerification.metadata.description.trim()
        : undefined;
    if (nextOriginalDescription && nextOriginalDescription !== normalizedOriginalDescription) {
      partialUpdate.originalVideoDescription = nextOriginalDescription;
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
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const clamped = Math.max(0, parsed);
    const rounded = Math.round(clamped * 10) / 10;

    const snapshot = get(state);
    const oldStart = snapshot.offsetStartTime;

    await updateFirebaseDocument({ offsetStartTime: rounded });
    updateState({ offsetStartTime: rounded, reactionCurrentTime: rounded });

    if (rounded > oldStart) {
      const oldKey = roundReactionTime(oldStart).toFixed(3);
      const newKey = roundReactionTime(rounded).toFixed(3);

      // 1. Player State Timeline
      const playerMap = timelineArrayToMap(snapshot.stateTimeline);
      if (playerMap.has(oldKey) && !playerMap.has(newKey)) {
        const entry = playerMap.get(oldKey)!;
        entry.t = rounded;
        playerMap.set(newKey, entry);
        playerMap.delete(oldKey);
        await persistPlayerTimelineMap(playerMap, rounded);
      }

      // 2. Volume Timeline
      const volumeMap = volumeTimelineArrayToMap(snapshot.volumeTimeline);
      if (volumeMap.has(oldKey) && !volumeMap.has(newKey)) {
        const entry = volumeMap.get(oldKey)!;
        entry.t = rounded;
        volumeMap.set(newKey, entry);
        volumeMap.delete(oldKey);
        await persistVolumeTimelineMap(volumeMap, rounded);
      }

      // 3. Reaction Volume Timeline
      const reactionVolumeMap = volumeTimelineArrayToMap(snapshot.reactionVolumeTimeline);
      if (reactionVolumeMap.has(oldKey) && !reactionVolumeMap.has(newKey)) {
        const entry = reactionVolumeMap.get(oldKey)!;
        entry.t = rounded;
        reactionVolumeMap.set(newKey, entry);
        reactionVolumeMap.delete(oldKey);
        await persistReactionVolumeTimelineMap(reactionVolumeMap, rounded);
      }

      // 4. Playback Rate Timeline
      const playbackMap = playbackTimelineArrayToMap(snapshot.playbackRateTimeline);
      if (playbackMap.has(oldKey) && !playbackMap.has(newKey)) {
        const entry = playbackMap.get(oldKey)!;
        entry.t = rounded;
        playbackMap.set(newKey, entry);
        playbackMap.delete(oldKey);
        await persistPlaybackTimelineMap(playbackMap, rounded);
      }
    }
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


    let finalValue = parsed;
    if (Number.isFinite(snapshot.reactionDuration) && snapshot.reactionDuration > 0) {
      finalValue = Math.min(finalValue, snapshot.reactionDuration);
    }

    await updateFirebaseDocument({ reactionFinishTime: finalValue });
    updateState({ reactionFinishTime: finalValue });
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

  const setFullscreenPrimaryVideo = async (value: FullscreenPrimaryVideo) => {
    const normalized = normalizeFullscreenPrimaryVideo(value);
    await updateFirebaseDocument({ fullscreenPrimaryVideo: normalized });
    updateState({ fullscreenPrimaryVideo: normalized });
  };

  const setFullscreenOverlayWidthPercent = async (value: number) => {
    const normalized = normalizeFullscreenOverlayWidthPercent(value);
    await updateFirebaseDocument({ fullscreenOverlayWidthPercent: normalized });
    updateState({ fullscreenOverlayWidthPercent: normalized });
  };

  const setFullscreenOverlayCorner = async (value: FullscreenOverlayCorner) => {
    const normalized = normalizeFullscreenOverlayCorner(value);
    await updateFirebaseDocument({ fullscreenOverlayCorner: normalized });
    updateState({ fullscreenOverlayCorner: normalized });
  };

  const performPostSaveRewind = (referenceTime: number) => {
    const snapshot = get(state);
    if (!snapshot.isFineTuneModeOn) {
      return;
    }
    if (!Number.isFinite(referenceTime)) {
      return;
    }
    const targetTime = referenceTime - 5;
    goToSecondsInReactionVideo(targetTime);
  };

  const persistPlayerTimelineMap = async (
    map: Map<string, { t: number; state: number; targetTime: number }>,
    referenceTime: number
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
      reactionConfigs: firestoreDeleteField()
    });

    if (typeof window !== 'undefined') {
      (window as any).playerConfigs = normalizedTimeline;
    }

    updateState({
      stateTimeline: normalizedTimeline,
      playerConfigs: nextPlayerConfigs,
      playerEventTimeline: buildPlayerEventTimeline(normalizedTimeline)
    });

    performPostSaveRewind(referenceTime);
  };

  const persistVolumeTimelineMap = async (map: Map<string, { t: number; volume: number }>, referenceTime: number) => {
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
      volumeConfigs: firestoreDeleteField()
    });

    if (typeof window !== 'undefined') {
      (window as any).volumeConfigs = normalizedTimeline;
    }

    updateState({
      volumeTimeline: normalizedTimeline,
      volumeConfigs: nextVolumeConfigs
    });

    performPostSaveRewind(referenceTime);
  };

  const persistReactionVolumeTimelineMap = async (map: Map<string, { t: number; volume: number }>, referenceTime: number) => {
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
      reactionVolumeConfigs: firestoreDeleteField()
    });

    if (typeof window !== 'undefined') {
      (window as any).reactionVolumeConfigs = normalizedTimeline;
    }

    updateState({
      reactionVolumeTimeline: normalizedTimeline,
      reactionVolumeConfigs: nextVolumeConfigs
    });

    performPostSaveRewind(referenceTime);
  };

  const persistPlaybackTimelineMap = async (map: Map<string, { t: number; rate: number }>, referenceTime: number) => {
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
      playbackRateConfigs: firestoreDeleteField()
    });

    if (typeof window !== 'undefined') {
      (window as any).playbackRateConfigs = normalizedTimeline;
    }

    updateState({
      playbackRateTimeline: normalizedTimeline,
      playbackRateConfigs: nextPlaybackRateConfigs
    });

    performPostSaveRewind(referenceTime);
  };

  const persistOverlayVisibilityTimelineMap = async (map: Map<string, { t: number; visible: boolean }>, referenceTime: number) => {
    const normalizedTimeline = Array.from(map.values()).sort((a, b) => a.t - b.t);

    await updateFirebaseDocument({
      overlayVisibilityTimeline: normalizedTimeline.map((entry) => ({
        t: Number(entry.t),
        visible: typeof entry.visible === 'boolean' ? entry.visible : true
      }))
    });

    if (typeof window !== 'undefined') {
      (window as any).overlayVisibilityTimeline = normalizedTimeline;
    }

    updateState({
      overlayVisibilityTimeline: normalizedTimeline
    });

    performPostSaveRewind(referenceTime);
  };

  const persistReactionTransportTrackMap = async (map: Map<string, { t: number; state: number }>, referenceTime: number) => {
    const normalizedTimeline = Array.from(map.values()).sort((a, b) => a.t - b.t);

    await updateFirebaseDocument({
      reactionTransportTrack: normalizedTimeline.map((entry) => ({
        t: Number(entry.t),
        state: Number(entry.state)
      }))
    });

    updateState({
      reactionTransportTrack: normalizedTimeline
    });

    performPostSaveRewind(referenceTime);
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
      await persistPlayerTimelineMap(timelineMap, roundedReactionTime);
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
      await persistVolumeTimelineMap(timelineMap, roundedReactionTime);
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
      await persistReactionVolumeTimelineMap(timelineMap, roundedReactionTime);
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
      await persistPlaybackTimelineMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to create playback rate config', error);
      throw error;
    }
  };

  const createOverlayVisibilityConfig = async ({ timeInReaction, visible }: { timeInReaction: number; visible: boolean }) => {
    const snapshot = get(state);
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedVisible = typeof visible === 'boolean' ? visible : true;

    const existingTimeline = Array.isArray(snapshot.overlayVisibilityTimeline) ? snapshot.overlayVisibilityTimeline : [];
    const timelineMap = new Map<string, { t: number; visible: boolean }>();

    existingTimeline.forEach((entry) => {
      if (entry && Number.isFinite(entry.t)) {
        timelineMap.set(Number(entry.t).toFixed(3), {
          t: Number(entry.t),
          visible: typeof entry.visible === 'boolean' ? entry.visible : true
        });
      }
    });

    timelineMap.set(roundedReactionTime.toFixed(3), {
      t: roundedReactionTime,
      visible: sanitizedVisible
    });

    try {
      await persistOverlayVisibilityTimelineMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to create overlay visibility config', error);
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
      await persistPlayerTimelineMap(timelineMap, roundedReactionTime);
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
      await persistPlayerTimelineMap(timelineMap, sanitizedReactionTime);
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
      await persistVolumeTimelineMap(timelineMap, roundedReactionTime);
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
      await persistReactionVolumeTimelineMap(timelineMap, roundedReactionTime);
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
      await persistVolumeTimelineMap(timelineMap, sanitizedReactionTime);
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
      await persistReactionVolumeTimelineMap(timelineMap, sanitizedReactionTime);
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
      await persistPlaybackTimelineMap(timelineMap, roundedReactionTime);
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
      await persistPlaybackTimelineMap(timelineMap, sanitizedReactionTime);
    } catch (error) {
      console.error('Failed to delete playback rate config', error);
      throw error;
    }
  };

  const updateOverlayVisibilityConfig = async ({
    timeInReaction,
    visible,
    previousTimeInReaction
  }: { timeInReaction: number; visible: boolean; previousTimeInReaction: number }) => {
    const snapshot = get(state);
    const existingTimeline = Array.isArray(snapshot.overlayVisibilityTimeline) ? snapshot.overlayVisibilityTimeline : [];
    const timelineMap = new Map<string, { t: number; visible: boolean }>();

    existingTimeline.forEach((entry) => {
      if (entry && Number.isFinite(entry.t)) {
        timelineMap.set(Number(entry.t).toFixed(3), {
          t: Number(entry.t),
          visible: typeof entry.visible === 'boolean' ? entry.visible : true
        });
      }
    });

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

    const resolvedVisible = typeof visible === 'boolean' ? visible : (currentEntry?.visible ?? true);

    if (nextKey !== previousKey) {
      timelineMap.delete(previousKey);
    }

    timelineMap.set(nextKey, {
      t: roundedReactionTime,
      visible: resolvedVisible
    });

    try {
      await persistOverlayVisibilityTimelineMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to update overlay visibility config', error);
      throw error;
    }
  };

  const deleteOverlayVisibilityConfig = async ({ timeInReaction }: { timeInReaction: number }) => {
    const snapshot = get(state);
    const existingTimeline = Array.isArray(snapshot.overlayVisibilityTimeline) ? snapshot.overlayVisibilityTimeline : [];
    const timelineMap = new Map<string, { t: number; visible: boolean }>();

    existingTimeline.forEach((entry) => {
      if (entry && Number.isFinite(entry.t)) {
        timelineMap.set(Number(entry.t).toFixed(3), {
          t: Number(entry.t),
          visible: typeof entry.visible === 'boolean' ? entry.visible : true
        });
      }
    });

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const key = roundReactionTime(sanitizedReactionTime).toFixed(3);

    if (!timelineMap.has(key)) {
      return;
    }

    timelineMap.delete(key);

    try {
      await persistOverlayVisibilityTimelineMap(timelineMap, sanitizedReactionTime);
    } catch (error) {
      console.error('Failed to delete overlay visibility config', error);
      throw error;
    }
  };

  const createReactionTransportConfig = async ({ timeInReaction, state: rawState }: { timeInReaction: number; state: number }) => {
    const snapshot = get(state);
    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedState = rawState === 1 ? 1 : 2;

    const existingTimeline = Array.isArray(snapshot.reactionTransportTrack) ? snapshot.reactionTransportTrack : [];
    const timelineMap = new Map<string, { t: number; state: number }>();
    existingTimeline.forEach((entry) => {
      if (entry && Number.isFinite(entry.t)) {
        timelineMap.set(Number(entry.t).toFixed(3), { t: Number(entry.t), state: Number(entry.state) });
      }
    });
    timelineMap.set(roundedReactionTime.toFixed(3), { t: roundedReactionTime, state: sanitizedState });

    try {
      await persistReactionTransportTrackMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to create reaction transport config', error);
      throw error;
    }
  };

  const updateReactionTransportConfig = async ({ timeInReaction, state: rawState, previousTimeInReaction }: { timeInReaction: number; state: number; previousTimeInReaction?: number }) => {
    const snapshot = get(state);
    const existingTimeline = Array.isArray(snapshot.reactionTransportTrack) ? snapshot.reactionTransportTrack : [];
    const timelineMap = new Map<string, { t: number; state: number }>();
    existingTimeline.forEach((entry) => {
      if (entry && Number.isFinite(entry.t)) {
        timelineMap.set(Number(entry.t).toFixed(3), { t: Number(entry.t), state: Number(entry.state) });
      }
    });

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const roundedReactionTime = roundReactionTime(sanitizedReactionTime);
    const sanitizedPreviousTime =
      typeof previousTimeInReaction === 'number' && Number.isFinite(previousTimeInReaction)
        ? Math.max(0, previousTimeInReaction)
        : sanitizedReactionTime;
    const roundedPreviousTime = roundReactionTime(sanitizedPreviousTime);
    const previousKey = roundedPreviousTime.toFixed(3);
    const nextKey = roundedReactionTime.toFixed(3);
    const sanitizedState = rawState === 1 ? 1 : 2;

    const currentEntry = timelineMap.get(previousKey);
    if (!currentEntry) {
      console.warn('updateReactionTransportConfig: entry not found at', previousKey);
      return;
    }

    const resolvedState = Number.isFinite(rawState) ? sanitizedState : (currentEntry?.state ?? 1);

    if (nextKey !== previousKey) {
      timelineMap.delete(previousKey);
    }
    timelineMap.set(nextKey, { t: roundedReactionTime, state: resolvedState });

    try {
      await persistReactionTransportTrackMap(timelineMap, roundedReactionTime);
    } catch (error) {
      console.error('Failed to update reaction transport config', error);
      throw error;
    }
  };

  const deleteReactionTransportConfig = async ({ timeInReaction }: { timeInReaction: number }) => {
    const snapshot = get(state);
    const existingTimeline = Array.isArray(snapshot.reactionTransportTrack) ? snapshot.reactionTransportTrack : [];
    const timelineMap = new Map<string, { t: number; state: number }>();
    existingTimeline.forEach((entry) => {
      if (entry && Number.isFinite(entry.t)) {
        timelineMap.set(Number(entry.t).toFixed(3), { t: Number(entry.t), state: Number(entry.state) });
      }
    });

    const sanitizedReactionTime = Number.isFinite(timeInReaction) ? Math.max(0, timeInReaction) : 0;
    const key = roundReactionTime(sanitizedReactionTime).toFixed(3);

    if (!timelineMap.has(key)) {
      console.warn('deleteReactionTransportConfig: entry not found at', key);
      return;
    }
    timelineMap.delete(key);

    try {
      await persistReactionTransportTrackMap(timelineMap, sanitizedReactionTime);
    } catch (error) {
      console.error('Failed to delete reaction transport config', error);
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
    const nextValue = !snapshot.showCinematicBars;
    updateState({ showCinematicBars: nextValue });
    writeCinematicBarsCookie(nextValue);
  };

  const handlePlayStateChange = (isPlaying: boolean) => {
    debugClickGate('[TwinPlayers] handlePlayStateChange called', { isPlaying }, true);
    if (isPlaying) {
      const wasUserPaused = get(state).isUserPaused;
      if (wasUserPaused) {
        updateState({ isUserPaused: false });
      }
      const snapshot = get(state);
      if (!snapshot.bothVideosStarted) {
        debugClickGate('[TwinPlayers] handlePlayStateChange releasing gate', {
          gateSatisfied: originalVideoClicked && reactionVideoClicked,
          offsetStartTime: snapshot.offsetStartTime,
          playbackRate: snapshot.currentPlaybackRate
        }, true);
        goToSecondsInReactionVideo(snapshot.offsetStartTime || 0);
        setPlaybackRateForOriginalVideo(snapshot.currentPlaybackRate);
        updateState({ bothVideosStarted: true });
        debugClickGate('[TwinPlayers] bothVideosStarted set true via handlePlayStateChange gate release', {
          offsetStartTime: snapshot.offsetStartTime,
          playbackRate: snapshot.currentPlaybackRate
        });
      }

      // Start BOTH players immediately when the user hits play.
      // The reaction player is the timeline leader; original will be corrected via
      // handleStateChangeInReactionVideo + periodic sync.
      if (wasUserPaused) {
        lastUserResumeAt = Date.now();
      }
      const reactionNow = typeof snapshot.playerReaction?.getCurrentTime === 'function'
        ? Number(snapshot.playerReaction.getCurrentTime())
        : Number(snapshot.reactionCurrentTime);

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
    if (get(state).isUserPaused) {
      updateState({ isUserPaused: false });
    }
    const snapshot = get(state);
    if (!snapshot.bothVideosStarted) {
      debugClickGate('[TwinPlayers] syncVideos releasing gate', {
        gateSatisfied: originalVideoClicked && reactionVideoClicked,
        offsetStartTime: snapshot.offsetStartTime,
        playbackRate: snapshot.currentPlaybackRate
      }, true);
      goToSecondsInReactionVideo(snapshot.offsetStartTime || 0);
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

    applyOriginalPlaybackForReactionTime(reactionNow, snapshot);
    startReactionVideo();
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
    // Update state reactively instead of refreshing
    updateState({ isFullscreen: value });

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

  const handleExitFullscreenClick = () => {
    openWithHalfscreen();
    updateState({
      isControlSurfaceVisible: false,
      fullscreenOverlayVisible: true
    });
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
    log('onMount started', { enableAutoPlay, instanceId });
    debugClickGate('[TwinPlayers] instance mounted', { enableAutoPlay }, true);

    if (ENABLE_WATCHDOG) {
      // Watchdog: if something starts playback while gate is closed, pause it and log.
      // This catches missed onStateChange events and stale player instances that can "auto-play".
      gateWatchdogInterval = setInterval(() => {
        const snapshot = get(state);
        if (snapshot.bothVideosStarted) {
          return;
        }

        const now = Date.now();

        const maybePauseIfPlaying = (target: any, which: 'reaction' | 'original') => {
          if (!target || typeof target.getPlayerState !== 'function') {
            return;
          }
          let playerState: number | undefined;
          try {
            playerState = Number(target.getPlayerState());
          } catch {
            playerState = undefined;
          }
          if (playerState !== YT.PlayerState.PLAYING) {
            return;
          }

          try {
            target.pauseVideo?.();
          } catch {
            // ignore
          }

          // Rate-limit watchdog logs to avoid console spam.
          if (now - lastGateWatchdogLogAt > 500) {
            lastGateWatchdogLogAt = now;
            debugClickGate('[TwinPlayers] WATCHDOG paused player while gated', {
              which,
              state: playerState,
              gateSatisfied: originalVideoClicked && reactionVideoClicked,
              ...getPlayerDebugInfo(target)
            }, true);
          }
        };

        maybePauseIfPlaying(snapshot.playerReaction, 'reaction');
        maybePauseIfPlaying(snapshot.playerOriginal, 'original');
      }, 150);
    }

    const isAutoPlay = enableAutoPlay ? readAutoPlayCookie() : false;
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
      const seq = (initSeq += 1);
      log('init start', { seq, retryCount: initRetryCount, instanceId });
      debugClickGate('[TwinPlayers] init start', { seq, retryCount: initRetryCount }, true);
      try {
        // Check if we're still the active instance before doing expensive work
        if (globalActiveInstanceId !== instanceId) {
          debugClickGate('[TwinPlayers] init aborted (instance superseded before start)', {
            seq,
            globalActiveInstanceId
          });
          return;
        }

        await tick();

        // Re-check after await - another instance may have claimed active
        if (globalActiveInstanceId !== instanceId) {
          debugClickGate('[TwinPlayers] init aborted (instance superseded after tick)', {
            seq,
            globalActiveInstanceId
          });
          return;
        }

        injectYoutubeIframeApiScript();
        log('waiting for YT API');
        await waitForYoutubeIframeApiReady();
        log('YT API ready');

        // Re-check after API ready
        if (globalActiveInstanceId !== instanceId) {
          debugClickGate('[TwinPlayers] init aborted (instance superseded after YT API ready)', {
            seq,
            globalActiveInstanceId
          });
          return;
        }

        // Wait for DOM elements with retry mechanism
        log('waiting for DOM elements');
        const elementsReady = await waitForPlayerElements(150, 100);
        log('DOM elements ready result', { elementsReady });
        if (!elementsReady) {
          console.warn('Player elements not found after waiting');
          debugClickGate('[TwinPlayers] init: player elements not ready', { seq, retryCount: initRetryCount });

          // Auto-retry after INIT_RETRY_DELAY if we haven't exceeded max retries
          if (initRetryCount < MAX_INIT_RETRIES && globalActiveInstanceId === instanceId) {
            initRetryCount++;
            console.log(`[TwinPlayers] Auto-retrying initialization (attempt ${initRetryCount}/${MAX_INIT_RETRIES})`);
            setTimeout(() => {
              if (globalActiveInstanceId === instanceId && !isDestroyed) {
                init();
              }
            }, INIT_RETRY_DELAY);
          } else {
            console.error('[TwinPlayers] Max retries exceeded, giving up');
            finalizeLoadingState();
          }
          return;
        }

        const initialSlug = get(state).pageSlug;
        if (!initialSlug) {
          finalizeLoadingState();
          debugClickGate('[TwinPlayers] init aborted (missing slug)', { seq });
          return;
        }

        // Final check before building interface
        if (globalActiveInstanceId !== instanceId) {
          debugClickGate('[TwinPlayers] init aborted (instance superseded before buildInterface)', {
            seq,
            globalActiveInstanceId
          });
          return;
        }

        await buildInterface(initialSlug);
        log('buildInterface called from init', { initialSlug });
      } catch (error) {
        log('init failed', { error: String(error) });
        console.error('Failed to initialize reaction player:', error);

        // Auto-retry on error if we haven't exceeded max retries
        if (initRetryCount < MAX_INIT_RETRIES && globalActiveInstanceId === instanceId && !isDestroyed) {
          initRetryCount++;
          console.log(`[TwinPlayers] Auto-retrying after error (attempt ${initRetryCount}/${MAX_INIT_RETRIES})`);
          setTimeout(() => {
            if (globalActiveInstanceId === instanceId && !isDestroyed) {
              init();
            }
          }, INIT_RETRY_DELAY);
        }
      } finally {
        debugClickGate('[TwinPlayers] init done', { seq });
      }
    };

    init();
  });

  onDestroy(() => {
    isDestroyed = true;
    debugClickGate('[TwinPlayers] instance destroyed', {}, true);
    // Ensure embedded YouTube players are torn down when leaving the route.
    // Without this, client-side navigation from edit -> reaction can leave behind
    // active player instances and cause inconsistent start/sync behavior.
    try {
      const snapshot = get(state);
      // CRITICAL: Pause players BEFORE destroying to prevent autoplay continuation
      try {
        snapshot.playerOriginal?.pauseVideo?.();
      } catch {
        // ignore
      }
      try {
        snapshot.playerReaction?.pauseVideo?.();
      } catch {
        // ignore
      }
      // Small delay to ensure pause takes effect before destroy
      snapshot.playerOriginal?.destroy?.();
      snapshot.playerReaction?.destroy?.();
    } catch (error) {
      console.warn('Failed to destroy YouTube players on teardown', error);
    }

    // Clean up any TikTok iframe/listener that may have been left behind
    destroyTikTokOriginalPlayer();

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
    if (typeof syncTracking.softSyncResetTimeoutId === 'number') {
      clearTimeout(syncTracking.softSyncResetTimeoutId);
      syncTracking.softSyncResetTimeoutId = undefined;
    }
    stopSyncScheduler();
    clearInterval(gateWatchdogInterval);
    gateWatchdogInterval = undefined;
    resetReactionDurationProbe();
    resetOriginalStateTracking();
    if (overlayElement) {
      overlayElement.style.pointerEvents = 'auto';
    }
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
      createReactionTransportConfig,
      updateReactionTransportConfig,
      deleteReactionTransportConfig,
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
      mobileLazySync: false
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
    mobileLazySync
  };
}
