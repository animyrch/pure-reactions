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

function onYouTubeIframeAPIReady() {
    playerOriginal = new YT.Player('player-original', {
        videoId: '6Cl91XNnk2U',
        playerVars: playerOptions,
        events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange
        }
    });
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

function logElapsedTime(actionCode, timeCode) {
    if (startTime) {
        const currentTime = new Date().getTime();
        const elapsedTime = (currentTime - startTime) / 1000; // Convert to seconds
        console.log("Timer: " + elapsedTime.toFixed(2) + " seconds");
        reactionConfigs[elapsedTime.toFixed(2).toString()] = [[actionCode, timeCode]];
    }
}

startReactionBtn.addEventListener("click", () => {
    console.log("Started the reaction");
    startReactionBtn.disabled = true;
    startVideoBtn.disabled = false;
    finishReactionBtn.disabled = false;

    // Start the timer
    startTime = new Date().getTime();
    logElapsedTime(CONFIG_OPTIONS.START_VIDEO_REACTION);
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
    logElapsedTime();
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

// // Event listener for when the user moves the mouse (dragging) on the seek bar
// seekBar.addEventListener("mousemove", () => {
//     if (isDragging) {
//         const seekTime = (seekBar.value / 100) * playerOriginal.getDuration();
//         playerOriginal.seekTo(seekTime, true);
//     }
// });

seekBar.addEventListener("mouseup", () => {
    isDragging = false;
    console.log("dragging stopped");
    const seekTime = (seekBar.value / 100) * playerOriginal.getDuration();
    logElapsedTime(CONFIG_OPTIONS.SEEK_TO_ORIGINAL, seekTime.toFixed(2));
});