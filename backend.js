// 2. This code loads the IFrame Player API code asynchronously.
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);


let timer;
let startTime;

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
    SEEK_TO_ORIGINAL: 6
};

const reactionConfigs = {};

var playerOptions = {
    'autoplay': 0,
    'controls': 0,
    'disablekb': 1,
    'modestbranding': 1,
    'enablejsapi': 1,
    'rel': 0
};


var playerOriginal;

const videoIdInput = document.getElementById("videoIdInput");

function loadYoutubePlayer() {
     const videoId = videoIdInput.value;
     window.originalVideoIdForReaction = videoId;

    playerOriginal = new YT.Player('player-original', {
        videoId: window.originalVideoIdForReaction,
        playerVars: playerOptions,
        events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange
        }
    });
}

function onYouTubeIframeAPIReady() {
    displayVideoIdInput();
}


function displayVideoIdInput() {
    videoIdInput.disabled = false;
}

// 4. The API will call this function when the video player is ready.
function onPlayerReady(event) {
    console.log('player ready');
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
            0: []
        };
        reactionConfigs[configKey][0].push(actionCode);
        reactionConfigs[configKey][0].push(getCurrentTimeForOriginalVideo());
        window.updateFirebaseDocument({
            "reaction-configs": reactionConfigs
        });
    }
}

startReactionBtn.addEventListener("click", () => {
    window.createReactionDocument(window.originalVideoIdForReaction);
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
    startReactionBtn.disabled = true;
    startVideoBtn.disabled = true;
    stopVideoBtn.disabled = true;
    finishReactionBtn.disabled = true;
    clearInterval(timer);
    console.log(reactionConfigs);
});

function startOriginalVideo() {
    playerOriginal.playVideo();
}
function pauseOriginalVideo() {
    playerOriginal.pauseVideo();
}


let seekBar = document.getElementById("seek-bar");
seekBar.value = 0;
let currentTimeDisplay = document.getElementById("current-time");
// Function to update the seek bar and current time display
function updateSeekBar() {
    const duration = playerOriginal.getDuration();
    const currentTime = playerOriginal.getCurrentTime();

    seekBar.value = (currentTime / duration) * 100;
    currentTimeDisplay.textContent = formatTime(currentTime) + " / " + formatTime(duration);

    requestAnimationFrame(updateSeekBar);
}

// Function to format time in HH:MM format
function formatTime(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
}

// Event listener for when the user interacts with the seek bar
seekBar.addEventListener("input", () => {
    const seekTime = (seekBar.value / 100) * playerOriginal.getDuration();
    playerOriginal.seekTo(parseFloat(seekTime), true);
});

// // Add these variables at the beginning of the script
// let isDragging = false;

// // Event listener for when the user starts dragging the seek bar
seekBar.addEventListener("mousedown", () => {
    isDragging = true;
    console.log("dragging started");
});

seekBar.addEventListener("mouseup", () => {
    isDragging = false;
    console.log("dragging stopped");
    logElapsedTime(CONFIG_OPTIONS.SEEK_TO_ORIGINAL);
});