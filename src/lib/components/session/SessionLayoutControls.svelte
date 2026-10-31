<script>
    import {
        FULLSCREEN_OVERLAY_WIDTH_MAX,
        FULLSCREEN_OVERLAY_WIDTH_MIN,
        FULLSCREEN_OVERLAY_WIDTH_STEP,
    } from "$lib/helpers/twinPlayersReactionData.ts";

    export let fullscreenPrimaryVideo = "original";
    export let fullscreenOverlayWidthPercent = 35;
    export let fullscreenOverlayCorner = "top-right";
    export let fullscreenOverlayVisible = true;
    export let onPrimaryChange = (_value) => {};
    export let onWidthChange = (_value) => {};
    export let onCornerChange = (_value) => {};
    export let onVisibleChange = (_value) => {};

    let open = false;

    const positions = [
        { value: "top-left", label: "Top left", x: 3, y: 3 },
        { value: "top-center", label: "Top center", x: 8, y: 3 },
        { value: "top-right", label: "Top right", x: 13, y: 3 },
        { value: "middle-left", label: "Middle left", x: 3, y: 9 },
        { value: "middle-right", label: "Middle right", x: 13, y: 9 },
        { value: "bottom-left", label: "Bottom left", x: 3, y: 15 },
        { value: "bottom-center", label: "Bottom center", x: 8, y: 15 },
        { value: "bottom-right", label: "Bottom right", x: 13, y: 15 },
    ];

    const positionGrid = [
        positions[0],
        positions[1],
        positions[2],
        positions[3],
        null,
        positions[4],
        positions[5],
        positions[6],
        positions[7],
    ];

    const closeOnEscape = (event) => {
        if (event.key === "Escape") {
            open = false;
        }
    };
</script>

<div class="relative">
    <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-primary/90 transition duration-subtle ease-cinematic hover:bg-elevated/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Layout"
        title="Layout"
        data-testid="session-layout-button"
        on:click={() => (open = !open)}
    >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <rect x="14" y="8" width="5" height="4" rx="0.5" fill="currentColor" stroke="none" />
        </svg>
        <span class="sr-only">Layout</span>
    </button>

    {#if open}
        <button
            type="button"
            class="fixed inset-0 z-60 cursor-default bg-transparent"
            aria-label="Close layout"
            on:click={() => (open = false)}
        ></button>
        <div
            class="absolute bottom-full right-0 z-70 mb-3 w-72 rounded-2xl border border-border-subtle bg-surface/95 p-3 text-left shadow-elevated backdrop-blur-sm"
            role="dialog"
            aria-label="Player layout"
            data-testid="session-layout-panel"
            on:keydown={closeOnEscape}
        >
            <p class="text-xs leading-snug text-text-muted">
                Choose the main video, and where the other one sits.
            </p>
            <div class="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Primary video">
                <button
                    type="button"
                    class={`rounded-lg border px-2 py-2 text-left transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ${fullscreenPrimaryVideo === "original" ? "border-accent-primary bg-accent-primary/10 text-text-primary" : "border-border-subtle bg-background/40 text-text-muted hover:text-text-primary"}`}
                    aria-pressed={fullscreenPrimaryVideo === "original"}
                    on:click={() => onPrimaryChange("original")}
                >
                    <span class="block text-xs font-semibold">Original main</span>
                    <span class="mt-0.5 block text-[11px] leading-snug text-text-muted">Stream sits on top.</span>
                </button>
                <button
                    type="button"
                    class={`rounded-lg border px-2 py-2 text-left transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ${fullscreenPrimaryVideo === "reaction" ? "border-accent-primary bg-accent-primary/10 text-text-primary" : "border-border-subtle bg-background/40 text-text-muted hover:text-text-primary"}`}
                    aria-pressed={fullscreenPrimaryVideo === "reaction"}
                    on:click={() => onPrimaryChange("reaction")}
                >
                    <span class="block text-xs font-semibold">Stream main</span>
                    <span class="mt-0.5 block text-[11px] leading-snug text-text-muted">Original sits on top.</span>
                </button>
            </div>

            <div class="mt-3 flex items-center justify-between gap-3">
                <label class="text-xs font-medium text-text-secondary" for="session-overlay-width">
                    Overlay size
                </label>
                <span class="text-xs tabular-nums text-text-muted">{fullscreenOverlayWidthPercent}%</span>
            </div>
            <input
                id="session-overlay-width"
                class="mt-2 h-2 w-full cursor-pointer accent-accent-primary"
                type="range"
                min={FULLSCREEN_OVERLAY_WIDTH_MIN}
                max={FULLSCREEN_OVERLAY_WIDTH_MAX}
                step={FULLSCREEN_OVERLAY_WIDTH_STEP}
                value={fullscreenOverlayWidthPercent}
                aria-label="Overlay size"
                on:input={(event) => onWidthChange(Number(event.currentTarget.value))}
            />

            <h3 class="mt-3 text-xs font-medium text-text-secondary">Overlay position</h3>
            <div class="mt-1.5 grid grid-cols-3 gap-1.5" role="group" aria-label="Overlay position">
                {#each positionGrid as position, index (position?.value ?? `empty-${index}`)}
                    {#if position}
                        <button
                            type="button"
                            class={`flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[11px] font-medium leading-tight transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ${fullscreenOverlayCorner === position.value ? "border-accent-primary bg-accent-primary text-background" : "border-border-subtle bg-background/40 text-text-muted hover:text-text-primary"}`}
                            aria-pressed={fullscreenOverlayCorner === position.value}
                            aria-label={`Place the overlay at the ${position.label.toLowerCase()}`}
                            on:click={() => onCornerChange(position.value)}
                        >
                            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <rect x="2" y="3" width="20" height="16" rx="2" stroke="currentColor" stroke-width="1.5" />
                                <rect x={position.x} y={position.y} width="8" height="5" rx="1" fill="currentColor" />
                            </svg>
                            <span>{position.label}</span>
                        </button>
                    {:else}
                        <div aria-hidden="true"></div>
                    {/if}
                {/each}
            </div>

            <button
                type="button"
                class="mt-3 flex w-full items-center justify-between rounded-lg border border-border-subtle bg-background/40 px-2 py-2 text-xs font-medium text-text-primary"
                aria-pressed={fullscreenOverlayVisible}
                data-testid="session-overlay-visibility"
                on:click={() => onVisibleChange(!fullscreenOverlayVisible)}
            >
                <span>{fullscreenOverlayVisible ? "Overlay visible" : "Overlay hidden"}</span>
                <span class="text-text-muted">{fullscreenOverlayVisible ? "Hide" : "Show"}</span>
            </button>
        </div>
    {/if}
</div>
