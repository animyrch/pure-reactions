// 2. This code loads the IFrame Player API code asynchronously.
var tag = document.createElement('script');

tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var startButtonHandler = document.getElementById('players-start');
startButtonHandler.addEventListener("click", () => {
    for (const secondsInfo of Object.keys(playerConfigs)) {
        const configsForSecond = playerConfigs[secondsInfo]
        console.log(secondsInfo);
        for (let configIterator = 0; configIterator < configsForSecond.length; configIterator++) {
            const configElement = configsForSecond[configIterator];
            console.log(configElement);
            setTimeoutHandler(secondsInfo, configElement);
        }
    }
});

function setTimeoutHandler (secondsInfo, configElement) {
    const activeConfigName = configElement[0];
    const extraConfigData = configElement[1];
    const timeoutInMiliseconds = secondsInfo * 1000;
    console.log(activeConfigName);
    switch (activeConfigName) {
        case CONFIG_OPTIONS.START_VIDEO_REACTION:
            console.log('hit start reaction', timeoutInMiliseconds);
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
function onYouTubeIframeAPIReady() {
    playerReaction = new YT.Player('player-reaction', {
        // videoId: '2fjff_9P9to',
        videoId: 'd7gU6ZIpoCM',
        playerVars: playerOptions,
        events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange
        }
    });
    playerOriginal = new YT.Player('player-original', {
        // videoId: 'wTLWTAG2DPU',
        videoId: 'sTtmpFIaFqc',
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
    console.log('attemptiong to start reaction');
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