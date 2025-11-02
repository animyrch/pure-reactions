/* global YT */
import { onDestroy, onMount } from 'svelte';
import { get, writable } from 'svelte/store';
import {
  getCurrentPlaybackRateFromConfigs,
  getCurrentStateFromStateConfigs,
  getCurrentVolumeFromVolumeConfigs
} from '$lib/helpers/reaction';
import {
  getReaction,
  updateFirebaseDocument,
  getPlaylist
} from '$lib/helpers/firebase';
import {
  downloadBasicVideoDetails,
  extractYouTubeVideoId,
  fetchFirstPlaylistVideos
} from '$lib/helpers/youtube';
import {
  deriveTimelines,
  readAutoPlayCookie,
  toggleFullscreenBodyClass,
  writeAutoPlayCookie
} from '$lib/helpers/reactionPlayer';

export const CONTROLS_FADE_CLASS = 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100';

const playerOptions = {
  autoplay: 0,
  controls: 1,
  disablekb: 1,
  modestbranding: 1,
  rel: 0
};

const iframeOptionDefault = {
  width: '100%',
  height: '100%'
};

export function useTwinPlayers({ data }) {
  const { slug, userId } = data;
  const initialUrlState = getInitialUrlState();

  const state = writable({
    isLoading: true,
    isReactionMissing: false,
    isEditModeOn: false,
    isFineTuneModeOn: false,
    canShowEditModeButton: false,
    canShowCloseEditModeButton: false,
    isUsersOwnVideo: false,
    isPublished: false,
    reactionVideoId: '',
    originalVideoAuthor: undefined,
    originalVideoTitle: undefined,
    reactionVideoAuthor: undefined,
    reactionVideoTitle: undefined,
    originalVideoId: undefined,
    reactorId: undefined,
    youtubePlaylistId: undefined,
    playlistDocumentId: initialUrlState.playlistId,
    playlistItems: [],
    playlistDocument: undefined,
    hasNextIndexInPlaylist: false,
    currentIndexInPlaylist: 0,
    isPlaylistAutoPlay: false,
    showCinematicBars: false,
    isFullscreen: initialUrlState.isFullscreen,
    isControlSurfaceVisible: false,
    isExitButtonExpanded: false,
    playerOriginal: null,
    playerReaction: null,
    bothVideosStarted: false,
    playerConfigs: {},
    volumeConfigs: {},
    playbackRateConfigs: {},
    stateTimeline: [],
    volumeTimeline: [],
    playbackRateTimeline: [],
    currentPlaybackRate: 1,
    currentStateOriginalVideo: -1,
    currentVolumeOriginalVideo: 100,
    offsetStartTime: 0,
    reactionFinishTime: 100000,
    timeOffset: 0,
    globalGain: 1,
    introBufferTime: 0,
    soundLevel: 100,
    pageSlug: slug,
    isOutOfSync: false
  });

  let overlayElement;
  let controlHideTimeout;
  let overlayPointerRestoreTimeout;
  let exitButtonCollapseTimeout;
  let pollInterval;
  let escListener;

  let originalVideoClicked = false;
  let reactionVideoClicked = false;
  let changingVolume = false;
  let changingState = false;
  let changingSpeed = false;

  toggleFullscreenBodyClass(initialUrlState.isFullscreen);

  const updateState = (partial) => {
    state.update((value) => {
      const patch = typeof partial === 'function' ? partial(value) : partial;
      return {
        ...value,
        ...patch
      };
    });
  };

  const startReactionVideo = () => {
    const { playerReaction } = get(state);
    playerReaction?.playVideo?.();
  };

  const startOriginalVideo = () => {
    const snapshot = get(state);
    if (snapshot.playerOriginal) {
      snapshot.playerOriginal.setPlaybackRate(snapshot.currentPlaybackRate);
      snapshot.playerOriginal.playVideo();
    }
  };

  const pauseOriginalVideo = () => {
    get(state).playerOriginal?.pauseVideo?.();
  };

  const pauseReactionVideo = () => {
    get(state).playerReaction?.pauseVideo?.();
  };

  const goToSecondsInOriginalVideo = (seconds) => {
    get(state).playerOriginal?.seekTo?.(seconds);
  };

  const goToSecondsInReactionVideo = (seconds) => {
    get(state).playerReaction?.seekTo?.(seconds);
  };

  const setVolumeForOriginalVideo = (volume) => {
    get(state).playerOriginal?.setVolume?.(volume);
  };

  const setPlaybackRateForOriginalVideo = (rate) => {
    const original = get(state).playerOriginal;
    if (original && typeof original.setPlaybackRate === 'function') {
      original.setPlaybackRate(rate);
    }
  };

  const handleOriginalVideoVolume = (reactionCurrentTime) => {
    const snapshot = get(state);
    const newVolume = getCurrentVolumeFromVolumeConfigs(
      reactionCurrentTime,
      window?.volumeConfigs,
      snapshot.globalGain,
      snapshot.timeOffset
    );
    if (!changingVolume && snapshot.currentVolumeOriginalVideo !== newVolume) {
      changingVolume = true;
      setVolumeForOriginalVideo(newVolume);
      updateState({ currentVolumeOriginalVideo: newVolume });
      changingVolume = false;
    }
  };

  const handleOriginalVideoSpeed = (reactionCurrentTime) => {
    const snapshot = get(state);
    const desiredPlaybackRate = getCurrentPlaybackRateFromConfigs(
      reactionCurrentTime,
      window?.playbackRateConfigs,
      snapshot.timeOffset
    );
    if (!changingSpeed && Math.abs(desiredPlaybackRate - snapshot.currentPlaybackRate) > 0.001) {
      changingSpeed = true;
      setPlaybackRateForOriginalVideo(desiredPlaybackRate);
      updateState({ currentPlaybackRate: desiredPlaybackRate });
      changingSpeed = false;
    }
  };

  const handleStateChangeInOriginalVideo = (previousState, nextState, targetTime) => {
    if (previousState === nextState) {
      return;
    }
    if (nextState === YT.PlayerState.PLAYING) {
      goToSecondsInOriginalVideo(targetTime);
      startOriginalVideo();
    } else if (nextState === YT.PlayerState.PAUSED || nextState === YT.PlayerState.BUFFERING) {
      pauseOriginalVideo();
    }
  };

  const handleOriginalVideoState = (reactionCurrentTime) => {
    const snapshot = get(state);
    const config = getCurrentStateFromStateConfigs(
      reactionCurrentTime,
      window?.playerConfigs,
      snapshot.timeOffset
    );
    if (!changingState && config.state !== snapshot.currentStateOriginalVideo) {
      changingState = true;
      handleStateChangeInOriginalVideo(snapshot.currentStateOriginalVideo, config.state, config.time);
      updateState({ currentStateOriginalVideo: config.state });
      changingState = false;
    }
  };

  const handleStateChangeInReactionVideo = (previousState, nextState) => {
    if (
      previousState !== YT.PlayerState.PAUSED &&
      previousState !== YT.PlayerState.BUFFERING &&
      (nextState === YT.PlayerState.PAUSED || nextState === YT.PlayerState.BUFFERING)
    ) {
      pauseOriginalVideo();
    }
    if (previousState === YT.PlayerState.BUFFERING && nextState === YT.PlayerState.PLAYING) {
      const reactionCurrentTime = Number(get(state).playerReaction?.getCurrentTime().toFixed(1));
      const closestConfig = getCurrentStateFromStateConfigs(reactionCurrentTime, window?.playerConfigs);
      const calculatedTimeForOriginalVideo = (reactionCurrentTime - closestConfig.closestSmallerTimeCode) + parseFloat(closestConfig.time);
      goToSecondsInOriginalVideo(calculatedTimeForOriginalVideo);
      if (closestConfig.state === YT.PlayerState.PLAYING) {
        startOriginalVideo();
      }
    }
  };

  const pollVideoCurrentTime = () => {
    clearInterval(pollInterval);
    const interval = 500;
    let reactionPlayerState = YT?.PlayerState?.UNSTARTED ?? -1;
    pollInterval = setInterval(() => {
      const snapshot = get(state);
      const { playerReaction, playerOriginal, reactionFinishTime, hasNextIndexInPlaylist, isPlaylistAutoPlay } = snapshot;
      if (!playerReaction || !playerOriginal) {
        return;
      }
      const newReactionState = playerReaction.getPlayerState();
      if (reactionPlayerState !== newReactionState) {
        handleStateChangeInReactionVideo(reactionPlayerState, newReactionState);
        reactionPlayerState = newReactionState;
      }
      const reactionCurrentTime = parseFloat(playerReaction.getCurrentTime().toFixed(1));
      if (reactionCurrentTime > reactionFinishTime) {
        pauseOriginalVideo();
        pauseReactionVideo();
        clearInterval(pollInterval);
        if (isPlaylistAutoPlay && hasNextIndexInPlaylist) {
          loadNextReactionInPlaylist();
        }
        return;
      }
      handleOriginalVideoVolume(reactionCurrentTime);
      handleOriginalVideoSpeed(reactionCurrentTime);
      handleOriginalVideoState(reactionCurrentTime);
    }, interval);
  };

  const onPlayerReady = (event) => {
    updateState({ isLoading: false });
    const snapshot = get(state);
    if (event?.target === snapshot.playerOriginal) {
      setPlaybackRateForOriginalVideo(snapshot.currentPlaybackRate);
    }
    if (event?.target === snapshot.playerReaction && typeof event?.target?.setPlaybackRate === 'function') {
      event.target.setPlaybackRate(1);
    }
  };

  const startVideos = () => {
    const snapshot = get(state);
    if (!snapshot.playerReaction) {
      return;
    }
    goToSecondsInReactionVideo(snapshot.offsetStartTime || 0);
    setPlaybackRateForOriginalVideo(snapshot.currentPlaybackRate);
    startReactionVideo();
    pollVideoCurrentTime();
    updateState({ bothVideosStarted: true });
  };

  const onStateChangeOriginal = (event) => {
    if (event.data === YT.PlayerState.PLAYING) {
      if (!originalVideoClicked) {
        pauseOriginalVideo();
        originalVideoClicked = true;
      }
      if (!get(state).bothVideosStarted && originalVideoClicked && reactionVideoClicked) {
        startVideos();
      }
    }
  };

  const onStateChangeReaction = (event) => {
    if (event.data === YT.PlayerState.ENDED && get(state).isPlaylistAutoPlay) {
      if (get(state).hasNextIndexInPlaylist) {
        loadNextReactionInPlaylist();
      }
    }
    if (event.data === YT.PlayerState.PLAYING) {
      if (!reactionVideoClicked) {
        pauseReactionVideo();
        reactionVideoClicked = true;
      }
      if (!get(state).bothVideosStarted && originalVideoClicked && reactionVideoClicked) {
        startVideos();
      }
    }
  };

  const toggleAutoPlaylist = () => {
    const snapshot = get(state);
    const nextValue = !snapshot.isPlaylistAutoPlay;
    updateState({ isPlaylistAutoPlay: nextValue });
    writeAutoPlayCookie(nextValue, snapshot.playlistDocumentId);
  };

  const loadYouTubeAPI = () => {
    if (typeof document === 'undefined') {
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('div')[0];
    firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
  };

  const setPlaylistData = async (playlistId, youtubePlaylistId) => {
    if (!playlistId || !youtubePlaylistId) {
      updateState({ playlistItems: [], playlistDocument: undefined, hasNextIndexInPlaylist: false });
      return;
    }
    const playlistItems = await fetchFirstPlaylistVideos(youtubePlaylistId);
    const playlistDocument = await getPlaylist(playlistId);
    const filteredItems = playlistItems.filter((item) => playlistDocument.originalVideoIds.includes(item.snippet.resourceId.videoId));
    const snapshot = get(state);
    const currentIndex = filteredItems.findIndex((item) => item.snippet.resourceId.videoId === snapshot.originalVideoId);
    updateState({
      playlistItems: filteredItems,
      playlistDocument,
      hasNextIndexInPlaylist: currentIndex < filteredItems.length - 1,
      currentIndexInPlaylist: currentIndex
    });
  };

  const updateUIElements = (slugValue) => {
    updateState({ pageSlug: slugValue });
    if (typeof window !== 'undefined') {
      window.currentReactionDocumentId = slugValue;
    }
  };

  const setUpVideos = async (reactionData) => {
    if (!reactionData) {
      return;
    }

    const {
      playerConfigs,
      volumeConfigs,
      playbackRateConfigs,
      stateTimeline,
      volumeTimeline,
      playbackRateTimeline
    } = deriveTimelines(reactionData);

    window.playerConfigs = reactionData['stateTimeline'] || reactionData['reactionConfigs'];
    window.volumeConfigs = reactionData['volumeTimeline'] || reactionData['volumeConfigs'];
    window.playbackRateConfigs = reactionData['playbackTimeline'] || reactionData['playbackRateConfigs'];

    const reactionVideoId = reactionData['reactionVideoId'];
    const originalVideoId = reactionData['originalVideoId'];
    const youtubePlaylistId = reactionData['youtubePlaylistId'];
    const offsetStartTime = reactionData['offsetStartTime'] ?? 0;
    const reactionFinishTime = parseFloat(reactionData['reactionFinishTime']) || 100000;
    const timeOffset = reactionData['timeOffset'] || 0;
    const globalGain = reactionData['globalGain'] || 1.0;
    const currentPlaybackRate = getCurrentPlaybackRateFromConfigs(offsetStartTime || 0, window.playbackRateConfigs, timeOffset);

    const previousOriginal = get(state).playerOriginal;
    const previousReaction = get(state).playerReaction;
    previousOriginal?.destroy?.();
    previousReaction?.destroy?.();

    let newPlayerReaction = null;
    if (reactionVideoId) {
      newPlayerReaction = new YT.Player('player-reaction', {
        videoId: reactionVideoId,
        playerVars: playerOptions,
        ...iframeOptionDefault,
        events: {
          onReady: onPlayerReady,
          onStateChange: onStateChangeReaction
        }
      });
    }

    const newPlayerOriginal = new YT.Player('player-original', {
      videoId: originalVideoId,
      playerVars: playerOptions,
      ...iframeOptionDefault,
      events: {
        onReady: onPlayerReady,
        onStateChange: onStateChangeOriginal
      }
    });

    const isUsersOwnVideo = reactionData['reactorId'] === userId;

    changingSpeed = false;
    originalVideoClicked = false;
    reactionVideoClicked = false;

    updateState({
      isPublished: reactionData.isPublished,
      isReactionMissing: !reactionVideoId,
      reactorId: reactionData['reactorId'],
      isUsersOwnVideo,
      canShowEditModeButton: isUsersOwnVideo,
      playerConfigs,
      volumeConfigs,
      playbackRateConfigs,
      stateTimeline,
      volumeTimeline,
      playbackRateTimeline,
      reactionVideoId,
      originalVideoId,
      reactionVideoAuthor: reactionData?.reactionVideoAuthor,
      reactionVideoTitle: reactionData?.reactionVideoTitle,
      originalVideoAuthor: reactionData?.originalVideoAuthor,
      originalVideoTitle: reactionData?.originalVideoTitle,
      youtubePlaylistId,
      offsetStartTime,
      reactionFinishTime,
      timeOffset,
      globalGain,
      currentPlaybackRate,
      playerOriginal: newPlayerOriginal,
      playerReaction: newPlayerReaction,
      currentStateOriginalVideo: -1,
      currentVolumeOriginalVideo: 100,
      bothVideosStarted: false,
      introBufferTime: timeOffset,
      soundLevel: Math.round((globalGain || 1) * 100)
    });

    await setPlaylistData(get(state).playlistDocumentId, youtubePlaylistId);
  };

  const buildInterface = async (slugValue, { isUpdate = false } = {}) => {
    if (isUpdate) {
      window.currentReactionDocumentId = slugValue;
      const reaction = await getReaction(slugValue);
      await setUpVideos(reaction);
      updateUIElements(slugValue);
    } else {
      window.currentReactionDocumentId = slugValue;
      const reaction = await getReaction(slugValue);
      await setUpVideos(reaction);
    }
  };

  const loadNextReactionInPlaylist = () => {
    const snapshot = get(state);
    const { hasNextIndexInPlaylist, playlistDocument, currentIndexInPlaylist, playlistItems } = snapshot;
    if (!hasNextIndexInPlaylist || !playlistDocument) {
      return;
    }
    const nextIndex = currentIndexInPlaylist + 1;
    const nextReactionDocumentId = playlistDocument.reactionBinomeIds[nextIndex];

    buildInterface(nextReactionDocumentId, { isUpdate: true }).then(() => {
      const updatedIndex = nextIndex;
      const hasNext = updatedIndex < playlistItems.length - 1;
      updateState({
        currentIndexInPlaylist: updatedIndex,
        hasNextIndexInPlaylist: hasNext
      });
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.pathname = `/reaction/${nextReactionDocumentId}`;
        window.history.pushState({}, '', url.toString());
      }
      originalVideoClicked = false;
      reactionVideoClicked = false;
      updateState({
        bothVideosStarted: false,
        currentStateOriginalVideo: -1,
        currentVolumeOriginalVideo: 100
      });
    });
  };

  const getBasicDetailsReaction = async (videoId) => {
    const { videoAuthor, videoTitle } = await downloadBasicVideoDetails(videoId);
    return { videoAuthor, videoTitle };
  };

  const setReactionVideoId = async (value) => {
    const cleanedId = extractYouTubeVideoId(value);
    const { videoAuthor, videoTitle } = await getBasicDetailsReaction(cleanedId);
    await updateFirebaseDocument({
      reactionVideoId: cleanedId,
      reactionVideoAuthor: videoAuthor,
      reactionVideoTitle: videoTitle
    });
    updateState({
      reactionVideoId: cleanedId,
      reactionVideoAuthor: videoAuthor,
      reactionVideoTitle: videoTitle
    });
  };

  const setIntroBufferTime = async (value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }
    await updateFirebaseDocument({ timeOffset: parsed });
    updateState({ timeOffset: parsed, introBufferTime: parsed });
  };

  const setSoundLevel = async (value) => {
    const gain = Number(value) / 100;
    await updateFirebaseDocument({ globalGain: Number.isNaN(gain) ? 1.0 : gain });
    updateState({ globalGain: Number.isNaN(gain) ? 1.0 : gain, soundLevel: value });
  };

  const setIsPublished = async () => {
    await updateFirebaseDocument({ isPublished: true });
    if (typeof location !== 'undefined') {
      location.reload();
    }
  };

  const setIsUnpublished = async () => {
    await updateFirebaseDocument({ isPublished: false });
    if (typeof location !== 'undefined') {
      location.reload();
    }
  };

  const enterEditMode = () => {
    updateState({ canShowCloseEditModeButton: true, isEditModeOn: true, canShowEditModeButton: false });
  };

  const closeEditMode = () => {
    updateState({ isEditModeOn: false, canShowEditModeButton: true, canShowCloseEditModeButton: false });
  };

  const toggleFineTuneMode = () => {
    const snapshot = get(state);
    updateState({ isFineTuneModeOn: !snapshot.isFineTuneModeOn });
  };

  const toggleCinematicBars = () => {
    const snapshot = get(state);
    updateState({ showCinematicBars: !snapshot.showCinematicBars });
  };

  const handlePlayStateChange = (isPlaying) => {
    if (isPlaying) {
      startReactionVideo();
      handleStateChangeInReactionVideo(YT.PlayerState.PAUSED, YT.PlayerState.PLAYING);
    } else {
      pauseOriginalVideo();
      pauseReactionVideo();
    }
  };

  const syncVideos = () => {
    pauseOriginalVideo();
    pauseReactionVideo();
    startReactionVideo();
    handleStateChangeInReactionVideo(YT.PlayerState.PAUSED, YT.PlayerState.PLAYING);
  };

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
    const snapshot = get(state);
    if (!snapshot.isFullscreen) {
      updateState({ isControlSurfaceVisible: false, isExitButtonExpanded: false });
      return;
    }
    controlHideTimeout = setTimeout(() => {
      updateState({ isControlSurfaceVisible: false, isExitButtonExpanded: false });
    }, 3000);
  };

  const handleFullscreenMouseMove = () => {
    if (!get(state).isFullscreen) {
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

  const setVideoScene = (value) => {
    if (typeof window === 'undefined') {
      return;
    }
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    params.set('isFullscreen', String(value));
    url.search = params.toString();
    window.location.href = url.toString();
  };

  const openWithFullscreen = () => {
    setVideoScene(true);
  };

  const openWithHalfscreen = () => {
    setVideoScene(false);
  };

  const handleExitFullscreenClick = () => {
    openWithHalfscreen();
    updateState({ isControlSurfaceVisible: false });
    clearTimeout(controlHideTimeout);
    collapseExitButton(true);
  };

  const editActionEntryPoint = async (callback) => {
    await callback();
    await setIsUnpublished();
  };

  const handleSlugChange = async (nextSlug) => {
    const snapshot = get(state);
    if (nextSlug === snapshot.pageSlug) {
      return;
    }
    updateState({ pageSlug: nextSlug });
    await buildInterface(nextSlug, { isUpdate: false });
  };

  const registerOverlayRef = (element) => {
    overlayElement = element;
  };

  onMount(() => {
    const isAutoPlay = readAutoPlayCookie();
    updateState({ isPlaylistAutoPlay: isAutoPlay });

    escListener = (event) => {
      if (get(state).isFullscreen && event.key === 'Escape') {
        event.preventDefault();
        openWithHalfscreen();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', escListener);
      window.addEventListener('mousemove', handleFullscreenMouseMove);
    }

    if (get(state).isFullscreen) {
      showControls();
      scheduleHideControls();
    }

    if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
      loadYouTubeAPI();
      window.onYouTubeIframeAPIReady = async () => {
        await buildInterface(get(state).pageSlug);
      };
    } else {
      buildInterface(get(state).pageSlug);
    }
  });

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('reaction-fullscreen');
    }
    if (typeof window !== 'undefined') {
      if (escListener) {
        window.removeEventListener('keydown', escListener);
      }
      window.removeEventListener('mousemove', handleFullscreenMouseMove);
    }
    clearTimeout(controlHideTimeout);
    clearTimeout(overlayPointerRestoreTimeout);
    clearTimeout(exitButtonCollapseTimeout);
    clearInterval(pollInterval);
    if (overlayElement) {
      overlayElement.style.pointerEvents = 'auto';
    }
  });

  return {
    state,
    actions: {
      toggleAutoPlaylist,
      toggleCinematicBars,
      handlePlayStateChange,
      syncVideos,
      showControls,
      scheduleHideControls,
      handleFullscreenPointerMove,
      handleFullscreenPointerDown,
      handleExitButtonEnter,
      handleExitButtonLeave,
      handleExitFullscreenClick,
      enterEditMode,
      closeEditMode,
      toggleFineTuneMode,
      setReactionVideoId,
      setIntroBufferTime,
      setSoundLevel,
      setIsPublished,
      setIsUnpublished,
      openWithFullscreen,
      openWithHalfscreen,
      editActionEntryPoint,
      handleSlugChange,
      registerOverlayRef
    }
  };
}

function getInitialUrlState() {
  if (typeof window === 'undefined') {
    return { isFullscreen: false, playlistId: null };
  }
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  return {
    isFullscreen: params.get('isFullscreen') === 'true',
    playlistId: params.get('playlistId')
  };
}
