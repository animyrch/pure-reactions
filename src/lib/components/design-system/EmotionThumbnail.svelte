<script>
  export let src = '';
  export let alt = '';
  export let loading = 'lazy';
  export let objectPosition = 'center';
  export let aspect = 'cinematic';
  export let caption = '';

  const aspectClasses = {
    cinematic: 'aspect-cinematic',
    portrait: 'aspect-portrait',
  };

  $: aspectClass = aspectClasses[aspect] ?? aspectClasses.cinematic;
</script>

<figure class="relative inline-flex flex-col overflow-hidden rounded-md bg-surface shadow-surface">
  <div class={`relative ${aspectClass} overflow-hidden`}>
    {#if src}
      <img
        src={src}
        alt={alt || caption || 'Reaction thumbnail'}
        loading={loading}
        style={`object-position: ${objectPosition};`}
        class="h-full w-full object-cover transition duration-slow ease-cinematic"
      />
    {/if}
    <slot name="overlay" />
  </div>

  {#if caption}
    <figcaption class="px-md py-sm text-sm text-text-secondary">
      {caption}
    </figcaption>
  {/if}
</figure>
