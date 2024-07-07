<script>
  import { onMount, onDestroy } from "svelte";
  import {
    getCurrentVolumeFromVolumeConfigs,
    getCurrentStateFromStateConfigs
  } from "$lib/helpers/reaction";
  import {
    getReaction,
    updateFirebaseDocument,
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

  // Check if window is defined (i.e., we're on the client side)
  if (typeof window !== 'undefined') {
    // Create a new URL object with the current URL
    let url = new URL(window.location.href);

    // Get the query parameters from the URL
    let params = new URLSearchParams(url.search);

    // Get the isFullscreen query parameter
    isFullscreen = params.get('isFullscreen') === 'true';
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
    playerOriginal.playVideo();
  }
  function pauseOriginalVideo() {
    playerOriginal.pauseVideo();
  }
  function pauseReactionVideo() {
    playerReaction.pauseVideo();
  }
  function handleOriginalVideoVolume(reactionCurrentTime) {
    const originalVideoNewVolume = getCurrentVolumeFromVolumeConfigs(reactionCurrentTime, window.volumeConfigs);
    if (!changingVolume && currentVolumeOriginalVideo !== originalVideoNewVolume) {
      changingVolume = true;
      setVolumeForOriginalVideo(originalVideoNewVolume);
      currentVolumeOriginalVideo = originalVideoNewVolume;
      changingVolume = false;
    }
  }

  function handleOriginalVideoState(reactionCurrentTime) {
    const originalVideoNewStateConfig = getCurrentStateFromStateConfigs(reactionCurrentTime, window.playerConfigs);
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
  }
  const startVideos = () => {
    bothVideosStarted = true;
    startReactionVideo();
    timeInformationReaction();
  };

  let originalVideoClicked;
  let reactionVideoClicked;
  let bothVideosStarted;
  function pollVideoCurrentTime() {
    const interval = 100; // Polling interval in milliseconds (adjust as needed)
    let reactionPlayerState = YT.PlayerState.UNSTARTED;
    // Use setInterval to periodically get the current time
    const pollInterval = setInterval(() => {
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
        const reactionCurrentTime = playerReaction.getCurrentTime().toFixed(1);
        handleOriginalVideoVolume(reactionCurrentTime);
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
  function onStateChangeReaction(event) {
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
  function setVolumeForOriginalVideo(volume) {
    playerOriginal.setVolume(volume);
  }

  const setUpVideos = (obtainedData) => {
    if (!obtainedData) {
      return;
    }
    isPublished = obtainedData.isPublished;
    isReactionMissing = !obtainedData["reactionVideoId"];
    reactorId = obtainedData["reactorId"];
    isUsersOwnVideo = reactorId === data.userId
    canShowEditModeButton = isUsersOwnVideo;
    window.playerConfigs = obtainedData["reactionConfigs"];
    playerConfigs = obtainedData["reactionConfigs"];
    window.volumeConfigs = obtainedData["volumeConfigs"];
    volumeConfigs = obtainedData["volumeConfigs"];
    originalVideoId = obtainedData["originalVideoId"];
    reactionVideoId = obtainedData["reactionVideoId"];
    reactionVideoAuthor = obtainedData?.reactionVideoAuthor;
    reactionVideoTitle = obtainedData?.reactionVideoTitle;
    originalVideoAuthor = obtainedData?.originalVideoAuthor;
    originalVideoTitle = obtainedData?.originalVideoTitle;

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
  };


  function timeInformationReaction() {
    pollVideoCurrentTime();
  }
  const buildInterface = async (slug) => {
    window.currentReactionDocumentId = slug;
    const pureReaction = await getReaction(slug);
    setUpVideos(pureReaction);
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
    if (window.playerConfigs && introBufferTime !== '0' && introBufferTime !== 0) {
      const reactionConfigs = window.playerConfigs;
      if (reactionConfigs) {
        Object.keys(reactionConfigs).forEach(async (timeCode) => {
        const updatedTime = parseFloat(timeCode) + parseFloat(introBufferTime);
        reactionConfigs[updatedTime.toFixed(1)] = reactionConfigs[timeCode];
        delete reactionConfigs[timeCode];
      });
      }
      const volumeConfigs = window.volumeConfigs;
      if (volumeConfigs) {
        Object.keys(volumeConfigs).forEach(async (timeCode) => {
          const updatedTime = parseFloat(timeCode) + parseFloat(introBufferTime);
          volumeConfigs[updatedTime.toFixed(1)] = volumeConfigs[timeCode];
          delete volumeConfigs[timeCode];
        });
      }
      updateFirebaseDocument({
        "reactionConfigs": reactionConfigs || {},
        "volumeConfigs": volumeConfigs || {}
      });
    }
  }

  const setSoundLevel = () => {
    let volumeConfigs = window.volumeConfigs;
    const newVolumeConfigs = new Map();
    newVolumeConfigs.set('0.0', { volume: 100 * (soundLevel / 100) });
    if (volumeConfigs) {
      Object.keys(volumeConfigs).forEach(async (timeCode) => {
        newVolumeConfigs.set(timeCode, { volume: volumeConfigs[timeCode].volume * (soundLevel / 100) });
      });
    }
    const volumeConfigsObject = Object.fromEntries(newVolumeConfigs);
    updateFirebaseDocument({
        "volumeConfigs": volumeConfigsObject
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
      // check if original video should be started as well
      handleStateChangeInReactionVideo(YT.PlayerState.PAUSED , YT.PlayerState.PLAYING);
    } else {
      pauseOriginalVideo();
      pauseReactionVideo();
    }
  }
  onMount(async () => {
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
    <p>Warning: The reaction video id is missing. This reaction page won't be listed on the home page until the reaction video url is added below :</p>
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
    <VideoControl
      {bothVideosStarted}
      on:playStateChanged={togglePlayState}
    />
  </div>
  <div class="videos-information-container pt-4">
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
        <ConfigEditor {playerConfigs} {volumeConfigs} />
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
