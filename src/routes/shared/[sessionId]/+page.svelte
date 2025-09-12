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
    let progress = 0;
    let currentTimeDisplay = "0:00 / 0:00";
    let isConnected = false;
    let errorMessage = '';
    let viewerId = null;
    let originalVideoTitle = '';
    let originalVideoAuthor = '';
    let isPlayerReady = false;
    let unsubscribe = null;

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

    function loadYoutubePlayer() {
        if (!sessionData?.originalVideoId) return;
        
        playerOriginal = new YT.Player("player-viewer", {
            videoId: sessionData.originalVideoId,
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
        
        // Sync with current session state
        if (sessionData) {
            syncWithSession();
        }
    }

    function onPlayerStateChange(event) {
        // Don't sync viewer state changes back to session
        // Only the reactor controls the session
    }

    function syncWithSession() {
        if (!playerOriginal || !sessionData) return;

        const currentTime = playerOriginal.getCurrentTime();
        const sessionTime = sessionData.currentTime || 0;
        const timeDiff = Math.abs(currentTime - sessionTime);

        // Only sync if there's a significant time difference (more than 1 second)
        if (timeDiff > 1) {
            playerOriginal.seekTo(sessionTime, true);
        }

        // Sync volume
        if (sessionData.volume !== undefined) {
            playerOriginal.setVolume(sessionData.volume);
        }

        // Sync play/pause state
        if (sessionData.state === SESSION_STATES.PLAYING && playerOriginal.getPlayerState() !== YT.PlayerState.PLAYING) {
            playerOriginal.playVideo();
        } else if (sessionData.state === SESSION_STATES.PAUSED && playerOriginal.getPlayerState() === YT.PlayerState.PLAYING) {
            playerOriginal.pauseVideo();
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
            
            // Get video details
            const { videoAuthor, videoTitle } = await downloadBasicVideoDetails(sessionData.originalVideoId);
            originalVideoAuthor = videoAuthor;
            originalVideoTitle = videoTitle;

            isConnected = true;

            // Start listening to session changes
            unsubscribe = listenToSession(sessionId, (newSessionData) => {
                sessionData = newSessionData;
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
                    class="w-3/12"
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
        </div>
    {/if}
</div>
