<script>
  /**
   * CollectionListItem — unified card wrapper for items inside any collection list.
   *
   * Provides consistent styling across Queue, Playlist, Moment, and Similar
   * Reactions lists: a thin collection-type accent border on the left, cinematic
   * surface background, hover lift, and focus-visible ring.
   *
   * Content is projected via the default slot so each page keeps its own
   * item component (QueueBinomeCard, MomentDiscoveryCard, etc.).
   *
   * @prop {'queue' | 'playlist' | 'moment' | 'similar'} collectionType
   * @prop {boolean}  [interactive=true]  — enables hover/focus lift effects
   * @prop {string}   [tag='div']         — wrapper element tag
   */

  export let collectionType = 'queue';
  export let interactive = true;
  export let tag = 'div';

  const accentBorderClasses = {
    queue: 'border-l-collection-queue',
    playlist: 'border-l-collection-playlist',
    moment: 'border-l-collection-moment',
    similar: 'border-l-collection-similar',
  };

  $: accentBorder = accentBorderClasses[collectionType] || accentBorderClasses.queue;
  $: interactiveClasses = interactive
    ? 'hover:border-border-strong/70 hover:shadow-elevated hover:-translate-y-0.5'
    : '';
</script>

<svelte:element
  this={tag}
  class="collection-list-item rounded-2xl border border-border-strong/40 border-l-[3px] {accentBorder} bg-surface/80 shadow-surface transition duration-300 ease-cinematic {interactiveClasses}"
>
  <slot />
</svelte:element>
