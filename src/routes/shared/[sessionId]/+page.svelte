<script>
    import { onMount, onDestroy } from "svelte";
    import { page } from '$app/stores';
    import { 
        getSessionData, 
        listenToSession, 
        joinSharedSession, 
        leaveSharedSession,
        SESSION_STATES 
    } from '$lib/helpers/sharedSession';
    import { downloadBasicVideoDetails } from '$lib/helpers/youtube';
    import { Progressbar } from 'flowbite-svelte';
    import { sineOut } from 'svelte/easing';

    
    let sessionId = $page.params.sessionId;
    let sessionData = null;
    let playerOriginal = null;
    let currentVideoId = null;
    let pendingVideoUpdate = null;
    let progress = 0;
    let currentTimeDisplay = "0:00 / 0:00";
    let isConnected = false;
    let errorMessage = '';
    let viewerId = null;
    let originalVideoTitle = '';
    let originalVideoAuthor = '';
    let isPlayerReady = false;
    let unsubscribe = null;
    
    // Debug mode
    let debugMode = $page.url.searchParams.get('debug') === 'true';
    
    // Twitch delay configuration for viewers
    const TWITCH_DELAY_SECONDS = 6;
    let delayedControls = {
        play: false,
        pause: false,
        seek: null,
        volume: null,
        playbackRate: null
    };
    let controlTimeouts = new Map();

    const playerOptions = {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        enablejsapi: 1,
        rel: 0,
    };

    // Generate unique viewer ID
    const generateViewerId = () => {
        return 'viewer_' + Math.random().toString(36).substr(2, 9);
    };

    function clearAllControlTimeouts() {
        controlTimeouts.forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        controlTimeouts.clear();
    }

    async function refreshVideoDetails(videoId) {
        if (!videoId) {
            originalVideoAuthor = '';
            originalVideoTitle = '';
            return;
        }

        try {
            const { videoAuthor, videoTitle } = await downloadBasicVideoDetails(videoId);
            originalVideoAuthor = videoAuthor;
            originalVideoTitle = videoTitle;
        } catch (error) {
            console.error('Failed to download video details:', error);
            originalVideoAuthor = '';
            originalVideoTitle = '';
        }
    }

    function loadYoutubePlayer() {
        const videoIdToLoad = currentVideoId || sessionData?.originalVideoId;
        if (!videoIdToLoad) return;
        
        playerOriginal = new YT.Player("player-viewer", {
            videoId: videoIdToLoad,
            playerVars: playerOptions,
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange,
            },
        });
    }

    function onPlayerReady(event) {
        console.log("Viewer player ready");
        isPlayerReady = true;
        
        if (pendingVideoUpdate && typeof playerOriginal?.cueVideoById === 'function') {
            playerOriginal.cueVideoById(pendingVideoUpdate);
            pendingVideoUpdate = null;
        }
        
        // Sync with current session state
        if (sessionData) {
            syncWithSession();
        }
    }

    function onPlayerStateChange(event) {
        // Don't sync viewer state changes back to session
        // Only the reactor controls the session
    }

    // Clear existing timeouts for a control type
    function clearControlTimeout(controlType) {
        if (controlTimeouts.has(controlType)) {
            clearTimeout(controlTimeouts.get(controlType));
            controlTimeouts.delete(controlType);
        }
    }

    // Delayed video controls for viewers to sync with Twitch delay
    function delayedPlay() {
        clearControlTimeout('play');
        const timeoutId = setTimeout(() => {
            playerOriginal.playVideo();
        }, TWITCH_DELAY_SECONDS * 1000);
        controlTimeouts.set('play', timeoutId);
    }

    function delayedPause() {
        clearControlTimeout('pause');
        const timeoutId = setTimeout(() => {
            playerOriginal.pauseVideo();
        }, TWITCH_DELAY_SECONDS * 1000);
        controlTimeouts.set('pause', timeoutId);
    }

    function delayedSeek(time) {
        clearControlTimeout('seek');
        const timeoutId = setTimeout(() => {
            playerOriginal.seekTo(time, true);
        }, TWITCH_DELAY_SECONDS * 1000);
        controlTimeouts.set('seek', timeoutId);
    }

    function delayedVolume(volume) {
        clearControlTimeout('volume');
        const timeoutId = setTimeout(() => {
            playerOriginal.setVolume(volume);
        }, TWITCH_DELAY_SECONDS * 1000);
        controlTimeouts.set('volume', timeoutId);
    }

    function delayedPlaybackRate(rate) {
        clearControlTimeout('speed');
        const timeoutId = setTimeout(() => {
            if (playerOriginal && typeof playerOriginal.setPlaybackRate === 'function') {
                playerOriginal.setPlaybackRate(rate);
            }
        }, TWITCH_DELAY_SECONDS * 1000);
        controlTimeouts.set('speed', timeoutId);
    }

    async function handleVideoChange(newVideoId) {
        if (!newVideoId) return;

        currentVideoId = newVideoId;
        clearAllControlTimeouts();
        await refreshVideoDetails(newVideoId);

        const videoConfig = {
            videoId: newVideoId,
            startSeconds: sessionData?.currentTime || 0
        };

        if (playerOriginal && typeof playerOriginal.cueVideoById === 'function' && isPlayerReady) {
            playerOriginal.cueVideoById(videoConfig);
            pendingVideoUpdate = null;
        } else {
            pendingVideoUpdate = videoConfig;
        }

        delayedPlaybackRate(sessionData?.playbackRate ?? 1);

        progress = 0;
        currentTimeDisplay = formatTime(videoConfig.startSeconds) + " / 0:00";
    }

    function syncWithSession() {
        if (!playerOriginal || !sessionData) return;

        const currentTime = playerOriginal.getCurrentTime();
        const sessionTime = sessionData.currentTime || 0;
        const timeDiff = Math.abs(currentTime - sessionTime);

        // Only sync if there's a significant time difference (more than 1 second)
        if (timeDiff > 1) {
            delayedSeek(sessionTime);
        }

        // Sync volume with delay
        if (sessionData.volume !== undefined) {
            delayedVolume(sessionData.volume);
        }

        if (sessionData.playbackRate !== undefined) {
            delayedPlaybackRate(sessionData.playbackRate);
        }

        // Sync play/pause state with delay
        if (sessionData.state === SESSION_STATES.PLAYING && playerOriginal.getPlayerState() !== YT.PlayerState.PLAYING) {
            delayedPlay();
        } else if (sessionData.state === SESSION_STATES.PAUSED && playerOriginal.getPlayerState() === YT.PlayerState.PLAYING) {
            delayedPause();
        }
    }

    function updateSeekBar() {
        if (!playerOriginal) return;
        
        const duration = playerOriginal.getDuration();
        const currentTime = playerOriginal.getCurrentTime();

        progress = (currentTime / duration) * 100;
        currentTimeDisplay = formatTime(currentTime) + " / " + formatTime(duration);

        requestAnimationFrame(updateSeekBar);
    }

    function formatTime(time) {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
    }

    async function initializeSession() {
        try {
            // Get session data
            sessionData = await getSessionData(sessionId);
            
            if (!sessionData) {
                errorMessage = 'Session not found or has expired.';
                return;
            }

            // Generate viewer ID and join session
            viewerId = generateViewerId();
            await joinSharedSession(sessionId, viewerId, 'Anonymous Viewer');
            
            // Track current video and load initial metadata
            currentVideoId = sessionData.originalVideoId;
            await refreshVideoDetails(currentVideoId);

            isConnected = true;

            // Start listening to session changes
            unsubscribe = listenToSession(sessionId, async (newSessionData) => {
                const previousVideoId = currentVideoId;
                sessionData = newSessionData;

                if (sessionData?.originalVideoId && sessionData.originalVideoId !== previousVideoId) {
                    await handleVideoChange(sessionData.originalVideoId);
                }
                if (isPlayerReady) {
                    syncWithSession();
                }
            });

        } catch (error) {
            console.error('Error initializing session:', error);
            errorMessage = 'Failed to connect to session. Please check the URL and try again.';
        }
    }

    onMount(async () => {
        // Load YouTube API
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("div")[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        // Wait for YouTube API to load, then initialize
        setTimeout(async () => {
            await initializeSession();
            if (isConnected) {
                loadYoutubePlayer();
                updateSeekBar();
            }
        }, 1000);
    });

    onDestroy(async () => {
        // Clear all pending timeouts
        clearAllControlTimeouts();
        
        // Leave session when component is destroyed
        if (viewerId && sessionId) {
            try {
                await leaveSharedSession(sessionId, viewerId);
            } catch (error) {
                console.error('Error leaving session:', error);
            }
        }
        
        // Unsubscribe from session updates
        if (unsubscribe) {
            unsubscribe();
        }
    });
</script>

<svelte:head>
    <title>Watching: {originalVideoTitle || 'Shared Reaction'}</title>
</svelte:head>

<div class="website-inner-container">
    {#if errorMessage}
        <div class="flex items-center justify-center h-screen">
            <div class="text-center">
                <h1 class="text-2xl font-bold text-red-600 mb-4">Connection Error</h1>
                <p class="text-gray-600 mb-4">{errorMessage}</p>
                <a href="/" class="text-blue-600 hover:underline">Return to Home</a>
            </div>
        </div>
    {:else if !isConnected}
        <div class="flex items-center justify-center h-screen">
            <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h1 class="text-xl font-semibold mb-2">Connecting to Session...</h1>
                <p class="text-gray-600">Please wait while we connect you to the shared reaction.</p>
            </div>
        </div>
    {:else}
        <div class="space-y-4">
            <!-- Session Info -->
            <div class="bg-blue-50 p-4 rounded-lg">
                <h1 class="text-xl font-bold text-blue-800">Watching Shared Reaction</h1>
                <p class="text-blue-600">
                    <strong>Video:</strong> {originalVideoTitle} by {originalVideoAuthor}
                </p>
                <p class="text-sm text-blue-500">
                    You're watching a live reaction session. The video will sync with the reactor's controls.
                </p>
            </div>
            <div class="flex gap-4">
                <iframe
                    title="Twitch Player"
                    src="https://player.twitch.tv/?channel=animy_tr&parent=localhost"
                    height="480"
                    width="720"
                    allowfullscreen>
                </iframe>
                <!-- Video Player -->
                <div class="w-full">
                    <div id="player-viewer" class="w-full h-96 mb-4"></div>
                </div>
                <iframe
                    title="Twitch Chat"
                    src="https://www.twitch.tv/embed/animy_tr/chat?parent=localhost"
                    height="500"
                    width="350">
                </iframe>
            </div>

                

            <!-- Instructions -->
            <div class="bg-yellow-50 p-4 rounded-lg">
                <h3 class="font-semibold text-yellow-800 mb-2">How it works</h3>
                <ul class="text-sm text-yellow-700 space-y-1">
                    <li>• The video will automatically sync with the reactor's controls</li>
                    <li>• You cannot control the video - only watch</li>
                    <li>• The session will end when the reactor finishes or leaves</li>
                    <li>• Refresh the page if the video stops syncing</li>
                </ul>
            </div>

            <!-- Debug Panel -->
            {#if debugMode}

                <!-- Twitch Delay Indicator -->
                <div class="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <div class="text-xs text-yellow-700">
                        <strong>Twitch Delay:</strong> {TWITCH_DELAY_SECONDS}s - Video controls are delayed to sync with Twitch stream
                    </div>
                </div>

            <!-- Session Status -->
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h3 class="font-semibold mb-2">Session Status</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span class="font-medium">Status:</span> 
                            <span class="ml-2 px-2 py-1 rounded text-xs {
                                sessionData?.state === SESSION_STATES.PLAYING ? 'bg-green-100 text-green-800' :
                                sessionData?.state === SESSION_STATES.PAUSED ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                            }">
                                {sessionData?.state || 'Unknown'}
                            </span>
                        </div>
                        <div>
                            <span class="font-medium">Viewers:</span> 
                            <span class="ml-2">{Object.keys(sessionData?.viewers || {}).length}</span>
                        </div>
                    </div>
                </div>
                <div class="debug-panel bg-gray-100 p-4 rounded text-sm">
                    <h3 class="font-bold">Debug Info (Viewer):</h3>
                    <p>Session ID: {sessionId}</p>
                    <p>Viewer ID: {viewerId || 'Not set'}</p>
                    <p>Player Ready: {isPlayerReady ? 'Yes' : 'No'}</p>
                    <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
                    <p>Current Time: {playerOriginal ? playerOriginal.getCurrentTime()?.toFixed(2) : 'N/A'}s</p>
                    <p>Session State: {sessionData?.state || 'Unknown'}</p>
                    <p>Session Time: {sessionData?.currentTime || 'N/A'}s</p>
                    <p>Session Volume: {sessionData?.volume || 'N/A'}%</p>
                    <p>Session Playback Rate: {sessionData?.playbackRate || 'N/A'}x</p>
                    <p>Pending Timeouts: {controlTimeouts.size}</p>
                    
                    <div class="mt-2">
                        <h4 class="font-semibold">Active Timeouts:</h4>
                        {#each Array.from(controlTimeouts.keys()) as controlType}
                            <div>• {controlType}</div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>
