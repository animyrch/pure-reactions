<script>
    import Recorder from "$lib/components/Recorder.svelte";
    import { onMount } from "svelte";
    import {
        createReactionDocument,
        updateFirebaseDocument,
        createPlaylistDocument,
        addToPlaylistDocument
    } from "$lib/helpers/firebase";
    import { handlePrivateRoute } from '$lib/helpers/routing';
    import { isMobileDevice } from '$lib/helpers/system';
    import { getCompensatedReactionTime } from '$lib/helpers/reaction';
    import PlaylistQueue from "$lib/components/Video/PlaylistQueue.svelte";
    import { isLoggedIn } from '$lib/stores/user';
    import { page } from '$app/stores';
    import { ButtonGroup, Button, Progressbar, Modal } from 'flowbite-svelte';
    import {
        BullhornSolid,
        PauseSolid,
        PlaySolid,
        VideoSolid,
        DownloadSolid,
        UsersSolid
    } from 'flowbite-svelte-icons';
    import { sineOut } from 'svelte/easing';
    import { downloadBasicVideoDetails } from '$lib/helpers/youtube';
    import { goToRoute } from "$lib/helpers/routing";
    import { fetchFirstPlaylistVideos } from '$lib/helpers/youtube';
    import { 
        createSharedSession, 
        updateSessionState, 
        generateShareUrl, 
        SESSION_STATES,
        cleanupInactiveSessions,
        listenToSession
    } from '$lib/helpers/sharedSession';

	export let data;

    const reactionConfigs = new Map();
    const volumeConfigs = new Map();
    const originalVideoId = $page.url.searchParams.get('id');
    const playlistId = $page.url.searchParams.get('playlist');
    const playlistBufferTime = $page.url.searchParams.get('playlistBufferTime');
    let playlistItems = [];
    const showRecorder = $page.url.searchParams.get('record');
    let currentPlaylistDocumentId = $page.url.searchParams.get('playlistDocumentId') || '';
    let playlistElements;
    const existingSharedSessionId = $page.url.searchParams.get('sharedSessionId');

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
    let reactionConfigsArray = [];
    let volumeConfigsArray = [];
    
    // Debug mode
    let debugMode = $page.url.searchParams.get('debug') === 'true';
    
    // Shared session variables
    let sharedSessionId = existingSharedSessionId;
    let shareUrl = '';
    let showShareModal = false;
    let viewerCount = 0;
    let sessionUnsubscribe = null;

    function subscribeToSession() {
        if (!sharedSessionId) {
            return;
        }

        if (sessionUnsubscribe) {
            sessionUnsubscribe();
        }

        sessionUnsubscribe = listenToSession(sharedSessionId, (sessionData) => {
            if (sessionData && sessionData.viewers) {
                viewerCount = Object.keys(sessionData.viewers).length;
            }
        });
    }

    function loadYoutubePlayer() {
        playerOriginal = new YT.Player("player-original", {
            videoId: originalVideoId,
            playerVars: playerOptions,
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange,
            },
        });
    }

    async function loadPlaylist() {
        if (playlistId) {
            playlistItems = await fetchFirstPlaylistVideos(playlistId);
            playlistElements = playlistItems.map(item => item.snippet.resourceId.videoId);
        }
    }
    // 4. The API will call this function when the video player is ready.
    function onPlayerReady(event) {
        console.log("player ready");
        // Update shared session with video duration
        if (sharedSessionId && playerOriginal) {
            updateSessionState(sharedSessionId, {
                duration: playerOriginal.getDuration()
            });
        }
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
            const reactionVideoTime = getCompensatedReactionTime(startTime, playlistBufferTime || 0);
            reactionConfigs.set(reactionVideoTime, { time: originalVideoTime, state: stateCode });
            reactionConfigsArray = Array.from(reactionConfigs.entries());

            const reactionConfigsObject = Object.fromEntries(reactionConfigs); // Convert the Map to an object
            updateFirebaseDocument({
                "reactionConfigs": reactionConfigsObject
            });
        }
    }

    function logVolumeChange(newVolume) {
        if (startTime) {
            const reactionVideoTime = getCompensatedReactionTime(startTime, playlistBufferTime || 0);
            volumeConfigs.set(reactionVideoTime, { volume: newVolume });
            volumeConfigsArray = Array.from(volumeConfigs.entries());

            const volumeConfigsObject = Object.fromEntries(volumeConfigs);
            updateFirebaseDocument({
                "volumeConfigs": volumeConfigsObject
            });
        }
    }

    function startOriginalVideo() {
        playerOriginal.playVideo();
        // Update shared session state
        if (sharedSessionId) {
            updateSessionState(sharedSessionId, {
                state: SESSION_STATES.PLAYING,
                currentTime: playerOriginal.getCurrentTime()
            });
        }
    }
    function pauseOriginalVideo() {
        playerOriginal.pauseVideo();
        // Update shared session state
        if (sharedSessionId) {
            updateSessionState(sharedSessionId, {
                state: SESSION_STATES.PAUSED,
                currentTime: playerOriginal.getCurrentTime()
            });
        }
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
            
            // Update shared session volume
            if (sharedSessionId) {
                updateSessionState(sharedSessionId, {
                    volume: volume
                });
            }
        } else {
            console.error('Player not ready or setVolume method not available.');
        }
    }

    let currentTimeDisplay = "0:00 / 0:00";
    let isFocusReactOn = false;

    const onClickStartReaction = async () => {
        const currentReactionDocumentId = await createReactionDocument({
            originalVideoId,
            userId: data.userId,
            originalVideoAuthor,
            originalVideoTitle,
            offsetStartTime: playlistBufferTime || 0,
        });
        
        // Create shared session
        try {
            if (!sharedSessionId) {
                sharedSessionId = await createSharedSession(currentReactionDocumentId, originalVideoId, data.userId);
                console.log('Shared session created:', sharedSessionId);
            } else {
                await updateSessionState(sharedSessionId, {
                    originalVideoId,
                    reactorId: data.userId,
                    activeReactionDocumentId: currentReactionDocumentId,
                    state: SESSION_STATES.WAITING,
                    currentTime: 0,
                    duration: 0
                });
                console.log('Shared session updated for new playlist video:', sharedSessionId);
            }

            shareUrl = generateShareUrl(sharedSessionId);
            subscribeToSession();
        } catch (error) {
            console.error('Failed to initialise shared session:', error);
        }
        
        if (playlistId) {
            if (currentPlaylistDocumentId) {
                const updateData = {
                    reactionDocumentId: currentReactionDocumentId,
                    playlistDocumentId: currentPlaylistDocumentId,
                    originalVideoId
                };
                await addToPlaylistDocument(updateData);
            } else {
                currentPlaylistDocumentId = await createPlaylistDocument({
                playlistYoutubeId: playlistId,
                userId: data.userId,
                reactionDocumentId: currentReactionDocumentId,
                originalVideoId
            });
            }
        }
        if (showRecorder) {
            startRecording = true;
        }
        updateFirebaseDocument({
            "playlistId": currentPlaylistDocumentId,
            "youtubePlaylistId": playlistId
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

    const goToReactionConfiguration = () => {
        currentButtonGroupState = BUTTON_GROUP_STATES.FINALISED;
        clearInterval(timer);
        goToRoute(`/reaction/${window.currentReactionDocumentId}`);
    };

    const onClickFinishReaction = async () => {
        const reactionVideoTime = getCompensatedReactionTime(startTime, playlistBufferTime || 0);
        console.log('finish reaction', reactionVideoTime);
        
        updateFirebaseDocument({
            "reactionFinishTime": reactionVideoTime,
        });
        // Also persist array-based timelines for efficient playback
        try {
            const stateTimeline = Array.from(reactionConfigs.entries())
                .map(([t, v]) => ({ t: parseFloat(t), state: v.state, targetTime: parseFloat(v.time) }))
                .sort((a, b) => a.t - b.t);
            const volumeTimeline = Array.from(volumeConfigs.entries())
                .map(([t, v]) => ({ t: parseFloat(t), volume: v.volume }))
                .sort((a, b) => a.t - b.t);
            await updateFirebaseDocument({
                stateTimeline,
                volumeTimeline
            });
        } catch (e) {
            console.error('Failed to persist array timelines', e);
        }
        if (showRecorder) {
            stopRecording = true;
        }
        if (!currentPlaylistDocumentId) {
            goToReactionConfiguration();
            return;
        }
        const nextVideoIndex = playlistElements.findIndex(item => item === originalVideoId) + 1;
        const nextVideoId = playlistElements[nextVideoIndex];
        if (sharedSessionId) {
            try {
                if (nextVideoId) {
                    await updateSessionState(sharedSessionId, {
                        state: SESSION_STATES.WAITING,
                        currentTime: 0
                    });
                } else {
                    await updateSessionState(sharedSessionId, {
                        state: SESSION_STATES.ENDED
                    });
                }
            } catch (error) {
                console.error('Failed to update shared session at finish:', error);
            }
        }
        if (!nextVideoId) {
            goToReactionConfiguration();
            return;
        }
        const nextRoute = `/backend?id=${nextVideoId}&playlist=${playlistId}&playlistDocumentId=${currentPlaylistDocumentId}&playlistBufferTime=${reactionVideoTime}` + (sharedSessionId ? `&sharedSessionId=${sharedSessionId}` : '');
        await goToRoute(nextRoute);
        location.reload();
    };

    const onClickShareSession = () => {
        showShareModal = true;
    };

    const copyShareUrl = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            // You could add a toast notification here
            console.log('Share URL copied to clipboard');
        } catch (error) {
            console.error('Failed to copy URL:', error);
        }
    };

    const onClickProgress = (event) => {
        const progressBar = event.currentTarget;
        const clickX = event.clientX - progressBar.getBoundingClientRect().left;
        const progressBarWidth = progressBar.clientWidth;

        const clickPercentage = (clickX / progressBarWidth) * 100;
        progress = clickPercentage;

        const seekTime = (progress / 100) * playerOriginal.getDuration();
        playerOriginal.seekTo(parseFloat(seekTime), true);
        
        // Update shared session with new time
        if (sharedSessionId) {
            updateSessionState(sharedSessionId, {
                currentTime: parseFloat(seekTime)
            });
        }
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
            loadPlaylist();
        }, 1000);

        await getBasicDetailsOriginal();
        if (playlistBufferTime) {
            onClickStartReaction();
        }

        if (sharedSessionId) {
            shareUrl = generateShareUrl(sharedSessionId);
            subscribeToSession();
        }

        // Clean up inactive sessions periodically
        setInterval(cleanupInactiveSessions, 60 * 60 * 1000); // Every hour
    });


    // Clean up session when page is unloaded
    const handleBeforeUnload = () => {
        if (sharedSessionId) {
            updateSessionState(sharedSessionId, {
                state: SESSION_STATES.ENDED
            });
        }
        if (sessionUnsubscribe) {
            sessionUnsubscribe();
        }
    };

    let originalVideoAuthor;
    let originalVideoTitle;
    const getBasicDetailsOriginal = async () => {
        const { videoAuthor, videoTitle } = await downloadBasicVideoDetails(originalVideoId);
        originalVideoAuthor = videoAuthor;
        originalVideoTitle = videoTitle;
    };
    function handleKeydown(event) {
        if (
            event.key === 'Enter' &&
            currentButtonGroupState === BUTTON_GROUP_STATES.INITIAL
        ) {
            event.preventDefault();
            onClickStartReaction();
        }
        if (
            event.key === ' ' &&
            currentButtonGroupState !== BUTTON_GROUP_STATES.INITIAL &&
            currentButtonGroupState !== BUTTON_GROUP_STATES.FINALISED
        ) {
            event.preventDefault();
            isPlaying ? onClickStopVideo() : onClickStartVideo();
        }
        if (
            event.key === 'Control' &&
            currentButtonGroupState === BUTTON_GROUP_STATES.RECORDING &&
            !isFocusReactOn
        ) {
            event.preventDefault();
            onClickFocusReact();
        }
    }
    function handleKeyup(event) {
        if (
            event.key === 'Control' &&
            currentButtonGroupState === BUTTON_GROUP_STATES.RECORDING &&
            isFocusReactOn
        ) {
            event.preventDefault();
            onClickFocusReact();
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} on:keyup={handleKeyup} on:beforeunload={handleBeforeUnload} />

{#if $isLoggedIn}
    <div class="website-inner-container">
        <div class="flex gap-3">
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
                        <Button
                            disabled={!sharedSessionId}
                            on:click={onClickShareSession}
                            outline color="blue"
                        >
                          <UsersSolid class="w-3 h-3 me-2" />
                          Share Session
                        </Button>
                      </ButtonGroup>
                </div>
            </div>
            <div class="tools-container w-1/5">
                {#if showRecorder}
                    <div>
                        <Recorder
                            {startRecording}
                            {stopRecording}
                        />
                    </div>
                {/if}
                <div>
                    <PlaylistQueue
                        currentlyViewed={originalVideoId}
                        playlistId={playlistId}
                        playlistDocumentId={currentPlaylistDocumentId}
                        startTime={startTime}
                        playlistBufferTime={playlistBufferTime}
                    />
                </div>
            </div>
        </div>
    </div>
    {#if debugMode && currentButtonGroupState !== BUTTON_GROUP_STATES.INITIAL}
        <div class="debug-panel bg-gray-100 p-4 m-2 rounded text-sm">
            <h3 class="font-bold">Debug Info:</h3>
            <p>Start Time: {startTime ? new Date(startTime).toISOString() : 'Not set'}</p>
            <p>Playlist Buffer: {playlistBufferTime || 0}s</p>
            <p>Reaction Configs: {reactionConfigsArray.length}</p>
            <p>Volume Configs: {volumeConfigsArray.length}</p>
            <p>Current State: {currentButtonGroupState}</p>
            
            <!-- Show recent configs -->
            <div class="mt-2">
                <h4 class="font-semibold">Recent State Changes:</h4>
                {#each reactionConfigsArray.slice(-5) as [time, config]}
                    <div>R: {time} → {config.state} (orig: {config.time})</div>
                {/each}
            </div>
            
            <div class="mt-2">
                <h4 class="font-semibold">Recent Volume Changes:</h4>
                {#each volumeConfigsArray.slice(-5) as [time, config]}
                    <div>V: {time} → {config.volume}</div>
                {/each}
            </div>
            
        </div>
    {/if}

    <!-- Share Session Modal -->
    <Modal bind:open={showShareModal} title="Share Your Reaction Session">
        <div class="space-y-4">
            <p class="text-gray-600">
                Share this URL with others to let them watch your reaction in real-time. 
                They'll see the same video and it will sync with your controls.
            </p>
            
            <div class="flex items-center space-x-2">
                <input 
                    type="text" 
                    value={shareUrl} 
                    readonly 
                    class="flex-1 p-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                />
                <Button on:click={copyShareUrl} color="blue" size="sm">
                    Copy
                </Button>
            </div>
            
            <div class="text-sm text-gray-500">
                <p>👥 Viewers: {viewerCount}</p>
                <p>📹 Video: {originalVideoTitle}</p>
            </div>
        </div>
    </Modal>
{:else}{handlePrivateRoute()}{/if}
