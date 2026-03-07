import type { TwinPlayersSyncAction } from '$lib/helpers/twinPlayersSyncTick';

export type TwinPlayersSyncApplyGuards = {
  changingVolume: boolean;
  changingReactionVolume: boolean;
  changingSpeed: boolean;
};

export type TwinPlayersSyncApplyOptions = {
  allowStateActions?: boolean;
  allowPlaybackRate?: boolean;
  allowVolume?: boolean;
  /** When true, playback-rate actions are skipped and original volume is snapped to 0 or 100. */
  isTikTokOriginal?: boolean;
};

export type TwinPlayersSyncApplyDeps = {
  setVolumeForOriginalVideo: (volume: number) => void;
  setVolumeForReactionVideo: (volume: number) => void;
  setPlaybackRateForOriginalVideo: (rate: number) => void;

  pauseOriginalVideo: () => void;
  handleStateChangeInOriginalVideo: (
    previousState: number,
    nextState: number,
    targetTime: number,
    options?: { allowSeekAhead?: boolean; throttleMs?: number; forceSeek?: boolean }
  ) => void;

  muteReactionAudio: (player?: any) => boolean;
  unmuteReactionAudio: (player?: any) => boolean;

  updateState: (partial: any) => void;
};

export type TwinPlayersSyncApplySnapshot = {
  currentVolumeOriginalVideo: number;
  currentVolumeReactionVideo: number;
  currentPlaybackRate: number;
  playerOriginal: any;
  playerReaction: any;
};

export function applyTwinPlayersSyncActions(
  actions: TwinPlayersSyncAction[],
  {
    snapshot,
    guards,
    workingState,
    ytEndedState,
    deps,
    options
  }: {
    snapshot: TwinPlayersSyncApplySnapshot;
    guards: TwinPlayersSyncApplyGuards;
    workingState: number;
    ytEndedState: number;
    deps: TwinPlayersSyncApplyDeps;
    options?: TwinPlayersSyncApplyOptions;
  }
): { nextGuards: TwinPlayersSyncApplyGuards; nextWorkingState: number } {
  const allowVolume = options?.allowVolume !== false;
  const allowPlaybackRate = options?.allowPlaybackRate !== false && !options?.isTikTokOriginal;
  const allowStateActions = options?.allowStateActions !== false;
  const isTikTokOriginal = Boolean(options?.isTikTokOriginal);

  let nextWorkingState = workingState;
  const nextGuards: TwinPlayersSyncApplyGuards = { ...guards };

  for (const action of actions) {
    switch (action.type) {
      case 'setOriginalVolume': {
        if (!allowVolume) {
          break;
        }
        const resolvedVolume = isTikTokOriginal
          ? (action.volume >= 100 ? 100 : 0)
          : action.volume;
        if (!nextGuards.changingVolume && snapshot.currentVolumeOriginalVideo !== resolvedVolume) {
          nextGuards.changingVolume = true;
          deps.setVolumeForOriginalVideo(resolvedVolume);
          deps.updateState({ currentVolumeOriginalVideo: resolvedVolume });
          nextGuards.changingVolume = false;
        }
        break;
      }
      case 'setReactionVolume': {
        if (!allowVolume) {
          break;
        }
        if (!nextGuards.changingReactionVolume && snapshot.currentVolumeReactionVideo !== action.volume) {
          nextGuards.changingReactionVolume = true;
          deps.setVolumeForReactionVideo(action.volume);
          deps.updateState({ currentVolumeReactionVideo: action.volume });
          nextGuards.changingReactionVolume = false;
        }
        break;
      }
      case 'setOriginalPlaybackRate': {
        if (!allowPlaybackRate) {
          break;
        }
        if (!nextGuards.changingSpeed && Math.abs(action.rate - snapshot.currentPlaybackRate) > 0.001) {
          nextGuards.changingSpeed = true;
          deps.setPlaybackRateForOriginalVideo(action.rate);
          deps.updateState({ currentPlaybackRate: action.rate });
          nextGuards.changingSpeed = false;
        }
        break;
      }
      case 'muteOriginal': {
        snapshot.playerOriginal?.mute?.();
        break;
      }
      case 'unmuteOriginal': {
        snapshot.playerOriginal?.unMute?.();
        break;
      }
      case 'muteReaction': {
        deps.muteReactionAudio(snapshot.playerReaction);
        break;
      }
      case 'unmuteReaction': {
        deps.unmuteReactionAudio(snapshot.playerReaction);
        break;
      }
      case 'pauseOriginal': {
        if (!allowStateActions) {
          break;
        }
        deps.pauseOriginalVideo();
        nextWorkingState = ytEndedState;
        break;
      }
      case 'applyOriginalStateChange': {
        if (!allowStateActions) {
          break;
        }
        deps.handleStateChangeInOriginalVideo(
          nextWorkingState,
          action.nextState,
          action.targetTime,
          action.options
        );
        nextWorkingState = action.nextState;
        break;
      }
    }
  }

  return { nextGuards, nextWorkingState };
}
