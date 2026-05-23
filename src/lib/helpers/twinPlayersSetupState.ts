import { deriveTwinPlayersReactionData } from '$lib/helpers/twinPlayersReactionData';

type TwinPlayersDerivedReactionData = ReturnType<typeof deriveTwinPlayersReactionData>;

type BuildTwinPlayersSetupStatePatchParams = {
  derived: TwinPlayersDerivedReactionData;
  reactionVideoAuthor?: string;
  reactionVideoTitle?: string;
  reactionVideoDescription?: string;
  nextPlayerOriginal: any;
  nextPlayerReaction: any;
  momentFeedLoopEnabled?: boolean;
};

export function buildTwinPlayersSetupStatePatch({
  derived,
  reactionVideoAuthor,
  reactionVideoTitle,
  reactionVideoDescription,
  nextPlayerOriginal,
  nextPlayerReaction,
  momentFeedLoopEnabled = false,
}: BuildTwinPlayersSetupStatePatchParams) {
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
    reactionVideoDescription,
    originalVideoAuthor: derived.normalizedOriginalMetadata.author,
    originalVideoAuthorUrl: derived.normalizedOriginalMetadata.authorUrl,
    originalVideoTitle: derived.normalizedOriginalMetadata.title,
    originalVideoDescription: derived.normalizedOriginalMetadata.description,
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
    fullscreenPrimaryVideoDefault: derived.fullscreenPrimaryVideo,
    fullscreenOverlayWidthPercent: derived.fullscreenOverlayWidthPercent,
    fullscreenOverlayCorner: derived.fullscreenOverlayCorner,
    currentPlaybackRate: derived.currentPlaybackRate,
    originalVideoPlatform: derived.originalVideoPlatform,
    playerOriginal: nextPlayerOriginal,
    playerReaction: nextPlayerReaction,
    currentStateOriginalVideo: -1,
    currentVolumeOriginalVideo: derived.initialOriginalVolume,
    fullscreenOverlayVisible: true,
    bothVideosStarted: false,
    isUserPaused: false,
    currentVolumeReactionVideo: derived.initialReactionVolume,
    reactionCurrentTime: derived.offsetStartTime || 0,
    reactionDuration: typeof nextPlayerReaction?.getDuration === 'function' ? Number(nextPlayerReaction.getDuration()) || 0 : 0,
    momentId: derived.momentId,
    isMomentReaction: derived.isMomentReaction,
    momentOriginalTimeSeconds: derived.momentOriginalTimeSeconds,
    momentFeedLoopEnabled: momentFeedLoopEnabled || derived.isMomentReaction
  };
}
