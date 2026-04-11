type TwinPlayersDebugClickGate = (
  label: string,
  details?: Record<string, any>,
  includeStack?: boolean
) => void;

type TwinPlayersGateWatchdogSnapshot = {
  bothVideosStarted: boolean;
  playerOriginal: any;
  playerReaction: any;
};

type CreateTwinPlayersGateWatchdogOptions = {
  enabled: boolean;
  getSnapshot: () => TwinPlayersGateWatchdogSnapshot;
  getPlayingStateValue: () => number | undefined;
  getPlayerDebugInfo: (target: any) => Record<string, any>;
  isGateSatisfied: () => boolean;
  debugClickGate: TwinPlayersDebugClickGate;
};

type CreateTwinPlayersFullscreenWindowBindingsOptions = {
  getIsFullscreen: () => boolean;
  onExitFullscreen: () => void;
  onFullscreenMouseMove: () => void;
};

type DestroyTwinPlayersPlayersOptions = {
  snapshot: {
    playerOriginal: any;
    playerReaction: any;
  };
  destroyTikTokOriginalPlayer: () => void;
  onDestroyError?: (error: unknown) => void;
};

export function createTwinPlayersGateWatchdog({
  enabled,
  getSnapshot,
  getPlayingStateValue,
  getPlayerDebugInfo,
  isGateSatisfied,
  debugClickGate
}: CreateTwinPlayersGateWatchdogOptions) {
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let lastWatchdogLogAt = 0;

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

    if (playerState !== getPlayingStateValue()) {
      return;
    }

    try {
      target.pauseVideo?.();
    } catch {
      return;
    }

    const now = Date.now();
    if (now - lastWatchdogLogAt <= 500) {
      return;
    }

    lastWatchdogLogAt = now;
    debugClickGate('[TwinPlayers] WATCHDOG paused player while gated', {
      which,
      state: playerState,
      gateSatisfied: isGateSatisfied(),
      ...getPlayerDebugInfo(target)
    }, true);
  };

  const start = () => {
    if (!enabled || intervalId) {
      return;
    }

    intervalId = setInterval(() => {
      const snapshot = getSnapshot();
      if (snapshot.bothVideosStarted) {
        return;
      }

      maybePauseIfPlaying(snapshot.playerReaction, 'reaction');
      maybePauseIfPlaying(snapshot.playerOriginal, 'original');
    }, 150);
  };

  const stop = () => {
    clearInterval(intervalId);
    intervalId = undefined;
  };

  return {
    start,
    stop
  };
}

export function createTwinPlayersFullscreenWindowBindings({
  getIsFullscreen,
  onExitFullscreen,
  onFullscreenMouseMove
}: CreateTwinPlayersFullscreenWindowBindingsOptions) {
  let escListener: ((event: KeyboardEvent) => void) | undefined;

  const mount = () => {
    if (typeof window === 'undefined') {
      return;
    }

    escListener = (event: KeyboardEvent) => {
      if (!getIsFullscreen() || event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      onExitFullscreen();
    };

    window.addEventListener('keydown', escListener);
    window.addEventListener('mousemove', onFullscreenMouseMove);
  };

  const unmount = () => {
    if (typeof window === 'undefined') {
      return;
    }

    if (escListener) {
      window.removeEventListener('keydown', escListener);
      escListener = undefined;
    }

    window.removeEventListener('mousemove', onFullscreenMouseMove);
  };

  return {
    mount,
    unmount
  };
}

export function destroyTwinPlayersPlayers({
  snapshot,
  destroyTikTokOriginalPlayer,
  onDestroyError
}: DestroyTwinPlayersPlayersOptions) {
  try {
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

    snapshot.playerOriginal?.destroy?.();
    snapshot.playerReaction?.destroy?.();
  } catch (error) {
    onDestroyError?.(error);
  }

  destroyTikTokOriginalPlayer();
}