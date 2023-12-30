<script>
  import { onMount } from "svelte";
  import {
    getCurrentVolumeFromVolumeConfigs,
    getCurrentStateFromStateConfigs
  } from "$lib/helpers/reaction";
  import {
    getReaction,
    updateFirebaseDocument
  } from '$lib/helpers/firebase';
  import VideoContainer from "$lib/components/VideoContainer.svelte";
  import { extractYouTubeVideoId } from '$lib/helpers/youtube';

  export let data; // Access the data passed from the server in props

  // 3. This function creates an <iframe> (and YouTube player)
  //    after the API code downloads.
  var playerReaction;
  var playerOriginal;
  var playerOptions = {
    autoplay: 0,
    controls: 1,
    disablekb: 1,
    modestbranding: 1,
    rel: 0
  };
  var iframeOptionDefault = {
      width: '100%',
      height: '100%'
  };
  let currentStateOriginalVideo = -1;
  var currentVolumeOriginalVideo = 100;
  var changingVolume = false;
  var changingState = false;
  let isReactionMissing = false;
  let reactionVideoIdInput = '';
  let isEditModeOn = false;
  let canShowEditModeButton = false;
  let canShowCloseEditModeButton = false;
  let introBufferTime = 0;
  let originalVideoId;
  let reactionVideoId;

  // Function to start the YouTube IFrame API loading
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

  const setUpVideos = (doc) => {
    if (!doc) {
      return;
    }
    const obtainedData = doc.data();
    isReactionMissing = !obtainedData["reactionVideoId"];
    const isUsersOwnVideo = obtainedData["reactorId"] === data.userId
    canShowEditModeButton = isUsersOwnVideo;
    window.playerConfigs = obtainedData["reactionConfigs"];
    window.volumeConfigs = obtainedData["volumeConfigs"];
    originalVideoId = obtainedData["originalVideoId"];
    reactionVideoId = obtainedData["reactionVideoId"];
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
  const buildInterface = async () => {
    window.currentReactionDocumentId = data.slug;
    const originalAndReactionVideos = await getReaction(data.slug);
    setUpVideos(originalAndReactionVideos);
  };

  const setReactionVideoId = async () => {
    await updateFirebaseDocument({
        "reactionVideoId": extractYouTubeVideoId(reactionVideoIdInput)
    });
    location.reload();
  }

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
      const currentConfigs = window.playerConfigs;
      Object.keys(currentConfigs).forEach(async (timeCode) => {
        const updatedTime = parseFloat(timeCode) + parseFloat(introBufferTime);
        currentConfigs[updatedTime.toFixed(1)] = currentConfigs[timeCode];
        delete currentConfigs[timeCode];
      });
      updateFirebaseDocument({
        "reactionConfigs": currentConfigs
      });
      location.reload();
    }
  }

  onMount(async () => {
    // Check if the YouTube API is already loaded
    if (typeof YT === "undefined" || typeof YT.Player === "undefined") {
      // If not loaded, start loading the YouTube API
      loadYouTubeAPI();

      // Set up a listener for the YouTube IFrame API ready event
      window.onYouTubeIframeAPIReady = async () => {
        console.log("YouTube IFrame API is ready");
        // Now, you can proceed to getReaction and set up videos
        await buildInterface();
      };
    } else {
      // If the YouTube API is already loaded, you can proceed directly
      console.log("YouTube IFrame API is already loaded");
      await buildInterface();
    }
  });
</script>

<div class="website-inner-container">
  {#if isReactionMissing}
  <p>Warning: The reaction video id is missing. This reaction page won't be listed on the home page until the reaction video url is added below :</p>
  {/if}
  <div class="videos-container">
    <VideoContainer videoId={originalVideoId}>
      <div id="player-original" class="video"/>
    </VideoContainer>
    {#if isReactionMissing || isEditModeOn}
      <label>
        Reaction Video ID:
        <input bind:value={reactionVideoIdInput} />
      </label>
      <button class="submit-button" on:click={setReactionVideoId}>Set Reaction Video Id</button>
    {/if}
    {#if !isReactionMissing}
      <VideoContainer videoId={reactionVideoId}>
        <div id="player-reaction" class="video"/>
      </VideoContainer>
    {/if}
    {#if canShowEditModeButton}
      <button class="submit-button" on:click={enterEditMode}>Edit Reaction</button>
    {/if}
    {#if canShowCloseEditModeButton}
      <button class="submit-button" on:click={closeEditMode}>Finish Editing</button>
    {/if}
    {#if isEditModeOn}
      <label>
        Set buffer time for intro:
        <input bind:value={introBufferTime} />
      </label>
      <button class="submit-button" on:click={setIntroBufferTime}>Modify reaction times</button>
    {/if}
  </div>
</div>

<style>
  .website-inner-container {
    margin: 0;
    width: 100%;
  }

  .videos-container {
    display: flex;
    flex-direction: column;
    width: 100vw;
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
