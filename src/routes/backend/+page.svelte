<!-- src/Backend.svelte -->
<script>
    import Recorder from "$lib/components/Recorder.svelte";
    import { onMount } from "svelte";
    import {
        createReactionDocument,
        updateFirebaseDocument
    } from "$lib/helpers/firebase";
    import { handlePrivateRoute } from '$lib/helpers/routing';
    import { isMobileDevice } from '$lib/helpers/system';
    import { extractYouTubeVideoId } from '$lib/helpers/youtube';
    import { getCompensatedReactionTime } from '$lib/helpers/reaction';

    const reactionConfigs = new Map();
    const volumeConfigs = new Map();
    let timer;
    let startTime;
    let videoIdInput;

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
        const videoId = extractYouTubeVideoId(videoIdInput);
        window.originalVideoIdForReaction = videoId;
        
        if (playerOriginal) {
            playerOriginal.destroy();
        }
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
        const videoIdInputDOM = document.getElementById("videoIdInput");
        if (videoIdInputDOM) {
            videoIdInputDOM.disabled = false;
        }
    }

    // 4. The API will call this function when the video player is ready.
    function onPlayerReady(event) {
        console.log("player ready");
    }
    function onPlayerStateChange(event) {
        const currentTime = playerOriginal.getCurrentTime();
        logStateChange(getCurrentTimeForOriginalVideo(), event.data);
        if (event.data == YT.PlayerState.UNSTARTED) {
            console.log('YT.PlayerState.UNSTARTED');
        }
        if (event.data == YT.PlayerState.ENDED) {
            console.log('YT.PlayerState.ENDED');
        }
        if (event.data == YT.PlayerState.PLAYING) {
            console.log('YT.PlayerState.PLAYING');
        }
        if (event.data == YT.PlayerState.PAUSED) {
            console.log('YT.PlayerState.PAUSED');
        }
        if (event.data == YT.PlayerState.BUFFERING) {
            console.log('YT.PlayerState.BUFFERING');
        }
        if (event.data == YT.PlayerState.CUED) {
            console.log('YT.PlayerState.CUED');
        }
        if (event.data == YT.PlayerState.PLAYING) {
            updateSeekBar();
        }
    }
    const getCurrentTimeForOriginalVideo = () => {
        const seekTime = (seekBar.value / 100) * playerOriginal.getDuration();
        return seekTime.toFixed(2);
    };
    function logStateChange(originalVideoTime, stateCode) {
        if (startTime) {
            const currentTime = new Date().getTime();
            const elapsedTime = (currentTime - startTime) / 1000; // Convert to seconds
            const reactionVideoTime = getCompensatedReactionTime(elapsedTime)
            reactionConfigs.set(reactionVideoTime, { time: originalVideoTime, state: stateCode });
            const reactionConfigsObject = Object.fromEntries(reactionConfigs); // Convert the Map to an object
            updateFirebaseDocument({
                "reactionConfigs": reactionConfigsObject
            });
        }
    }

    function logVolumeChange(newVolume) {
        if (startTime) {
            const currentTime = new Date().getTime();
            const elapsedTime = (currentTime - startTime) / 1000; // Convert to seconds
            const reactionVideoTime = getCompensatedReactionTime(elapsedTime)
            volumeConfigs.set(reactionVideoTime, { volume: newVolume });
            const volumeConfigsObject = Object.fromEntries(volumeConfigs);
            updateFirebaseDocument({
                "volumeConfigs": volumeConfigsObject
            });
        }
    }

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

    let soundLevel = 100; // Initial sound level, adjust as needed

    // Add an event listener to update the YouTube player's volume
    $: {
        // Calculate the volume based on the soundLevel (0-100)
        const volume = soundLevel / 100;
        
        // Set the volume for the YouTube player
        if (playerOriginal) {
            setVolumeForOriginalVideo(volume * 100); // YouTube API uses a volume range of 0-100
        }
    }
    function setVolumeForOriginalVideo(volume) {
        if (playerOriginal && typeof playerOriginal.setVolume === 'function') {
            playerOriginal.setVolume(volume);
            console.log('new sound set');
        } else {
            console.error('Player not ready or setVolume method not available.');
        }
    }


    let seekBar;
    let currentTimeDisplay;

    let showRecorder = false;
    let isFocusReactOn = false;

    onMount(async () => {
        if (isMobileDevice()) {
            handlePrivateRoute();
        }
        seekBar = document.getElementById("seek-bar");
        if (seekBar) {
            seekBar.value = 0;

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
            });
        }
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
        const focusReactBtn = document.getElementById("focusReact");
        const stopVideoBtn = document.getElementById("stopVideo");
        const finishReactionBtn = document.getElementById("finishReaction");
        const seekBarContainer = document.getElementById("seek-bar-container");
        const volumeBarContainer = document.getElementById("volume-bar-container");

        if (startReactionBtn) {
            startReactionBtn.addEventListener("click", () => {
                createReactionDocument(window.originalVideoIdForReaction, data.userId);
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
        }

        if (startVideoBtn) {
            startVideoBtn.addEventListener("click", () => {
                console.log("Started the video");
                startOriginalVideo();
                startVideoBtn.disabled = true;
                stopVideoBtn.disabled = false;
                focusReactBtn.disabled = false;
                seekBarContainer.style.display = "block";
                volumeBarContainer.style.display = "block";
            });
        }

        if (focusReactBtn) {
            focusReactBtn.addEventListener("click", () => {
            isFocusReactOn = !isFocusReactOn;
            const soundLevel = isFocusReactOn ? 20 : 100;
            logVolumeChange(soundLevel);
        });
        }

        if (stopVideoBtn) {
            stopVideoBtn.addEventListener("click", () => {
                console.log("Stopped the video");
                pauseOriginalVideo();
                stopVideoBtn.disabled = true;
                focusReactBtn.disabled = true;
                startVideoBtn.disabled = false;
            });
        }

        if (finishReactionBtn) {
            finishReactionBtn.addEventListener("click", () => {
                console.log("Finished the reaction");
                if (showRecorder) {
                    stopRecording = true;
                }
                startReactionBtn.disabled = true;
                startVideoBtn.disabled = true;
                stopVideoBtn.disabled = true;
                focusReactBtn.disabled = true;
                finishReactionBtn.disabled = true;
                clearInterval(timer);
            });
        }
    });

	export let data;
</script>

{#if data.isLoggedIn}
    <div class="website-inner-container">
        <div>
            <form id="videoIdInputForm">
                <label for="videoId">Enter the video id:</label>
                <input
                    type="text"
                    id="videoIdInput"
                    name="videoId"
                    required
                    bind:value={videoIdInput}
                />
                <button type="button" on:click={loadYoutubePlayer}>Submit</button>
            </form>
        </div>
        <label>
            <input type="checkbox" bind:checked={showRecorder} />
            Show Recorder
        </label>
        <div class="flex-container">
            <div id="volume-bar-container">
                <input
                    type="range"
                    id="sound-control"
                    min="0"
                    max="100"
                    step="1"
                    bind:value={soundLevel}
                    class="vertical-slider"
                />
            </div>
            <div class="video-items-container">
                {#if showRecorder}
                    <div class="video-item" id="player-original" />
                    <div class="video-item">
                        <Recorder {startRecording} {stopRecording} />
                    </div>
                {:else}
                    <div class="video-item">
                        <div id="player-original" />
                    </div>
                {/if}
            </div>
        </div>
        <div>
            <button id="startReaction">Start Reaction</button>
            <button id="startVideo" disabled>Start Video</button>
            <button id="focusReact" class:active={isFocusReactOn} disabled>Focus React</button>
            <button id="stopVideo" disabled>Stop Video</button>
            <button id="finishReaction" disabled>Finish Reaction</button>
        </div>
        <div id="seek-bar-container">
            <input type="range" id="seek-bar" min="0" max="100" step="0.01" />
            <div>Current Time: <span id="current-time">0:00</span></div>
        </div>
    </div>
{:else}{handlePrivateRoute()}{/if}

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

    #seek-bar-container, #volume-bar-container {
        display: none;
    }

    .video-items-container {
        display: flex;
        flex-direction: column;
        width: 100vw;
    }

    .video-item {
        object-fit: contain;
        width: 100%;
        height: calc(100vw * 0.56);
    }
    #sound-control {
        transform: rotate(270deg);
        height: 150px; /* Adjust the height as needed */
        width: 150px;  /* Adjust the width as needed */
    }
    .flex-container {
        display: flex;
    }

    #focusReact.active {
        background-color: rgb(230, 20, 20) !important;
        color: white;
    }


</style>
