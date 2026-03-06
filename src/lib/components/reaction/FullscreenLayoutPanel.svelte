<script>
  import CinematicButton from "$lib/components/design-system/CinematicButton.svelte";

  export let fullscreenPrimaryVideo = "original";
  export let fullscreenOverlayWidthPercent = 35;
  export let fullscreenOverlayCorner = "top-right";
  export let onSetFullscreenPrimaryVideo = () => {};
  export let onSetFullscreenOverlayWidthPercent = () => {};
  export let onSetFullscreenOverlayCorner = () => {};

  const OVERLAY_WIDTH_MIN = 5;
  const OVERLAY_WIDTH_MAX = 50;
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

  const handleCornerSelect = (value) => {
    onSetFullscreenOverlayCorner(value);
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
            Choose a width from 5% to 50% in 5% steps.
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
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <button
          type="button"
          class={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-medium transition duration-subtle ease-cinematic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background ${fullscreenOverlayCorner === "top-left" ? "border-accent-primary bg-accent-primary/10 text-text-primary" : "border-border-subtle bg-background/40 text-text-muted hover:text-text-primary"}`}
          on:click={() => handleCornerSelect("top-left")}
          aria-pressed={fullscreenOverlayCorner === "top-left"}
          aria-label="Place smaller video in the top left"
        >
          <svg
            class="h-10 w-10"
            viewBox="0 0 40 40"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="36"
              height="36"
              rx="6"
              stroke="currentColor"
              stroke-width="2"
            />
            <rect
              x="6"
              y="6"
              width="12"
              height="8"
              rx="2"
              fill="currentColor"
              opacity="0.7"
            />
          </svg>
          <span>Top left</span>
        </button>
        <button
          type="button"
          class={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-medium transition duration-subtle ease-cinematic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background ${fullscreenOverlayCorner === "top-right" ? "border-accent-primary bg-accent-primary/10 text-text-primary" : "border-border-subtle bg-background/40 text-text-muted hover:text-text-primary"}`}
          on:click={() => handleCornerSelect("top-right")}
          aria-pressed={fullscreenOverlayCorner === "top-right"}
          aria-label="Place smaller video in the top right"
        >
          <svg
            class="h-10 w-10"
            viewBox="0 0 40 40"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="36"
              height="36"
              rx="6"
              stroke="currentColor"
              stroke-width="2"
            />
            <rect
              x="22"
              y="6"
              width="12"
              height="8"
              rx="2"
              fill="currentColor"
              opacity="0.7"
            />
          </svg>
          <span>Top right</span>
        </button>
        <button
          type="button"
          class={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-medium transition duration-subtle ease-cinematic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background ${fullscreenOverlayCorner === "bottom-left" ? "border-accent-primary bg-accent-primary/10 text-text-primary" : "border-border-subtle bg-background/40 text-text-muted hover:text-text-primary"}`}
          on:click={() => handleCornerSelect("bottom-left")}
          aria-pressed={fullscreenOverlayCorner === "bottom-left"}
          aria-label="Place smaller video in the bottom left"
        >
          <svg
            class="h-10 w-10"
            viewBox="0 0 40 40"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="36"
              height="36"
              rx="6"
              stroke="currentColor"
              stroke-width="2"
            />
            <rect
              x="6"
              y="26"
              width="12"
              height="8"
              rx="2"
              fill="currentColor"
              opacity="0.7"
            />
          </svg>
          <span>Bottom left</span>
        </button>
        <button
          type="button"
          class={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-medium transition duration-subtle ease-cinematic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background ${fullscreenOverlayCorner === "bottom-right" ? "border-accent-primary bg-accent-primary/10 text-text-primary" : "border-border-subtle bg-background/40 text-text-muted hover:text-text-primary"}`}
          on:click={() => handleCornerSelect("bottom-right")}
          aria-pressed={fullscreenOverlayCorner === "bottom-right"}
          aria-label="Place smaller video in the bottom right"
        >
          <svg
            class="h-10 w-10"
            viewBox="0 0 40 40"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="36"
              height="36"
              rx="6"
              stroke="currentColor"
              stroke-width="2"
            />
            <rect
              x="22"
              y="26"
              width="12"
              height="8"
              rx="2"
              fill="currentColor"
              opacity="0.7"
            />
          </svg>
          <span>Bottom right</span>
        </button>
        <button
          type="button"
          class={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-medium transition duration-subtle ease-cinematic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background ${fullscreenOverlayCorner === "bottom-center" ? "border-accent-primary bg-accent-primary/10 text-text-primary" : "border-border-subtle bg-background/40 text-text-muted hover:text-text-primary"}`}
          on:click={() => handleCornerSelect("bottom-center")}
          aria-pressed={fullscreenOverlayCorner === "bottom-center"}
          aria-label="Place smaller video at the bottom center"
        >
          <svg
            class="h-10 w-10"
            viewBox="0 0 40 40"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="36"
              height="36"
              rx="6"
              stroke="currentColor"
              stroke-width="2"
            />
            <rect
              x="14"
              y="26"
              width="12"
              height="8"
              rx="2"
              fill="currentColor"
              opacity="0.7"
            />
          </svg>
          <span>Bottom center</span>
        </button>
      </div>
    </div>
  </div>
</section>
