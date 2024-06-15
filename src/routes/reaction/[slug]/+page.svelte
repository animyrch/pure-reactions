<script>
  import { onMount, onDestroy } from "svelte";
  import {
    getCurrentVolumeFromVolumeConfigs,
    getCurrentStateFromStateConfigs
  } from "$lib/helpers/reaction";
  import {
    getReaction,
    updateFirebaseDocument,
    getReactionsToOriginalVideo
  } from '$lib/helpers/firebase';
  import { extractYouTubeVideoId } from '$lib/helpers/youtube';
  import { currentUser } from '$lib/stores/user';
  import ReactionsListElement from "$lib/components/ReactionsListElement.svelte";
  import { page } from '$app/stores';
  import { GradientButton, Input, Label, Button } from 'flowbite-svelte';
  import { downloadBasicVideoDetails } from '$lib/helpers/youtube';
  import CreatorDetails from "$lib/components/Video/CreatorDetails.svelte";
  import { ExpandSolid, MinimizeSolid } from 'flowbite-svelte-icons';

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
  let canShowEditModeButton = false;
  let isUsersOwnVideo = false;
  let canShowCloseEditModeButton = false;
  let introBufferTime = 0;
  let originalVideoId;
  let reactionVideoId;
  let reactorId;
  let otherReactions = [];
  let pageSlug = data.slug;
  let reactionVideoAuthor;
  let reactionVideoTitle;
  let originalVideoAuthor;
  let originalVideoTitle;
  let isFullscreen;
  let isLoading = true;

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
    otherReactions = [];
    isPublished = obtainedData.isPublished;
    isReactionMissing = !obtainedData["reactionVideoId"];
    reactorId = obtainedData["reactorId"];
    isUsersOwnVideo = reactorId === data.userId
    canShowEditModeButton = isUsersOwnVideo;
    window.playerConfigs = obtainedData["reactionConfigs"];
    window.volumeConfigs = obtainedData["volumeConfigs"];
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
    if (originalVideoId && reactionVideoId) {
      getReactionsToOriginalVideo(originalVideoId, reactionVideoId).then(reactions => {
        otherReactions = reactions;
      });
    }
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
  <div class="flex justify-between m-2">
    {#if isUsersOwnVideo}
    <div class="text-left">
      {#if canShowEditModeButton}
        <GradientButton
          on:click={enterEditMode}
          color="pinkToOrange"
        >
          Edit Reaction
        </GradientButton>
      {/if}
      {#if canShowCloseEditModeButton}
        <GradientButton
          on:click={closeEditMode}
          color="pinkToOrange"
        >
          Finish Editing
        </GradientButton>
      {/if}
      {#if !isPublished && !isReactionMissing}
        <GradientButton
          on:click={setIsPublished}
          color="pinkToOrange"
        >
          Publish
        </GradientButton>
      {/if}
      {#if isPublished}
        <GradientButton
          on:click={setIsUnpublished}
          color="pinkToOrange"
        >
          Unpublish
        </GradientButton>
      {/if}
      </div>
      {/if}
    <div class="hidden md:block">
      {#if isFullscreen}
        <Button
          size="md"
          on:click={openWithHalfscreen}
        >
          <MinimizeSolid class="w-3.5 h-3.5 me-2" />
          <span>Halfscreen</span>
        </Button>
      {:else}
        <Button
          size="md"
          on:click={openWithFullscreen}
        >
          <ExpandSolid class="w-3.5 h-3.5 me-2" />
          <span>Fullscreen</span>
        </Button>
      {/if}
    </div>
  </div>
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
  </div>

  {#if !isEditModeOn && otherReactions?.length}
    <div class="other-reactions">
      <div class="text-center">
        <p>Other reactions to the same video</p>
      </div>
      <div class="w-auto max-w-96">
        {#each otherReactions as reaction, index (index)}
          <div key={reaction.id}>
            <ReactionsListElement {reaction} />
          </div>
        {/each}
      </div>
    </div>
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
