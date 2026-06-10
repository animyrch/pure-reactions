import { get, writable } from 'svelte/store';
import {
  DEFAULT_FULLSCREEN_OVERLAY_CORNER,
  DEFAULT_FULLSCREEN_OVERLAY_WIDTH_PERCENT,
  DEFAULT_FULLSCREEN_PRIMARY_VIDEO,
  type FullscreenOverlayCorner,
  type FullscreenPrimaryVideo
} from '$lib/helpers/twinPlayersReactionData';

export type TwinPlayersState = {
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
  originalVideoSlug?: string;
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
  fullscreenPrimaryVideoDefault: FullscreenPrimaryVideo;
  fullscreenOverlayWidthPercent: number;
  fullscreenOverlayCorner: FullscreenOverlayCorner;
  pageSlug: string;
  isOutOfSync: boolean;
  seekMin: number;
  seekMax: number;
  originalVideoPlatform: 'youtube' | 'tiktok';
  momentId?: string;
  isMomentReaction: boolean;
  momentOriginalTimeSeconds?: number;
  momentFeedLoopEnabled: boolean;
};

type TwinPlayersContentState = Pick<
  TwinPlayersState,
  | 'isReactionMissing'
  | 'isUsersOwnVideo'
  | 'isPublished'
  | 'reactionVideoId'
  | 'reactionVideoAuthor'
  | 'reactorDisplayName'
  | 'reactionVideoTitle'
  | 'reactionVideoDescription'
  | 'originalVideoAuthor'
  | 'originalVideoAuthorUrl'
  | 'originalVideoTitle'
  | 'originalVideoDescription'
  | 'originalVideoSlug'
  | 'originalVideoId'
  | 'reactorId'
  | 'youtubePlaylistId'
  | 'pageSlug'
  | 'originalVideoPlatform'
  | 'momentId'
  | 'isMomentReaction'
  | 'momentOriginalTimeSeconds'
>;

type TwinPlayersCollectionState = Pick<
  TwinPlayersState,
  | 'playlistDocumentId'
  | 'playlistItems'
  | 'playlistDocument'
  | 'hasNextIndexInPlaylist'
  | 'currentIndexInPlaylist'
  | 'isPlaylistAutoPlay'
  | 'queueSlug'
  | 'queueIndex'
  | 'isQueueAutoPlay'
>;

type TwinPlayersUiState = Pick<
  TwinPlayersState,
  | 'isLoading'
  | 'isEditModeOn'
  | 'isFineTuneModeOn'
  | 'canShowEditModeButton'
  | 'canShowCloseEditModeButton'
  | 'showCinematicBars'
  | 'isFullscreen'
  | 'isControlSurfaceVisible'
  | 'isExitButtonExpanded'
  | 'fullscreenOverlayVisible'
  | 'fullscreenPrimaryVideo'
  | 'fullscreenPrimaryVideoDefault'
  | 'fullscreenOverlayWidthPercent'
  | 'fullscreenOverlayCorner'
>;

type TwinPlayersPlaybackState = Pick<
  TwinPlayersState,
  | 'playerOriginal'
  | 'playerReaction'
  | 'bothVideosStarted'
  | 'isUserPaused'
  | 'currentPlaybackRate'
  | 'currentStateOriginalVideo'
  | 'currentVolumeOriginalVideo'
  | 'currentVolumeReactionVideo'
  | 'reactionCurrentTime'
  | 'reactionDuration'
  | 'offsetStartTime'
  | 'reactionFinishTime'
  | 'timeOffset'
  | 'globalGain'
  | 'introBufferTime'
  | 'soundLevel'
  | 'isReactionMuteModeEnabled'
  | 'isReactionAutoMuted'
  | 'isOutOfSync'
  | 'seekMin'
  | 'seekMax'
>;

type TwinPlayersTimelineState = Pick<
  TwinPlayersState,
  | 'playerConfigs'
  | 'volumeConfigs'
  | 'reactionVolumeConfigs'
  | 'playbackRateConfigs'
  | 'stateTimeline'
  | 'volumeTimeline'
  | 'reactionVolumeTimeline'
  | 'playbackRateTimeline'
  | 'overlayVisibilityTimeline'
  | 'playerEventTimeline'
>;

type CreateTwinPlayersStateControllerOptions = {
  pageSlug: string;
  playlistDocumentId?: string | null;
  queueSlug?: string | null;
  queueIndex: number;
  isQueueAutoPlay: boolean;
  showCinematicBars: boolean;
  isFullscreen: boolean;
  momentFeedLoopEnabled?: boolean;
};

const contentKeys = [
  'isReactionMissing',
  'isUsersOwnVideo',
  'isPublished',
  'reactionVideoId',
  'reactionVideoAuthor',
  'reactorDisplayName',
  'reactionVideoTitle',
  'reactionVideoDescription',
  'originalVideoAuthor',
  'originalVideoAuthorUrl',
  'originalVideoTitle',
  'originalVideoDescription',
  'originalVideoSlug',
  'originalVideoId',
  'reactorId',
  'youtubePlaylistId',
  'pageSlug',
  'originalVideoPlatform',
  'momentId',
  'isMomentReaction',
  'momentOriginalTimeSeconds',
  'momentFeedLoopEnabled'
] as const;

const collectionKeys = [
  'playlistDocumentId',
  'playlistItems',
  'playlistDocument',
  'hasNextIndexInPlaylist',
  'currentIndexInPlaylist',
  'isPlaylistAutoPlay',
  'queueSlug',
  'queueIndex',
  'isQueueAutoPlay'
] as const;

const uiKeys = [
  'isLoading',
  'isEditModeOn',
  'isFineTuneModeOn',
  'canShowEditModeButton',
  'canShowCloseEditModeButton',
  'showCinematicBars',
  'isFullscreen',
  'isControlSurfaceVisible',
  'isExitButtonExpanded',
  'fullscreenOverlayVisible',
  'fullscreenPrimaryVideo',
  'fullscreenPrimaryVideoDefault',
  'fullscreenOverlayWidthPercent',
  'fullscreenOverlayCorner'
] as const;

const playbackKeys = [
  'playerOriginal',
  'playerReaction',
  'bothVideosStarted',
  'isUserPaused',
  'currentPlaybackRate',
  'currentStateOriginalVideo',
  'currentVolumeOriginalVideo',
  'currentVolumeReactionVideo',
  'reactionCurrentTime',
  'reactionDuration',
  'offsetStartTime',
  'reactionFinishTime',
  'timeOffset',
  'globalGain',
  'introBufferTime',
  'soundLevel',
  'isReactionMuteModeEnabled',
  'isReactionAutoMuted',
  'isOutOfSync',
  'seekMin',
  'seekMax'
] as const;

const timelineKeys = [
  'playerConfigs',
  'volumeConfigs',
  'reactionVolumeConfigs',
  'playbackRateConfigs',
  'stateTimeline',
  'volumeTimeline',
  'reactionVolumeTimeline',
  'playbackRateTimeline',
  'overlayVisibilityTimeline',
  'playerEventTimeline'
] as const;

const hasOwnKey = (patch: Partial<TwinPlayersState>, key: keyof TwinPlayersState) =>
  Object.prototype.hasOwnProperty.call(patch, key);

const extractPatch = <K extends readonly (keyof TwinPlayersState)[]>(
  patch: Partial<TwinPlayersState>,
  keys: K
): Partial<Pick<TwinPlayersState, K[number]>> | undefined => {
  const nextPatch: Partial<Pick<TwinPlayersState, K[number]>> = {};
  let hasValues = false;

  keys.forEach((key) => {
    if (!hasOwnKey(patch, key)) {
      return;
    }

    nextPatch[key] = patch[key] as TwinPlayersState[K[number]];
    hasValues = true;
  });

  return hasValues ? nextPatch : undefined;
};

const applySlicePatch = <T extends object>(
  store: { update: (updater: (value: T) => T) => void },
  patch?: Partial<T>
) => {
  if (!patch) {
    return;
  }

  store.update((value) => ({
    ...value,
    ...patch
  }));
};

export function createTwinPlayersStateController({
  pageSlug,
  playlistDocumentId,
  queueSlug,
  queueIndex,
  isQueueAutoPlay,
  showCinematicBars,
  isFullscreen,
  momentFeedLoopEnabled = false
}: CreateTwinPlayersStateControllerOptions) {
  const contentState = writable<TwinPlayersContentState>({
    isReactionMissing: false,
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
    pageSlug,
    originalVideoPlatform: 'youtube',
    momentId: undefined,
    isMomentReaction: false,
    momentOriginalTimeSeconds: undefined,
    momentFeedLoopEnabled
  });

  const collectionState = writable<TwinPlayersCollectionState>({
    playlistDocumentId,
    playlistItems: [],
    playlistDocument: undefined,
    hasNextIndexInPlaylist: false,
    currentIndexInPlaylist: 0,
    isPlaylistAutoPlay: false,
    queueSlug,
    queueIndex,
    isQueueAutoPlay
  });

  const uiState = writable<TwinPlayersUiState>({
    isLoading: true,
    isEditModeOn: false,
    isFineTuneModeOn: false,
    canShowEditModeButton: false,
    canShowCloseEditModeButton: false,
    showCinematicBars,
    isFullscreen,
    isControlSurfaceVisible: !isFullscreen,
    isExitButtonExpanded: false,
    fullscreenOverlayVisible: true,
    fullscreenPrimaryVideo: DEFAULT_FULLSCREEN_PRIMARY_VIDEO,
    fullscreenPrimaryVideoDefault: DEFAULT_FULLSCREEN_PRIMARY_VIDEO,
    fullscreenOverlayWidthPercent: DEFAULT_FULLSCREEN_OVERLAY_WIDTH_PERCENT,
    fullscreenOverlayCorner: DEFAULT_FULLSCREEN_OVERLAY_CORNER
  });

  const playbackState = writable<TwinPlayersPlaybackState>({
    playerOriginal: null,
    playerReaction: null,
    bothVideosStarted: false,
    isUserPaused: false,
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
    isOutOfSync: false,
    seekMin: 0,
    seekMax: 100000
  });

  const timelineState = writable<TwinPlayersTimelineState>({
    playerConfigs: {},
    volumeConfigs: {},
    reactionVolumeConfigs: {},
    playbackRateConfigs: {},
    stateTimeline: [],
    volumeTimeline: [],
    reactionVolumeTimeline: [],
    playbackRateTimeline: [],
    overlayVisibilityTimeline: [],
    playerEventTimeline: []
  });

  const state = writable<TwinPlayersState>({
    ...get(contentState),
    ...get(collectionState),
    ...get(uiState),
    ...get(playbackState),
    ...get(timelineState)
  });

  const getSnapshot = () => get(state);

  const patchState = (patch: Partial<TwinPlayersState>) => {
    if (Object.keys(patch).length === 0) {
      return getSnapshot();
    }

    applySlicePatch(contentState, extractPatch(patch, contentKeys));
    applySlicePatch(collectionState, extractPatch(patch, collectionKeys));
    applySlicePatch(uiState, extractPatch(patch, uiKeys));
    applySlicePatch(playbackState, extractPatch(patch, playbackKeys));
    applySlicePatch(timelineState, extractPatch(patch, timelineKeys));

    const nextState = {
      ...getSnapshot(),
      ...patch
    };
    state.set(nextState);
    return nextState;
  };

  return {
    state,
    getSnapshot,
    patchState
  };
}
