<script>
    /* global YT */
    import { onMount, onDestroy } from 'svelte';
    import { signInAnonymously } from 'firebase/auth';
    import { page } from '$app/stores';
    import { goToRoute } from '$lib/helpers/routing';
    import { auth } from '$lib/constants/firebase';
    import {
        getSessionData,
        listenToSession,
        joinSharedSession,
        leaveSharedSession,
        SESSION_STATES
    } from '$lib/helpers/sharedSession';
    import { fetchOriginalVideoMetadata } from '$lib/helpers/originalVideo';
    import { UsersSolid, ArrowLeftOutline } from 'flowbite-svelte-icons';

    let sessionId = $page.params.sessionId;
    let sessionData = null;
    let playerOriginal = null;
    let currentVideoId = null;
    let pendingVideoUpdate = null;
    let isConnected = false;
    let errorMessage = '';
    let viewerId = null;
    let originalVideoTitle = '';
    let originalVideoAuthor = '';
    let isPlayerReady = false;
    let isBuffering = false;
    let unsubscribe = null;
    let isLeaving = false;

    let debugMode = $page.url.searchParams.get('debug') === 'true';

    const TWITCH_DELAY_SECONDS = 6;
    let controlTimeouts = new Map();

    const playerOptions = {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        enablejsapi: 1,
        rel: 0
    };

    async function ensureViewerAuth() {
        if (auth.currentUser) {
            return auth.currentUser;
        }

        const credentials = await signInAnonymously(auth);
        return credentials.user;
    }

    function clearAllControlTimeouts() {
        controlTimeouts.forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        controlTimeouts = new Map();
    }

    function clearControlTimeout(controlType) {
        if (controlTimeouts.has(controlType)) {
            clearTimeout(controlTimeouts.get(controlType));
            controlTimeouts.delete(controlType);
            controlTimeouts = new Map(controlTimeouts);
        }
    }

    async function refreshVideoDetails(videoId) {
        if (!videoId) {
            originalVideoAuthor = '';
            originalVideoTitle = '';
            return;
        }

        try {
            const metadata = await fetchOriginalVideoMetadata({
                platform: sessionData?.originalVideoPlatform,
                videoId,
                videoUrl: sessionData?.originalVideoUrl,
            });
            originalVideoAuthor = metadata.author || '';
            originalVideoTitle = metadata.title || '';
        } catch (error) {
            console.error('Failed to download video details:', error);
            originalVideoAuthor = '';
            originalVideoTitle = '';
        }
    }

    function loadYoutubePlayer() {
        const videoIdToLoad = currentVideoId || sessionData?.originalVideoId;
        if (!videoIdToLoad) return;

        playerOriginal = new YT.Player('player-viewer', {
            videoId: videoIdToLoad,
            playerVars: playerOptions,
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange
            }
        });
    }

    function onPlayerReady() {
        console.log('Viewer player ready');
        isPlayerReady = true;

        if (pendingVideoUpdate && typeof playerOriginal?.cueVideoById === 'function') {
            playerOriginal.cueVideoById(pendingVideoUpdate);
            pendingVideoUpdate = null;
        }

        if (sessionData) {
            syncWithSession();
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
        // Playback is host-controlled; viewers stay passive.
    }

    function delayedPlay() {
        clearControlTimeout('play');
        const timeoutId = setTimeout(() => {
            playerOriginal?.playVideo();
        }, TWITCH_DELAY_SECONDS * 1000);
        controlTimeouts.set('play', timeoutId);
        controlTimeouts = new Map(controlTimeouts);
    }

    function delayedPause() {
        clearControlTimeout('pause');
        const timeoutId = setTimeout(() => {
            playerOriginal?.pauseVideo();
        }, TWITCH_DELAY_SECONDS * 1000);
        controlTimeouts.set('pause', timeoutId);
        controlTimeouts = new Map(controlTimeouts);
    }

    function delayedSeek(time) {
        clearControlTimeout('seek');
        const timeoutId = setTimeout(() => {
            playerOriginal?.seekTo(time, true);
        }, TWITCH_DELAY_SECONDS * 1000);
        controlTimeouts.set('seek', timeoutId);
        controlTimeouts = new Map(controlTimeouts);
    }

    function delayedVolume(volume) {
        clearControlTimeout('volume');
        const timeoutId = setTimeout(() => {
            playerOriginal?.setVolume(volume);
        }, TWITCH_DELAY_SECONDS * 1000);
        controlTimeouts.set('volume', timeoutId);
        controlTimeouts = new Map(controlTimeouts);
    }

    function delayedPlaybackRate(rate) {
        clearControlTimeout('speed');
        const timeoutId = setTimeout(() => {
            if (playerOriginal && typeof playerOriginal.setPlaybackRate === 'function') {
                playerOriginal.setPlaybackRate(rate);
            }
        }, TWITCH_DELAY_SECONDS * 1000);
        controlTimeouts.set('speed', timeoutId);
        controlTimeouts = new Map(controlTimeouts);
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
    }

    function syncWithSession() {
        if (!playerOriginal || !sessionData) return;

        const currentTime = playerOriginal.getCurrentTime();
        const sessionTime = sessionData.currentTime || 0;
        const timeDiff = Math.abs(currentTime - sessionTime);

        if (timeDiff > 1) {
            delayedSeek(sessionTime);
        }

        if (sessionData.volume !== undefined) {
            delayedVolume(sessionData.volume);
        }

        if (sessionData.playbackRate !== undefined) {
            delayedPlaybackRate(sessionData.playbackRate);
        }

        const currentState = playerOriginal.getPlayerState();
        if (sessionData.state === SESSION_STATES.PLAYING && currentState !== YT.PlayerState.PLAYING) {
            delayedPlay();
        } else if (sessionData.state === SESSION_STATES.PAUSED && currentState === YT.PlayerState.PLAYING) {
            delayedPause();
        }
    }

    async function initializeSession() {
        try {
            sessionData = await getSessionData(sessionId);

            if (!sessionData) {
                errorMessage = 'Session not found or has expired.';
                return;
            }

            const viewerUser = await ensureViewerAuth();
            viewerId = viewerUser.uid;
            await joinSharedSession(sessionId, viewerId, 'Anonymous Viewer');

            currentVideoId = sessionData.originalVideoId;
            await refreshVideoDetails(currentVideoId);

            isConnected = true;

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
            errorMessage = 'Failed to connect to session. Please check the link and try again.';
        }
    }

    async function leaveSession() {
        if (isLeaving) return;
        isLeaving = true;

        try {
            clearAllControlTimeouts();
            if (viewerId && sessionId) {
                await leaveSharedSession(sessionId, viewerId);
            }
        } catch (error) {
            console.error('Error leaving session:', error);
        } finally {
            goToRoute('/');
        }
    }

    onMount(async () => {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';

        const firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag?.parentNode) {
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
            document.head.appendChild(tag);
        }

        setTimeout(async () => {
            await initializeSession();
            if (isConnected) {
                loadYoutubePlayer();
            }
        }, 1000);
    });

    onDestroy(async () => {
        clearAllControlTimeouts();

        if (viewerId && sessionId) {
            try {
                await leaveSharedSession(sessionId, viewerId);
            } catch (error) {
                console.error('Error leaving session:', error);
            }
        }

        if (unsubscribe) {
            unsubscribe();
        }
    });

    $: viewerCount = sessionData?.viewers ? Object.keys(sessionData.viewers).length : 0;
    $: viewerLabel = viewerCount === 1 ? 'viewer' : 'viewers';
    $: connectionTheme = (() => {
        if (errorMessage) {
            return {
                label: 'Disconnected',
                badge: 'border-rose-500/50 bg-rose-500/10 text-rose-200',
                dot: 'bg-rose-400'
            };
        }
        if (!isConnected) {
            return {
                label: 'Connecting…',
                badge: 'border-slate-800 bg-slate-900/60 text-slate-300',
                dot: 'bg-slate-500 animate-pulse'
            };
        }
        if (sessionData?.state === SESSION_STATES.PLAYING) {
            return {
                label: 'Live',
                badge: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-100',
                dot: 'bg-emerald-400'
            };
        }
        if (sessionData?.state === SESSION_STATES.PAUSED) {
            return {
                label: 'Paused',
                badge: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
                dot: 'bg-amber-400'
            };
        }
        return {
            label: 'Ready',
            badge: 'border-blue-500/40 bg-blue-500/10 text-blue-100',
            dot: 'bg-blue-300'
        };
    })();
</script>

<svelte:head>
    <title>Watching: {originalVideoTitle || 'Shared Reaction'}</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-100">
    <div class="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-10 lg:py-14">
        {#if errorMessage}
            <div class="flex flex-1 items-center justify-center">
                <div class="max-w-lg rounded-3xl border border-rose-500/20 bg-rose-500/5 p-10 text-center shadow-[0_30px_80px_-60px_rgba(244,63,94,0.9)]">
                    <h1 class="text-2xl font-semibold text-white">Connection error</h1>
                    <p class="mt-3 text-sm text-rose-200/80">{errorMessage}</p>
                    <button
                        type="button"
                        class="mt-6 inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-5 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        on:click={() => goToRoute('/')}
                    >
                        <ArrowLeftOutline class="h-4 w-4" />
                        <span>Return home</span>
                    </button>
                </div>
            </div>
        {:else}
            <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-wait disabled:border-slate-800 disabled:text-slate-500"
                    on:click={leaveSession}
                    disabled={isLeaving}
                >
                    <ArrowLeftOutline class="h-4 w-4" />
                    <span>{isLeaving ? 'Leaving…' : 'Leave session'}</span>
                </button>

                <div class="flex items-center gap-3 text-sm">
                    <div class="inline-flex items-center gap-1.5 rounded-full bg-slate-900/60 px-3 py-1 text-xs text-slate-400">
                        <UsersSolid class="h-3.5 w-3.5 text-slate-500" />
                        <span>{viewerCount} {viewerLabel}</span>
                    </div>
                    <div class={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${connectionTheme.badge}`}>
                        <span class={`h-2 w-2 rounded-full ${connectionTheme.dot}`}></span>
                        <span>{connectionTheme.label}</span>
                    </div>
                </div>
            </header>

            {#if !isConnected}
                <div class="mt-24 flex flex-1 items-center justify-center">
                    <div class="flex flex-col items-center gap-4 rounded-3xl border border-slate-900/60 bg-slate-900/40 px-10 py-12 text-center shadow-[0_35px_80px_-60px_rgba(15,23,42,1)]">
                        <div class="h-12 w-12 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400"></div>
                        <h1 class="text-xl font-semibold text-white">Connecting to session…</h1>
                        <p class="max-w-sm text-sm text-slate-400">Inside a moment the playback will sync with the reactor. Keep the tab open and we’ll take care of the timing.</p>
                    </div>
                </div>
            {:else}
                <main class="mt-10 grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <section class="flex flex-col overflow-hidden rounded-3xl border border-slate-900/60 bg-slate-900/50 shadow-[0_45px_90px_-70px_rgba(15,23,42,1)]">
                        <div class="flex items-center justify-between border-b border-slate-900/60 px-6 py-4">
                            <div>
                                <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Livestream</p>
                                <h2 class="text-lg font-semibold text-white">Twitch broadcast</h2>
                            </div>
                            <span class="rounded-full bg-slate-950/60 px-3 py-1 text-xs text-slate-400">~{TWITCH_DELAY_SECONDS}s offset</span>
                        </div>
                        <div class="relative aspect-video w-full bg-black">
                            <iframe
                                title="Twitch Player"
                                src="https://player.twitch.tv/?channel=animy_tr&parent=localhost"
                                allowfullscreen
                                loading="lazy"
                                class="h-full w-full border-0"
                            ></iframe>
                        </div>
                        <div class="hidden border-t border-slate-900/60 lg:block">
                            <iframe
                                title="Twitch Chat"
                                src="https://www.twitch.tv/embed/animy_tr/chat?parent=localhost"
                                loading="lazy"
                                class="h-64 w-full border-0"
                            ></iframe>
                        </div>
                    </section>

                    <aside class="flex flex-col gap-6">
                        <div class="overflow-hidden rounded-3xl border border-slate-900/60 bg-slate-900/50 shadow-[0_45px_90px_-70px_rgba(15,23,42,1)]">
                            <div class="flex flex-col gap-1 border-b border-slate-900/60 px-6 py-4">
                                <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Synced video</p>
                                <h2 class="text-lg font-semibold text-white">{originalVideoTitle || 'Loading video…'}</h2>
                                {#if originalVideoAuthor}
                                    <p class="text-sm text-slate-400">by {originalVideoAuthor}</p>
                                {/if}
                            </div>
                            <div class="relative aspect-video w-full bg-black" aria-busy={isBuffering}>
                                {#if isBuffering}
                                    <div class="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400/70 via-blue-200/40 to-blue-400/70 animate-pulse"></div>
                                {/if}
                                <div id="player-viewer" class="h-full w-full"></div>
                            </div>
                        </div>

                        <div class="rounded-3xl border border-slate-900/60 bg-slate-900/40 p-6 text-sm text-slate-300 shadow-[0_35px_70px_-60px_rgba(15,23,42,1)]">
                            <h3 class="text-base font-semibold text-white">What to expect</h3>
                            <p class="mt-2 text-slate-400">
                                Playback follows the reactor with a gentle ~{TWITCH_DELAY_SECONDS}-second cushion so what you see lines up with the live stream.
                            </p>
                        </div>

                        <div class="rounded-3xl border border-slate-900/60 bg-slate-900/40 p-6 text-sm text-slate-300 shadow-[0_35px_70px_-60px_rgba(15,23,42,1)]">
                            <h3 class="text-base font-semibold text-white">Viewing tips</h3>
                            <ul class="mt-3 space-y-2 text-slate-400">
                                <li class="flex items-start gap-2">
                                    <span class="mt-1 h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                                    <span>Stay in this tab to keep your playback aligned with the host.</span>
                                </li>
                                <li class="flex items-start gap-2">
                                    <span class="mt-1 h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                                    <span>The host controls play, pause and scrubbing. Sit back and enjoy.</span>
                                </li>
                                <li class="flex items-start gap-2">
                                    <span class="mt-1 h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                                    <span>If the video drifts, a quick refresh restores sync in seconds.</span>
                                </li>
                            </ul>
                        </div>
                    </aside>
                </main>
            {/if}

            {#if debugMode}
                <section class="mt-10 rounded-3xl border border-slate-900/60 bg-slate-900/40 p-6 text-sm text-slate-300 shadow-[0_35px_70px_-60px_rgba(15,23,42,1)]">
                    <h3 class="text-base font-semibold text-white">Debug info</h3>
                    <div class="mt-3 grid gap-3 sm:grid-cols-2">
                        <div class="space-y-1">
                            <p><span class="text-slate-500">Session ID:</span> {sessionId}</p>
                            <p><span class="text-slate-500">Viewer ID:</span> {viewerId || 'Not set'}</p>
                            <p><span class="text-slate-500">Connected:</span> {isConnected ? 'Yes' : 'No'}</p>
                            <p><span class="text-slate-500">Player ready:</span> {isPlayerReady ? 'Yes' : 'No'}</p>
                        </div>
                        <div class="space-y-1">
                            <p><span class="text-slate-500">Session state:</span> {sessionData?.state || 'Unknown'}</p>
                            <p><span class="text-slate-500">Session time:</span> {sessionData?.currentTime || 'N/A'}s</p>
                            <p><span class="text-slate-500">Volume:</span> {sessionData?.volume ?? 'N/A'}%</p>
                            <p><span class="text-slate-500">Playback rate:</span> {sessionData?.playbackRate ?? 'N/A'}x</p>
                        </div>
                    </div>
                    <div class="mt-4">
                        <h4 class="font-semibold text-white/90">Active timeouts</h4>
                        {#if controlTimeouts.size === 0}
                            <p class="text-slate-500">None</p>
                        {:else}
                            <ul class="mt-2 space-y-1 text-slate-400">
                                {#each Array.from(controlTimeouts.keys()) as controlType}
                                    <li>• {controlType}</li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                </section>
            {/if}
        {/if}
    </div>
</div>
