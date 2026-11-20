import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#lib/helpers/firebase.js', () => ({
  getPlaylist: vi.fn(),
  getQueueBySlug: vi.fn(),
  getReaction: vi.fn(),
  updateFirebaseDocument: vi.fn()
}));

vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

import { getReaction } from '#lib/helpers/firebase.js';
import { buildTwinPlayersInPlaceTransitionPlan } from '#lib/helpers/twinPlayersInPlaceTransition.ts';
import { createTwinPlayersNavigationController } from '#lib/helpers/twinPlayersNavigationController.ts';
import { createTwinPlayersOrchestrationController } from '#lib/helpers/twinPlayersOrchestrationController.ts';

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
    expect(plan.shouldResetGate).toBe(true);
    expect(plan.nextBothVideosStarted).toBe(false);
  });

  it('keeps the click gate open when the next reaction continues a started session', () => {
    const plan = buildTwinPlayersInPlaceTransitionPlan({
      snapshotBefore: {
        playerReaction: { loadVideoById() {}, cueVideoById() {} },
        playerOriginal: { loadVideoById() {} },
        originalVideoPlatform: 'youtube',
        bothVideosStarted: true,
        reactionDuration: 120
      },
      derived: {
        reactionVideoId: 'reaction-video-b',
        originalVideoId: 'original-video',
        originalVideoPlatform: 'youtube'
      },
      previousReactionVideoId: 'reaction-video-a',
      preserveReactionTime: false,
      autoPlay: true,
      hasReactionElement: true,
      hasOriginalElement: true
    });

    expect(plan.shouldResetGate).toBe(false);
    expect(plan.nextBothVideosStarted).toBe(true);
    expect(plan.canReuseReactionPlayer).toBe(true);
    expect(plan.shouldCreateReactionPlayer).toBe(false);
  });
});

const orchestrationHooks = (overrides = {}) => ({
  getSnapshot: () => ({}),
  updateState: () => {},
  getNavigationHooks: () => ({
    buildInterface: vi.fn(async () => {}),
    setPlaylistData: vi.fn(async () => {})
  }),
  isCurrentInstance: () => true,
  getActiveInstanceId: () => 'test',
  waitForDomTick: async () => {},
  injectYoutubeIframeApiScript: () => {},
  waitForYoutubeIframeApiReady: async () => {},
  createTikTokOriginalPlayer: () => null,
  destroyTikTokOriginalPlayer: () => {},
  setExpectedPlayerReadyCount: () => {},
  finalizeLoadingState: () => {},
  arePlayersActuallyReady: () => true,
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
  setSwitchingReactionInPlace: () => {},
  resetClickGateForSetup: () => {},
  primeClickGateFromAutoplay: () => {},
  satisfyClickGateForAutoplay: () => {},
  debugClickGate: () => {},
  log: () => {},
  ...overrides
});

describe('moment next reaction playback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.window = {
      location: { pathname: '/moments/moment-a/reaction/reaction-a' }
    };
    globalThis.YT = { PlayerState: { PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5, ENDED: 0 } };
    vi.stubGlobal('document', {
      getElementById: (id) => (
        id === 'player-reaction' || id === 'player-original' ? { id, parentElement: null } : null
      )
    });
  });

  const loadNextReaction = async (autoPlay) => {
    const reactionPlayer = {
      loadVideoById: vi.fn(),
      cueVideoById: vi.fn(),
      setVolume: vi.fn(),
      getDuration: () => 120,
      seekTo: vi.fn()
    };
    const originalPlayer = {
      loadVideoById: vi.fn(),
      cueVideoById: vi.fn(),
      setVolume: vi.fn(),
      stopVideo: vi.fn(),
      getDuration: () => 200
    };
    const state = {
      pageSlug: 'reaction-a',
      playerReaction: reactionPlayer,
      playerOriginal: originalPlayer,
      originalVideoPlatform: 'youtube',
      bothVideosStarted: true,
      reactionDuration: 90,
      reactionVideoId: 'reaction-video-a',
      playlistDocumentId: null
    };
    const syncVideos = vi.fn();
    const pollVideoCurrentTime = vi.fn();
    const primeClickGateFromAutoplay = vi.fn();

    getReaction.mockResolvedValue({
      id: 'reaction-b',
      reactionVideoId: 'reaction-video-b',
      originalVideoId: 'original-video',
      originalVideoPlatform: 'youtube',
      offsetStartTime: 0,
      reactionConfigs: {
        '0.0': { state: 1, time: '12.00' }
      }
    });

    const { loadReactionInPlace } = createTwinPlayersOrchestrationController(orchestrationHooks({
      getSnapshot: () => state,
      updateState: (patch) => {
        Object.assign(state, patch);
      },
      syncVideos,
      pollVideoCurrentTime,
      primeClickGateFromAutoplay
    }));

    await loadReactionInPlace('reaction-b', { autoPlay });

    return { state, reactionPlayer, originalPlayer, syncVideos, pollVideoCurrentTime, primeClickGateFromAutoplay };
  };

  it('loads and syncs the next reaction when the playback session has started', async () => {
    const result = await loadNextReaction(true);

    expect(result.primeClickGateFromAutoplay).toHaveBeenCalledWith(true);
    expect(result.reactionPlayer.loadVideoById).toHaveBeenCalledWith({
      videoId: 'reaction-video-b',
      startSeconds: 0
    });
    expect(result.reactionPlayer.cueVideoById).not.toHaveBeenCalled();
    expect(result.syncVideos).toHaveBeenCalledTimes(1);
    expect(result.pollVideoCurrentTime).toHaveBeenCalledTimes(1);
    expect(result.state.bothVideosStarted).toBe(true);
  });

  it('cues the next reaction and closes the click gate when autoplay is off', async () => {
    const result = await loadNextReaction(false);

    expect(result.primeClickGateFromAutoplay).toHaveBeenCalledWith(false);
    expect(result.reactionPlayer.cueVideoById).toHaveBeenCalledWith({
      videoId: 'reaction-video-b',
      startSeconds: 0
    });
    expect(result.reactionPlayer.loadVideoById).not.toHaveBeenCalled();
    expect(result.syncVideos).not.toHaveBeenCalled();
    expect(result.pollVideoCurrentTime).not.toHaveBeenCalled();
    expect(result.state.bothVideosStarted).toBe(false);
  });
});
