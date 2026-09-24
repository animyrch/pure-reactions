import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/helpers/firebase', () => ({
  getPlaylist: vi.fn(),
  getQueueBySlug: vi.fn(),
  getReaction: vi.fn(),
  updateFirebaseDocument: vi.fn()
}));

vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

import { buildTwinPlayersInPlaceTransitionPlan } from '$lib/helpers/twinPlayersInPlaceTransition';
import { createTwinPlayersNavigationController } from '$lib/helpers/twinPlayersNavigationController';
import { createTwinPlayersOrchestrationController } from '$lib/helpers/twinPlayersOrchestrationController';

const navigationDeps = (overrides = {}) => ({
  getSnapshot: () => ({ pageSlug: 'reaction-a' }),
  updateState: vi.fn(),
  setUpVideos: vi.fn(async () => {}),
  loadReactionInPlace: vi.fn(async () => {}),
  onResetStandaloneTransition: vi.fn(),
  debugClickGate: vi.fn(),
  log: vi.fn(),
  isSwitchingReactionInPlace: () => false,
  ...overrides
});

describe('moment next reaction player setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.window = globalThis.window || {};
  });

  it('does not rebuild both players while an in-place switch is running', async () => {
    const setUpVideos = vi.fn(async () => {});
    const controller = createTwinPlayersNavigationController(navigationDeps({
      setUpVideos,
      isSwitchingReactionInPlace: () => true
    }));

    await controller.handleSlugChange('reaction-b');

    expect(setUpVideos).not.toHaveBeenCalled();
  });

  it('still rebuilds when the slug changes and nothing is switching in place', async () => {
    const setUpVideos = vi.fn(async () => {});
    const updateState = vi.fn();
    const controller = createTwinPlayersNavigationController(navigationDeps({
      setUpVideos,
      updateState,
      getSnapshot: () => ({ pageSlug: 'reaction-a' })
    }));

    await controller.handleSlugChange('reaction-b');

    expect(updateState).toHaveBeenCalledWith({ pageSlug: 'reaction-b' });
    expect(setUpVideos).toHaveBeenCalledTimes(1);
  });

  it('claims the next reaction id before the DOM tick that flushes slug handling', async () => {
    const state = { pageSlug: 'reaction-a' };
    let switchingDuringTick = false;
    let switching = false;

    const { loadReactionInPlace } = createTwinPlayersOrchestrationController({
      getSnapshot: () => state,
      updateState: (patch) => {
        Object.assign(state, patch);
      },
      getNavigationHooks: () => null,
      isCurrentInstance: () => true,
      getActiveInstanceId: () => 'test',
      waitForDomTick: async () => {
        switchingDuringTick = switching;
        throw new Error('stop-after-claim');
      },
      injectYoutubeIframeApiScript: () => {},
      waitForYoutubeIframeApiReady: async () => {},
      createTikTokOriginalPlayer: () => null,
      destroyTikTokOriginalPlayer: () => {},
      setExpectedPlayerReadyCount: () => {},
      finalizeLoadingState: () => {},
      arePlayersActuallyReady: () => false,
      onPlayerReady: () => {},
      onStateChangeOriginal: () => {},
      onStateChangeReaction: () => {},
      enforceReactionMuteMode: () => {},
      resetReactionDurationProbe: () => {},
      resetOriginalStateTracking: () => {},
      stopSyncScheduler: () => {},
      pollVideoCurrentTime: () => {},
      syncVideos: () => {},
      handleStateChangeInReactionVideo: () => {},
      verifyAndSyncMetadata: async () => {},
      seekReactionTo: () => {},
      setSwitchingReactionInPlace: (value) => {
        switching = value;
      },
      resetClickGateForSetup: () => {},
      primeClickGateFromAutoplay: () => {},
      satisfyClickGateForAutoplay: () => {},
      debugClickGate: () => {},
      log: () => {}
    });

    await expect(loadReactionInPlace('reaction-b')).rejects.toThrow('stop-after-claim');
    expect(switchingDuringTick).toBe(true);
    expect(state.pageSlug).toBe('reaction-b');
    expect(window.currentReactionDocumentId).toBe('reaction-b');
  });

  it('keeps the reaction player when the next moment uses a different reaction video', () => {
    const plan = buildTwinPlayersInPlaceTransitionPlan({
      snapshotBefore: {
        playerReaction: { loadVideoById() {}, cueVideoById() {} },
        playerOriginal: { loadVideoById() {} },
        originalVideoPlatform: 'youtube',
        bothVideosStarted: false,
        reactionDuration: 120
      },
      derived: {
        reactionVideoId: 'reaction-video-b',
        originalVideoId: 'original-video',
        originalVideoPlatform: 'youtube'
      },
      previousReactionVideoId: 'reaction-video-a',
      preserveReactionTime: false,
      autoPlay: false,
      hasReactionElement: true,
      hasOriginalElement: true
    });

    expect(plan.isSameReactionVideo).toBe(false);
    expect(plan.canReuseReactionPlayer).toBe(true);
    expect(plan.shouldCreateReactionPlayer).toBe(false);
    expect(plan.canReuseOriginalPlayer).toBe(true);
    expect(plan.shouldCreateOriginalPlayer).toBe(false);
  });
});
