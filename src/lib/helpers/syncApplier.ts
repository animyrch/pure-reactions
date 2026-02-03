import { applyTwinPlayersSyncActions } from '$lib/helpers/twinPlayersSyncApply';

export type SyncApplierDeps = {
  setVolumeForOriginalVideo: (...args: any[]) => any;
  setVolumeForReactionVideo: (...args: any[]) => any;
  setPlaybackRateForOriginalVideo: (...args: any[]) => any;
  pauseOriginalVideo: (...args: any[]) => any;
  handleStateChangeInOriginalVideo: (...args: any[]) => any;
  muteReactionAudio: (...args: any[]) => any;
  unmuteReactionAudio: (...args: any[]) => any;
  updateState: (patch: Record<string, any>) => any;
  enforceReactionMuteMode?: (state?: number) => any;
};

export function applySyncActionsAndStateUpdates(
  result: any,
  snapshot: any,
  guards: { changingVolume: boolean; changingReactionVolume: boolean; changingSpeed: boolean },
  deps: SyncApplierDeps,
  options: { ytEndedState: number; isMobileAudio: boolean },
  applyOptions?: Record<string, any>
) {
  const { nextGuards, nextWorkingState } = applyTwinPlayersSyncActions(result.actions, {
    snapshot,
    guards,
    workingState: snapshot.currentStateOriginalVideo,
    ytEndedState: options.ytEndedState,
    deps: {
      setVolumeForOriginalVideo: deps.setVolumeForOriginalVideo,
      setVolumeForReactionVideo: deps.setVolumeForReactionVideo,
      setPlaybackRateForOriginalVideo: deps.setPlaybackRateForOriginalVideo,
      pauseOriginalVideo: deps.pauseOriginalVideo,
      handleStateChangeInOriginalVideo: deps.handleStateChangeInOriginalVideo,
      muteReactionAudio: deps.muteReactionAudio,
      unmuteReactionAudio: deps.unmuteReactionAudio,
      updateState: deps.updateState
    },
    ...applyOptions
  });

  if (typeof result.stateUpdates?.currentStateOriginalVideo === 'number') {
    if (snapshot.currentStateOriginalVideo !== result.stateUpdates.currentStateOriginalVideo) {
      deps.updateState({ currentStateOriginalVideo: result.stateUpdates.currentStateOriginalVideo });
    }
  } else if (nextWorkingState !== snapshot.currentStateOriginalVideo) {
    deps.updateState({ currentStateOriginalVideo: nextWorkingState });
  }

  if (!options.isMobileAudio && typeof result.enforceMuteModeWithOriginalState === 'number' && typeof deps.enforceReactionMuteMode === 'function') {
    deps.enforceReactionMuteMode(result.enforceMuteModeWithOriginalState);
  }

  if (typeof result.stateUpdates?.fullscreenOverlayVisible === 'boolean') {
    deps.updateState({ fullscreenOverlayVisible: result.stateUpdates.fullscreenOverlayVisible });
  }

  return { nextGuards, nextWorkingState };
}
