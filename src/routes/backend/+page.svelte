<script>
    /* global YT */
    import Recorder from "$lib/components/Recorder.svelte";
    import { onDestroy, onMount, tick } from "svelte";
    import {
        createReactionDocument,
        updateFirebaseDocument,
        createPlaylistDocument,
        addToPlaylistDocument
    } from "$lib/helpers/firebase";
    import { handlePrivateRoute, goToRoute } from "$lib/helpers/routing";
    import { isMobileDevice } from '$lib/helpers/system';
    import { getCompensatedReactionTime } from '$lib/helpers/reaction';
    import PlaylistQueue from "$lib/components/Video/PlaylistQueue.svelte";
    import { isLoggedIn } from '$lib/stores/user';
    import { page } from '$app/stores';
    import { get } from 'svelte/store';
    import { afterNavigate } from '$app/navigation';
    import { Progressbar, Modal } from 'flowbite-svelte';
    import {
        BullhornSolid,
        PauseSolid,
        PlaySolid,
        VideoSolid,
        DownloadSolid,
        UsersSolid
    } from 'flowbite-svelte-icons';
    import { sineOut } from 'svelte/easing';
    import { downloadBasicVideoDetails, fetchFirstPlaylistVideos } from '$lib/helpers/youtube';
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
    const playbackRateConfigs = new Map();
    let originalVideoId = '';
    let playlistId = '';
    let playlistBufferTime = '';
    let playlistItems = [];
    let showRecorder = false;
    let currentPlaylistDocumentId = '';
    let playlistElements;
    let sharedSessionId = '';

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

    const stageSequence = [
        {
            id: 'setup',
            title: 'Setup',
            description: 'Prep your camera, playlist and session links.'
        },
        {
            id: 'record',
            title: 'Record',
            description: 'Capture reactions while keeping playback in sync.'
        },
        {
            id: 'review',
            title: 'Review',
            description: 'Wrap up and push the reaction to the editor.'
        }
    ];

    const mapButtonStateToStageIndex = (state) => {
        switch (state) {
            case BUTTON_GROUP_STATES.INITIAL:
            case BUTTON_GROUP_STATES.READY:
                return 0;
            case BUTTON_GROUP_STATES.RECORDING:
            case BUTTON_GROUP_STATES.PAUSED:
                return 1;
            case BUTTON_GROUP_STATES.FINALISED:
                return 2;
            default:
                return 0;
        }
    };

    let currentStageIndex = 0;
    let stageProgress = stageSequence.map((stage, index) => ({
        ...stage,
        status: index === 0 ? 'active' : 'upcoming',
        displayIndex: String(index + 1).padStart(2, '0')
    }));
    let stageActions = [];

    let timer;
    let startTime;
    let playerOriginal;
    let isPlayerOriginalReady = false;
    let shouldStartWhenReady = false;
    let progress = 0;
    let startRecording = false;
    let stopRecording = false;
    let currentButtonGroupState = BUTTON_GROUP_STATES.INITIAL;
    let isPlaying = false;
    let reactionConfigsArray = [];
    let volumeConfigsArray = [];
    let playbackRateConfigsArray = [];
    let availablePlaybackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    let playbackRateIndex = availablePlaybackRates.indexOf(1) !== -1 ? availablePlaybackRates.indexOf(1) : 0;
    let playbackRate = availablePlaybackRates[playbackRateIndex] || 1;
    let pendingPlaybackRate = null;
    let isBuffering = false;
    
    // Debug mode
    let debugMode = false;

    // Navigation-aware derived params
    $: {
        const params = $page?.url?.searchParams;
        if (params) {
            const nextOriginalVideoId = params.get('id') || '';
            if (nextOriginalVideoId !== originalVideoId) {
                originalVideoId = nextOriginalVideoId;
                hasInitialisedBackend = false;
                autoStartedBufferVideoId = '';
            }
            const nextPlaylistId = params.get('playlist') || '';
            if (nextPlaylistId !== playlistId) {
                playlistId = nextPlaylistId;
                hasInitialisedBackend = false;
            }
            const nextPlaylistBufferTime = params.get('playlistBufferTime') || '';
            if (nextPlaylistBufferTime !== playlistBufferTime) {
                playlistBufferTime = nextPlaylistBufferTime;
                if (!nextPlaylistBufferTime) {
                    autoStartedBufferVideoId = '';
                }
            }
            showRecorder = params.has('record');
            const nextPlaylistDocumentId = params.get('playlistDocumentId') || '';
            if (nextPlaylistDocumentId !== currentPlaylistDocumentId) {
                currentPlaylistDocumentId = nextPlaylistDocumentId;
                hasInitialisedBackend = false;
            }
            const nextSharedSessionId = params.get('sharedSessionId') || '';
            if (nextSharedSessionId && nextSharedSessionId !== sharedSessionId) {
                sharedSessionId = nextSharedSessionId;
            }
            debugMode = params.get('debug') === 'true';
        }
    }
    
    // Shared session variables
    let shareUrl = '';
    $: if (sharedSessionId && typeof window !== 'undefined') {
        shareUrl = generateShareUrl(sharedSessionId);
    }
    let showShareModal = false;
    let viewerCount = 0;
    let viewerLabel = 'viewers';
    let sessionUnsubscribe = null;
    const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';
    const PLAYER_CONTAINER_ID = 'player-original';
    const PLAYER_CONTAINER_SELECTOR = '#player-original';
    let youtubeApiReadyPromise;
    let hasInitialisedBackend = false;
    let isInitialisingBackend = false;
    let lastInitialisedVideoId = '';
    let autoStartedBufferVideoId = '';
    let initialisationAbortController = null;
    let cleanupIntervalId;
    let afterNavigateUnsubscribe;
    let loginUnsubscribe;
    let isLoggedInSnapshot = false;
    let lastSubscribedSessionId = '';

    if (typeof window !== 'undefined') {
        afterNavigateUnsubscribe = afterNavigate(() => {
            triggerBackendInitialisation('after-navigate');
        });
    }

    $: currentStageIndex = mapButtonStateToStageIndex(currentButtonGroupState);

    $: stageProgress = stageSequence.map((stage, index) => ({
        ...stage,
        status: index < currentStageIndex ? 'complete' : index === currentStageIndex ? 'active' : 'upcoming',
        displayIndex: String(index + 1).padStart(2, '0')
    }));

    $: viewerLabel = viewerCount === 1 ? 'viewer' : 'viewers';

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

    $: if (!sharedSessionId && sessionUnsubscribe) {
        sessionUnsubscribe();
        sessionUnsubscribe = null;
    }

    $: if (sharedSessionId && sharedSessionId !== lastSubscribedSessionId) {
        lastSubscribedSessionId = sharedSessionId;
        subscribeToSession();
    }

    function loadYoutubePlayer(videoIdParam = originalVideoId) {
        if (!videoIdParam) {
            console.error('Cannot load YouTube player without a video id.');
            return;
        }
        console.log('Loading YouTube Player for video ID:', videoIdParam);
        isPlayerOriginalReady = false;
        playerOriginal = new YT.Player(PLAYER_CONTAINER_ID, {
            videoId: videoIdParam,
            playerVars: playerOptions,
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange,
                onError: (event) => {
                    console.error('YouTube Player Error:', event.data);
                }
            },
        });
    }

    async function loadPlaylist() {
        if (playlistId) {
            playlistItems = await fetchFirstPlaylistVideos(playlistId);
            playlistElements = playlistItems.map(item => item.snippet.resourceId.videoId);
        }
    }

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function waitForPlayerMountpoint(signal, { maxAttempts = 40, delayMs = 50 } = {}) {
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            if (signal?.aborted) {
                return false;
            }
            if (typeof document !== 'undefined' && document.querySelector(PLAYER_CONTAINER_SELECTOR)) {
                return true;
            }
            await tick();
            await wait(delayMs);
        }
        console.warn('YouTube player mountpoint not found after waiting.');
        return false;
    }

    function resetPlayer() {
        if (playerOriginal?.destroy) {
            try {
                playerOriginal.destroy();
            } catch (error) {
                console.warn('Failed to destroy YouTube player instance', error);
            }
        }
        playerOriginal = null;
        isPlayerOriginalReady = false;
        isPlaying = false;
        shouldStartWhenReady = false;
    }

    async function initialiseBackend(videoId, reason = 'unknown') {
        if (!videoId || isInitialisingBackend) {
            return;
        }
        initialisationAbortController?.abort();
        const controller = new AbortController();
        initialisationAbortController = controller;
        isInitialisingBackend = true;
        try {
            injectYoutubeIframeApiScript();
            await waitForYoutubeIframeApiReady();
            if (controller.signal.aborted) {
                return;
            }
            const mountReady = await waitForPlayerMountpoint(controller.signal);
            if (!mountReady || controller.signal.aborted) {
                return;
            }
            resetPlayer();
            loadYoutubePlayer(videoId);
            await loadPlaylist();
            if (controller.signal.aborted) {
                return;
            }
            await getBasicDetailsOriginal();
            if (controller.signal.aborted) {
                return;
            }
            if (playlistBufferTime && autoStartedBufferVideoId !== videoId) {
                await onClickStartReaction();
                autoStartedBufferVideoId = videoId;
            }
            if (sharedSessionId) {
                shareUrl = generateShareUrl(sharedSessionId);
                subscribeToSession();
            }
            hasInitialisedBackend = true;
            lastInitialisedVideoId = videoId;
        } catch (error) {
            if (!controller.signal.aborted) {
                console.error('Failed to initialise backend recorder flow', error, { reason });
            }
        } finally {
            if (initialisationAbortController === controller) {
                initialisationAbortController = null;
            }
            isInitialisingBackend = false;
        }
    }

    function triggerBackendInitialisation(reason = 'direct') {
        if (!isLoggedInSnapshot || !originalVideoId) {
            return;
        }
        if (isInitialisingBackend) {
            return;
        }
        if (hasInitialisedBackend && lastInitialisedVideoId === originalVideoId) {
            return;
        }
        initialiseBackend(originalVideoId, reason);
    }

    function injectYoutubeIframeApiScript() {
        if (typeof document === 'undefined') {
            return;
        }
        const existingScript = document.querySelector(`script[src="${YOUTUBE_IFRAME_API_SRC}"]`);
        if (existingScript) {
            return;
        }
        const tag = document.createElement('script');
        tag.src = YOUTUBE_IFRAME_API_SRC;
        const firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag?.parentNode) {
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
            document.head.appendChild(tag);
        }
    }

    function waitForYoutubeIframeApiReady() {
        if (typeof window === 'undefined') {
            return Promise.resolve();
        }

        if (window.YT && typeof window.YT.Player === 'function') {
            return Promise.resolve();
        }

        if (youtubeApiReadyPromise) {
            return youtubeApiReadyPromise;
        }

        youtubeApiReadyPromise = new Promise((resolve, reject) => {
            const previousCallback = window.onYouTubeIframeAPIReady;
            let intervalId;
            let timeoutId;

            const cleanup = () => {
                if (intervalId) {
                    clearInterval(intervalId);
                }
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                if (window.onYouTubeIframeAPIReady === handleReady) {
                    window.onYouTubeIframeAPIReady = previousCallback;
                }
            };

            const resolveReady = () => {
                cleanup();
                resolve();
            };

            const handleReady = () => {
                if (typeof previousCallback === 'function') {
                    previousCallback();
                }
                resolveReady();
            };

            window.onYouTubeIframeAPIReady = handleReady;

            intervalId = setInterval(() => {
                if (window.YT && typeof window.YT.Player === 'function') {
                    resolveReady();
                }
            }, 50);

            timeoutId = setTimeout(() => {
                cleanup();
                youtubeApiReadyPromise = null;
                reject(new Error('YouTube Iframe API failed to load.'));
            }, 10000);
        });

        return youtubeApiReadyPromise;
    }
    // 4. The API will call this function when the video player is ready.
    function onPlayerReady(event) {
        console.log("player ready");
        if (event?.target === playerOriginal) {
            const playerRates = typeof playerOriginal.getAvailablePlaybackRates === 'function'
                ? playerOriginal.getAvailablePlaybackRates()
                : availablePlaybackRates;
            availablePlaybackRates = Array.isArray(playerRates) && playerRates.length
                ? [...playerRates].sort((a, b) => a - b)
                : [1];

            const desiredRate = pendingPlaybackRate ?? playbackRate;
            const fallbackRate = availablePlaybackRates.includes(desiredRate)
                ? desiredRate
                : (availablePlaybackRates.includes(1) ? 1 : availablePlaybackRates[0]);
            playbackRateIndex = Math.max(availablePlaybackRates.indexOf(fallbackRate), 0);
            playbackRate = availablePlaybackRates[playbackRateIndex] ?? 1;

            applyPlaybackRate(playbackRate, { shouldLog: false, syncSession: false });
            pendingPlaybackRate = null;
            isPlayerOriginalReady = true;
            if (shouldStartWhenReady) {
                shouldStartWhenReady = false;
                startOriginalVideo();
            }

            // Update shared session with video duration and playback speed
            if (sharedSessionId) {
                updateSessionState(sharedSessionId, {
                    duration: playerOriginal.getDuration(),
                    playbackRate
                });
            }
        } else if (event?.target && typeof event.target.setPlaybackRate === 'function') {
            // Ensure auxiliary players (e.g., recorder preview) stay at real-time speed
            event.target.setPlaybackRate(1);
        }
    }
    function onPlayerStateChange(event) {
        if (event?.data === YT.PlayerState.BUFFERING) {
            isBuffering = true;
        } else if (
            event?.data === YT.PlayerState.PLAYING ||
            event?.data === YT.PlayerState.PAUSED ||
            event?.data === YT.PlayerState.CUED ||
            event?.data === YT.PlayerState.ENDED
        ) {
            isBuffering = false;
        }
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
        if (!playerOriginal || typeof playerOriginal.getDuration !== 'function') {
            return "0.00";
        }
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

    const formatPlaybackRate = (rate) => {
        const numeric = Number(rate ?? 1);
        return Math.abs(numeric - Math.round(numeric)) < 1e-3 ? numeric.toFixed(0) : numeric.toFixed(2);
    };

    function logPlaybackRateChange(newPlaybackRate) {
        if (startTime) {
            const parsedRate = Number(newPlaybackRate) || 1;
            const reactionVideoTime = getCompensatedReactionTime(startTime, playlistBufferTime || 0);
            playbackRateConfigs.set(reactionVideoTime, { rate: parsedRate });
            playbackRateConfigsArray = Array.from(playbackRateConfigs.entries());

            const playbackRateConfigsObject = Object.fromEntries(playbackRateConfigs);
            updateFirebaseDocument({
                "playbackRateConfigs": playbackRateConfigsObject
            });
        }
    }

    function applyPlaybackRate(rate, { shouldLog = false, syncSession = true } = {}) {
        const playerRates = typeof playerOriginal?.getAvailablePlaybackRates === 'function'
            ? playerOriginal.getAvailablePlaybackRates()
            : null;
        const normalizedRates = Array.isArray(playerRates) && playerRates.length
            ? [...playerRates].sort((a, b) => a - b)
            : (availablePlaybackRates.length ? [...availablePlaybackRates] : [1]);

        availablePlaybackRates = normalizedRates;

        let resolvedRate = rate;
        if (!normalizedRates.includes(rate)) {
            resolvedRate = normalizedRates.includes(1) ? 1 : normalizedRates[0];
        }

        const targetIndex = normalizedRates.indexOf(resolvedRate);
        playbackRateIndex = targetIndex >= 0 ? targetIndex : playbackRateIndex;
        playbackRate = resolvedRate;

        if (playerOriginal && typeof playerOriginal.setPlaybackRate === 'function') {
            playerOriginal.setPlaybackRate(resolvedRate);
            pendingPlaybackRate = null;
        } else {
            pendingPlaybackRate = resolvedRate;
        }

        if (shouldLog) {
            logPlaybackRateChange(resolvedRate);
        }

        if (syncSession && sharedSessionId) {
            updateSessionState(sharedSessionId, {
                playbackRate: resolvedRate
            });
        }
    }

    function updatePlaybackRateFromIndex(index, { userInitiated = false } = {}) {
        if (!Array.isArray(availablePlaybackRates) || availablePlaybackRates.length === 0) {
            availablePlaybackRates = [1];
        }
        const normalizedIndex = Math.round(index);
        const clampedIndex = Math.max(0, Math.min(normalizedIndex, availablePlaybackRates.length - 1));
        const selectedRate = availablePlaybackRates[clampedIndex] ?? 1;
        playbackRateIndex = clampedIndex;
        applyPlaybackRate(selectedRate, { shouldLog: userInitiated, syncSession: true });
    }

    function startOriginalVideo() {
        applyPlaybackRate(playbackRate, { shouldLog: false, syncSession: false });
        if (!playerOriginal || typeof playerOriginal.playVideo !== 'function') {
            shouldStartWhenReady = true;
            return false;
        }
        shouldStartWhenReady = false;
        playerOriginal.playVideo();
        isPlayerOriginalReady = true;
        isPlaying = true;
        currentButtonGroupState = BUTTON_GROUP_STATES.RECORDING;
        // Update shared session state
        if (sharedSessionId) {
            const currentTime = typeof playerOriginal.getCurrentTime === 'function'
                ? playerOriginal.getCurrentTime()
                : 0;
            updateSessionState(sharedSessionId, {
                state: SESSION_STATES.PLAYING,
                currentTime,
                playbackRate
            });
        }
        return true;
    }
    function pauseOriginalVideo() {
        if (!playerOriginal || typeof playerOriginal.pauseVideo !== 'function') {
            return;
        }
        playerOriginal.pauseVideo();
        // Update shared session state
        if (sharedSessionId) {
            const currentTime = typeof playerOriginal.getCurrentTime === 'function'
                ? playerOriginal.getCurrentTime()
                : 0;
            updateSessionState(sharedSessionId, {
                state: SESSION_STATES.PAUSED,
                currentTime,
                playbackRate
            });
        }
    }
    function updateSeekBar() {
        if (!playerOriginal || typeof playerOriginal.getDuration !== 'function' || typeof playerOriginal.getCurrentTime !== 'function') {
            return;
        }
        const duration = playerOriginal.getDuration();
        if (!duration) {
            requestAnimationFrame(updateSeekBar);
            return;
        }
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

        playbackRateConfigs.clear();
        playbackRateConfigsArray = [];
        
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
                    duration: 0,
                    playbackRate
                });
                console.log('Shared session updated for new playlist video:', sharedSessionId);
            }

            shareUrl = generateShareUrl(sharedSessionId);
            subscribeToSession();

            applyPlaybackRate(playbackRate, { shouldLog: false, syncSession: true });
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
        logPlaybackRateChange(playbackRate);
    };

    const onClickStartVideo = () => {
        const started = startOriginalVideo();
        if (!started) {
            console.warn('YouTube player not ready yet; playback will start once it loads.');
        }
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

        const isPlaylistFlow = Boolean(playlistId);
        const playlistHasItems = Array.isArray(playlistElements) && playlistElements.length > 0;
        const currentPlaylistIndex = isPlaylistFlow && playlistHasItems
            ? playlistElements.findIndex((item) => item === originalVideoId)
            : -1;
        const nextVideoId = currentPlaylistIndex !== -1 && currentPlaylistIndex < playlistElements.length - 1
            ? playlistElements[currentPlaylistIndex + 1]
            : undefined;

        // Always save reactionFinishTime for playlist flows
        if (isPlaylistFlow) {
            updateFirebaseDocument({
                "reactionFinishTime": reactionVideoTime,
            });
        }
        
        // Also persist array-based timelines for efficient playback
        try {
            const stateTimeline = Array.from(reactionConfigs.entries())
                .map(([t, v]) => ({ t: parseFloat(t), state: v.state, targetTime: parseFloat(v.time) }))
                .sort((a, b) => a.t - b.t);
            const volumeTimeline = Array.from(volumeConfigs.entries())
                .map(([t, v]) => ({ t: parseFloat(t), volume: v.volume }))
                .sort((a, b) => a.t - b.t);
            const playbackTimeline = Array.from(playbackRateConfigs.entries())
                .map(([t, v]) => ({ t: parseFloat(t), rate: Number(v.rate) || 1 }))
                .sort((a, b) => a.t - b.t);
            await updateFirebaseDocument({
                stateTimeline,
                volumeTimeline,
                playbackTimeline,
                // Remove legacy object-map formats now that arrays are saved
                reactionConfigs: null,
                volumeConfigs: null,
                playbackRateConfigs: null
            });
        } catch (e) {
            console.error('Failed to persist array timelines', e);
        }
        
        if (showRecorder) {
            stopRecording = true;
        }
        
        // Update shared session state
        if (sharedSessionId) {
            try {
                if (nextVideoId) {
                    await updateSessionState(sharedSessionId, {
                        state: SESSION_STATES.WAITING,
                        currentTime: 0,
                        playbackRate
                    });
                } else {
                    await updateSessionState(sharedSessionId, {
                        state: SESSION_STATES.ENDED,
                        playbackRate
                    });
                }
            } catch (error) {
                console.error('Failed to update shared session at finish:', error);
            }
        }
        
        // If there's a next video, navigate to it (regardless of playlistDocumentId)
        if (nextVideoId) {
            const nextRoute = `/backend?id=${nextVideoId}&playlist=${playlistId}&playlistDocumentId=${currentPlaylistDocumentId}&playlistBufferTime=${reactionVideoTime}` + (sharedSessionId ? `&sharedSessionId=${sharedSessionId}` : '');
            await goToRoute(nextRoute);
            location.reload();
            return;
        }
        
        // No next video - go to reaction configuration
        goToReactionConfiguration();
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
        if (!playerOriginal || typeof playerOriginal.getDuration !== 'function' || typeof playerOriginal.seekTo !== 'function') {
            return;
        }
        const seekTime = (progress / 100) * playerOriginal.getDuration();
        playerOriginal.seekTo(parseFloat(seekTime), true);
        
        // Update shared session with new time
        if (sharedSessionId) {
            updateSessionState(sharedSessionId, {
                currentTime: parseFloat(seekTime),
                playbackRate
            });
        }
    };

    $: stageActions = [
        {
            id: 'start-reaction',
            label: 'Start Reaction',
            description: 'Create your synced session and prep the recorder.',
            icon: VideoSolid,
            onClick: onClickStartReaction,
            disabled: currentButtonGroupState !== BUTTON_GROUP_STATES.INITIAL,
            tone: 'accent'
        },
        {
            id: 'start-video',
            label: 'Start Video',
            description: 'Kick off playback for everyone in the session.',
            icon: PlaySolid,
            onClick: onClickStartVideo,
            disabled: currentButtonGroupState !== BUTTON_GROUP_STATES.READY || !isPlayerOriginalReady
        },
        {
            id: 'focus-react',
            label: isFocusReactOn ? 'Release Focus' : 'Focus React',
            description: isFocusReactOn
                ? 'Restore the original track to full volume.'
                : 'Duck the original audio so the mic takes lead.',
            icon: BullhornSolid,
            onClick: onClickFocusReact,
            disabled: currentButtonGroupState !== BUTTON_GROUP_STATES.RECORDING,
            active: isFocusReactOn
        },
        {
            id: 'stop-video',
            label: 'Pause Video',
            description: 'Pause playback to regroup or add notes.',
            icon: PauseSolid,
            onClick: onClickStopVideo,
            disabled: currentButtonGroupState !== BUTTON_GROUP_STATES.RECORDING
        },
        {
            id: 'finish-reaction',
            label: 'Finish Reaction',
            description: 'Lock the timeline and move into review.',
            icon: DownloadSolid,
            onClick: onClickFinishReaction,
            disabled: currentButtonGroupState === BUTTON_GROUP_STATES.INITIAL || currentButtonGroupState === BUTTON_GROUP_STATES.FINALISED
        }
    ];

    onMount(() => {
        if (isMobileDevice()) {
            handlePrivateRoute();
        }

        isLoggedInSnapshot = get(isLoggedIn);
        if (isLoggedInSnapshot) {
            triggerBackendInitialisation('mount');
        }

        loginUnsubscribe = isLoggedIn.subscribe((value) => {
            const wasLoggedIn = isLoggedInSnapshot;
            isLoggedInSnapshot = value;
            if (value) {
                if (!wasLoggedIn) {
                    triggerBackendInitialisation('login');
                }
            } else {
                resetPlayer();
                hasInitialisedBackend = false;
                lastInitialisedVideoId = '';
            }
        });

        cleanupIntervalId = setInterval(cleanupInactiveSessions, 60 * 60 * 1000);
    });

    onDestroy(() => {
        loginUnsubscribe?.();
        loginUnsubscribe = undefined;
        afterNavigateUnsubscribe?.();
        afterNavigateUnsubscribe = undefined;
        if (cleanupIntervalId) {
            clearInterval(cleanupIntervalId);
            cleanupIntervalId = undefined;
        }
        initialisationAbortController?.abort();
        initialisationAbortController = null;
        if (sessionUnsubscribe) {
            sessionUnsubscribe();
            sessionUnsubscribe = null;
        }
        resetPlayer();
    });

    $: if (isLoggedInSnapshot && originalVideoId && !hasInitialisedBackend && !isInitialisingBackend) {
        triggerBackendInitialisation('reactive');
    }


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
    <div class="min-h-screen bg-slate-950 text-slate-100">
        <div class="mx-auto flex h-full max-w-6xl flex-col gap-6 px-4 py-8">
            <header class="space-y-6">
                <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div class="space-y-1">
                        <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Now Recording</p>
                        <h1 class="text-xl font-semibold text-white">
                            {originalVideoTitle ?? "Loading reaction details…"}
                        </h1>
                        <p class="text-xs uppercase tracking-[0.3em] text-slate-600">
                            {originalVideoAuthor ? `Original by ${originalVideoAuthor}` : ""}
                        </p>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-300 sm:flex">
                            <UsersSolid class="h-4 w-4 text-slate-400" />
                            <span>{viewerCount} {viewerLabel}</span>
                        </div>
                        <button
                            class="flex items-center gap-2 rounded-full border border-blue-500/50 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-400/70 disabled:border-slate-700 disabled:bg-slate-800/60 disabled:text-slate-500 disabled:focus:ring-0"
                            on:click={onClickShareSession}
                            disabled={!sharedSessionId}
                        >
                            <UsersSolid class="h-4 w-4" />
                            Share Session
                        </button>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-4">
                    {#each stageProgress as stage, idx}
                        <div class="flex items-center gap-4">
                            <div
                                class={`flex h-16 min-w-[12rem] items-center gap-3 rounded-2xl border px-4 transition ${
                                    stage.status === 'complete'
                                        ? 'border-emerald-500/80 bg-emerald-500/10 text-emerald-100'
                                        : stage.status === 'active'
                                        ? 'border-blue-500/80 bg-blue-500/10 text-blue-100'
                                        : 'border-slate-800 bg-slate-900/40 text-slate-400'
                                }`}
                            >
                                <span
                                    class={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                                        stage.status === 'complete'
                                            ? 'bg-emerald-500 text-slate-950'
                                            : stage.status === 'active'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-slate-800 text-slate-400'
                                    }`}
                                >
                                    {stage.displayIndex}
                                </span>
                                <div class="flex flex-col">
                                    <span class="text-sm font-semibold text-inherit">{stage.title}</span>
                                    <span class="text-xs text-slate-400">
                                        {stage.description}
                                    </span>
                                </div>
                            </div>
                            {#if idx < stageProgress.length - 1}
                                <span class="hidden h-px w-10 bg-slate-800 md:block"></span>
                            {/if}
                        </div>
                    {/each}
                </div>
            </header>

            <main class="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section class="flex flex-col gap-6">
                    <div class="overflow-hidden rounded-3xl border border-slate-900/60 bg-slate-900/60 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.8)]">
                        <div class="relative aspect-video w-full bg-black" aria-busy={isBuffering}>
                            {#if isBuffering}
                                <div class="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400/70 via-blue-200/40 to-blue-400/70 animate-pulse"></div>
                            {/if}
                            <div id="player-original" class="h-full w-full"></div>
                            <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent"></div>
                            <div class="pointer-events-none absolute bottom-5 left-6 flex items-center gap-3 text-sm font-mono text-slate-200">
                                <span class="text-xs uppercase tracking-[0.3em] text-slate-500">Timeline</span>
                                <span class="rounded-full bg-slate-950/60 px-3 py-1 text-base font-semibold text-white">
                                    {currentTimeDisplay}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        class="group relative overflow-hidden rounded-3xl border border-slate-900/60 bg-slate-900/40 px-6 py-5 text-left transition hover:border-slate-800 hover:bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                        on:click={onClickProgress}
                    >
                        <div class="flex items-baseline justify-between">
                            <span class="text-xs uppercase tracking-[0.3em] text-slate-500">Scrub</span>
                            <span class="font-mono text-sm text-slate-200">{currentTimeDisplay}</span>
                        </div>
                        <Progressbar
                            {progress}
                            animate
                            precision={2}
                            tweenDuration={400}
                            easing={sineOut}
                            size="h-2"
                            labelInsideClass="hidden"
                            class="mt-4"
                        />
                    </button>

                    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {#each stageActions as action}
                            <button
                                class={`flex h-full items-start gap-3 rounded-3xl border px-4 py-4 text-left transition focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-blue-500/60 ${
                                    action.active
                                        ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-100'
                                        : action.tone === 'accent'
                                        ? 'border-blue-500/60 bg-blue-500/10 text-blue-100'
                                        : 'border-slate-900/60 bg-slate-900/40 text-slate-200'
                                } disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/20 disabled:text-slate-500`}
                                on:click={action.onClick}
                                disabled={action.disabled}
                            >
                                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/60">
                                    <svelte:component
                                        this={action.icon}
                                        class={`h-4 w-4 ${
                                            action.active
                                                ? 'text-emerald-300'
                                                : action.tone === 'accent'
                                                ? 'text-blue-300'
                                                : 'text-slate-300'
                                        }`}
                                    />
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-sm font-semibold leading-tight text-inherit">{action.label}</span>
                                    <span class="mt-1 text-xs text-slate-400">{action.description}</span>
                                </div>
                            </button>
                        {/each}
                    </div>
                </section>

                <aside class="flex w-full flex-col gap-4">
                    <div class="rounded-3xl border border-slate-900/60 bg-slate-900/40 p-5">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Playback Rate</p>
                                <p class="text-sm font-semibold text-slate-100">{formatPlaybackRate(playbackRate)}x</p>
                            </div>
                            <span class="text-xs text-slate-500">
                                {formatPlaybackRate(availablePlaybackRates[0] ?? 1)}x – {formatPlaybackRate(availablePlaybackRates[availablePlaybackRates.length - 1] ?? 1)}x
                            </span>
                        </div>
                        <div class="mt-4 flex items-center gap-3">
                            <input
                                type="range"
                                min="0"
                                max={Math.max(availablePlaybackRates.length - 1, 0)}
                                step="1"
                                bind:value={playbackRateIndex}
                                on:input={() => updatePlaybackRateFromIndex(playbackRateIndex, { userInitiated: true })}
                                class="h-1 flex-1 appearance-none rounded-full bg-slate-800 accent-blue-500"
                                disabled={availablePlaybackRates.length <= 1}
                            />
                        </div>
                        <div class="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                            {#each availablePlaybackRates as rate, idx}
                                <span class={`rounded-full px-2 py-1 ${idx === playbackRateIndex ? 'bg-slate-800 text-slate-200' : ''}`}>
                                    {formatPlaybackRate(rate)}x
                                </span>
                            {/each}
                        </div>
                    </div>

                    {#if showRecorder}
                        <div class="rounded-3xl border border-slate-900/60 bg-slate-900/40 p-5">
                            <p class="mb-3 text-xs uppercase tracking-[0.3em] text-slate-500">Recorder</p>
                            <Recorder {startRecording} {stopRecording} />
                        </div>
                    {/if}

                    <div class="rounded-3xl border border-slate-900/60 bg-slate-900/40 p-5">
                        <p class="mb-3 text-xs uppercase tracking-[0.3em] text-slate-500">Upcoming Videos</p>
                        <PlaylistQueue
                            currentlyViewed={originalVideoId}
                            playlistId={playlistId}
                            playlistDocumentId={currentPlaylistDocumentId}
                            startTime={startTime}
                            playlistBufferTime={playlistBufferTime}
                        />
                    </div>

                    {#if debugMode && currentButtonGroupState !== BUTTON_GROUP_STATES.INITIAL}
                        <div class="rounded-3xl border border-slate-900/60 bg-slate-900/40 p-5 text-xs text-slate-300">
                            <div class="flex items-center justify-between">
                                <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Debug</p>
                                <span class="rounded-full bg-slate-950/60 px-2 py-1 font-mono text-[10px] text-slate-400">DEV</span>
                            </div>
                            <ul class="mt-3 space-y-1">
                                <li>Start Time: {startTime ? new Date(startTime).toISOString() : 'Not set'}</li>
                                <li>Playlist Buffer: {playlistBufferTime || 0}s</li>
                                <li>Reaction Configs: {reactionConfigsArray.length}</li>
                                <li>Volume Configs: {volumeConfigsArray.length}</li>
                                <li>Playback Rate Configs: {playbackRateConfigsArray.length}</li>
                                <li>Current State: {currentButtonGroupState}</li>
                            </ul>
                            <div class="mt-4 space-y-3">
                                <div>
                                    <p class="font-semibold text-slate-200">Recent State Changes</p>
                                    {#if reactionConfigsArray.length === 0}
                                        <p class="text-slate-500">No entries yet.</p>
                                    {:else}
                                        {#each reactionConfigsArray.slice(-5) as [time, config]}
                                            <p>R: {time} → {config.state} (orig: {config.time})</p>
                                        {/each}
                                    {/if}
                                </div>
                                <div>
                                    <p class="font-semibold text-slate-200">Recent Volume Changes</p>
                                    {#if volumeConfigsArray.length === 0}
                                        <p class="text-slate-500">No entries yet.</p>
                                    {:else}
                                        {#each volumeConfigsArray.slice(-5) as [time, config]}
                                            <p>V: {time} → {config.volume}</p>
                                        {/each}
                                    {/if}
                                </div>
                                <div>
                                    <p class="font-semibold text-slate-200">Recent Playback Speed</p>
                                    {#if playbackRateConfigsArray.length === 0}
                                        <p class="text-slate-500">No entries yet.</p>
                                    {:else}
                                        {#each playbackRateConfigsArray.slice(-5) as [time, config]}
                                            <p>S: {time} → {formatPlaybackRate(config.rate)}x</p>
                                        {/each}
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/if}
                </aside>
            </main>
        </div>
    </div>

    <Modal bind:open={showShareModal} title="Share Your Reaction Session">
        <div class="space-y-4 text-slate-200">
            <p class="text-sm text-slate-400">
                Share this link so collaborators can watch your reaction live. Playback stays in sync with your controls.
            </p>

            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <input
                    type="text"
                    value={shareUrl}
                    readonly
                    class="flex-1 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-2 font-mono text-sm text-slate-200"
                />
                <button
                    class="flex items-center justify-center rounded-full border border-blue-500/50 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-400/70"
                    on:click={copyShareUrl}
                >
                    Copy
                </button>
            </div>

            <div class="grid gap-2 text-xs text-slate-400">
                <p>👥 Viewers: {viewerCount}</p>
                <p>📹 Video: {originalVideoTitle}</p>
            </div>
        </div>
    </Modal>
{:else}
    {handlePrivateRoute()}
{/if}
