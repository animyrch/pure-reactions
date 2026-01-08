<script>
    import { createEventDispatcher, onDestroy } from "svelte";
    import {
        PauseSolid,
        PlaySolid,
        ClockOutline,
        ArrowsRepeatOutline,
        VideoSolid,
        ExpandSolid,
    } from "flowbite-svelte-icons";

    export let bothVideosStarted;
    export let isPlaylist;
    export let isPlaylistAutoPlay;
    export let showAutoPlayButton = true;
    export let showCinematicBars = false;
    export let isFullscreen = false;
    export let currentTime = 0;
    export let duration = 0;
    export let seekMin = 0;
    export let seekMax;

    let isPlaying = true;
    let isInteracting = false;
    let isKeyboardFocus = false;
    let isDragging = false;
    let isHoveringControls = false;
    let localTime = 0;
    let hideTimeout;
    let containerRef;

    let pendingSeekTime = null;
    let pendingSeekTimeout;

    let seekRaf = 0;
    let queuedSeekTime = null;

    const dispatch = createEventDispatcher();

    // Re-add these (they were present before; glassBase is required by glassClasses)
    const buttonBase =
        "inline-flex h-16 w-16 items-center justify-center rounded-full text-text-primary transition duration-subtle ease-cinematic hover:bg-elevated/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97]";
    const tooltipBase =
        "pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-overlay px-xs py-[2px] text-[0.65rem] uppercase tracking-wide text-text-primary opacity-0 transition duration-subtle ease-cinematic";
    const glassBase =
        "controls-glass transition-opacity duration-500 ease-cinematic";

    const clearPendingSeek = () => {
        pendingSeekTime = null;
        if (pendingSeekTimeout) clearTimeout(pendingSeekTimeout);
        pendingSeekTimeout = null;
    };

    const armPendingSeek = (time) => {
        pendingSeekTime = time;
        if (pendingSeekTimeout) clearTimeout(pendingSeekTimeout);
        pendingSeekTimeout = setTimeout(clearPendingSeek, 1200);
    };

    const queueSeekDispatch = (time) => {
        queuedSeekTime = time;
        if (seekRaf) return;
        seekRaf = requestAnimationFrame(() => {
            seekRaf = 0;
            const t = queuedSeekTime;
            queuedSeekTime = null;
            if (t == null) return;
            dispatch("seek", { time: t });
        });
    };

    const clearHideTimeout = () => {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }
    };

    const scheduleHide = () => {
        clearHideTimeout();
        // If dragging or hovering controls, don't hide
        if (isDragging || isHoveringControls) return;

        hideTimeout = setTimeout(() => {
            if (!isKeyboardFocus && !isDragging && !isHoveringControls) {
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

    function handleControlsMouseEnter() {
        if (!bothVideosStarted) return;
        isHoveringControls = true;
        revealControls();
    }

    function handleControlsMouseLeave() {
        if (!bothVideosStarted) return;
        isHoveringControls = false;
        scheduleHide();
    }

    $: if (!isDragging && pendingSeekTime == null) {
        localTime = currentTime;
    }

    $: if (pendingSeekTime != null && Number.isFinite(currentTime)) {
        // Clear once the parent/video time "catches up" to the user's requested seek.
        if (Math.abs(currentTime - pendingSeekTime) <= 0.25) {
            clearPendingSeek();
        }
    }

    const clampNumber = (value, min, max) => {
        const normalized = Number(value);
        if (!Number.isFinite(normalized)) return min;
        return Math.min(Math.max(normalized, min), max);
    };

    $: safeSeekMin = Number.isFinite(seekMin) && seekMin >= 0 ? seekMin : 0;
    $: safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
    $: safeSeekMaxCandidate =
        Number.isFinite(seekMax) && seekMax > 0 ? seekMax : safeDuration;
    $: safeSeekMax =
        safeSeekMaxCandidate >= safeSeekMin
            ? safeSeekMaxCandidate
            : safeSeekMin;

    $: hasExplicitSegmentBounds =
        Boolean(isPlaylist) &&
        Number.isFinite(seekMin) &&
        seekMin >= 0 &&
        Number.isFinite(seekMax) &&
        seekMax > 0 &&
        seekMax >= seekMin;

    $: displaySeekMin = hasExplicitSegmentBounds ? 0 : safeSeekMin;
    $: displaySeekMax = hasExplicitSegmentBounds
        ? Math.max(0, safeSeekMax - safeSeekMin)
        : safeSeekMax;
    $: displayTime = hasExplicitSegmentBounds
        ? Math.max(0, localTime - safeSeekMin)
        : localTime;

    $: if (safeSeekMax > safeSeekMin) {
        const clamped = clampNumber(localTime, safeSeekMin, safeSeekMax);
        if (localTime !== clamped) {
            localTime = clamped;
        }
    } else {
        localTime = safeSeekMin;
    }

    function handleSeekInput(event) {
        isDragging = true;
        const rawValue = parseFloat(event.currentTarget.value);
        const time = hasExplicitSegmentBounds
            ? clampNumber(safeSeekMin + rawValue, safeSeekMin, safeSeekMax)
            : clampNumber(rawValue, safeSeekMin, safeSeekMax);

        localTime = time;

        // Keep UI locked + actually seek while dragging/clicking.
        armPendingSeek(time);
        queueSeekDispatch(time);

        scheduleHide(); // keep awake
    }

    function handleSeekChange(event) {
        const rawValue = parseFloat(event.currentTarget.value);
        const time = hasExplicitSegmentBounds
            ? clampNumber(safeSeekMin + rawValue, safeSeekMin, safeSeekMax)
            : clampNumber(rawValue, safeSeekMin, safeSeekMax);

        localTime = time;
        isDragging = false;

        // Finalize seek (in case some UAs only commit on change).
        armPendingSeek(time);
        queueSeekDispatch(time);

        scheduleHide();
    }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    }

    onDestroy(() => {
        clearHideTimeout();
        clearPendingSeek();
        if (seekRaf) cancelAnimationFrame(seekRaf);
    });

    function togglePlayState() {
        isPlaying = !isPlaying;
        dispatch("playStateChanged", { isPlaying });
    }
    function syncVideos() {
        dispatch("syncVideos");
    }
    function toggleAutoPlaylist() {
        dispatch("toggleAutoPlaylist");
    }
    function toggleBars() {
        dispatch("toggleBars");
    }
    function enterFullscreen() {
        dispatch("enterFullscreen");
    }

    function handleKeydown(event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;

        const target = event.target;
        if (
            target instanceof HTMLElement &&
            (target.isContentEditable ||
                target.closest('input, textarea, [contenteditable="true"]'))
        ) {
            return;
        }

        // Don't hijack ArrowLeft/Right when the related-reactions carousel has focus.
        if (
            (event.key === "ArrowRight" || event.key === "ArrowLeft") &&
            target instanceof HTMLElement &&
            target.closest(".carousel, [data-carousel-item]")
        ) {
            return;
        }

        if (event.key === " ") {
            event.preventDefault();
            togglePlayState();
            return;
        }

        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            if (!bothVideosStarted) return;
            if (safeSeekMax <= safeSeekMin) return;

            event.preventDefault();
            const delta = event.key === "ArrowRight" ? 5 : -5;
            const baseTime = Number.isFinite(currentTime)
                ? currentTime
                : localTime;
            const nextTime = clampNumber(
                baseTime + delta,
                safeSeekMin,
                safeSeekMax,
            );

            localTime = nextTime;
            armPendingSeek(nextTime);
            queueSeekDispatch(nextTime);
            scheduleHide();
        }
    }

    $: isVisible =
        !bothVideosStarted ||
        isInteracting ||
        isKeyboardFocus ||
        isDragging ||
        isHoveringControls;
    $: glassClasses = `${glassBase} ${isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`;
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
        <p
            class="max-w-lg rounded-md bg-overlay/80 px-md py-sm text-center text-sm text-text-secondary backdrop-blur"
        >
            Tap or click each video once to sync playback, then use the controls
            here.
        </p>
    {:else}
        <div
            class={glassClasses}
            role="toolbar"
            aria-label="Reaction playback controls"
            tabindex="0"
            on:mouseenter={handleControlsMouseEnter}
            on:mouseleave={handleControlsMouseLeave}
        >
            <!-- Play/Pause -->
            <div class="group relative shrink-0 order-2 sm:order-none">
                <button
                    type="button"
                    class={`${buttonBase} ${isPlaying ? "bg-accent-primary text-background shadow-elevated" : "bg-surface/80 shadow-surface"}`}
                    on:click={togglePlayState}
                    aria-label={isPlaying
                        ? "Pause both videos"
                        : "Resume both videos"}
                    aria-pressed={isPlaying}
                >
                    {#if isPlaying}
                        <PauseSolid class="h-5 w-5" />
                    {:else}
                        <PlaySolid class="h-5 w-5" />
                    {/if}
                    <span class="sr-only"
                        >{isPlaying ? "Pause videos" : "Resume videos"}</span
                    >
                </button>
                <span
                    class={`${tooltipBase} group-hover:opacity-100 group-focus-within:opacity-100`}
                >
                    {isPlaying ? "Pause" : "Play"}
                </span>
            </div>

            <!-- Scrubber -->
            <div class="flex w-full items-center px-0 sm:flex-1 sm:px-3 gap-3 order-1 sm:order-none">
                <span
                    class="text-xs tabular-nums text-text-muted font-medium min-w-[32px] text-right hidden sm:block"
                    >{formatTime(displayTime)}</span
                >
                <input
                    type="range"
                    min={displaySeekMin}
                    max={displaySeekMax}
                    step="0.1"
                    value={displayTime}
                    class="scrubber-range w-full cursor-pointer"
                    on:input={handleSeekInput}
                    on:change={handleSeekChange}
                    disabled={safeSeekMax <= safeSeekMin}
                    aria-label="Seek reaction video"
                />
                <span
                    class="text-xs tabular-nums text-text-muted font-medium min-w-[32px] hidden sm:block"
                    >{formatTime(displaySeekMax)}</span
                >
            </div>

            <!-- Other Buttons -->
            <div class="flex items-center gap-2 shrink-0 order-3 sm:order-none">
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
                    <span
                        class={`${tooltipBase} group-hover:opacity-100 group-focus-within:opacity-100`}
                    >
                        Sync
                    </span>
                </div>

                {#if isPlaylist && showAutoPlayButton}
                    <div class="group relative">
                        <button
                            type="button"
                            class={`${buttonBase} ${isPlaylistAutoPlay ? "bg-success text-background shadow-elevated" : "bg-surface/80 shadow-surface"}`}
                            on:click={toggleAutoPlaylist}
                            aria-label={`Toggle auto-playlist ${isPlaylistAutoPlay ? "off" : "on"}`}
                            aria-pressed={isPlaylistAutoPlay}
                        >
                            <ArrowsRepeatOutline class="h-5 w-5" />
                            <span class="sr-only"
                                >Toggle playlist auto-play</span
                            >
                        </button>
                        <span
                            class={`${tooltipBase} group-hover:opacity-100 group-focus-within:opacity-100`}
                        >
                            Auto {isPlaylistAutoPlay ? "On" : "Off"}
                        </span>
                    </div>
                {/if}

                <div class="group relative">
                    <button
                        type="button"
                        class={`${buttonBase} ${showCinematicBars ? "bg-border-strong/90 shadow-elevated" : "bg-surface/80 shadow-surface"}`}
                        on:click={toggleBars}
                        aria-pressed={showCinematicBars}
                        aria-label={showCinematicBars
                            ? "Disable cinematic bars"
                            : "Enable cinematic bars"}
                    >
                        <VideoSolid class="h-5 w-5" />
                        <span class="sr-only"
                            >Toggle cinematic letterboxing</span
                        >
                    </button>
                    <span
                        class={`${tooltipBase} group-hover:opacity-100 group-focus-within:opacity-100`}
                    >
                        Bars {showCinematicBars ? "On" : "Off"}
                    </span>
                </div>

                {#if !isFullscreen}
                    <div class="group relative hidden md:block">
                        <button
                            type="button"
                            class={`${buttonBase} bg-surface/80 shadow-surface`}
                            on:click={enterFullscreen}
                            aria-label="Enter fullscreen view"
                        >
                            <ExpandSolid class="h-5 w-5" />
                            <span class="sr-only">Enter fullscreen</span>
                        </button>
                        <span
                            class={`${tooltipBase} group-hover:opacity-100 group-focus-within:opacity-100`}
                        >
                            Fullscreen
                        </span>
                    </div>
                {/if}
            </div>
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
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.5rem;
        border-radius: 999px;
        background: rgba(20, 24, 32, 0.9);
        box-shadow: 0 12px 32px rgba(5, 8, 12, 0.55);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        width: 100%;
    }

    @media (min-width: 640px) {
        .controls-glass {
            flex-wrap: nowrap;
            justify-content: flex-start;
            gap: 1.5rem;
        }
    }

    .scrubber-range {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        height: 36px;
        cursor: pointer;
        touch-action: manipulation;
    }

    .scrubber-range:focus {
        outline: none;
    }

    .scrubber-range::-webkit-slider-runnable-track {
        height: 10px;
        border-radius: 999px;
        @apply bg-border-subtle/60;
    }

    .scrubber-range::-moz-range-track {
        height: 10px;
        border-radius: 999px;
        @apply bg-border-subtle/60;
    }

    .scrubber-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        height: 24px;
        width: 24px;
        border-radius: 999px;
        margin-top: -7px; /* centers thumb on 10px track */
        @apply bg-text-primary border border-border-strong/60;
        transition: transform 0.1s ease;
    }

    .scrubber-range::-moz-range-thumb {
        height: 24px;
        width: 24px;
        border-radius: 999px;
        @apply bg-text-primary border border-border-strong/60;
        cursor: pointer;
        transition: transform 0.1s ease;
    }

    .scrubber-range::-moz-range-progress {
        height: 10px;
        border-radius: 999px;
        @apply bg-border-strong/70;
    }

    .scrubber-range:hover::-webkit-slider-runnable-track {
        @apply bg-border-strong/60;
    }

    .scrubber-range:hover::-moz-range-track {
        @apply bg-border-strong/60;
    }

    .scrubber-range:hover::-webkit-slider-thumb,
    .scrubber-range:hover::-moz-range-thumb {
        transform: scale(1.06);
    }
</style>
