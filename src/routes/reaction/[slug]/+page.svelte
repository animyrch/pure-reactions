<script>
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
  import { goto } from '$app/navigation'

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
  onMount(async () => {
    isPlaylistAutoPlay = getAutoPlayCookie();
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
  });
</script>
<div class={!isLoading ? 'hidden' : ''}>Loading...</div>
<div class="{isLoading ? 'hidden' : ''} website-inner-container">
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
  {#if isFullscreen}
    <!-- fullscreen -->
    <div class="relative h-screen">
      <div id="player-original" class="absolute top-0 h-screen"/>
      <div id="player-reaction" class="absolute top-0 right-0 h-1/3-screen w-1/3"/>
    </div>
  {:else}
    <!-- default -->
    <div class="flex flex-col-reverse w-full md:flex-row">
      <div id="player-original" class="h-1/25-screen"/>
      <div id="player-reaction" class="h-1/25-screen"/>
    </div>
  {/if}
  <div class="my-4">
    {#if playerOriginal && playerReaction}
      <VideoControl
        {bothVideosStarted}
        isPlaylist={!!(playlistId)}
        isPlaylistAutoPlay={isPlaylistAutoPlay}
        on:playStateChanged={togglePlayState}
        on:syncVideos={syncVideos}
        on:toggleAutoPlaylist={toggleAutoPlaylist}
      />
    {/if}
  </div>
  <div class="videos-information-container pt-4 flex gap-4">
    <div class="w-1/2">
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
    </div>
    {#if originalVideoId && playlistId}
      <div class="w-1/2">
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
</div>

<style>
  .website-inner-container {
    margin: 0;
    width: 100%;
  }

  /* Style for individual video iframes */
  .video {
    object-fit: contain;
    width: 100%;
    height: calc(100vw * 0.56);
  }
  .submit-button {
    height: 2rem;
  }
  @media screen and (min-width: 600px) {
    .videos-container {
      flex-direction: row;
    }
    .video {
      /* width: 49%; */
      height: calc((100vw * 0.56) / 2);
    }
  }
</style>
