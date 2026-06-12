<script>
  import CinematicButton from "$lib/components/design-system/CinematicButton.svelte";

  export let fullscreenPrimaryVideo = "original";
  export let fullscreenOverlayWidthPercent = 35;
  export let fullscreenOverlayCorner = "top-right";
  export let onSetFullscreenPrimaryVideo = () => {};
  export let onSetFullscreenOverlayWidthPercent = () => {};
  export let onOpenOverlayPositionPanel = () => {};

  const OVERLAY_WIDTH_MIN = 5;
  const OVERLAY_WIDTH_MAX = 80;
  const OVERLAY_WIDTH_STEP = 5;
  const DEFAULT_OVERLAY_WIDTH = 35;

  let overlayWidthValue = Number.isFinite(fullscreenOverlayWidthPercent)
    ? fullscreenOverlayWidthPercent
    : DEFAULT_OVERLAY_WIDTH;
  let lastOverlayWidthProp = fullscreenOverlayWidthPercent;

  $: if (fullscreenOverlayWidthPercent !== lastOverlayWidthProp) {
    lastOverlayWidthProp = fullscreenOverlayWidthPercent;
    overlayWidthValue = Number.isFinite(fullscreenOverlayWidthPercent)
      ? fullscreenOverlayWidthPercent
      : DEFAULT_OVERLAY_WIDTH;
  }

  $: isOverlayWidthDirty =
    Number.isFinite(overlayWidthValue) &&
    overlayWidthValue !== fullscreenOverlayWidthPercent;

  const handleOverlayWidthInput = (event) => {
    const value = Number.parseFloat(event.currentTarget.value);
    overlayWidthValue = Number.isNaN(value) ? DEFAULT_OVERLAY_WIDTH : value;
  };

  const handleOverlayWidthSubmit = () => {
    if (!Number.isFinite(overlayWidthValue)) return;
    const snapped =
      Math.round(overlayWidthValue / OVERLAY_WIDTH_STEP) * OVERLAY_WIDTH_STEP;
    const clamped = Math.max(
      OVERLAY_WIDTH_MIN,
      Math.min(OVERLAY_WIDTH_MAX, snapped),
    );
    onSetFullscreenOverlayWidthPercent(clamped);
  };

  const handlePrimaryVideoSelect = (value) => {
    onSetFullscreenPrimaryVideo(value);
  };

  const CORNER_LABELS = {
    "top-left": "Top left",
    "top-center": "Top center",
    "top-right": "Top right",
    "middle-left": "Middle left",
    "middle-right": "Middle right",
    "bottom-left": "Bottom left",
    "bottom-center": "Bottom center",
    "bottom-right": "Bottom right",
  };
</script>

<section
  class="rounded-3xl border border-border-subtle bg-surface/80 px-6 py-6 shadow-elevated"
>
  <header
    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
  >
    <div>
      <h2 class="text-lg font-semibold text-text-primary">
        Fullscreen layout
      </h2>
      <p class="text-sm text-text-muted">
        Decide which video fills the screen, how large the overlay feels, and
        where it sits in the corner.
      </p>
    </div>
  </header>

  <div class="mt-6 flex flex-col gap-6">
    <div class="grid gap-4 md:grid-cols-2">
      <div class="flex flex-col gap-3">
        <h3 class="text-sm font-medium text-text-secondary">
          Fullscreen video
        </h3>
        <div class="grid grid-cols-2 gap-3">
          <button
            type="button"
            class={`flex flex-col items-center gap-2 rounded-2xl border px-4 py-4 text-sm font-medium transition duration-subtle ease-cinematic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background ${fullscreenPrimaryVideo === "original" ? "border-accent-primary bg-accent-primary/10 text-text-primary" : "border-border-subtle bg-background/40 text-text-muted hover:text-text-primary"}`}
            on:click={() => handlePrimaryVideoSelect("original")}
            aria-pressed={fullscreenPrimaryVideo === "original"}
            aria-label="Set original video as fullscreen"
          >
            <svg
              class="h-10 w-16"
              viewBox="0 0 80 48"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="1"
                y="1"
                width="78"
                height="46"
                rx="6"
                stroke="currentColor"
                stroke-width="2"
              />
              <rect
                x="52"
                y="8"
                width="20"
                height="12"
                rx="3"
                fill="currentColor"
                opacity="0.7"
              />
            </svg>
            <span>Original fullscreen</span>
          </button>
          <button
            type="button"
            class={`flex flex-col items-center gap-2 rounded-2xl border px-4 py-4 text-sm font-medium transition duration-subtle ease-cinematic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background ${fullscreenPrimaryVideo === "reaction" ? "border-accent-primary bg-accent-primary/10 text-text-primary" : "border-border-subtle bg-background/40 text-text-muted hover:text-text-primary"}`}
            on:click={() => handlePrimaryVideoSelect("reaction")}
            aria-pressed={fullscreenPrimaryVideo === "reaction"}
            aria-label="Set reaction video as fullscreen"
          >
            <svg
              class="h-10 w-16"
              viewBox="0 0 80 48"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="1"
                y="1"
                width="78"
                height="46"
                rx="6"
                stroke="currentColor"
                stroke-width="2"
              />
              <rect
                x="8"
                y="28"
                width="20"
                height="12"
                rx="3"
                fill="currentColor"
                opacity="0.7"
              />
            </svg>
            <span>Reaction fullscreen</span>
          </button>
        </div>
      </div>

      <form
        class="flex flex-col gap-4"
        on:submit|preventDefault={handleOverlayWidthSubmit}
      >
        <div>
          <h3 class="text-sm font-medium text-text-secondary">
            Smaller video width
          </h3>
          <p class="mt-1 text-sm text-text-muted">
            Choose a width from 5% to 80% in 5% steps.
          </p>
        </div>
        <div class="flex w-full flex-col gap-2">
          <div class="flex items-center justify-between">
            <label
              class="text-sm font-medium text-text-secondary"
              for="fullscreen-overlay-width">Overlay width</label
            >
            <span class="text-sm text-text-muted">{overlayWidthValue}%</span>
          </div>
          <input
            id="fullscreen-overlay-width"
            class="h-2 w-full rounded-full bg-border-subtle accent-accent-primary"
            type="range"
            min={OVERLAY_WIDTH_MIN}
            max={OVERLAY_WIDTH_MAX}
            step={OVERLAY_WIDTH_STEP}
            value={overlayWidthValue}
            on:input={handleOverlayWidthInput}
          />
        </div>
        <div class="flex justify-end">
          <CinematicButton
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!isOverlayWidthDirty}
          >
            <span>Save overlay size</span>
          </CinematicButton>
        </div>
      </form>
    </div>

    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-medium text-text-secondary">
        Smaller video position
      </h3>
      <div class="flex items-center gap-3">
        <span class="text-sm text-text-muted">
          Current: <span class="font-medium text-text-secondary">{CORNER_LABELS[fullscreenOverlayCorner] ?? fullscreenOverlayCorner}</span>
        </span>
        <button
          type="button"
          class="flex items-center gap-2 rounded-2xl border border-border-subtle bg-background/40 px-4 py-2 text-sm font-medium text-text-muted transition duration-subtle ease-cinematic hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          on:click={onOpenOverlayPositionPanel}
          aria-label="Open overlay position picker"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span>Change position</span>
        </button>
      </div>
    </div>
  </div>
</section>
