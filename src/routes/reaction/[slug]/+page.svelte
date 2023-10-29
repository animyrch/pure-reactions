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
    bothVideosStarted = true;
    startReactionVideo();
    timeInformationReaction();
  };

  let originalVideoClicked;
  let reactionVideoClicked;
  let bothVideosStarted;
  function pollVideoCurrentTime() {
    const interval = 100; // Polling interval in milliseconds (adjust as needed)
    let originalPlayerState = YT.PlayerState.UNSTARTED;
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
        const originalVideoInfo = window.playerConfigs.get(reactionCurrentTime + '');
        const originalPlayerNewState = originalVideoInfo?.state;
        const originalPlayerTime = originalVideoInfo?.time;
        if (
          originalPlayerTime !== undefined &&
          originalPlayerNewState !== undefined &&
          originalPlayerNewState !== originalPlayerState
        ) {
          handleStateChangeInOriginalVideo(originalPlayerState, originalPlayerNewState, originalPlayerTime);
        }
        if (originalPlayerNewState !== undefined) {
          originalPlayerState = originalPlayerNewState;
        }
      }
    }, interval);
  }
  const handleStateChangeInOriginalVideo = (originalPlayerState, originalPlayerNewState, originalPlayerTime) => {
    if (originalPlayerState !== originalPlayerNewState) {
      console.log(originalPlayerState, originalPlayerNewState);
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
      const originalVideoInfo = window.playerConfigs.get(reactionCurrentTime + '');
      originalVideoInfo?.time && goToSecondsInOriginalVideo(originalVideoInfo?.time);
      if (originalVideoInfo?.state === YT.PlayerState.PLAYING) {
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

  const unpackReactionConfigs = (compressedData) => {
    const sortedData = Object.fromEntries(
        Object.entries(compressedData).sort(([a], [b]) => Number(a) - Number(b))
      );
    const uncompressedData = new Map();
    let currentStateForOriginal = YT.PlayerState.UNSTARTED;
    let currentSecondsForOriginal = 0;
    let elementsProcessed = 0;
    for(const element of Object.entries(sortedData)) {
      uncompressedData.set(parseFloat(element[0]), element[1]);
    }
    for (let index = 0; elementsProcessed < Object.entries(compressedData).length; index++) {
      const currentIndex = index / 10;
      if (currentStateForOriginal === YT.PlayerState.PLAYING) {
        currentSecondsForOriginal += 0.1;
      }
      if (!uncompressedData.get(currentIndex)) {
        // uncompressedData.set(currentIndex + '', {
        //   state: currentStateForOriginal,
        //   time: currentSecondsForOriginal.toFixed(1)
        // });
      } else {
        console.log('found already set')
        currentStateForOriginal = uncompressedData.get(currentIndex)?.state;
        currentSecondsForOriginal = +uncompressedData.get(currentIndex)?.time + 1.5;
        uncompressedData.set(currentIndex + '', {
          state: currentStateForOriginal,
          time: currentSecondsForOriginal
        });
        elementsProcessed++;
      }
    }

    return uncompressedData;
  };

  const setUpVideos = (doc) => {
    if (!doc) {
      return;
    }
    const obtainedData = doc.data();
    window.playerConfigs = unpackReactionConfigs(obtainedData["reaction-configs"]);
    console.log(window.playerConfigs);
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
