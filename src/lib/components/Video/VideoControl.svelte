<script>
        import { createEventDispatcher, onDestroy } from 'svelte';
        import {
            PauseSolid,
            PlaySolid,
            ClockOutline,
            ArrowsRepeatOutline,
            VideoSolid,
            ExpandSolid
        } from 'flowbite-svelte-icons';

        export let bothVideosStarted;
        export let isPlaylist;
        export let isPlaylistAutoPlay;
        export let showCinematicBars = false;
        export let isFullscreen = false;

        let isPlaying = true;
        let isInteracting = false;
        let isKeyboardFocus = false;
        let hideTimeout;
        let containerRef;
        const dispatch = createEventDispatcher();

        const buttonBase = 'inline-flex h-11 w-11 items-center justify-center rounded-full text-text-primary transition duration-subtle ease-cinematic hover:bg-elevated/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97]';
        const tooltipBase = 'pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-overlay px-xs py-[2px] text-[0.65rem] uppercase tracking-wide text-text-primary opacity-0 transition duration-subtle ease-cinematic';
        const glassBase = 'controls-glass transition-opacity duration-500 ease-cinematic';

        const clearHideTimeout = () => {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
            }
        };

        const scheduleHide = () => {
            clearHideTimeout();
            hideTimeout = setTimeout(() => {
                if (!isKeyboardFocus) {
                    isInteracting = false;
                }
            }, 2200);
        };

        const revealControls = () => {
            isInteracting = true;
            scheduleHide();
        };

        function handlePointerMove() {
            if (!bothVideosStarted) return;
            revealControls();
        }

        function handlePointerLeave() {
            if (!bothVideosStarted) return;
            scheduleHide();
        }

        function handleFocusIn() {
            isKeyboardFocus = true;
            revealControls();
        }

        function handleFocusOut() {
            requestAnimationFrame(() => {
                if (!containerRef?.contains(document.activeElement)) {
                    isKeyboardFocus = false;
                    if (bothVideosStarted) {
                        scheduleHide();
                    }
                }
            });
        }

        onDestroy(() => {
            clearHideTimeout();
        });

        function togglePlayState() {
            isPlaying = !isPlaying;
            dispatch('playStateChanged', { isPlaying });
        }
        function syncVideos() {
            dispatch('syncVideos');
        }
        function toggleAutoPlaylist() {
            dispatch('toggleAutoPlaylist');
        }
        function toggleBars() {
            dispatch('toggleBars');
        }
        function enterFullscreen() {
            dispatch('enterFullscreen');
        }

        function handleKeydown(event) {
            if (event.key === ' ') {
                event.preventDefault();
                togglePlayState();
            }
        }

        $: isVisible = !bothVideosStarted || isInteracting || isKeyboardFocus;
        $: glassClasses = `${glassBase} ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`;
    </script>

    <svelte:window on:keydown={handleKeydown} />

    <div
        bind:this={containerRef}
        class="control-shell relative flex w-full flex-col items-center gap-sm text-text-primary"
        role="region"
        aria-label="Playback control surface"
        on:mousemove={handlePointerMove}
        on:mouseleave={handlePointerLeave}
        on:mouseenter={handlePointerMove}
        on:touchstart={handlePointerMove}
        on:focusin={handleFocusIn}
        on:focusout={handleFocusOut}
    >
        {#if !bothVideosStarted}
            <p class="max-w-md rounded-md bg-overlay/80 px-md py-sm text-center text-sm text-text-secondary backdrop-blur">
                Tap or click each video once to sync playback, then use the controls here.
            </p>
        {:else}
            <div class={glassClasses} role="toolbar" aria-label="Reaction playback controls">
                <div class="group relative">
                    <button
                        type="button"
                        class={`${buttonBase} ${isPlaying ? 'bg-accent-primary text-background shadow-elevated' : 'bg-surface/80 shadow-surface'}`}
                        on:click={togglePlayState}
                        aria-label={isPlaying ? 'Pause both videos' : 'Resume both videos'}
                        aria-pressed={isPlaying}
                    >
                        {#if isPlaying}
                            <PauseSolid class="h-5 w-5" />
                        {:else}
                            <PlaySolid class="h-5 w-5" />
                        {/if}
                        <span class="sr-only">{isPlaying ? 'Pause videos' : 'Resume videos'}</span>
                    </button>
                    <span class={`${tooltipBase} group-hover:opacity-100 group-focus-within:opacity-100`}>
                        {isPlaying ? 'Pause' : 'Play'}
                    </span>
                </div>

                <div class="group relative">
                    <button
                        type="button"
                        class={`${buttonBase} bg-surface/80 shadow-surface`}
                        on:click={syncVideos}
                        aria-label="Re-sync playback"
                    >
                        <ClockOutline class="h-5 w-5" />
                        <span class="sr-only">Sync videos</span>
                    </button>
                    <span class={`${tooltipBase} group-hover:opacity-100 group-focus-within:opacity-100`}>
                        Sync
                    </span>
                </div>

                {#if isPlaylist}
                    <div class="group relative">
                        <button
                            type="button"
                            class={`${buttonBase} ${isPlaylistAutoPlay ? 'bg-success text-background shadow-elevated' : 'bg-surface/80 shadow-surface'}`}
                            on:click={toggleAutoPlaylist}
                            aria-label={`Toggle auto-playlist ${isPlaylistAutoPlay ? 'off' : 'on'}`}
                            aria-pressed={isPlaylistAutoPlay}
                        >
                            <ArrowsRepeatOutline class="h-5 w-5" />
                            <span class="sr-only">Toggle playlist auto-play</span>
                        </button>
                        <span class={`${tooltipBase} group-hover:opacity-100 group-focus-within:opacity-100`}>
                            Auto {isPlaylistAutoPlay ? 'On' : 'Off'}
                        </span>
                    </div>
                {/if}

                <div class="group relative">
                    <button
                        type="button"
                        class={`${buttonBase} ${showCinematicBars ? 'bg-border-strong/90 shadow-elevated' : 'bg-surface/80 shadow-surface'}`}
                        on:click={toggleBars}
                        aria-pressed={showCinematicBars}
                        aria-label={showCinematicBars ? 'Disable cinematic bars' : 'Enable cinematic bars'}
                    >
                        <VideoSolid class="h-5 w-5" />
                        <span class="sr-only">Toggle cinematic letterboxing</span>
                    </button>
                    <span class={`${tooltipBase} group-hover:opacity-100 group-focus-within:opacity-100`}>
                        Bars {showCinematicBars ? 'On' : 'Off'}
                    </span>
                </div>

                {#if !isFullscreen}
                    <div class="group relative">
                        <button
                            type="button"
                            class={`${buttonBase} bg-surface/80 shadow-surface`}
                            on:click={enterFullscreen}
                            aria-label="Enter fullscreen view"
                        >
                            <ExpandSolid class="h-5 w-5" />
                            <span class="sr-only">Enter fullscreen</span>
                        </button>
                        <span class={`${tooltipBase} group-hover:opacity-100 group-focus-within:opacity-100`}>
                            Fullscreen
                        </span>
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    <style>
        .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
        }
        .controls-glass {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.45rem 0.9rem;
            border-radius: 999px;
            background: rgba(20, 24, 32, 0.8);
            box-shadow: 0 12px 32px rgba(5, 8, 12, 0.45);
            backdrop-filter: blur(18px);
            border: 1px solid rgba(255, 255, 255, 0.06);
        }
    </style>