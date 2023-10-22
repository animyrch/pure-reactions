<script>
  import { onMount } from "svelte";
  import { initializeApp } from "firebase/app";
  import { getFirestore, doc, getDoc } from "firebase/firestore/lite";
  import { COLLECTION_NAME, FIREBASE_CONFIG } from "$lib/constants/firebase";

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
  // 4. The API will call this function when the video player is ready.
  function onPlayerReady(event) {
    console.log("player ready");
  }
  const startVideos = () => {
    setTimeoutHandler(0, [1]);
    console.log(window.playerConfigs);
    for (const secondsInfo of Object.keys(window.playerConfigs)) {
      const configsForSecond = window.playerConfigs[secondsInfo];
      console.log(secondsInfo);
      const configElement = configsForSecond[0];
      console.log(configElement);
      setTimeoutHandler(secondsInfo, configElement);
    }
  };

  let originalVideoClicked;
  let reactionVideoClicked;
  function onStateChangeOriginal(event) {
    if (event.data == YT.PlayerState.PLAYING) {
      if (!originalVideoClicked) {
        pauseOriginalVideo();
        originalVideoClicked = true;
      }
      if (originalVideoClicked && reactionVideoClicked) {
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
      if (originalVideoClicked && reactionVideoClicked) {
        startVideos();
      }
    }
  }

  function goToSecondsInOriginalVideo(seconds) {
    return function () {
      playerOriginal.seekTo(seconds);
    };
  }
  function setVolumeForOriginalVideo(volume) {
    playerOriginal.setVolume(volume);
  }
  var CONFIG_OPTIONS = {
    START_VIDEO_REACTION: 1,
    START_VIDEO_ORIGINAL: 2,
    SET_VOLUME_REACTION: 3,
    SET_VOLUME_ORIGINAL: 4,
    PAUSE_VIDEO_ORIGINAL: 5,
    SEEK_TO_ORIGINAL: 6,
  };
  function setTimeoutHandler(secondsInfo, configElement) {
    const activeConfigName = configElement[0];
    const extraConfigData = configElement[1];
    const timeoutInMiliseconds = secondsInfo * 1000;
    console.log(activeConfigName);
    console.log(timeoutInMiliseconds);
    switch (activeConfigName) {
      case CONFIG_OPTIONS.START_VIDEO_REACTION:
        setTimeout(startReactionVideo, timeoutInMiliseconds);
        break;
      case CONFIG_OPTIONS.SET_VOLUME_ORIGINAL:
        setTimeout(
          setVolumeForOriginalVideo(extraConfigData),
          timeoutInMiliseconds
        );
        break;
      case CONFIG_OPTIONS.START_VIDEO_ORIGINAL:
        setTimeout(startOriginalVideo, timeoutInMiliseconds);
        break;
      case CONFIG_OPTIONS.PAUSE_VIDEO_ORIGINAL:
        setTimeout(pauseOriginalVideo, timeoutInMiliseconds);
        break;
      case CONFIG_OPTIONS.SEEK_TO_ORIGINAL:
        setTimeout(
          goToSecondsInOriginalVideo(extraConfigData),
          timeoutInMiliseconds
        );
        break;
      default:
        break;
    }
  }

  const setUpVideos = (doc) => {
    if (!doc) {
      return;
    }
    const obtainedData = doc.data();
    window.playerConfigs = obtainedData["reaction-configs"];
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
