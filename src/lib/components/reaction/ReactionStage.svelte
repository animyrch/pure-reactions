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
    /** 'tiktok' | 'youtube' — controls the original player container aspect ratio */
    export let originalVideoPlatform = 'youtube';

    export let alwaysShowMissingPlaceholder = false;

    export let overlayRef;

    // Forward touch event handlers for swipe navigation (optional)
    export let onTouchStart = null;
    export let onTouchEnd = null;

    const dispatch = createEventDispatcher();

    // Mobile landscape detection & control visibility
    let isMobileLandscape = false;
    let controlsVisible = true;
    let controlsTimeout;
    let landscapeMediaQuery;

    // Desktop overlay: md+ (≥768px) and not a touch-landscape device
    let isDesktop = false;
    let desktopMediaQuery;

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

    function handleDesktopChange(e) {
        isDesktop = e.matches;
    }

    $: shouldAutoHideMobileDock = isMobileLandscape;

    function showControls() {
        controlsVisible = true;
        if (controlsTimeout) clearTimeout(controlsTimeout);
        if (!shouldAutoHideMobileDock) return;

        controlsTimeout = setTimeout(() => {
            if (shouldAutoHideMobileDock) {
                controlsVisible = false;
            }
        }, 3000);
    }

    let prevBothVideosStarted = bothVideosStarted;
    $: if (bothVideosStarted && !prevBothVideosStarted) {
        showControls();
        prevBothVideosStarted = bothVideosStarted;
    } else if (!bothVideosStarted) {
        prevBothVideosStarted = false;
    }

    function handleInteraction() {
        if (shouldAutoHideMobileDock) {
            showControls();
        }
    }

    $: effectiveStickyControlsClass = shouldAutoHideMobileDock
        ? controlsVisible
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        : stickyControlsClass;

    // Overlay visibility control applies in both fullscreen and mobile landscape
    $: effectiveOverlayClass =
        isOverlayLayout && !fullscreenOverlayVisible
            ? "opacity-0 pointer-events-none"
            : "opacity-100 pointer-events-auto";

    let wrapperRef;

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
    const handleEnterFullscreen = async () => {
        // Try to request browser fullscreen on the main wrapper if possible,
        // then notify parent so app state can update.
        try {
            const el = typeof window !== "undefined" && wrapperRef ? wrapperRef : document.documentElement;
            if (el && typeof el.requestFullscreen === "function") {
                await el.requestFullscreen();
            } else if (el && typeof el.webkitRequestFullscreen === "function") {
                // Safari
                el.webkitRequestFullscreen();
            }
        } catch (err) {
            console.warn("Fullscreen request failed:", err);
        }

        dispatch("enterFullscreen");
    };

    function handleFullscreenChange() {
        if (typeof document === "undefined") return;
        const el = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
        if (!el) {
            // Browser left fullscreen (e.g., via Escape). Notify parent to update app state.
            dispatch("exitClick");
        }
    }
    const handleSeek = (time) => dispatch("seek", time);

    const OVERLAY_WIDTH_MIN = 5;
    const OVERLAY_WIDTH_MAX = 80;
    const OVERLAY_WIDTH_STEP = 5;
    const DEFAULT_OVERLAY_WIDTH = 35;

    const normalizeOverlayWidth = (value) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return DEFAULT_OVERLAY_WIDTH;
        const snapped =
            Math.round(parsed / OVERLAY_WIDTH_STEP) * OVERLAY_WIDTH_STEP;
        return Math.max(
            OVERLAY_WIDTH_MIN,
            Math.min(OVERLAY_WIDTH_MAX, snapped),
        );
    };

    const overlayPositionClasses = {
        "top-left": "left-6 top-6",
        "top-right": "right-6 top-6",
        "bottom-left": "left-6 bottom-6",
        "bottom-right": "right-6 bottom-6",
        "bottom-center": "left-1/2 -translate-x-1/2 bottom-6",
    };

    $: normalizedOverlayWidth = normalizeOverlayWidth(
        fullscreenOverlayWidthPercent,
    );
    $: normalizedOverlayCorner =
        fullscreenOverlayCorner in overlayPositionClasses
            ? fullscreenOverlayCorner
            : "top-right";
    $: overlayCornerClass = overlayPositionClasses[normalizedOverlayCorner];
    $: isReactionPrimary = fullscreenPrimaryVideo === "reaction";
    $: isDesktopOverlay = isDesktop && !isMobileLandscape && !isFullscreen && bothVideosStarted;
    $: isOverlayLayout = isFullscreen || (isMobileLandscape && bothVideosStarted) || isDesktopOverlay;
    $: isOriginalOverlay = isOverlayLayout && isReactionPrimary;
    $: isReactionOverlay = isOverlayLayout && !isReactionPrimary;

    onMount(() => {
        // Match CSS: @media (orientation: landscape) and (max-width: 1023px), (orientation: landscape) and (max-height: 600px)
        landscapeMediaQuery = window.matchMedia(
            "(hover: none) and (pointer: coarse) and (orientation: landscape) and (max-width: 1023px), (hover: none) and (pointer: coarse) and (orientation: landscape) and (max-height: 768px), (hover: none) and (pointer: coarse) and (orientation: landscape) and (min-aspect-ratio: 1.5) and (max-height: 900px)",
        );

        isMobileLandscape = landscapeMediaQuery.matches;
        landscapeMediaQuery.addEventListener("change", handleMediaQueryChange);

        // Desktop overlay: md breakpoint (≥768px)
        desktopMediaQuery = window.matchMedia("(min-width: 768px)");
        isDesktop = desktopMediaQuery.matches;
        desktopMediaQuery.addEventListener("change", handleDesktopChange);

        if (isMobileLandscape) {
            showControls();
        }
        if (typeof document !== "undefined") {
            // Listen for browser-level fullscreen changes (Escape key, browser UI).
            document.addEventListener("fullscreenchange", handleFullscreenChange);
            document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
            document.addEventListener("msfullscreenchange", handleFullscreenChange);
        }
    });

    onDestroy(() => {
        if (landscapeMediaQuery) {
            landscapeMediaQuery.removeEventListener(
                "change",
                handleMediaQueryChange,
            );
        }
        if (desktopMediaQuery) {
            desktopMediaQuery.removeEventListener("change", handleDesktopChange);
        }
        if (controlsTimeout) clearTimeout(controlsTimeout);
        
        
        if (typeof document !== "undefined") {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
            document.removeEventListener("msfullscreenchange", handleFullscreenChange);
        }
    });

    // When the app's `isFullscreen` state is cleared, also exit browser fullscreen
    // if the document is currently fullscreen. This keeps browser-level fullscreen
    // in sync with the app state (e.g., when the user clicks the Exit button).
    $: if (typeof document !== "undefined") {
        if (!isFullscreen && document.fullscreenElement) {
            // Best-effort exit; ignore errors.
            document.exitFullscreen?.().catch(() => {});
            if (typeof document.webkitExitFullscreen === "function") {
                try {
                    document.webkitExitFullscreen();
                } catch (e) {
                    /* ignore */
                }
            }
        }
    }
</script>

<div
    bind:this={wrapperRef}
    class={`theater-wrapper transition-all duration-500 ${
        isFullscreen
            ? "theater-wrapper--fullscreen fixed inset-0 z-50 m-0 h-screen w-screen overflow-hidden rounded-none bg-black px-0 py-0 text-text-primary shadow-none"
            : isDesktopOverlay
            ? "relative w-full max-w-[80%] bg-black text-text-primary shadow-none md:shadow-elevated md:mx-auto md:my-10 md:rounded-2xl md:bg-surface/80 md:px-4 md:py-8 md:backdrop-blur sm:px-6 lg:px-10 xl:rounded-3xl"
            : "relative w-full max-w-none bg-black text-text-primary shadow-none md:shadow-elevated md:mx-auto md:my-10 md:rounded-2xl md:bg-surface/80 md:px-4 md:py-8 md:backdrop-blur sm:px-6 lg:px-10 xl:rounded-3xl"
    }`}
    style={`--control-dock-space: 80px; --overlay-width: ${normalizedOverlayWidth}%;`}
    data-overlay-corner={normalizedOverlayCorner}
    data-fullscreen-primary={isReactionPrimary ? "reaction" : "original"}
    role="button"
    tabindex="0"
    aria-label="Show controls"
    on:click={handleInteraction}
    on:touchstart={(e) => { handleInteraction(e); if (onTouchStart) onTouchStart(e); }}
    on:touchend={(e) => { if (onTouchEnd) onTouchEnd(e); }}
    on:keydown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleInteraction();
        handleInteraction(); // Any key shows controls? maybe just Enter/Space.
    }}
>
    <!-- Fullscreen overlay (overlayRef still used for pointer events) -->
    {#if isFullscreen}
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
            : isOverlayLayout
            ? "relative w-full aspect-video overflow-hidden"
            : "flex flex-col-reverse gap-0 md:grid md:gap-6 md:grid-cols-2 xl:gap-8"}
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
                    {#if !isOverlayLayout && originalVideoPlatform === 'tiktok'}
                        <!-- TikTok: keep the 16:9 height, centre a narrow 9:16 strip inside -->
                        <div class="absolute inset-0 flex items-center justify-center bg-black">
                            <div
                                class="relative h-full overflow-hidden bg-black"
                                style="aspect-ratio: 9/16;"
                            >
                                <div
                                    id="player-original"
                                    class="h-full w-full"
                                ></div>
                            </div>
                        </div>
                    {:else}
                        <div
                            id="player-original"
                            class="absolute inset-0 h-full w-full"
                        ></div>
                    {/if}
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
                    : "relative overflow-hidden bg-black/80 shadow-surface w-full h-[56.25vw] mx-auto mt-0 rounded-none md:w-auto md:h-auto md:mt-0 md:mx-0 md:rounded-xl md:aspect-[16/9]"}
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
            onExitClick={handleExitClick}
            currentTime={reactionCurrentTime}
            duration={reactionDuration}
            seekMin={offsetStartTime || 0}
            seekMax={reactionFinishTime > 0
                ? Math.min(reactionFinishTime, reactionDuration || 0)
                : reactionDuration || 0}
            onSeek={handleSeek}
        />
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

        .theater-wrapper
            [data-stage-role="primary"]
            [data-stage="original-frame"] {
            width: 100%;
            height: 100%;
        }

        .theater-wrapper
            [data-stage-role="primary"]
            [data-stage="original-frame-inner"] {
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
