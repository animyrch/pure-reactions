<script>
  /**
   * CollectionHeader — unified header for all list-based reaction experiences.
   *
   * Provides a consistent layout with:
   * - A small uppercase label that identifies the collection type
   * - A collection-type highlight colour (left accent bar + label tint)
   * - Title, optional description, item count, and action buttons
   *
   * @prop {'queue' | 'playlist' | 'moment' | 'similar'} collectionType
   * @prop {string}  title
   * @prop {string}  [description='']
   * @prop {number}  [itemCount=0]
   * @prop {string}  [itemLabel='item']   — singular noun (e.g. "reaction")
   * @prop {'h1' | 'h2' | 'h3'} [headingLevel='h1'] — semantic heading level
   */

  export let collectionType = 'queue';
  export let title = '';
  export let description = '';
  export let itemCount = 0;
  export let itemLabel = 'item';
  export let headingLevel = 'h1';

  const labels = {
    queue: 'Queue',
    playlist: 'Playlist',
    moment: 'Moment',
    similar: 'Similar Reactions',
  };

  const accentClasses = {
    queue: 'border-collection-queue text-collection-queue',
    playlist: 'border-collection-playlist text-collection-playlist',
    moment: 'border-collection-moment text-collection-moment',
    similar: 'border-collection-similar text-collection-similar',
  };

  const accentBarClasses = {
    queue: 'bg-collection-queue',
    playlist: 'bg-collection-playlist',
    moment: 'bg-collection-moment',
    similar: 'bg-collection-similar',
  };

  $: label = labels[collectionType] || 'Collection';
  $: accent = accentClasses[collectionType] || accentClasses.queue;
  $: accentBar = accentBarClasses[collectionType] || accentBarClasses.queue;
  $: countText = itemCount === 1
    ? `1 ${itemLabel}`
    : `${itemCount} ${itemLabel}s`;
</script>

<header class="collection-header relative pl-4" aria-label="{label}: {title}">
  <!-- Accent bar -->
  <span
    class="absolute left-0 top-0 h-full w-[3px] rounded-full {accentBar}"
    aria-hidden="true"
  ></span>

  <div class="space-y-2">
    <p class="text-xs font-semibold uppercase tracking-[0.3em] {accent}">
      {label}
    </p>

    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div class="space-y-1.5">
        <svelte:element this={headingLevel} class="text-2xl font-semibold text-text-primary sm:text-3xl md:text-4xl">
          {title}
        </svelte:element>
        {#if description}
          <p class="max-w-3xl text-sm text-text-muted">{description}</p>
        {/if}
      </div>

      <div class="flex items-center gap-3 text-sm text-text-muted">
        <span
          class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur"
        >
          {countText}
        </span>
        <!-- Slot for extra metadata (owner badge, publish toggle, etc.) -->
        <slot name="meta" />
      </div>
    </div>

    <!-- Slot for action buttons (play, resume, etc.) -->
    <slot name="actions" />
  </div>
</header>
