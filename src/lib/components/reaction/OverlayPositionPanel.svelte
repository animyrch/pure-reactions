<script>
  export let fullscreenOverlayCorner = "top-right";
  export let onSetFullscreenOverlayCorner = () => {};
  export let onClose = () => {};

  const POSITIONS = [
    {
      value: "top-left",
      label: "Top left",
      ariaLabel: "Place smaller video in the top left",
      svgRect: { x: 6, y: 6 },
    },
    {
      value: "top-center",
      label: "Top center",
      ariaLabel: "Place smaller video at the top center",
      svgRect: { x: 14, y: 6 },
    },
    {
      value: "top-right",
      label: "Top right",
      ariaLabel: "Place smaller video in the top right",
      svgRect: { x: 22, y: 6 },
    },
    {
      value: "middle-left",
      label: "Middle left",
      ariaLabel: "Place smaller video in the middle left",
      svgRect: { x: 6, y: 16 },
    },
    {
      value: "middle-right",
      label: "Middle right",
      ariaLabel: "Place smaller video in the middle right",
      svgRect: { x: 22, y: 16 },
    },
    {
      value: "bottom-left",
      label: "Bottom left",
      ariaLabel: "Place smaller video in the bottom left",
      svgRect: { x: 6, y: 26 },
    },
    {
      value: "bottom-center",
      label: "Bottom center",
      ariaLabel: "Place smaller video at the bottom center",
      svgRect: { x: 14, y: 26 },
    },
    {
      value: "bottom-right",
      label: "Bottom right",
      ariaLabel: "Place smaller video in the bottom right",
      svgRect: { x: 22, y: 26 },
    },
  ];

  const handleSelect = (value) => {
    onSetFullscreenOverlayCorner(value);
  };
</script>

<section
  class="rounded-3xl border border-border-subtle bg-surface/80 px-6 py-6 shadow-elevated"
  aria-label="Overlay position"
>
  <header
    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
  >
    <div>
      <h2 class="text-lg font-semibold text-text-primary">
        Overlay position
      </h2>
      <p class="text-sm text-text-muted">
        Choose where the smaller video sits on screen.
      </p>
    </div>
    <button
      type="button"
      class="flex-none self-end rounded-2xl border border-border-subtle bg-background/40 px-4 py-2 text-sm font-medium text-text-muted transition duration-subtle ease-cinematic hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:self-auto"
      on:click={onClose}
      aria-label="Close overlay position panel"
    >
      Close
    </button>
  </header>

  <div class="mt-6">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {#each POSITIONS as position (position.value)}
        <button
          type="button"
          class={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-medium transition duration-subtle ease-cinematic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background ${fullscreenOverlayCorner === position.value ? "border-accent-primary bg-accent-primary/10 text-text-primary" : "border-border-subtle bg-background/40 text-text-muted hover:text-text-primary"}`}
          on:click={() => handleSelect(position.value)}
          aria-pressed={fullscreenOverlayCorner === position.value}
          aria-label={position.ariaLabel}
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
              x={position.svgRect.x}
              y={position.svgRect.y}
              width="12"
              height="8"
              rx="2"
              fill="currentColor"
              opacity="0.7"
            />
          </svg>
          <span>{position.label}</span>
        </button>
      {/each}
    </div>
  </div>
</section>
