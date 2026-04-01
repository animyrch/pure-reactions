import { deriveTwinPlayersReactionData } from '$lib/helpers/twinPlayersReactionData';

type TwinPlayersDerivedReactionData = ReturnType<typeof deriveTwinPlayersReactionData>;

type TwinPlayersSnapshotBeforeTransition = {
  playerReaction: any;
  playerOriginal: any;
  originalVideoPlatform: 'youtube' | 'tiktok';
  bothVideosStarted: boolean;
  reactionDuration: number;
};

type BuildTwinPlayersInPlaceTransitionPlanParams = {
  snapshotBefore: TwinPlayersSnapshotBeforeTransition;
  derived: TwinPlayersDerivedReactionData;
  previousReactionVideoId?: string;
  previousReactionTime?: number;
  preserveReactionTime: boolean;
  autoPlay?: boolean;
  hasReactionElement: boolean;
  hasOriginalElement: boolean;
};

export function buildTwinPlayersInPlaceTransitionPlan({
  snapshotBefore,
  derived,
  previousReactionVideoId,
  previousReactionTime,
  preserveReactionTime,
  autoPlay,
  hasReactionElement,
  hasOriginalElement
}: BuildTwinPlayersInPlaceTransitionPlanParams) {
  const isSameReactionVideo = derived.reactionVideoId === previousReactionVideoId;

  const canReuseReactionPlayer =
    Boolean(snapshotBefore.playerReaction) &&
    Boolean(derived.reactionVideoId) &&
    isSameReactionVideo &&
    hasReactionElement;

  const canReuseOriginalPlayer =
    Boolean(snapshotBefore.playerOriginal) &&
    Boolean(derived.originalVideoId) &&
    snapshotBefore.originalVideoPlatform === 'youtube' &&
    derived.originalVideoPlatform === 'youtube' &&
    hasOriginalElement &&
    typeof snapshotBefore.playerOriginal?.loadVideoById === 'function';

  const shouldResetGate = !isSameReactionVideo;
  const effectivePreviousReactionTime = isSameReactionVideo ? previousReactionTime : undefined;
  const shouldCreateReactionPlayer = Boolean(derived.reactionVideoId) && !canReuseReactionPlayer;
  const shouldCreateOriginalPlayer = Boolean(derived.originalVideoId) && !canReuseOriginalPlayer;
  const nextBothVideosStarted = shouldResetGate
    ? false
    : (isSameReactionVideo && preserveReactionTime ? snapshotBefore.bothVideosStarted : Boolean(autoPlay));

  return {
    isSameReactionVideo,
    canReuseReactionPlayer,
    canReuseOriginalPlayer,
    shouldResetGate,
    effectivePreviousReactionTime,
    shouldCreateReactionPlayer,
    shouldCreateOriginalPlayer,
    nextBothVideosStarted,
    expectedPlayerReadyCount: (shouldCreateReactionPlayer ? 1 : 0) + (shouldCreateOriginalPlayer ? 1 : 0),
  };
}

type BuildTwinPlayersInPlaceStatePatchParams = {
  snapshotBefore: TwinPlayersSnapshotBeforeTransition;
  derived: TwinPlayersDerivedReactionData;
  reactionVideoAuthor?: string;
  reactionVideoTitle?: string;
  nextPlayerOriginal: any;
  nextPlayerReaction: any;
  transitionPlan: ReturnType<typeof buildTwinPlayersInPlaceTransitionPlan>;
};

export function buildTwinPlayersInPlaceStatePatch({
  snapshotBefore,
  derived,
  reactionVideoAuthor,
  reactionVideoTitle,
  nextPlayerOriginal,
  nextPlayerReaction,
  transitionPlan
}: BuildTwinPlayersInPlaceStatePatchParams) {
  const reactionCurrentTime =
    typeof transitionPlan.effectivePreviousReactionTime === 'number'
      ? transitionPlan.effectivePreviousReactionTime
      : derived.offsetStartTime || 0;

  const reactionDuration =
    typeof nextPlayerReaction?.getDuration === 'function'
      ? Number(nextPlayerReaction.getDuration()) || 0
      : snapshotBefore.reactionDuration;

  const seekMin = derived.offsetStartTime || 0;
  const rawDuration =
    typeof nextPlayerReaction?.getDuration === 'function'
      ? Number(nextPlayerReaction.getDuration())
      : Number(snapshotBefore.reactionDuration);
  const durationCap = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : Number.POSITIVE_INFINITY;
  const rawFinish = Number(derived.reactionFinishTime);
  const finishCap = Number.isFinite(rawFinish) && rawFinish > 0 ? rawFinish : Number.POSITIVE_INFINITY;
  const seekMax = Math.max(seekMin, Math.min(durationCap, finishCap));

  return {
    isPublished: derived.isPublished,
    isReactionMissing: derived.isReactionMissing,
    reactorId: derived.resolvedReactorId,
    isUsersOwnVideo: derived.isUsersOwnVideo,
    canShowEditModeButton: derived.canShowEditModeButton,
    playerConfigs: derived.playerConfigs,
    volumeConfigs: derived.volumeConfigs,
    reactionVolumeConfigs: derived.reactionVolumeConfigs,
    playbackRateConfigs: derived.playbackRateConfigs,
    stateTimeline: derived.stateTimeline,
    volumeTimeline: derived.volumeTimeline,
    reactionVolumeTimeline: derived.reactionVolumeTimeline,
    playbackRateTimeline: derived.playbackRateTimeline,
    overlayVisibilityTimeline: derived.overlayVisibilityTimeline,
    playerEventTimeline: derived.playerEventTimeline,
    reactionVideoId: derived.reactionVideoId,
    originalVideoId: derived.originalVideoId,
    reactionVideoAuthor,
    reactorDisplayName: derived.resolvedReactorDisplayName,
    reactionVideoTitle,
    youtubePlaylistId: derived.youtubePlaylistId,
    offsetStartTime: derived.offsetStartTime,
    reactionFinishTime: derived.reactionFinishTime,
    timeOffset: derived.timeOffset,
    globalGain: derived.globalGain,
    introBufferTime: derived.timeOffset,
    soundLevel: derived.soundLevel,
    isReactionMuteModeEnabled: derived.isReactionMuteModeEnabled,
    isReactionAutoMuted: false,
    fullscreenPrimaryVideo: derived.fullscreenPrimaryVideo,
    fullscreenOverlayWidthPercent: derived.fullscreenOverlayWidthPercent,
    fullscreenOverlayCorner: derived.fullscreenOverlayCorner,
    currentPlaybackRate: derived.currentPlaybackRate,
    originalVideoAuthor: derived.normalizedOriginalMetadata.author,
    originalVideoAuthorUrl: derived.normalizedOriginalMetadata.authorUrl,
    originalVideoTitle: derived.normalizedOriginalMetadata.title,
    originalVideoDescription: derived.normalizedOriginalMetadata.description,
    originalVideoPlatform: derived.originalVideoPlatform,
    playerOriginal: nextPlayerOriginal,
    playerReaction: nextPlayerReaction,
    currentStateOriginalVideo: -1,
    currentVolumeOriginalVideo: derived.initialOriginalVolume,
    fullscreenOverlayVisible: true,
    currentVolumeReactionVideo: derived.initialReactionVolume,
    bothVideosStarted: transitionPlan.nextBothVideosStarted,
    reactionCurrentTime,
    reactionDuration,
    seekMin,
    seekMax
  };
}