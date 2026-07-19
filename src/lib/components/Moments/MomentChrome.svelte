<script>
  import { goto } from '$app/navigation';
  import { PlusOutline, VideoCameraOutline } from 'flowbite-svelte-icons';
  import CinematicButton from '$lib/components/design-system/CinematicButton.svelte';

  export let momentId = '';
  export let momentTitle = '';
  export let onAddReaction = () => {};
  export let addReactionLoading = false;

  const goCreateMoment = () => goto('/moments/new');
</script>

<header
  class="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 pt-4 sm:px-6"
>
  <div class="pointer-events-auto min-w-0 flex-1">
    <a
      href="/moments"
      class="text-xs font-medium uppercase tracking-wide text-white/70 transition hover:text-white"
    >
      Moments
    </a>
    <h1 class="mt-1 line-clamp-2 text-lg font-semibold text-white sm:text-xl">{momentTitle}</h1>
  </div>

  <div class="pointer-events-auto flex shrink-0 flex-col gap-2">
    <CinematicButton
      type="button"
      variant="secondary"
      class="!px-3 !py-2 text-xs sm:text-sm"
      disabled={addReactionLoading || !momentId}
      on:click={onAddReaction}
    >
      <span class="inline-flex items-center gap-2">
        <PlusOutline class="h-4 w-4" aria-hidden="true" />
        {addReactionLoading ? 'Starting…' : 'Add reaction'}
      </span>
    </CinematicButton>
    <CinematicButton
      type="button"
      variant="ghost"
      class="!px-3 !py-2 text-xs text-white/90 sm:text-sm"
      on:click={goCreateMoment}
    >
      <span class="inline-flex items-center gap-2">
        <VideoCameraOutline class="h-4 w-4" aria-hidden="true" />
        New moment
      </span>
    </CinematicButton>
  </div>
</header>
