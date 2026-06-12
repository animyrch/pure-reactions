import {
  getCurrentPlaybackRateFromConfigs,
  getCurrentStateFromStateConfigs,
  getCurrentVolumeFromVolumeConfigs
} from '$lib/helpers/reaction';
import { normalizeOriginalVideoPlatform } from '$lib/helpers/platform';
import { normalizeOriginalVideoMetadata } from '$lib/helpers/originalVideo';
import { deriveTimelines } from '$lib/helpers/reactionPlayer';
import { buildPlayerEventTimeline } from '$lib/helpers/twinPlayersTimeline';

export type FullscreenPrimaryVideo = 'original' | 'reaction';
export type FullscreenOverlayCorner = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export const DEFAULT_FULLSCREEN_PRIMARY_VIDEO: FullscreenPrimaryVideo = 'original';
export const DEFAULT_FULLSCREEN_OVERLAY_WIDTH_PERCENT = 35;
export const DEFAULT_FULLSCREEN_OVERLAY_CORNER: FullscreenOverlayCorner = 'top-right';
export const FULLSCREEN_OVERLAY_WIDTH_MIN = 5;
export const FULLSCREEN_OVERLAY_WIDTH_MAX = 80;
export const FULLSCREEN_OVERLAY_WIDTH_STEP = 5;

export const normalizeFullscreenPrimaryVideo = (value: unknown): FullscreenPrimaryVideo =>
  value === 'reaction' ? 'reaction' : 'original';

export const normalizeFullscreenOverlayCorner = (value: unknown): FullscreenOverlayCorner => {
  if (
    value === 'top-left' || value === 'top-center' || value === 'top-right' ||
    value === 'middle-left' || value === 'middle-right' ||
    value === 'bottom-left' || value === 'bottom-center' || value === 'bottom-right'
  ) {
    return value;
  }
  return DEFAULT_FULLSCREEN_OVERLAY_CORNER;
};

export const normalizeFullscreenOverlayWidthPercent = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_FULLSCREEN_OVERLAY_WIDTH_PERCENT;
  }
  const snapped = Math.round(parsed / FULLSCREEN_OVERLAY_WIDTH_STEP) * FULLSCREEN_OVERLAY_WIDTH_STEP;
  return Math.max(FULLSCREEN_OVERLAY_WIDTH_MIN, Math.min(FULLSCREEN_OVERLAY_WIDTH_MAX, snapped));
};

type DeriveTwinPlayersReactionDataParams = {
  reactionData: any;
  viewerUserId?: string | null;
  viewerDisplayName?: string | null;
  reactionFinishTimeFallback?: number;
};

export function deriveTwinPlayersReactionData({
  reactionData,
  viewerUserId,
  viewerDisplayName,
  reactionFinishTimeFallback = 0
}: DeriveTwinPlayersReactionDataParams) {
  const reactionVideoId = reactionData?.reactionVideoId ?? '';
  const originalVideoId = reactionData?.originalVideoId;
  const youtubePlaylistId = reactionData?.youtubePlaylistId;

  const rawOffsetStartTime = Number(reactionData?.offsetStartTime ?? 0);
  const offsetStartTime = Number.isFinite(rawOffsetStartTime) && rawOffsetStartTime >= 0
    ? Math.round(rawOffsetStartTime * 10) / 10
    : 0;
  const reactionFinishTime = parseFloat(reactionData?.reactionFinishTime) || reactionFinishTimeFallback;
  const timeOffset = reactionData?.timeOffset || 0;

  const globalGainValue = reactionData?.globalGain;
  const globalGain = typeof globalGainValue === 'number' && !Number.isNaN(globalGainValue) ? globalGainValue : 1.0;
  const soundLevel = Math.max(0, Math.min(200, Math.round(globalGain * 100)));

  const fullscreenPrimaryVideo = normalizeFullscreenPrimaryVideo(reactionData?.fullscreenPrimaryVideo);
  const fullscreenOverlayWidthPercent = normalizeFullscreenOverlayWidthPercent(reactionData?.fullscreenOverlayWidthPercent);
  const fullscreenOverlayCorner = normalizeFullscreenOverlayCorner(reactionData?.fullscreenOverlayCorner);

  const {
    playerConfigs,
    volumeConfigs,
    reactionVolumeConfigs,
    playbackRateConfigs,
    stateTimeline,
    volumeTimeline,
    reactionVolumeTimeline,
    playbackRateTimeline,
    overlayVisibilityTimeline
  } = deriveTimelines(reactionData);

  const playerEventTimeline = buildPlayerEventTimeline(stateTimeline);
  const initialConfig = getCurrentStateFromStateConfigs(
    offsetStartTime || 0,
    stateTimeline,
    timeOffset
  );
  const rawInitialState = Number(initialConfig.state);
  const initialState = Number.isFinite(rawInitialState) ? rawInitialState : -1;
  const initialTargetTime = Number(initialConfig.time ?? 0);

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
  const currentPlaybackRate = getCurrentPlaybackRateFromConfigs(offsetStartTime || 0, playbackRateTimeline, timeOffset);

  const resolvedReactorId =
    typeof reactionData?.reactorId === 'string'
      ? reactionData.reactorId
      : typeof reactionData?.userId === 'string'
        ? reactionData.userId
        : undefined;
  const rawReactorDisplayName =
    typeof reactionData?.reactorDisplayName === 'string' ? reactionData.reactorDisplayName.trim() : '';
  const normalizedViewerDisplayName = typeof viewerDisplayName === 'string' ? viewerDisplayName.trim() : '';
  const resolvedReactorDisplayName =
    rawReactorDisplayName || (reactionData?.reactorId === viewerUserId ? normalizedViewerDisplayName : '');

  const reactionVideoDescription =
    (typeof reactionData?.reactionVideoDescription === 'string'
      ? reactionData.reactionVideoDescription.trim()
      : '') ||
    (typeof reactionData?.youtube?.meta?.description === 'string'
      ? reactionData.youtube.meta.description.trim()
      : '') ||
    undefined;

  const normalizedOriginalMetadata = normalizeOriginalVideoMetadata(reactionData);
  const originalVideoPlatform = normalizeOriginalVideoPlatform(reactionData?.originalVideoPlatform);

  return {
    reactionVideoId,
    originalVideoId,
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
    timelineSources: {
      playerConfigs: reactionData?.stateTimeline || reactionData?.reactionConfigs,
      volumeConfigs: reactionData?.volumeTimeline || reactionData?.volumeConfigs,
      reactionVolumeConfigs: reactionData?.reactionVolumeTimeline || reactionData?.reactionVolumeConfigs,
      playbackRateConfigs: reactionData?.playbackTimeline || reactionData?.playbackRateConfigs,
    },
    initialState,
    initialTargetTime,
    initialOriginalVolume,
    initialReactionVolume,
    currentPlaybackRate,
    resolvedReactorId,
    resolvedReactorDisplayName: resolvedReactorDisplayName || undefined,
    reactionVideoDescription,
    normalizedOriginalMetadata,
    originalVideoPlatform,
    isReactionMissing: !reactionVideoId,
    isUsersOwnVideo: resolvedReactorId === viewerUserId,
    canShowEditModeButton: resolvedReactorId === viewerUserId,
    isReactionMuteModeEnabled: Boolean(reactionData?.muteReactionWhileOriginalPlays),
    isPublished: reactionData?.isPublished,
    momentId: typeof reactionData?.momentId === 'string' ? reactionData.momentId : undefined,
    isMomentReaction: Boolean(reactionData?.isMomentReaction),
    momentOriginalTimeSeconds: Number.isFinite(Number(reactionData?.momentOriginalTimeSeconds))
      ? Number(reactionData.momentOriginalTimeSeconds)
      : undefined,
  };
}