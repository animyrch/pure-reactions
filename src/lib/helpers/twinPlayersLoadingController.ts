type CreateTwinPlayersLoadingControllerOptions = {
  setLoadingState: (isLoading: boolean) => void;
  arePlayersActuallyReady: () => boolean;
  canRetry: () => boolean;
  onRetryRequested: () => void;
  retryDelayMs: number;
};

export function createTwinPlayersLoadingController({
  setLoadingState,
  arePlayersActuallyReady,
  canRetry,
  onRetryRequested,
  retryDelayMs
}: CreateTwinPlayersLoadingControllerOptions) {
  let pendingPlayerReadyCount = 0;
  let playerReadyTimeout: ReturnType<typeof setTimeout> | undefined;

  const finalizeLoadingState = () => {
    pendingPlayerReadyCount = 0;
    clearTimeout(playerReadyTimeout);
    playerReadyTimeout = undefined;
    setLoadingState(false);
  };

  const scheduleLoadingFallback = () => {
    clearTimeout(playerReadyTimeout);
    if (pendingPlayerReadyCount === 0) {
      return;
    }

    playerReadyTimeout = setTimeout(() => {
      if (!arePlayersActuallyReady() && canRetry()) {
        onRetryRequested();
        return;
      }

      finalizeLoadingState();
    }, retryDelayMs);
  };

  const setExpectedPlayerReadyCount = (count: number) => {
    pendingPlayerReadyCount = count;
    if (count === 0) {
      finalizeLoadingState();
      return;
    }

    setLoadingState(true);
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

  const dispose = () => {
    clearTimeout(playerReadyTimeout);
    playerReadyTimeout = undefined;
    pendingPlayerReadyCount = 0;
  };

  return {
    finalizeLoadingState,
    setExpectedPlayerReadyCount,
    markPlayerReady,
    dispose,
  };
}