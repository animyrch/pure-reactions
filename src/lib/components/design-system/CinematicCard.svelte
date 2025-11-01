<script>
  export let title = '';
  export let description = '';
  export let thumbnail = '';
  export let metadata = '';
  export let href;
  export let target;
  export let rel;
  export let ariaLabel;
  export let interactive = false;

  const isLink = typeof href === 'string' && href.length > 0;
  const rootTag = isLink ? 'a' : 'div';
  const computedRel = rel ?? (isLink && href.startsWith('http') ? 'noopener noreferrer' : undefined);
  const ariaLabelValue = ariaLabel ?? (isLink && !title ? description : undefined);
  $: altText = title || description || 'Reaction thumbnail';
</script>

<svelte:element
  this={rootTag}
  href={isLink ? href : undefined}
  target={target}
  rel={isLink ? computedRel : undefined}
  aria-label={ariaLabelValue}
  class="group relative flex flex-col overflow-hidden rounded-md bg-surface text-text-primary shadow-surface transition duration-deliberate ease-cinematic hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  class:cursor-pointer={isLink || interactive}
  tabindex={!isLink && interactive ? '0' : undefined}
  role={!isLink && interactive ? 'button' : undefined}
>
  <div class="relative aspect-cinematic overflow-hidden">
    {#if thumbnail}
      <img
        src={thumbnail}
        alt={altText}
        class="h-full w-full object-cover object-center transition duration-slow ease-cinematic group-hover:scale-[1.02]"
        loading="lazy"
      />
    {/if}
    <slot name="thumbnailOverlay" />
  </div>

  <div class="flex flex-1 flex-col gap-sm p-md">
    {#if title}
      <h3 class="text-lg font-semibold text-text-primary">
        {title}
      </h3>
    {/if}

    {#if description}
      <p class="text-sm text-text-muted">
        {description}
      </p>
    {/if}

    <slot />

    {#if metadata}
      <p class="mt-auto text-xs uppercase tracking-wide text-text-secondary">
        {metadata}
      </p>
    {/if}

    <slot name="meta" />
  </div>
</svelte:element>
