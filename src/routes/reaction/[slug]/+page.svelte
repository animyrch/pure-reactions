<script>
  import { onMount } from "svelte";
  import { initializeApp } from "firebase/app";
  import { getFirestore, doc, getDoc } from "firebase/firestore/lite";
  import { COLLECTION_NAME, FIREBASE_CONFIG } from "$lib/constants/firebase";
  import { getCurrentVolumeFromVolumeConfigs, getCurrentStateFromStateConfigs } from "$lib/helpers/reaction";

  export let data; // Access the data passed from the server in props
  // Initialize Firebase

  // 3. This function creates an <iframe> (and YouTube player)
  //    after the API code downloads.
  var playerReaction;
  var playerOriginal;
  var playerOptions = {
    autoplay: 0,
    controls: 1,
    disablekb: 1,
    modestbranding: 1,
    rel: 0,
  };
  let currentStateOriginalVideo = -1;
  var currentVolumeOriginalVideo = 100;
  var changingVolume = false;
  var changingState = false;

  // Function to start the YouTube IFrame API loading
  function loadYouTubeAPI() {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
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
      // timeInformationOriginal();
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
    window.playerConfigs = obtainedData["reaction-configs"];
    window.volumeConfigs = obtainedData["volume-configs"];
    playerReaction = new YT.Player("player-reaction", {
      videoId: obtainedData["reaction-video-id"],
      playerVars: playerOptions,
      events: {
        onReady: onPlayerReady,
        onStateChange: onStateChangeReaction,
      },
    });
    playerOriginal = new YT.Player("player-original", {
      videoId: obtainedData["original-video-id"],
      playerVars: playerOptions,
      events: {
        onReady: onPlayerReady,
        onStateChange: onStateChangeOriginal,
      },
    });
  };

  const getReactions = async () => {
    const app = initializeApp(FIREBASE_CONFIG);
    const db = getFirestore(app);
    const docRef = doc(db, COLLECTION_NAME, data.slug);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      console.log("Document data:", docSnap.data());
      return docSnap;
    } else {
      console.log("No such document!");
    }
  };

  function timeInformationOriginal() {
    pollVideoCurrentTime('original', playerOriginal);
  }
  function timeInformationReaction() {
    pollVideoCurrentTime();
  }
  const buildInterface = async () => {
    const originalAndReactionVideos = await getReactions();
    setUpVideos(originalAndReactionVideos);
  };

  onMount(async () => {
    // Check if the YouTube API is already loaded
    if (typeof YT === "undefined" || typeof YT.Player === "undefined") {
      // If not loaded, start loading the YouTube API
      loadYouTubeAPI();

      // Set up a listener for the YouTube IFrame API ready event
      window.onYouTubeIframeAPIReady = async () => {
        console.log("YouTube IFrame API is ready");
        // Now, you can proceed to getReactions and set up videos
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
  {data.slug}
  <div id="player" />
  <div class="video-container">
    <div id="player-original" />
    <div id="player-reaction" />
  </div>
</div>

<style>
  /* Style for video container */
  .video-container {
    display: flex;
    justify-content: space-between;
    gap: 5rem;
    width: 100%;
  }

  .website-inner-container {
    margin: 5rem;
  }

  /* Style for individual video iframes */
  .video {
    flex: 0 0 48%; /* Adjust width as needed */
    margin-right: 2%;
  }

  /* Style for centered button */
  .center-button {
    margin-top: 20px;
    text-align: center;
  }

  /* Style for the button */
  button {
    padding: 10px 20px;
    background-color: #007bff;
    color: #fff;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
  }

  /* Hover effect for the button */
  button:hover {
    background-color: #0056b3;
  }

  #player-original {
    width: 100wv;
  }
</style>
