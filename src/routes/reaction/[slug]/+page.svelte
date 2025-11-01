<script>
  /* global YT */
  import { onMount, onDestroy } from "svelte";
  import {
    getCurrentVolumeFromVolumeConfigs,
    getCurrentStateFromStateConfigs,
    getCurrentPlaybackRateFromConfigs
  } from "$lib/helpers/reaction";
  import {
    getReaction,
    updateFirebaseDocument,
    getPlaylist,
  } from '$lib/helpers/firebase';
  import { extractYouTubeVideoId } from '$lib/helpers/youtube';
  import { currentUser } from '$lib/stores/user';
  import { page } from '$app/stores';
  import { Input, Label, Button } from 'flowbite-svelte';
  import { downloadBasicVideoDetails } from '$lib/helpers/youtube';
  import CreatorDetails from "$lib/components/Video/CreatorDetails.svelte";
  import ConfigEditor from "$lib/components/Video/ConfigEditor.svelte";
  import ReactionBinomeTopActions from "$lib/components/Video/ReactionBinomeTopActions.svelte";
  import OtherReactions from "$lib/components/Video/OtherReactions.svelte";
  import VideoControl from "$lib/components/Video/VideoControl.svelte";
  import PlaylistQueue from "$lib/components/Video/PlaylistQueue.svelte";
  import { fetchFirstPlaylistVideos } from '$lib/helpers/youtube';

  export let data;

  $currentUser;
  
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

  let playerReaction;
  let playerOriginal;
  let isPublished;
  let currentStateOriginalVideo = -1;
  let currentVolumeOriginalVideo = 100;
  let changingVolume = false;
  let changingState = false;
  let isReactionMissing = false;
  let isEditModeOn = false;
  let isFineTuneModeOn = false;
  let canShowEditModeButton = false;
  let isUsersOwnVideo = false;
  let canShowCloseEditModeButton = false;
  let introBufferTime = 0;
  let soundLevel = 100;
  let originalVideoId;
  let reactionVideoId;
  let reactorId;
  let pageSlug = data.slug;
  let reactionVideoAuthor;
  let reactionVideoTitle;
  let originalVideoAuthor;
  let originalVideoTitle;
  let isFullscreen;
  let isLoading = true;
  let playerConfigs = {};  // Declare playerConfigs here
  let volumeConfigs = {};  // Declare volumeConfigs here
  let playbackRateConfigs = {};
  let stateTimeline = [];
  let volumeTimeline = [];
  let playbackRateTimeline = [];
  let currentPlaybackRate = 1;
  let changingSpeed = false;
  let isOutOfSync = false;
  let showCinematicBars = false;
  let playlistItems = [];
  let playlistDocument;
  let playlistId;
  let youtubePlaylistId;
  let currentIndexInPlaylist;
  let hasNextIndexInPlaylist;
  let isPlaylistAutoPlay = false;
  let offsetStartTime = 0;
  let reactionFinishTime = 100000;
  let timeOffset = 0; // non-destructive shift for timelines
  let globalGain = 1.0; // non-destructive volume gain
  let currentReactionData; // Store current reaction data for playlist navigation
  const fullscreenBodyClass = 'reaction-fullscreen';
  let escListener;
  let isControlSurfaceVisible = false;
  let controlHideTimeout;
  let fullscreenPointerOverlay;
  let overlayPointerRestoreTimeout;
  let isExitButtonExpanded = false;
  let exitButtonCollapseTimeout;

  function getAutoPlayCookie() {
    const autoPlayCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('autoPlay='))
      ?.split('=')[1];
    return autoPlayCookie === 'true';
  }
  function setAutoPlayCookie(value) {
    if (!playlistId) {
      return;
    }
    const expiry = new Date();
    expiry.setTime(expiry.getTime() + 365 * 24 * 60 * 60 * 1000);
    document.cookie = `autoPlay=${value}; expires=${expiry.toUTCString()}; path=/`;
  }
  // Check if window is defined (i.e., we're on the client side)
  if (typeof window !== 'undefined') {
    // Create a new URL object with the current URL
    let url = new URL(window.location.href);

    // Get the query parameters from the URL
    let params = new URLSearchParams(url.search);

    // Get the isFullscreen query parameter
    isFullscreen = params.get('isFullscreen') === 'true';
    playlistId = params.get('playlistId');
  }

  $: if (typeof document !== 'undefined') {
    document.body.classList.toggle(fullscreenBodyClass, Boolean(isFullscreen));
  }


  function loadYouTubeAPI() {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("div")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }

  function startReactionVideo() {
    playerReaction.playVideo();
  }
  function startOriginalVideo() {
    setPlaybackRateForOriginalVideo(currentPlaybackRate);
    playerOriginal.playVideo();
  }
  function pauseOriginalVideo() {
    playerOriginal.pauseVideo();
  }
  function pauseReactionVideo() {
    playerReaction.pauseVideo();
  }
  function toggleAutoPlaylist() {
    const autoPlayCookie = getAutoPlayCookie();
    isPlaylistAutoPlay = !autoPlayCookie;
    setAutoPlayCookie(!autoPlayCookie);
  }
  function handleOriginalVideoVolume(reactionCurrentTime) {
    const originalVideoNewVolume = getCurrentVolumeFromVolumeConfigs(
      reactionCurrentTime,
      window.volumeConfigs,
      globalGain,
      timeOffset
    );
    if (!changingVolume && currentVolumeOriginalVideo !== originalVideoNewVolume) {
      changingVolume = true;
      setVolumeForOriginalVideo(originalVideoNewVolume);
      currentVolumeOriginalVideo = originalVideoNewVolume;
      changingVolume = false;
    }
  }

  function handleOriginalVideoSpeed(reactionCurrentTime) {
    const desiredPlaybackRate = getCurrentPlaybackRateFromConfigs(
      reactionCurrentTime,
      window.playbackRateConfigs,
      timeOffset
    );
    if (!changingSpeed && Math.abs(desiredPlaybackRate - currentPlaybackRate) > 0.001) {
      changingSpeed = true;
      currentPlaybackRate = desiredPlaybackRate;
      setPlaybackRateForOriginalVideo(desiredPlaybackRate);
      changingSpeed = false;
    }
  }

  function handleOriginalVideoState(reactionCurrentTime) {
    const originalVideoNewStateConfig = getCurrentStateFromStateConfigs(
      reactionCurrentTime,
      window.playerConfigs,
      timeOffset
    );
    if (!changingState && originalVideoNewStateConfig.state !== currentStateOriginalVideo) {
      changingState = true;
      handleStateChangeInOriginalVideo(currentStateOriginalVideo, originalVideoNewStateConfig.state, originalVideoNewStateConfig.time);
      currentStateOriginalVideo = originalVideoNewStateConfig.state;
      changingState = false;
    }
  }
  // 4. The API will call this function when the video player is ready.
  function onPlayerReady(event) {
    isLoading = false;
    console.log("player ready");
    if (event?.target === playerOriginal) {
      setPlaybackRateForOriginalVideo(currentPlaybackRate);
    }
    if (event?.target === playerReaction && typeof event?.target?.setPlaybackRate === 'function') {
      event.target.setPlaybackRate(1);
    }
  }
  const startVideos = () => {
    bothVideosStarted = true;
    goToSecondsInReactionVideo(offsetStartTime || 0);
    setPlaybackRateForOriginalVideo(currentPlaybackRate);
    startReactionVideo();
    pollVideoCurrentTime();
  };

  let originalVideoClicked;
  let reactionVideoClicked;
  let bothVideosStarted;
  const controlsFadeClass = 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100';
  $: stickyControlsClass = bothVideosStarted ? controlsFadeClass : 'opacity-100';

  function pollVideoCurrentTime() {
    const interval = 500; // Polling interval in milliseconds (adjust as needed)
    let reactionPlayerState = YT.PlayerState.UNSTARTED;
    // Use setInterval to periodically get the current time
    const pollInterval = setInterval(async () => {
      if (
        playerReaction && playerOriginal
      ) {
        const reactionVideoNewState = playerReaction.getPlayerState();
        if (reactionPlayerState !== reactionVideoNewState) {
          handleStateChangeInReactionVideo(reactionPlayerState, reactionVideoNewState);
          reactionPlayerState = reactionVideoNewState;
        }
      }
      if (
        playerReaction
      ) {
        const reactionCurrentTime = parseFloat(playerReaction.getCurrentTime().toFixed(1));
        if (reactionCurrentTime > reactionFinishTime) {
          console.log('exceeding reaction finish time');
          pauseOriginalVideo();
          pauseReactionVideo();
          clearInterval(pollInterval);
          if (isPlaylistAutoPlay) {
            console.log('is autoplay');
            if (hasNextIndexInPlaylist) {
              console.log('has next index in playlist');
              loadNextReactionInPlaylist();
            }
          }
        }
        handleOriginalVideoVolume(reactionCurrentTime);
        handleOriginalVideoSpeed(reactionCurrentTime);
        handleOriginalVideoState(reactionCurrentTime);
      }
    }, interval);
  }
  const handleStateChangeInOriginalVideo = (originalPlayerState, originalPlayerNewState, originalPlayerTime) => {
    if (originalPlayerState !== originalPlayerNewState) {
      if (originalPlayerNewState === YT.PlayerState.PLAYING) {
        goToSecondsInOriginalVideo(originalPlayerTime);
        startOriginalVideo();
      } else if (
        originalPlayerNewState === YT.PlayerState.PAUSED ||
        originalPlayerNewState === YT.PlayerState.BUFFERING
      ) {
        pauseOriginalVideo();
      }
    }
  };
  const handleStateChangeInReactionVideo = (reactionPlayerState, reactionVideoNewState) => {
    if (
      reactionPlayerState !== YT.PlayerState.PAUSED && reactionPlayerState !== YT.PlayerState.BUFFERING &&
      (reactionVideoNewState === YT.PlayerState.PAUSED || reactionVideoNewState === YT.PlayerState.BUFFERING)
    ) {
      pauseOriginalVideo();
    }
    if (
      reactionPlayerState === YT.PlayerState.BUFFERING &&
      reactionVideoNewState === YT.PlayerState.PLAYING
    ) {
      const reactionCurrentTime = playerReaction.getCurrentTime().toFixed(1);
      const closetSmallerConfig = getCurrentStateFromStateConfigs(reactionCurrentTime, window.playerConfigs);
      const calculatedTimeForOriginalVideo = (reactionCurrentTime - closetSmallerConfig.closestSmallerTimeCode) + parseFloat(closetSmallerConfig.time)
      goToSecondsInOriginalVideo(calculatedTimeForOriginalVideo);
      if (closetSmallerConfig.state === YT.PlayerState.PLAYING) {
        startOriginalVideo();
      }
    }
  }


  function onStateChangeOriginal(event) {
    if (event.data == YT.PlayerState.PLAYING) {
      if (!originalVideoClicked) {
        pauseOriginalVideo();
        originalVideoClicked = true;
      }
      if (!bothVideosStarted && originalVideoClicked && reactionVideoClicked) {
        startVideos();
      }
    }
  }
  async function onStateChangeReaction(event) {
    if (event.data === YT.PlayerState.ENDED && isPlaylistAutoPlay) {
      if (hasNextIndexInPlaylist) {
        loadNextReactionInPlaylist();
      }
    }
    if (event.data == YT.PlayerState.PLAYING) {
      if (!reactionVideoClicked) {
        pauseReactionVideo();
        reactionVideoClicked = true;
      }
      if (!bothVideosStarted && originalVideoClicked && reactionVideoClicked) {
        startVideos();
      }
    }
  }

  function goToSecondsInOriginalVideo(seconds) {
    playerOriginal.seekTo(seconds);
  }
  function goToSecondsInReactionVideo(seconds) {
    console.log("going to seconds in reaction video", seconds);
    playerReaction.seekTo(seconds);
  }
  function setVolumeForOriginalVideo(volume) {
    playerOriginal.setVolume(volume);
  }

  function setPlaybackRateForOriginalVideo(rate) {
    if (playerOriginal && typeof playerOriginal.setPlaybackRate === 'function') {
      playerOriginal.setPlaybackRate(rate);
    }
  }

  function loadNextReactionInPlaylist() {
    if (!hasNextIndexInPlaylist || !playlistDocument) {
      return;
    }
    
    const nextIndex = currentIndexInPlaylist + 1;
    const nextReactionDocumentId = playlistDocument.reactionBinomeIds[nextIndex];
    
    // Get the next reaction data and update the players
    buildInterface(nextReactionDocumentId, { isUpdate: true }).then(() => {
      // Update playlist state
      currentIndexInPlaylist = nextIndex;
      hasNextIndexInPlaylist = currentIndexInPlaylist < playlistItems.length - 1;
      
      // Update URL without page reload
      const url = new URL(window.location.href);
      url.pathname = `/reaction/${nextReactionDocumentId}`;
      window.history.pushState({}, '', url.toString());
      
      // Reset player states
      originalVideoClicked = false;
      reactionVideoClicked = false;
      bothVideosStarted = false;
      currentStateOriginalVideo = -1;
      currentVolumeOriginalVideo = 100;
    });
  }

  function updateUIElements() {
    // Update page slug for UI components
    pageSlug = currentReactionData?.id || data.slug;
    
    // Trigger reactivity by updating the data store
    if (typeof window !== 'undefined') {
      window.currentReactionDocumentId = pageSlug;
    }
  }

  const setUpVideos = async (obtainedData) => {
    if (!obtainedData) {
      return;
    }
    isPublished = obtainedData.isPublished;
    isReactionMissing = !obtainedData["reactionVideoId"];
    reactorId = obtainedData["reactorId"];
    isUsersOwnVideo = reactorId === data.userId
    canShowEditModeButton = isUsersOwnVideo;
    changingSpeed = false;
    // Prefer new array timelines; fall back to legacy maps
    window.playerConfigs = obtainedData["stateTimeline"] || obtainedData["reactionConfigs"];
    window.volumeConfigs = obtainedData["volumeTimeline"] || obtainedData["volumeConfigs"];
    window.playbackRateConfigs = obtainedData["playbackTimeline"] || obtainedData["playbackRateConfigs"];
    // For editor compatibility: if only arrays exist, convert to legacy maps locally
    if (!obtainedData["reactionConfigs"] && Array.isArray(obtainedData["stateTimeline"])) {
      playerConfigs = Object.fromEntries(
        obtainedData["stateTimeline"].map((ev) => [Number(ev.t).toFixed(1), { time: Number(ev.targetTime).toFixed(2), state: ev.state }])
      );
    } else {
      playerConfigs = obtainedData["reactionConfigs"] || {};
    }
    if (!obtainedData["volumeConfigs"] && Array.isArray(obtainedData["volumeTimeline"])) {
      volumeConfigs = Object.fromEntries(
        obtainedData["volumeTimeline"].map((ev) => [Number(ev.t).toFixed(1), { volume: ev.volume }])
      );
    } else {
      volumeConfigs = obtainedData["volumeConfigs"] || {};
    }
    if (!obtainedData["playbackRateConfigs"] && Array.isArray(obtainedData["playbackTimeline"])) {
      playbackRateConfigs = Object.fromEntries(
        obtainedData["playbackTimeline"].map((ev) => [Number(ev.t).toFixed(1), { rate: ev.rate }])
      );
    } else {
      playbackRateConfigs = obtainedData["playbackRateConfigs"] || {};
    }

    stateTimeline = Array.isArray(obtainedData["stateTimeline"]) && obtainedData["stateTimeline"].length
      ? obtainedData["stateTimeline"]
      : Object.entries(playerConfigs).map(([key, value]) => ({
          t: Number(key),
          state: Number(value?.state ?? -1),
          targetTime: Number(value?.time ?? 0)
        })).sort((a, b) => a.t - b.t);

    volumeTimeline = Array.isArray(obtainedData["volumeTimeline"]) && obtainedData["volumeTimeline"].length
      ? obtainedData["volumeTimeline"]
      : Object.entries(volumeConfigs).map(([key, value]) => ({
          t: Number(key),
          volume: Number(value?.volume ?? 100)
        })).sort((a, b) => a.t - b.t);

    playbackRateTimeline = Array.isArray(obtainedData["playbackTimeline"]) && obtainedData["playbackTimeline"].length
      ? obtainedData["playbackTimeline"]
      : Object.entries(playbackRateConfigs).map(([key, value]) => ({
          t: Number(key),
          rate: Number(value?.rate ?? 1)
        })).sort((a, b) => a.t - b.t);

    originalVideoId = obtainedData["originalVideoId"];
    reactionVideoId = obtainedData["reactionVideoId"];
    reactionVideoAuthor = obtainedData?.reactionVideoAuthor;
    reactionVideoTitle = obtainedData?.reactionVideoTitle;
    originalVideoAuthor = obtainedData?.originalVideoAuthor;
    originalVideoTitle = obtainedData?.originalVideoTitle;
    youtubePlaylistId = obtainedData?.youtubePlaylistId;
    offsetStartTime = obtainedData?.offsetStartTime;
    reactionFinishTime = parseFloat(obtainedData?.reactionFinishTime);
    timeOffset = obtainedData?.timeOffset || 0;
    globalGain = obtainedData?.globalGain || 1.0;
    currentPlaybackRate = getCurrentPlaybackRateFromConfigs(
      offsetStartTime || 0,
      window.playbackRateConfigs,
      timeOffset
    );

    originalVideoTitle
    if (playerOriginal) {
      playerOriginal.destroy();
    }
    if (playerReaction) {
      playerReaction.destroy();
    }
    if (!isReactionMissing) {
      playerReaction = new YT.Player("player-reaction", {
        videoId: reactionVideoId,
        playerVars: playerOptions,
        ...iframeOptionDefault,
        events: {
          onReady: onPlayerReady,
          onStateChange: onStateChangeReaction,
        },
      });
    }
    playerOriginal = new YT.Player("player-original", {
      videoId: originalVideoId,
      playerVars: playerOptions,
      ...iframeOptionDefault,
      events: {
        onReady: onPlayerReady,
        onStateChange: onStateChangeOriginal,
      },
    });
    if (playlistId) {
      playlistItems = await fetchFirstPlaylistVideos(youtubePlaylistId);
      playlistDocument = await getPlaylist(playlistId);
      // only keep videos in playlistItems if they are in the playlistDocument.originalVideoIds
      playlistItems = playlistItems.filter((item) => playlistDocument.originalVideoIds.includes(item.snippet.resourceId.videoId));
      currentIndexInPlaylist = playlistItems.findIndex((item) => item.snippet.resourceId.videoId === originalVideoId);
      hasNextIndexInPlaylist = currentIndexInPlaylist < playlistItems.length - 1;
    }
  };


  const buildInterface = async (slug, {
    isUpdate = false
  } = {}) => {
    if (isUpdate) {
      // Update existing interface without destroying players
      window.currentReactionDocumentId = slug;
      const pureReaction = await getReaction(slug);
      await setUpVideos(pureReaction);
      updateUIElements();
    } else {
      // Build new interface (existing behavior)
      window.currentReactionDocumentId = slug;
      const pureReaction = await getReaction(slug);
      setUpVideos(pureReaction);
    }
  };

  const getBasicDetailsReaction = async () => {
      const { videoAuthor, videoTitle } = await downloadBasicVideoDetails(reactionVideoId);
      reactionVideoAuthor = videoAuthor;
      reactionVideoTitle = videoTitle;
  };
  const setReactionVideoId = async () => {
    reactionVideoId = extractYouTubeVideoId(reactionVideoId);
    await getBasicDetailsReaction();
    await updateFirebaseDocument({
      reactionVideoId,
      reactionVideoAuthor,
      reactionVideoTitle
    });
  };

  const setIsPublished = async () => {
    await updateFirebaseDocument({
        "isPublished": true
    });
    location.reload();
  };
  const setIsUnpublished = async () => {
    await updateFirebaseDocument({
        "isPublished": false
    });
    location.reload();
  };

  const enterEditMode = () => {
    canShowCloseEditModeButton = true;
    isEditModeOn = true;
    canShowEditModeButton = false;
  };

  const closeEditMode = () => {
    isEditModeOn = false;
    canShowEditModeButton = true;
    canShowCloseEditModeButton = false;
  };

  const setIntroBufferTime = () => {
    // Non-destructive: store as timeOffset
    const parsed = parseFloat(introBufferTime);
    if (!isNaN(parsed)) {
      updateFirebaseDocument({
        timeOffset: parsed
      });
    }
  };

  const setSoundLevel = () => {
    // Non-destructive: store as globalGain (1.0 means unchanged)
    const gain = Number(soundLevel) / 100;
    updateFirebaseDocument({
      globalGain: isNaN(gain) ? 1.0 : gain
    });
  };

  const editActionEntryPoint = async (callback) => {
    await callback();
    await setIsUnpublished();
  };

  const openWithFullscreen = () => {
    setVideoScene(true);
  };


  const openWithHalfscreen = () => {
    setVideoScene(false);
  };

  const setVideoScene = (newValue) => {
    const url = new URL(window.location.href);

    // Get the query parameters from the URL
    const params = new URLSearchParams(url.search);

    // Set the new query parameter
    params.set('isFullscreen', newValue);

    // Update the URL's query parameters
    url.search = params.toString();

    // Open the new URL in the same tab
    window.location.href = url.toString();
  };
  function toggleFineTuneMode() {
    isFineTuneModeOn = !isFineTuneModeOn;
  }
  function toggleCinematicBars() {
    showCinematicBars = !showCinematicBars;
  }
  function togglePlayState(event) {
    if (event.detail.isPlaying) {
      startReactionVideo();
      handleStateChangeInReactionVideo(YT.PlayerState.PAUSED , YT.PlayerState.PLAYING);
    } else {
      pauseOriginalVideo();
      pauseReactionVideo();
    }
  }
  function syncVideos() {
    pauseOriginalVideo();
    pauseReactionVideo();
    startReactionVideo();
    handleStateChangeInReactionVideo(YT.PlayerState.PAUSED , YT.PlayerState.PLAYING);
  }

  function showControls() {
    isControlSurfaceVisible = true;
    clearTimeout(controlHideTimeout);
  }

  function scheduleHideControls() {
    clearTimeout(controlHideTimeout);
    if (!isFullscreen) {
      isControlSurfaceVisible = false;
      isExitButtonExpanded = false;
      return;
    }
    controlHideTimeout = setTimeout(() => {
      isControlSurfaceVisible = false;
      isExitButtonExpanded = false;
    }, 3000);
  }

  function handleFullscreenMouseMove() {
    if (!isFullscreen) {
      return;
    }
    showControls();
    scheduleHideControls();
  }

  function handleExitFullscreenClick() {
    openWithHalfscreen();
    isControlSurfaceVisible = false;
    clearTimeout(controlHideTimeout);
    collapseExitButton(true);
  }

  function temporarilyDisableOverlayPointerEvents() {
    if (!fullscreenPointerOverlay) {
      return;
    }
    fullscreenPointerOverlay.style.pointerEvents = 'none';
    clearTimeout(overlayPointerRestoreTimeout);
    overlayPointerRestoreTimeout = setTimeout(() => {
      if (fullscreenPointerOverlay) {
        fullscreenPointerOverlay.style.pointerEvents = 'auto';
      }
      overlayPointerRestoreTimeout = undefined;
    }, 1500);
  }

  function handleFullscreenPointerMove() {
    handleFullscreenMouseMove();
  }

  function handleFullscreenPointerDown() {
    handleFullscreenMouseMove();
    temporarilyDisableOverlayPointerEvents();
  }

  function expandExitButton() {
    clearTimeout(exitButtonCollapseTimeout);
    isExitButtonExpanded = true;
  }

  function collapseExitButton(force = false) {
    clearTimeout(exitButtonCollapseTimeout);
    if (force) {
      isExitButtonExpanded = false;
      return;
    }
    exitButtonCollapseTimeout = setTimeout(() => {
      isExitButtonExpanded = false;
    }, 120);
  }

  function handleExitButtonEnter() {
    showControls();
    expandExitButton();
  }

  function handleExitButtonLeave() {
    scheduleHideControls();
    collapseExitButton();
  }

  onMount(async () => {
    isPlaylistAutoPlay = getAutoPlayCookie();
    escListener = (event) => {
      if (isFullscreen && event.key === 'Escape') {
        event.preventDefault();
        openWithHalfscreen();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', escListener);
      window.addEventListener('mousemove', handleFullscreenMouseMove);
    }
    if (isFullscreen) {
      showControls();
      scheduleHideControls();
    }
    if (typeof YT === "undefined" || typeof YT.Player === "undefined") {
      loadYouTubeAPI();

      window.onYouTubeIframeAPIReady = async () => {
        console.log("YouTube IFrame API is ready");
        await buildInterface(pageSlug);
      };
    } else {
      console.log("YouTube IFrame API is already loaded");
      await buildInterface(pageSlug);
    }
  });
  const unsubscribe = page.subscribe(async ({ params }) => {
    if (params.slug !== pageSlug) {
      pageSlug = params.slug;
      await buildInterface(pageSlug);
    }
  });
  onDestroy(() => {
    unsubscribe();
    if (typeof document !== 'undefined') {
      document.body.classList.remove(fullscreenBodyClass);
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
    if (fullscreenPointerOverlay) {
      fullscreenPointerOverlay.style.pointerEvents = 'auto';
    }
  });
</script>
<div class={!isLoading ? 'hidden' : ''}>Loading...</div>
<div class={`website-inner-container ${isLoading ? 'hidden' : ''} bg-background text-text-primary`}>
  {#if isReactionMissing}
    <p>Warning: The reaction video id is missing. This reaction page won't be listed on the home page until the reaction video url is added below and then published:</p>
  {/if}
  <ReactionBinomeTopActions
    isUsersOwnVideo={isUsersOwnVideo}
    canShowEditModeButton={canShowEditModeButton}
    {canShowCloseEditModeButton}
    {isPublished}
    {isReactionMissing}
    {isFullscreen}
    on:enterEditMode={enterEditMode}
    on:closeEditMode={closeEditMode}
    on:setIsPublished={setIsPublished}
    on:setIsUnpublished={setIsUnpublished}
    on:openWithFullscreen={openWithFullscreen}
    on:openWithHalfscreen={openWithHalfscreen}
  />
  <section class={`theater-wrapper ${isFullscreen
    ? 'fixed inset-0 z-50 m-0 h-screen w-screen overflow-hidden rounded-none bg-black px-0 py-0 text-text-primary shadow-none'
    : 'relative mx-auto my-10 w-full max-w-none rounded-2xl bg-surface/80 px-4 py-8 text-text-primary shadow-elevated backdrop-blur sm:px-6 lg:px-10 xl:rounded-3xl'
  }`}>
    {#if isFullscreen}
      <div class="relative h-full w-full overflow-hidden">
        <div class={`absolute left-6 top-6 z-50 transition-opacity duration-200 ease-cinematic ${isControlSurfaceVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
          <button
            type="button"
            class={`group flex items-center overflow-hidden rounded-full bg-surface/40 ${isExitButtonExpanded ? 'pl-3 pr-4' : 'px-3'} py-2 text-sm font-semibold text-text-primary shadow-elevated backdrop-blur transition-all duration-200 ease-cinematic hover:-translate-y-0.5 hover:bg-surface/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
            on:click={handleExitFullscreenClick}
            on:mouseenter={handleExitButtonEnter}
            on:mouseleave={handleExitButtonLeave}
            on:focus={handleExitButtonEnter}
            on:blur={handleExitButtonLeave}
            on:touchstart={handleExitButtonEnter}
            on:touchend={handleExitButtonLeave}
            aria-label="Exit fullscreen"
            title="Exit fullscreen"
          >
            <span class={`flex items-center justify-center overflow-hidden transition-all duration-200 ease-cinematic ${isExitButtonExpanded ? 'w-0 opacity-0' : 'w-4 opacity-80'}`}>
              <svg
                class="h-4 w-4 text-text-primary/80"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M5 9V5h4V3H3v6h2zm14-6h-6v2h4v4h2V3zm-6 18h6v-6h-2v4h-4v2zM5 15H3v6h6v-2H5v-4z" />
              </svg>
            </span>
            <span class={`inline-flex items-center whitespace-nowrap transition-all duration-200 ease-cinematic ${isExitButtonExpanded ? 'ml-2 max-w-xs opacity-100' : 'ml-0 max-w-0 opacity-0'}`}>
              Exit fullscreen
            </span>
          </button>
        </div>
        <div
          bind:this={fullscreenPointerOverlay}
          class="absolute inset-0 z-40 cursor-default bg-transparent"
          on:pointermove={handleFullscreenPointerMove}
          on:pointerdown={handleFullscreenPointerDown}
          on:pointerleave={scheduleHideControls}
        ></div>
        <div class="absolute inset-0">
          <div id="player-original" class="h-full w-full"></div>
        </div>
        {#if showCinematicBars}
          <div class="pointer-events-none absolute inset-x-0 top-0 h-[12%] bg-gradient-to-b from-black via-black/80 to-transparent" aria-hidden="true"></div>
          <div class="pointer-events-none absolute inset-x-0 bottom-0 h-[12%] bg-gradient-to-t from-black via-black/80 to-transparent" aria-hidden="true"></div>
        {/if}
        {#if !isReactionMissing}
          <div class="pointer-events-auto absolute right-6 top-6 z-50 w-[min(28%,320px)]">
            <div class="relative aspect-cinematic overflow-hidden rounded-lg bg-black/80 shadow-elevated">
              <div id="player-reaction" class="absolute inset-0 h-full w-full"></div>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="grid gap-6 md:grid-cols-2 xl:gap-8">
        <div class="relative overflow-hidden rounded-xl bg-black shadow-elevated">
          <div class="relative aspect-[16/9] sm:aspect-[3/2]">
            <div id="player-original" class="absolute inset-0 h-full w-full"></div>
          </div>
          {#if showCinematicBars}
            <div class="pointer-events-none absolute inset-x-0 top-0 h-[12%] bg-gradient-to-b from-black via-black/80 to-transparent" aria-hidden="true"></div>
            <div class="pointer-events-none absolute inset-x-0 bottom-0 h-[12%] bg-gradient-to-t from-black via-black/80 to-transparent" aria-hidden="true"></div>
          {/if}
        </div>
        {#if !isReactionMissing}
          <div class="relative overflow-hidden rounded-xl bg-black/80 shadow-surface">
            <div class="relative aspect-[16/9] sm:aspect-[3/2]">
              <div id="player-reaction" class="absolute inset-0 h-full w-full"></div>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if playerOriginal && playerReaction}
      <div class={`controls-dock group pointer-events-none ${isFullscreen ? 'fixed inset-x-0 bottom-12 z-50 flex justify-center px-6' : 'sticky top-6 z-30 mt-10 flex justify-center'}`}>
        <div class={`controls-surface pointer-events-auto rounded-full bg-overlay px-sm py-xs shadow-elevated transition duration-slow ease-cinematic ${stickyControlsClass}`}>
          <VideoControl
            {bothVideosStarted}
            isPlaylist={!!(playlistId)}
            isPlaylistAutoPlay={isPlaylistAutoPlay}
            {showCinematicBars}
            on:playStateChanged={togglePlayState}
            on:syncVideos={syncVideos}
            on:toggleAutoPlaylist={toggleAutoPlaylist}
            on:toggleBars={toggleCinematicBars}
          />
        </div>
      </div>
    {/if}
  </section>
  {#if !isFullscreen}
    <div class="videos-information-container mx-auto w-full px-4 pt-6 sm:px-6 lg:px-10">
      <CreatorDetails
        originalVideoAuthor={originalVideoAuthor}
        originalVideoTitle={originalVideoTitle}
        originalVideoId={originalVideoId}
        reactionVideoAuthor={reactionVideoAuthor}
        reactionVideoTitle={reactionVideoTitle}
        reactionVideoId={reactionVideoId}
        pageSlug={pageSlug}
        isUsersOwnVideo={isUsersOwnVideo}
        reactorId={reactorId}
      />

      {#if originalVideoId && playlistId}
        <div class="mt-8">
          <PlaylistQueue
            {playlistItems}
            {playlistDocument}
            currentlyViewed={originalVideoId}
            playlistId={youtubePlaylistId}
            playlistDocumentId={playlistId}
            isCreation={false}
          />
        </div>
      {/if}
    </div>

    {#if !isEditModeOn && originalVideoId && reactionVideoId}
      <OtherReactions
        originalVideoId={originalVideoId}
        reactionVideoId={reactionVideoId}
      />
    {/if}

    <div class="flex flex-col gap-4">
      {#if isReactionMissing || isEditModeOn}
        <div class="flex gap-4">
          <Label for="reaction-video-id-input" class="flex-none block mb-2 self-center">Reaction video id:</Label>
          <Input class="shrink" bind:value={reactionVideoId} id="reaction-video-id-input" />
          <Button class="submit-button flex-none" on:click={() => editActionEntryPoint(setReactionVideoId)}>Set Reaction Video Id</Button>
        </div>
      {/if}
      {#if isEditModeOn}
        <div class="flex gap-4">
          <Label for="buffer-time-input" class="flex-none block mb-2 self-center">Set buffer time for intro:</Label>
          <Input class="shrink" bind:value={introBufferTime} id="buffer-time-input" />
          <Button class="submit-button flex-none" on:click={() => editActionEntryPoint(setIntroBufferTime)}>Modify reaction times</Button>
        </div>
      {/if}
      {#if isEditModeOn}
        <div class="flex gap-4">
          <Label for="sound-level-input" class="flex-none block mb-2 self-center">Adjust sound level for original video:</Label>
          <input type="range" min="0" max="200" bind:value={soundLevel} id="sound-level-input" class="shrink" />
          <Button class="submit-button flex-none" on:click={() => editActionEntryPoint(setSoundLevel)}>Set sound level</Button>
        </div>
      {/if}
    </div>

    {#if isEditModeOn}
        <Button on:click={toggleFineTuneMode}>
          {#if isFineTuneModeOn}Disable Fine Tune Mode{:else}Enable Fine Tune Mode{/if}
        </Button>
        {#if isFineTuneModeOn}
          <ConfigEditor
            {playerConfigs}
            {volumeConfigs}
            {stateTimeline}
            {volumeTimeline}
            playbackRateConfigs={playbackRateConfigs}
            playbackRateTimeline={playbackRateTimeline}
          />
        {/if}
    {/if}
  {/if}
</div>

<style>
  .website-inner-container {
    margin: 0;
    width: 100%;
  }

  .submit-button {
    height: 2rem;
  }

  :global(body.reaction-fullscreen) {
    overflow: hidden;
  }
</style>
