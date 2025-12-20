<script>
  export let isControlSurfaceVisible = false;
  export let isExitButtonExpanded = false;
  export let showCinematicBars = false;
  export let isReactionMissing = false;
  export let onExitClick = () => {};
  export let onExitEnter = () => {};
  export let onExitLeave = () => {};
  export let onPointerMove = () => {};
  export let onPointerDown = () => {};
  export let onPointerLeave = () => {};

  let overlayElement;
  export { overlayElement as overlayRef };
</script>

<div class="relative h-full w-full overflow-hidden">
  <div
    class={`absolute left-6 top-6 z-50 transition-opacity duration-200 ease-cinematic ${isControlSurfaceVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
  >
    <button
      type="button"
      class={`group flex items-center overflow-hidden rounded-full bg-surface/40 ${isExitButtonExpanded ? "pl-3 pr-4" : "px-3"} py-2 text-sm font-semibold text-text-primary shadow-elevated backdrop-blur transition-all duration-200 ease-cinematic hover:-translate-y-0.5 hover:bg-surface/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
      on:click={onExitClick}
      on:mouseenter={onExitEnter}
      on:mouseleave={onExitLeave}
      on:focus={onExitEnter}
      on:blur={onExitLeave}
      on:touchstart={onExitEnter}
      on:touchend={onExitLeave}
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
    bind:this={overlayElement}
    on:pointermove={onPointerMove}
    on:pointerdown={onPointerDown}
    on:pointerleave={onPointerLeave}
  ></div>
  <div class="absolute inset-0">
    <div id="player-original" class="h-full w-full"></div>
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
  {#if !isReactionMissing}
    <div
      class="pointer-events-auto absolute right-6 top-6 z-50 w-[min(28%,320px)]"
    >
      <div
        class="relative aspect-cinematic overflow-hidden rounded-lg bg-black/80 shadow-elevated"
      >
        <div id="player-reaction" class="absolute inset-0 h-full w-full"></div>
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
  {/if}
</div>
