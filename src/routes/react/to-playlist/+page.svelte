<script>
    import Recorder from "$lib/components/Recorder.svelte";
    import { onMount } from "svelte";
    import {
        createPlaylistReactionDocument,
        updateFirebaseDocument
    } from "$lib/helpers/firebase";
    import { handlePrivateRoute } from '$lib/helpers/routing';
    import { isMobileDevice } from '$lib/helpers/system';
    import { getCompensatedReactionTime } from '$lib/helpers/reaction';
    import { isLoggedIn } from '$lib/stores/user';
    import { page } from '$app/stores';
    import { ButtonGroup, Button, Progressbar } from 'flowbite-svelte';
    import {
        BullhornSolid,
        PauseSolid,
        PlaySolid,
        VideoSolid,
        DownloadSolid
    } from 'flowbite-svelte-icons';
    import { sineOut } from 'svelte/easing';
    import { downloadBasicVideoDetails, getPlaylistVideoDetails } from '$lib/helpers/youtube';
    import { goToRoute } from "$lib/helpers/routing";

	export let data;

    const reactionConfigs = new Map();
    const volumeConfigs = new Map();
    const originalPlaylistId = $page.url.searchParams.get('id');
    const showRecorder = $page.url.searchParams.get('record');
    
    const playerOptions = {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        enablejsapi: 1,
        rel: 0,
    };
    const BUTTON_GROUP_STATES = {
        INITIAL: 'initial',
        READY: 'ready',
        RECORDING: 'recording',
        PAUSED: 'paused',
        FINALISED: 'finalised'
    };

    let timer;
    let startTime;
    let playerOriginal;
    let progress = 0;
    let startRecording = false;
    let stopRecording = false;
    let currentButtonGroupState = BUTTON_GROUP_STATES.INITIAL;
    let isPlaying = false;
    let videosInPlaylist = [];
    function loadYoutubePlayer() {
        playerOriginal = new YT.Player("player-original", {
            // videoId: originalPlaylistId,
            playerVars: {
                ...playerOptions,
                listType: 'playlist',
                list: originalPlaylistId
            },
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange,
            },
        });
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
        const seekTime = (progress / 100) * playerOriginal.getDuration();
        return seekTime.toFixed(2);
    };
    function logStateChange(originalVideoTime, stateCode) {
        if (startTime) {
            if (stateCode === YT.PlayerState.BUFFERING) {
                stateCode = YT.PlayerState.PAUSED;
            }
            const currentTime = new Date().getTime();
            const elapsedTime = (currentTime - startTime) / 1000; // Convert to seconds
            const reactionVideoTime = getCompensatedReactionTime(elapsedTime)
            const reactionConfigsObject = Object.fromEntries(reactionConfigs); // Convert the Map to an object
            // update the correct element from videosInPlaylist in place
            videosInPlaylist.forEach(video => {
                if (video.videoId === playerOriginal.getVideoData()?.video_id) {
                    video.reactionConfigs[reactionVideoTime] = { time: originalVideoTime, state: stateCode };
                    // exit for each once the correct video is found
                    return;
                }
            });
            updateFirebaseDocument({
                videosInPlaylist
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

        progress = (currentTime / duration) * 100;
        currentTimeDisplay =
            formatTime(currentTime) + " / " + formatTime(duration);

        requestAnimationFrame(updateSeekBar);
    }

    // Function to format time in HH:MM format
    function formatTime(time) {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
    }

    let soundLevel = 100;

    $: {
        const volume = soundLevel / 100;
        if (playerOriginal) {
            setVolumeForOriginalVideo(volume * 100);
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

    let currentTimeDisplay = "0:00 / 0:00";
    let isFocusReactOn = false;

    const onClickStartReaction = () => {
        videosInPlaylist.forEach(video => {
            video.reactionConfigs = {};
        });
        createPlaylistReactionDocument({
            originalPlaylistId,
            userId: data.userId,
            videosInPlaylist
        });
        currentButtonGroupState = BUTTON_GROUP_STATES.READY;

        startTime = new Date().getTime();
    };

    const onClickStartVideo = () => {
        isPlaying = true;
        startOriginalVideo();
        currentButtonGroupState = BUTTON_GROUP_STATES.RECORDING;
    };

    const onClickFocusReact = () => {
        isFocusReactOn = !isFocusReactOn;
        const soundLevel = isFocusReactOn ? 20 : 100;
        logVolumeChange(soundLevel);
    };

    const onClickStopVideo = () => {
        isPlaying = false;
        pauseOriginalVideo();
        currentButtonGroupState = BUTTON_GROUP_STATES.READY;
    };

    const onClickFinishReaction = () => {
        if (showRecorder) {
            stopRecording = true;
        }
        currentButtonGroupState = BUTTON_GROUP_STATES.FINALISED;
        clearInterval(timer);
        goToRoute(`/reaction/${window.currentReactionDocumentId}`);
    };

    const onClickProgress = (event) => {
        const progressBar = event.currentTarget;
        const clickX = event.clientX - progressBar.getBoundingClientRect().left;
        const progressBarWidth = progressBar.clientWidth;

        const clickPercentage = (clickX / progressBarWidth) * 100;
        progress = clickPercentage;

        const seekTime = (progress / 100) * playerOriginal.getDuration();
        playerOriginal.seekTo(parseFloat(seekTime), true);
    };

    onMount(async () => {
        if (isMobileDevice()) {
            handlePrivateRoute();
        }
            const tag = document.createElement("script");
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName("div")[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

            setTimeout(() => {
            loadYoutubePlayer();
        }, 1000);

        await getBasicDetailsOriginal();
    });

    let originalVideoAuthor;
    let originalVideoTitle;
    const getBasicDetailsOriginal = async () => {
        console.log('getBasicDetailsOriginal', originalPlaylistId);
        videosInPlaylist = await getPlaylistVideoDetails(originalPlaylistId);

        // for each video in the playlist, download the basic details and add it to the videosInPlaylist
        videosInPlaylist.forEach(async (video) => {
            const { videoAuthor } = await downloadBasicVideoDetails(video.videoId);
            video.videoAuthor = videoAuthor;
            video.videoTitle = video.title;
        });

        console.log(videosInPlaylist, 'videosInPlaylist');
        // const { videoAuthor, videoTitle } = await downloadBasicVideoDetails(originalPlaylistId);
        // console.log(videoAuthor, videoTitle);
    };
    // function handleKeydown(event) {
    //     if (
    //         event.key === 'Enter' &&
    //         currentButtonGroupState === BUTTON_GROUP_STATES.INITIAL
    //     ) {
    //         event.preventDefault();
    //         onClickStartReaction();
    //     }
    //     if (
    //         event.key === ' ' &&
    //         currentButtonGroupState !== BUTTON_GROUP_STATES.INITIAL &&
    //         currentButtonGroupState !== BUTTON_GROUP_STATES.FINALISED
    //     ) {
    //         event.preventDefault();
    //         isPlaying ? onClickStopVideo() : onClickStartVideo();
    //     }
    //     if (
    //         event.key === 'Control' &&
    //         currentButtonGroupState === BUTTON_GROUP_STATES.RECORDING &&
    //         !isFocusReactOn
    //     ) {
    //         event.preventDefault();
    //         onClickFocusReact();
    //     }
    // }
    // function handleKeyup(event) {
    //     if (
    //         event.key === 'Control' &&
    //         currentButtonGroupState === BUTTON_GROUP_STATES.RECORDING &&
    //         isFocusReactOn
    //     ) {
    //         event.preventDefault();
    //         onClickFocusReact();
    //     }
    // }
</script>

<!-- <svelte:window on:keydown={handleKeydown} on:keyup={handleKeyup} /> -->

{#if $isLoggedIn}
    <div class="website-inner-container">
        <div class="flex">
            <div class="original-video-container w-4/5 h-svh">
                <div id="player-original" class="w-full h-2/3"/>
                <button
                    class="new-seekbar w-full h-24" 
                    on:click={onClickProgress}
                >
                    {currentTimeDisplay}
                    <Progressbar
                        {progress}
                        animate
                        precision={2}
                        tweenDuration={400}
                        easing={sineOut}
                        size="h-2"
                        labelInsideClass="hidden"
                        class="mb-8"
                    />
                </button>
                <div class="reaction-buttons text-center m-2 h-24">
                    <ButtonGroup>
                        <Button
                            disabled={currentButtonGroupState !== BUTTON_GROUP_STATES.INITIAL}
                            on:click={onClickStartReaction}
                            outline color="dark"
                        >
                          <VideoSolid class="w-3 h-3 me-2" />
                          Start Reaction
                        </Button>
                        <Button
                            disabled={currentButtonGroupState !== BUTTON_GROUP_STATES.READY}
                            on:click={onClickStartVideo}
                            outline color="dark"
                        >
                          <PlaySolid class="w-3 h-3 me-2" />
                          Start Video
                        </Button>
                        <Button
                            disabled={currentButtonGroupState !== BUTTON_GROUP_STATES.RECORDING}
                            on:click={onClickFocusReact}
                            outline={!isFocusReactOn}
                            color={isFocusReactOn ? "red" : "dark"}
                        >
                          <BullhornSolid class="w-3 h-3 me-2" />
                          Focus React
                        </Button>
                        <Button
                            disabled={currentButtonGroupState !== BUTTON_GROUP_STATES.RECORDING}
                            on:click={onClickStopVideo}
                            outline color="dark"
                        >
                          <PauseSolid class="w-3 h-3 me-2" />
                          Stop Video
                        </Button>
                        <Button
                            disabled={currentButtonGroupState === BUTTON_GROUP_STATES.INITIAL || currentButtonGroupState === BUTTON_GROUP_STATES.FINALISED}
                            on:click={onClickFinishReaction}
                            outline color="dark"
                        >
                          <DownloadSolid class="w-3 h-3 me-2" />
                          Finish Reaction
                        </Button>
                      </ButtonGroup>
                </div>
            </div>
        </div>
    </div>
{:else}{handlePrivateRoute()}{/if}
