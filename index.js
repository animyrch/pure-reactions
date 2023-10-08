// 2. This code loads the IFrame Player API code asynchronously.
var tag = document.createElement('script');

tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var startButtonHandler = document.getElementById('players-start');
startButtonHandler.addEventListener("click", () => {
    setTimeoutHandler(0, [1]);
    console.log(window.playerConfigs);
    for (const secondsInfo of Object.keys(window.playerConfigs)) {
        const configsForSecond = window.playerConfigs[secondsInfo]
        console.log(secondsInfo);
        const configElement = configsForSecond[0];
        console.log(configElement);
        setTimeoutHandler(secondsInfo, configElement);
    }
});

function setTimeoutHandler (secondsInfo, configElement) {
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
            setTimeout(setVolumeForOriginalVideo(extraConfigData), timeoutInMiliseconds);
            break;
        case CONFIG_OPTIONS.START_VIDEO_ORIGINAL:
            setTimeout(startOriginalVideo, timeoutInMiliseconds);
            break;
        case CONFIG_OPTIONS.PAUSE_VIDEO_ORIGINAL:
            setTimeout(pauseOriginalVideo, timeoutInMiliseconds);
            break;
        case CONFIG_OPTIONS.SEEK_TO_ORIGINAL:
            setTimeout(goToSecondsInOriginalVideo(extraConfigData), timeoutInMiliseconds);
            break;
        default:
            break;
    }
}
// 3. This function creates an <iframe> (and YouTube player)
//    after the API code downloads.
var playerReaction;
var playerOriginal;
var playerOptions = {
    'autoplay': 0,
    'controls': 1,
    'disablekb': 1,
    'modestbranding': 1,
    'rel': 0
};

const setUpVideos = (doc) => {
    const obtainedData = doc.data();
    console.log(obtainedData);
    console.log(obtainedData["reaction-configs"]);
    window.playerConfigs = obtainedData["reaction-configs"];
    console.log(window.playerConfigs);
    playerReaction = new YT.Player('player-reaction', {
        // videoId: '2fjff_9P9to',
        videoId: obtainedData['reaction-video-id'],
        playerVars: playerOptions,
        events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange
        }
    });
    playerOriginal = new YT.Player('player-original', {
        // videoId: 'wTLWTAG2DPU',
        videoId: obtainedData['original-video-id'],
        playerVars: playerOptions,
        events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange
        }
    });
};

function onYouTubeIframeAPIReady() {
    window.getReactions(setUpVideos);
}

// 4. The API will call this function when the video player is ready.
function onPlayerReady(event) {
console.log('player ready');
// event.target.playVideo();
}

// 5. The API calls this function when the player's state changes.
//    The function indicates that when playing a video (state=1),
//    the player should play for six seconds and then stop.
// var done = false;
function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        // setTimeout(stopVideo, 6000);
        // done = true;
    }
}
function stopReactionVideo() {
    playerReaction.stopVideo();
}
function stopOriginalVideo() {
    playerOriginal.stopVideo();
}
function startReactionVideo() {
    playerReaction.playVideo();
}
function startOriginalVideo() {
    playerOriginal.playVideo();
}
function pauseReactionVideo() {
    playerReaction.pauseVideo();
}
function pauseOriginalVideo() {
    playerOriginal.pauseVideo();
}
function goToSecondsInOriginalVideo(seconds) {
    return function() {
        playerOriginal.seekTo(seconds);
    };
}
function setVolumeForOriginalVideo(volume) {
    playerOriginal.setVolume(volume);
}