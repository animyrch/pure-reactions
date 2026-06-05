import type { TwinPlayersState } from '$lib/helpers/twinPlayersStateController';

type CreateTwinPlayersControlSurfaceControllerOptions = {
  getSnapshot: () => TwinPlayersState;
  updateState: (patch: Partial<TwinPlayersState>) => void;
  onExitFullscreen: () => void;
};

export function createTwinPlayersControlSurfaceController({
  getSnapshot,
  updateState,
  onExitFullscreen
}: CreateTwinPlayersControlSurfaceControllerOptions) {
  let overlayElement: HTMLDivElement | undefined;
  let controlHideTimeout: ReturnType<typeof setTimeout> | undefined;
  let overlayPointerRestoreTimeout: ReturnType<typeof setTimeout> | undefined;
  let exitButtonCollapseTimeout: ReturnType<typeof setTimeout> | undefined;

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

    // If fullscreen, keep existing behavior (auto-hide after timeout)
    if (getSnapshot().isFullscreen) {
      controlHideTimeout = setTimeout(() => {
        updateState({ isControlSurfaceVisible: false, isExitButtonExpanded: false });
      }, 3000);
      return;
    }

    // Also allow auto-hide on mobile landscape / touch-landscape overlay mode
    try {
      const mq = window.matchMedia(
        "(hover: none) and (pointer: coarse) and (orientation: landscape) and (max-width: 1023px), (hover: none) and (pointer: coarse) and (orientation: landscape) and (max-height: 768px), (hover: none) and (pointer: coarse) and (orientation: landscape) and (min-aspect-ratio: 1.5) and (max-height: 900px)"
      );
      if (mq.matches && getSnapshot().bothVideosStarted) {
        controlHideTimeout = setTimeout(() => {
          updateState({ isControlSurfaceVisible: false, isExitButtonExpanded: false });
        }, 3000);
        return;
      }
    } catch (e) {
      // ignore matchMedia errors and fallthrough to default
    }

    // Default: keep controls visible for non-fullscreen, non-mobile-landscape
    updateState({ isControlSurfaceVisible: true, isExitButtonExpanded: false });
  };

  const handleFullscreenMouseMove = () => {
    if (!getSnapshot().isFullscreen) {
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

  const handleExitFullscreenClick = () => {
    onExitFullscreen();
    updateState({
      isControlSurfaceVisible: true,
      fullscreenOverlayVisible: true
    });
    clearTimeout(controlHideTimeout);
    collapseExitButton(true);
  };

  const registerOverlayElement = (element: HTMLDivElement | undefined) => {
    if (overlayElement && overlayElement !== element) {
      overlayElement.style.pointerEvents = 'auto';
    }
    overlayElement = element;
  };

  const syncWithFullscreenState = () => {
    if (!getSnapshot().isFullscreen) {
      updateState({ isControlSurfaceVisible: true, isExitButtonExpanded: false });
      return;
    }

    showControls();
    scheduleHideControls();
  };

  const dispose = () => {
    clearTimeout(controlHideTimeout);
    clearTimeout(overlayPointerRestoreTimeout ?? undefined);
    clearTimeout(exitButtonCollapseTimeout);
    if (overlayElement) {
      overlayElement.style.pointerEvents = 'auto';
    }
    overlayPointerRestoreTimeout = undefined;
  };

  return {
    showControls,
    scheduleHideControls,
    handleFullscreenMouseMove,
    handleFullscreenPointerMove,
    handleFullscreenPointerDown,
    handleExitButtonEnter,
    handleExitButtonLeave,
    handleExitFullscreenClick,
    registerOverlayElement,
    syncWithFullscreenState,
    dispose
  };
}