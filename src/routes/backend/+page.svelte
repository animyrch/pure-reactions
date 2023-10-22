<!-- src/Backend.svelte -->
<script>
    import Recorder from "$lib/components/Recorder.svelte";
    import { onMount } from "svelte";
    import { COLLECTION_NAME, FIREBASE_CONFIG } from "$lib/constants/firebase";

    import { initializeApp } from "firebase/app";
    import {
        getFirestore,
        collection,
        doc,
        addDoc,
        updateDoc,
    } from "firebase/firestore/lite";

    // Initialize Firebase
    const app = initializeApp(FIREBASE_CONFIG);
    const db = getFirestore(app);

    const reactionConfigs = {};
    let timer;
    let startTime;

    let startRecording = false;
    let stopRecording = false;

    let playerOriginal;
    const playerOptions = {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        enablejsapi: 1,
        rel: 0,
    };
    function loadYoutubePlayer() {
        const videoId = videoIdInput.value;
        window.originalVideoIdForReaction = videoId;

        playerOriginal = new YT.Player("player-original", {
            videoId: window.originalVideoIdForReaction,
            playerVars: playerOptions,
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange,
            },
        });
    }

    function displayVideoIdInput() {
        videoIdInput.disabled = false;
    }

    // 4. The API will call this function when the video player is ready.
    function onPlayerReady(event) {
        console.log("player ready");
        // event.target.playVideo();
    }
    function onPlayerStateChange(event) {
        if (event.data == YT.PlayerState.PLAYING) {
            updateSeekBar();
        }
    }
    const getCurrentTimeForOriginalVideo = () => {
        const seekTime = (seekBar.value / 100) * playerOriginal.getDuration();
        return seekTime.toFixed(2);
    };
    function logElapsedTime(actionCode) {
        if (startTime) {
            const currentTime = new Date().getTime();
            const elapsedTime = (currentTime - startTime) / 1000; // Convert to seconds
            console.log("Timer: " + elapsedTime.toFixed(2) + " seconds");
            const configKey = elapsedTime.toFixed(2).toString();
            reactionConfigs[configKey] = {
                0: [],
            };
            reactionConfigs[configKey][0].push(actionCode);
            reactionConfigs[configKey][0].push(
                getCurrentTimeForOriginalVideo()
            );
            updateFirebaseDocument({
                "reaction-configs": reactionConfigs,
            });
        }
    }

    const createReactionDocument = (originalVideoId) => {
        const reactionsCollection = collection(db, COLLECTION_NAME);
        const dataToAdd = {
            "original-video-id": originalVideoId,
            "reactor-id": 1,
            "reaction-configs": {},
        };
        addDoc(reactionsCollection, dataToAdd)
            .then((documentRef) => {
                // documentRef.id contains the auto-generated document ID
                console.log("Document added with ID:", documentRef.id);
                window.currentReactionDocumentId = documentRef.id;
            })
            .catch((error) => {
                console.error("Error adding document:", error);
            });
    };

    const updateFirebaseDocument = (dataToUpdate) => {
        const reactionsCollection = collection(db, COLLECTION_NAME);
        const documentRef = doc(
            reactionsCollection,
            window.currentReactionDocumentId
        );

        updateDoc(documentRef, dataToUpdate);
    };

    function startOriginalVideo() {
        playerOriginal.playVideo();
    }
    function pauseOriginalVideo() {
        playerOriginal.pauseVideo();
    }
    function updateSeekBar() {
        const duration = playerOriginal.getDuration();
        const currentTime = playerOriginal.getCurrentTime();

        seekBar.value = (currentTime / duration) * 100;
        currentTimeDisplay.textContent =
            formatTime(currentTime) + " / " + formatTime(duration);

        requestAnimationFrame(updateSeekBar);
    }

    // Function to format time in HH:MM format
    function formatTime(time) {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
    }

    let seekBar;
    let currentTimeDisplay;

    let showRecorder = false;

    onMount(async () => {
        seekBar = document.getElementById("seek-bar");
        seekBar.value = 0;
        window.onYouTubeIframeAPIReady = () => {
            displayVideoIdInput();
        };
        currentTimeDisplay = document.getElementById("current-time");
        // Function to update the seek bar and current time display

        // Load the YouTube API
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("div")[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        const startReactionBtn = document.getElementById("startReaction");
        const startVideoBtn = document.getElementById("startVideo");
        const stopVideoBtn = document.getElementById("stopVideo");
        const finishReactionBtn = document.getElementById("finishReaction");
        const seekBarContainer = document.getElementById("seek-bar-container");
        const CONFIG_OPTIONS = {
            START_VIDEO_REACTION: 1,
            START_VIDEO_ORIGINAL: 2,
            SET_VOLUME_REACTION: 3,
            SET_VOLUME_ORIGINAL: 4,
            PAUSE_VIDEO_ORIGINAL: 5,
            SEEK_TO_ORIGINAL: 6,
        };

        const videoIdInput = document.getElementById("videoIdInput");

        startReactionBtn.addEventListener("click", () => {
            createReactionDocument(window.originalVideoIdForReaction);
            if (showRecorder) {
                startRecording = true;
            }
            console.log("Started the reaction");
            startReactionBtn.disabled = true;
            startVideoBtn.disabled = false;
            finishReactionBtn.disabled = false;

            // Start the timer
            startTime = new Date().getTime();
        });

        startVideoBtn.addEventListener("click", () => {
            console.log("Started the video");
            startOriginalVideo();
            logElapsedTime(CONFIG_OPTIONS.START_VIDEO_ORIGINAL);
            startVideoBtn.disabled = true;
            stopVideoBtn.disabled = false;
            seekBarContainer.style.display = "block";
        });

        stopVideoBtn.addEventListener("click", () => {
            console.log("Stopped the video");
            pauseOriginalVideo();
            logElapsedTime(CONFIG_OPTIONS.PAUSE_VIDEO_ORIGINAL);
            stopVideoBtn.disabled = true;
            startVideoBtn.disabled = false;
        });

        finishReactionBtn.addEventListener("click", () => {
            console.log("Finished the reaction");
            if (showRecorder) {
                stopRecording = true;
            }
            startReactionBtn.disabled = true;
            startVideoBtn.disabled = true;
            stopVideoBtn.disabled = true;
            finishReactionBtn.disabled = true;
            clearInterval(timer);
            console.log(reactionConfigs);
        });

        // Event listener for when the user interacts with the seek bar
        seekBar.addEventListener("input", () => {
            const seekTime =
                (seekBar.value / 100) * playerOriginal.getDuration();
            playerOriginal.seekTo(parseFloat(seekTime), true);
        });

        // // Event listener for when the user starts dragging the seek bar
        seekBar.addEventListener("mousedown", () => {
            console.log("dragging started");
        });

        seekBar.addEventListener("mouseup", () => {
            console.log("dragging stopped");
            logElapsedTime(CONFIG_OPTIONS.SEEK_TO_ORIGINAL);
        });
    });
</script>

<div class="website-inner-container">
    <div>
        <form id="videoIdInputForm">
            <label for="videoId">Enter the video id:</label>
            <input
                type="text"
                id="videoIdInput"
                name="videoId"
                required
                disabled
            />
            <button type="button" on:click={loadYoutubePlayer}>Submit</button>
        </form>
    </div>
    <label>
        <input type="checkbox" bind:checked={showRecorder} />
        Show Recorder
    </label>
    <div class="video-items-container">
        {#if showRecorder}
            <div class="video-item" id="player-original" />
            <div class="video-item">
                <Recorder {startRecording} {stopRecording} />
            </div>
        {:else}
            <div id="player-original" />
        {/if}
    </div>
    <div>
        <button id="startReaction">Start Reaction</button>
        <button id="startVideo" disabled>Start Video</button>
        <button id="stopVideo" disabled>Stop Video</button>
        <button id="finishReaction" disabled>Finish Reaction</button>
    </div>
    <div id="seek-bar-container">
        <input type="range" id="seek-bar" min="0" max="100" step="0.01" />
        <div>Current Time: <span id="current-time">0:00</span></div>
    </div>
</div>

<style>
    body {
        text-align: center;
        font-family: Arial, sans-serif;
    }

    iframe {
        width: 100%;
        height: 70vh;
    }

    button {
        margin: 10px;
        padding: 10px 20px;
        font-size: 16px;
        cursor: pointer;
    }

    button:disabled {
        background-color: #ccc;
        cursor: not-allowed;
    }

    #seek-bar {
        width: 800px;
    }

    #seek-bar-container {
        display: none;
    }

    .video-items-container {
        display: flex;
    }
</style>
