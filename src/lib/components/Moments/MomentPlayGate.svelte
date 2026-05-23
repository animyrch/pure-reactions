<script>
  import CinematicButton from '$lib/components/design-system/CinematicButton.svelte';

  export let visible = false;
  export let onPlay = () => {};
</script>

{#if visible}
  <div
    class="absolute inset-0 z-20 flex items-center justify-center bg-black/55 px-6 backdrop-blur-[2px]"
    role="presentation"
  >
    <div class="max-w-sm text-center">
      <p class="text-lg font-semibold text-white">Watch this moment</p>
      <p class="mt-2 text-sm text-white/75">
        Tap play to start synchronized playback. Swiping to more reactions will continue automatically.
      </p>
      <div class="mt-6 flex justify-center">
        <CinematicButton type="button" variant="primary" on:click={onPlay}>
          Play moment reaction
        </CinematicButton>
      </div>
    </div>
  </div>
{/if}
