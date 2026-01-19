<script>
    import ControlDock from "$lib/components/reaction/ControlDock.svelte";
    import MissingReactionPlaceholder from "$lib/components/reaction/MissingReactionPlaceholder.svelte";
    import { createEventDispatcher, onMount, onDestroy } from "svelte";

    export let isFullscreen = false;
    export let isControlSurfaceVisible = false;
    export let isExitButtonExpanded = false;
    export let showCinematicBars = false;
    export let isReactionMissing = false;
    export let isUsersOwnVideo = false;
    export let playerOriginal = null;
    export let playerReaction = null;
    export let stickyControlsClass = "opacity-100";
    export let bothVideosStarted = false;
    export let isPlaylist = false;
    export let isPlaylistAutoPlay = false;
    export let reactionCurrentTime = 0;
    export let reactionDuration = 0;
    export let offsetStartTime = 0;
    export let reactionFinishTime = 0;
    export let missingReactionLoading = false;
    export let missingReactionError = "";
    export let fullscreenPrimaryVideo = "original";
    export let fullscreenOverlayWidthPercent = 35;
    export let fullscreenOverlayCorner = "top-right";
    export let fullscreenOverlayVisible = true;

    export let alwaysShowMissingPlaceholder = false;

    export let overlayRef;

    const dispatch = createEventDispatcher();

    // Mobile landscape detection & control visibility
    let isMobileLandscape = false;
    let controlsVisible = true;
    let controlsTimeout;
    let landscapeMediaQuery;

    function handleMediaQueryChange(e) {
        isMobileLandscape = e.matches;
        // Reset controls visibility when entering/exiting mobile landscape
        if (isMobileLandscape) {
            showControls();
        } else {
            controlsVisible = true; // Always visible in other modes unless handled elsewhere
            if (controlsTimeout) clearTimeout(controlsTimeout);
        }
    }

    function showControls() {
        if (!isMobileLandscape && !isFullscreen) return; // Only apply auto-hide in mobile landscape or fullscreen (if desired, currently targeting mobile landscape per request)

        // Actually, request says: "The control dock should be visible as a bottom overlay when the user goes into landscape mode... disappears after 5 seconds"
        // So we strictly enforce this logic when isMobileLandscape is true.

        controlsVisible = true;
        if (controlsTimeout) clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            if (isMobileLandscape) {
                controlsVisible = false;
            }
        }, 5000);
    }

    function handleInteraction() {
        if (isMobileLandscape) {
            showControls();
        }
    }

    /* 
       Computed stickyControlsClass:
       - If isMobileLandscape: toggle opacity based on controlsVisible.
       - Else: stick to default passed prop (or 'opacity-100' logic from parent if it was dynamic, but here we can just pipe it or override).
       The parent passes `stickyControlsClass`, but for mobile landscape we need to override it.
    */
    $: effectiveStickyControlsClass = isMobileLandscape
        ? controlsVisible
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        : stickyControlsClass;

    // Overlay visibility control only applies in fullscreen, not mobile landscape
    $: effectiveOverlayClass = isFullscreen && !fullscreenOverlayVisible
        ? "opacity-0 pointer-events-none"
        : "opacity-100 pointer-events-auto";

    const handleExitClick = () => dispatch("exitClick");
    const handleExitEnter = () => dispatch("exitEnter");
    const handleExitLeave = () => dispatch("exitLeave");
    const handlePointerMove = (e) => {
        dispatch("pointerMove", e);
        // We can treat pointer move as interaction for desktop,
        // but for mobile touch 'pointerdown' or 'click' is better.
        // Let's hook a general interaction handler to the wrapper.
    };
    const handlePointerDown = (e) => dispatch("pointerDown", e);
    const handlePointerLeave = (e) => dispatch("pointerLeave", e);
    const handleMissingReactionSubmit = (e) =>
        dispatch("missingReactionSubmit", e.detail);
    const handlePlayStateChanged = (e) =>
        dispatch("playStateChanged", e.detail);
    const handleSyncVideos = () => dispatch("syncVideos");
    const handleToggleAutoPlaylist = () => dispatch("toggleAutoPlaylist");
    const handleToggleCinematicBars = () => dispatch("toggleCinematicBars");
    const handleEnterFullscreen = () => dispatch("enterFullscreen");
    const handleSeek = (time) => dispatch("seek", time);

    const OVERLAY_WIDTH_MIN = 5;
    const OVERLAY_WIDTH_MAX = 50;
    const OVERLAY_WIDTH_STEP = 5;
    const DEFAULT_OVERLAY_WIDTH = 35;

    const normalizeOverlayWidth = (value) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return DEFAULT_OVERLAY_WIDTH;
        const snapped =
            Math.round(parsed / OVERLAY_WIDTH_STEP) * OVERLAY_WIDTH_STEP;
        return Math.max(OVERLAY_WIDTH_MIN, Math.min(OVERLAY_WIDTH_MAX, snapped));
    };

    const overlayCornerClasses = {
        "top-left": "left-6 top-6",
        "top-right": "right-6 top-6",
        "bottom-left": "left-6 bottom-6",
        "bottom-right": "right-6 bottom-6",
    };

    $: normalizedOverlayWidth = normalizeOverlayWidth(
        fullscreenOverlayWidthPercent,
    );
    $: normalizedOverlayCorner =
        fullscreenOverlayCorner in overlayCornerClasses
            ? fullscreenOverlayCorner
            : "top-right";
    $: overlayCornerClass = overlayCornerClasses[normalizedOverlayCorner];
    $: isReactionPrimary = fullscreenPrimaryVideo === "reaction";
    $: isOverlayLayout = isFullscreen || isMobileLandscape;
    $: isOriginalOverlay = isOverlayLayout && isReactionPrimary;
    $: isReactionOverlay = isOverlayLayout && !isReactionPrimary;

    onMount(() => {
        console.log('ReactionStage mounted');
        console.log('Initial isMobileLandscape:', isMobileLandscape);
        console.log('Initial fullscreenOverlayVisible:', fullscreenOverlayVisible);

        // Match CSS: @media (orientation: landscape) and (max-width: 1023px), (orientation: landscape) and (max-height: 600px)
        landscapeMediaQuery = window.matchMedia(
            "(orientation: landscape) and (max-width: 1023px), (orientation: landscape) and (max-height: 600px)",
        );

        isMobileLandscape = landscapeMediaQuery.matches;
        landscapeMediaQuery.addEventListener("change", handleMediaQueryChange);

        if (isMobileLandscape) {
            showControls();
        }
    });

    onDestroy(() => {
        if (landscapeMediaQuery) {
            landscapeMediaQuery.removeEventListener(
                "change",
                handleMediaQueryChange,
            );
        }
        if (controlsTimeout) clearTimeout(controlsTimeout);
    });

    $: console.log('Updated isMobileLandscape:', isMobileLandscape);
    $: console.log('Updated fullscreenOverlayVisible:', fullscreenOverlayVisible);
    $: console.log('Updated controlsVisible:', controlsVisible);
</script>

<div
    class={`theater-wrapper ${
        isFullscreen
            ? "theater-wrapper--fullscreen fixed inset-0 z-50 m-0 h-screen w-screen overflow-hidden rounded-none bg-black px-0 py-0 text-text-primary shadow-none"
            : "relative w-full max-w-none bg-black text-text-primary shadow-none md:shadow-elevated md:mx-auto md:my-10 md:rounded-2xl md:bg-surface/80 md:px-4 md:py-8 md:backdrop-blur sm:px-6 lg:px-10 xl:rounded-3xl"
    }`}
    style={`--control-dock-space: 80px; --overlay-width: ${normalizedOverlayWidth}%;`}
    data-overlay-corner={normalizedOverlayCorner}
    data-fullscreen-primary={isReactionPrimary ? "reaction" : "original"}
    role="button"
    tabindex="0"
    aria-label="Show controls"
    on:click={handleInteraction}
    on:touchstart={handleInteraction}
    on:keydown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleInteraction();
        handleInteraction(); // Any key shows controls? maybe just Enter/Space.
    }}
>
    <!-- Fullscreen overlay & exit button (only shown when fullscreen) -->
    {#if isFullscreen}
        <div
            class={`absolute left-6 top-6 z-50 transition-opacity duration-200 ease-cinematic ${isControlSurfaceVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        >
            <button
                type="button"
                class={`group flex items-center overflow-hidden rounded-full bg-surface/40 ${isExitButtonExpanded ? "pl-3 pr-4" : "px-3"} py-2 text-sm font-semibold text-text-primary shadow-elevated backdrop-blur transition-all duration-200 ease-cinematic hover:-translate-y-0.5 hover:bg-surface/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
                on:click={handleExitClick}
                on:mouseenter={handleExitEnter}
                on:mouseleave={handleExitLeave}
                on:focus={handleExitEnter}
                on:blur={handleExitLeave}
                on:touchstart={handleExitEnter}
                on:touchend={handleExitLeave}
                aria-label="Exit fullscreen"
                title="Exit fullscreen"
            >
                <span
                    class={`flex items-center justify-center overflow-hidden transition-all duration-200 ease-cinematic ${isExitButtonExpanded ? "w-0 opacity-0" : "w-4 opacity-80"}`}
                >
                    <svg
                        class="h-4 w-4 text-text-primary/80"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            d="M5 9V5h4V3H3v6h2zm14-6h-6v2h4v4h2V3zm-6 18h6v-6h-2v4h-4v2zM5 15H3v6h6v-2H5v-4z"
                        />
                    </svg>
                </span>
                <span
                    class={`inline-flex items-center whitespace-nowrap transition-all duration-200 ease-cinematic ${isExitButtonExpanded ? "ml-2 max-w-xs opacity-100" : "ml-0 max-w-0 opacity-0"}`}
                >
                    Exit fullscreen
                </span>
            </button>
        </div>
        <div
            class="absolute inset-0 z-40 cursor-default bg-transparent"
            bind:this={overlayRef}
            on:pointermove={handlePointerMove}
            on:pointerdown={handlePointerDown}
            on:pointerleave={handlePointerLeave}
        ></div>
    {/if}

    <!-- Main stage container: players always exist in DOM, layout changes via CSS -->
    <div
        data-stage="container"
        class={isFullscreen
            ? "relative h-full w-full"
            : "flex flex-col gap-0 md:grid md:gap-6 md:grid-cols-2 xl:gap-8"}
    >
        <!-- Original video player container -->
        <div
            data-stage="original"
            data-stage-role={isOverlayLayout
                ? isOriginalOverlay
                    ? "overlay"
                    : "primary"
                : "grid"}
            class={isOverlayLayout
                ? isOriginalOverlay
                    ? `pointer-events-auto absolute ${overlayCornerClass} z-50 transition-opacity duration-300 ease-cinematic ${effectiveOverlayClass}`
                    : "absolute inset-0"
                : "relative overflow-hidden bg-black shadow-elevated rounded-none md:rounded-xl"}
            style={isOriginalOverlay ? "width: var(--overlay-width);" : ""}
        >
            <div
                data-stage="original-frame"
                class={isOverlayLayout
                    ? isOriginalOverlay
                        ? "relative w-full aspect-cinematic overflow-hidden rounded-lg bg-black/80 shadow-elevated"
                        : "h-full w-full"
                    : "relative w-full h-[56.25vw] md:h-auto md:aspect-[16/9]"}
            >
                <div
                    data-stage="original-frame-inner"
                    class="relative h-full w-full"
                >
                    <div
                        id="player-original"
                        class="absolute inset-0 h-full w-full"
                    ></div>
                </div>
            </div>
            {#if showCinematicBars}
                <div
                    class={`pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black via-black/80 to-transparent ${isFullscreen ? "h-[12%]" : "h-[8%] from-black/80"}`}
                    aria-hidden="true"
                ></div>
                <div
                    class="pointer-events-none absolute inset-x-0 bottom-0 h-[12%] bg-gradient-to-t from-black via-black/80 to-transparent"
                    aria-hidden="true"
                ></div>
            {/if}
        </div>

        <!-- Reaction video player container -->
        {#if !isReactionMissing}
            <div
                data-stage="reaction"
                data-stage-role={isOverlayLayout
                    ? isReactionOverlay
                        ? "overlay"
                        : "primary"
                    : "grid"}
                class={isOverlayLayout
                    ? isReactionOverlay
                        ? `pointer-events-auto absolute ${overlayCornerClass} z-50 transition-opacity duration-300 ease-cinematic ${effectiveOverlayClass}`
                        : "absolute inset-0"
                    : "relative overflow-hidden bg-black/80 shadow-surface w-[80vw] h-[45vw] mx-auto mt-4 rounded-lg md:w-auto md:h-auto md:mt-0 md:mx-0 md:rounded-xl md:aspect-[16/9]"}
                style={isReactionOverlay ? "width: var(--overlay-width);" : ""}
            >
                <div
                    class={isOverlayLayout
                        ? isReactionOverlay
                            ? "relative aspect-cinematic overflow-hidden rounded-lg bg-black/80 shadow-elevated"
                            : "relative h-full w-full"
                        : "relative h-full w-full"}
                >
                    <div
                        id="player-reaction"
                        class="absolute inset-0 h-full w-full"
                    ></div>
                    {#if showCinematicBars}
                        <div
                            class="pointer-events-none absolute inset-x-0 top-0 h-[12%] bg-gradient-to-b from-black via-black/80 to-transparent"
                            aria-hidden="true"
                        ></div>
                        <div
                            class="pointer-events-none absolute inset-x-0 bottom-0 h-[12%] bg-gradient-to-t from-black via-black/80 to-transparent"
                            aria-hidden="true"
                        ></div>
                    {/if}
                </div>
            </div>
        {:else if isUsersOwnVideo || alwaysShowMissingPlaceholder}
            <MissingReactionPlaceholder
                loading={missingReactionLoading}
                error={missingReactionError}
                on:submit={handleMissingReactionSubmit}
            />
        {:else if !isUsersOwnVideo}
            <div class="hidden"></div>
        {/if}
    </div>

    {#if playerOriginal && (playerReaction || isReactionMissing)}
        <ControlDock
            {isFullscreen}
            stickyControlsClass={effectiveStickyControlsClass}
            {bothVideosStarted}
            {isPlaylist}
            {isPlaylistAutoPlay}
            {showCinematicBars}
            onPlayStateChanged={handlePlayStateChanged}
            onSyncVideos={handleSyncVideos}
            onToggleAutoPlaylist={handleToggleAutoPlaylist}
            onToggleBars={handleToggleCinematicBars}
            onEnterFullscreen={handleEnterFullscreen}
            currentTime={reactionCurrentTime}
            duration={reactionDuration}
            seekMin={offsetStartTime || 0}
            seekMax={Math.min(reactionFinishTime || 0, reactionDuration || 0)}
            onSeek={handleSeek}
        />
        <!-- Debug Helper -->
        <!-- <div class="debug-info">
            Wait for layout... if this is red, base styles active.
            <br />
            W: <span id="debug-w">-</span> H: <span id="debug-h">-</span>
        </div> -->
        <script>
            const updateDebug = () => {
                const w = document.getElementById("debug-w");
                if (w) w.innerText = window.innerWidth;
                const h = document.getElementById("debug-h");
                if (h) h.innerText = window.innerHeight;
            };
            window.addEventListener("resize", updateDebug);
            setTimeout(updateDebug, 500);
        </script>
    {/if}
</div>

<style>
    /* 
       Targeting:
       1. Standard mobile widths (max-width: 1023px)
       2. Short heights (max-height: 768px - covering 720p legacy phones/phablets)
       3. Wide aspect ratios (min-aspect-ratio: 1.5 - covering 16:10 & 16:9) with constrained height (max-height: 900px)
    */
    @media (hover: none) and (pointer: coarse) and (orientation: landscape) and (max-width: 1023px),
        (hover: none) and (pointer: coarse) and (orientation: landscape) and (max-height: 768px),
        (hover: none) and (pointer: coarse) and (orientation: landscape) and (min-aspect-ratio: 1.5) and (max-height: 900px) {
        :global(div.theater-wrapper) {
            position: fixed;
            inset: 0;
            z-index: 50;
            margin: 0;
            padding: 0;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            border-radius: 0;
            background: black;
        }

        .theater-wrapper [data-stage="container"] {
            position: absolute;
            inset: 0;
            z-index: 50;
            display: block; /* Changing from flex to block to allow absolute positioning of children */
            padding: 0;
            background: black;
        }

        .theater-wrapper [data-stage-role="primary"] {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            z-index: 10;
        }

        .theater-wrapper [data-stage-role="primary"] [data-stage="original-frame"] {
            width: 100%;
            height: 100%;
        }

        .theater-wrapper [data-stage-role="primary"] [data-stage="original-frame-inner"] {
            width: 100%;
            height: 100%;
            max-height: none;
            aspect-ratio: auto;
        }

        .theater-wrapper [data-stage-role="overlay"] {
            position: absolute;
            width: var(--overlay-width) !important;
            height: auto;
            aspect-ratio: 16 / 9;
            z-index: 60;
            margin: 0;
            border-radius: 0.5rem; /* rounded-lg */
            overflow: hidden;
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.5); /* shadow-xl */
        }

        .theater-wrapper[data-overlay-corner="top-left"]
            [data-stage-role="overlay"] {
            top: 0;
            left: 0;
        }

        .theater-wrapper[data-overlay-corner="top-right"]
            [data-stage-role="overlay"] {
            top: 0;
            right: 0;
        }

        .theater-wrapper[data-overlay-corner="bottom-left"]
            [data-stage-role="overlay"] {
            bottom: 0;
            left: 0;
        }

        .theater-wrapper[data-overlay-corner="bottom-right"]
            [data-stage-role="overlay"] {
            bottom: 0;
            right: 0;
        }
    }

    @supports (height: 100dvh) {
        @media (hover: none) and (pointer: coarse) and (orientation: landscape) and (max-width: 1023px),
            (hover: none) and (pointer: coarse) and (orientation: landscape) and (max-height: 768px),
            (hover: none) and (pointer: coarse) and (orientation: landscape) and (min-aspect-ratio: 1.5) and (max-height: 900px) {
            :global(div.theater-wrapper) {
                height: 100dvh;
            }
        }
    }
</style>
