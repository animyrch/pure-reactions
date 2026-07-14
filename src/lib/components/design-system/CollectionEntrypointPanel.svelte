<script>
  import CollectionHeader from './CollectionHeader.svelte';
  import CinematicButton from './CinematicButton.svelte';

  export let collectionType = 'queue';
  export let title = '';
  export let description = '';
  export let itemCount = 0;
  export let itemLabel = 'item';
  export let headingLevel = 'h1';
  export let statusMessage = '';
  export let primaryLabel = '';
  export let primaryAriaLabel = '';
  export let primaryDisabled = false;
  export let secondaryLabel = '';
  export let secondaryAriaLabel = '';
  export let secondaryDisabled = false;
  export let primaryLoading = false;
  export let secondaryLoading = false;
  export let onPrimaryClick = null;
  export let onSecondaryClick = null;

  const overlayBackgrounds = {
    queue: 'radial-gradient(circle at 15% 20%, rgba(167, 139, 250, 0.12), transparent 35%), radial-gradient(circle at 80% 10%, rgba(92, 178, 255, 0.05), transparent 30%), radial-gradient(circle at 40% 70%, rgba(52, 211, 153, 0.04), transparent 32%)',
    playlist: 'radial-gradient(circle at 15% 20%, rgba(92, 178, 255, 0.12), transparent 35%), radial-gradient(circle at 80% 10%, rgba(167, 139, 250, 0.05), transparent 30%), radial-gradient(circle at 40% 70%, rgba(251, 191, 36, 0.04), transparent 32%)',
    moment: 'radial-gradient(circle at 15% 20%, rgba(251, 191, 36, 0.12), transparent 35%), radial-gradient(circle at 80% 10%, rgba(92, 178, 255, 0.05), transparent 30%), radial-gradient(circle at 40% 70%, rgba(52, 211, 153, 0.04), transparent 32%)',
    similar: 'radial-gradient(circle at 15% 20%, rgba(52, 211, 153, 0.12), transparent 35%), radial-gradient(circle at 80% 10%, rgba(92, 178, 255, 0.05), transparent 30%), radial-gradient(circle at 40% 70%, rgba(167, 139, 250, 0.04), transparent 32%)',
  };

  const defaultPrimaryLabels = {
    queue: 'Play all',
    playlist: 'Play all',
    moment: 'Open collection',
    similar: 'Open collection',
  };

  const defaultPrimaryAriaLabels = {
    queue: 'Play all items in this queue from the beginning',
    playlist: 'Play all items in this playlist from the beginning',
    moment: 'Open this collection',
    similar: 'Open this collection',
  };

  $: overlayBackground = overlayBackgrounds[collectionType] || overlayBackgrounds.queue;
  $: resolvedPrimaryLabel = primaryLabel || defaultPrimaryLabels[collectionType] || 'Play all';
  $: resolvedPrimaryAriaLabel = primaryAriaLabel || defaultPrimaryAriaLabels[collectionType] || resolvedPrimaryLabel;
</script>

<section class="relative overflow-hidden rounded-[2rem] border border-border-strong/40 bg-surface/70 shadow-surface">
  <div class="pointer-events-none absolute inset-0" style={`background: ${overlayBackground};`} aria-hidden="true"></div>

  <div class="relative space-y-6 p-4 sm:p-6 lg:p-8">
    <CollectionHeader
      {collectionType}
      {title}
      {description}
      {itemCount}
      {itemLabel}
      {headingLevel}
    >
      <svelte:fragment slot="meta">
        <slot name="meta" />
      </svelte:fragment>
    </CollectionHeader>

    <div class="flex flex-col gap-3 rounded-2xl border border-border-strong/40 bg-background/50 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div class="min-h-6 text-sm text-text-muted">
        {#if statusMessage}
          {statusMessage}
        {/if}
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        {#if onPrimaryClick}
          <CinematicButton
            type="button"
            variant="primary"
            tone={collectionType}
            ariaLabel={resolvedPrimaryAriaLabel}
            disabled={primaryDisabled}
            loading={primaryLoading}
            on:click={onPrimaryClick}
          >
            {resolvedPrimaryLabel}
          </CinematicButton>
        {/if}

        {#if onSecondaryClick}
          <CinematicButton
            type="button"
            variant="secondary"
            ariaLabel={secondaryAriaLabel || secondaryLabel}
            disabled={secondaryDisabled}
            loading={secondaryLoading}
            on:click={onSecondaryClick}
          >
            {secondaryLabel}
          </CinematicButton>
        {/if}
      </div>
    </div>

    <slot />
  </div>
</section>