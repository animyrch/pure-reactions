<script>
    import FullscreenChrome from "$lib/components/reaction/FullscreenChrome.svelte";
    import ControlDock from "$lib/components/reaction/ControlDock.svelte";
    import MissingReactionPlaceholder from "$lib/components/reaction/MissingReactionPlaceholder.svelte";
    import { createEventDispatcher } from "svelte";

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

    export let alwaysShowMissingPlaceholder = false;

    export let overlayRef;

    const dispatch = createEventDispatcher();

    const handleExitClick = () => dispatch("exitClick");
    const handleExitEnter = () => dispatch("exitEnter");
    const handleExitLeave = () => dispatch("exitLeave");
    const handlePointerMove = (e) => dispatch("pointerMove", e);
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

    // We are not passing actions directly to avoid tight coupling to the composable,
    // instead re-dispatching events.
</script>

<section
    class={`theater-wrapper ${
        isFullscreen
            ? "fixed inset-0 z-50 m-0 h-screen w-screen overflow-hidden rounded-none bg-black px-0 py-0 text-text-primary shadow-none"
            : "relative w-full max-w-none bg-black text-text-primary shadow-none md:shadow-elevated md:mx-auto md:my-10 md:rounded-2xl md:bg-surface/80 md:px-4 md:py-8 md:backdrop-blur sm:px-6 lg:px-10 xl:rounded-3xl"
    }`}
    style="--control-dock-space: 80px;"
>
    {#if isFullscreen}
        <FullscreenChrome
            {isControlSurfaceVisible}
            {isExitButtonExpanded}
            {showCinematicBars}
            {isReactionMissing}
            bind:overlayRef
            onExitClick={handleExitClick}
            onExitEnter={handleExitEnter}
            onExitLeave={handleExitLeave}
            onPointerMove={(e) => handlePointerMove(e)}
            onPointerDown={(e) => handlePointerDown(e)}
            onPointerLeave={(e) => handlePointerLeave(e)}
        />
    {:else}
        <div
            data-stage="container"
            class="flex flex-col gap-0 md:grid md:gap-6 md:grid-cols-2 xl:gap-8"
        >
            <div
                data-stage="original"
                class="relative overflow-hidden bg-black shadow-elevated rounded-none md:rounded-xl"
            >
                <div
                    data-stage="original-frame"
                    class="relative w-full h-[56.25vw] md:h-auto md:aspect-[16/9]"
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
                        class="pointer-events-none absolute inset-x-0 top-0 h-[12%] bg-gradient-to-b from-black via-black/80 to-transparent"
                        aria-hidden="true"
                    ></div>
                    <div
                        class="pointer-events-none absolute inset-x-0 bottom-0 h-[12%] bg-gradient-to-t from-black via-black/80 to-transparent"
                        aria-hidden="true"
                    ></div>
                {/if}
            </div>
            {#if !isReactionMissing}
                <div
                    data-stage="reaction"
                    class="relative overflow-hidden bg-black/80 shadow-surface w-[80vw] h-[45vw] mx-auto mt-4 rounded-lg md:w-auto md:h-auto md:mt-0 md:mx-0 md:rounded-xl md:aspect-[16/9]"
                >
                    <div
                        class="relative h-full w-full"
                    >
                        <div
                            id="player-reaction"
                            class="absolute inset-0 h-full w-full"
                        ></div>
                    </div>
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
    {/if}

    {#if playerOriginal && (playerReaction || isReactionMissing)}
        <ControlDock
            {isFullscreen}
            {stickyControlsClass}
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
    {/if}
</section>

<style>
    @media (hover: none) and (pointer: coarse) and (orientation: landscape) and (max-width: 1023px) {
        :global(section.theater-wrapper) {
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
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            gap: 0;
            padding: 0;
            padding-bottom: var(--control-dock-space);
            background: black;
        }

        .theater-wrapper [data-stage="original"],
        .theater-wrapper [data-stage="reaction"] {
            position: relative;
            inset: auto;
            top: auto;
            right: auto;
            margin: 0;
        }

        .theater-wrapper [data-stage="original"] {
            flex: 0 0 60%;
        }

        .theater-wrapper [data-stage="reaction"] {
            flex: 0 0 40%;
            width: auto;
        }

        .theater-wrapper [data-stage="original-frame"] {
            display: block;
            height: auto;
        }

        .theater-wrapper [data-stage="original-frame-inner"] {
            width: 100%;
            aspect-ratio: 16 / 9;
            height: auto;
            max-height: calc(100vh - var(--control-dock-space));
        }

        .theater-wrapper [data-stage="reaction"] {
            aspect-ratio: 16 / 9;
            height: auto;
        }
    }

    @supports (height: 100dvh) {
        @media (hover: none) and (pointer: coarse) and (orientation: landscape) and (max-width: 1023px) {
            :global(section.theater-wrapper) {
                height: 100dvh;
            }

            .theater-wrapper [data-stage="original-frame-inner"] {
                max-height: calc(100dvh - var(--control-dock-space));
            }
        }
    }
</style>
