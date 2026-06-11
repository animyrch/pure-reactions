<script>
  import SEO from '$lib/components/SEO.svelte';
  import ReactionsList from '$lib/components/ReactionsList.svelte';

  export let data = {};

  $: originalVideo = data?.originalVideo ?? {};
  $: reactions = data?.reactions ?? [];
  $: slug = data?.slug ?? '';

  // Build structured data for the original video
  $: schemaMarkup = (() => {
    const json = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${originalVideo.title} - Reactions`,
      url: `https://purereactions.com/reactions/${encodeURIComponent(slug)}`,
      mainEntity: {
        '@type': 'VideoObject',
        name: originalVideo.title || 'Original Video',
        author: {
          '@type': 'Person',
          name: originalVideo.author || 'Unknown Creator',
        },
        description: originalVideo.description || '',
        thumbnailUrl: originalVideo.thumbnailUrl || '',
        url: originalVideo.url || '',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: reactions.length,
        ratingCount: reactions.length,
      },
    }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    return `<script type="application/ld+json">${json}<` + `/script>`;
  })();

  const seoDescription = `Watch ${reactions.length} reactions to "${originalVideo.title}" by ${originalVideo.author}. Synchronized, fair-use-free reactions with twin-player technology on Pure Reactions.`;
</script>

<SEO
  title="{originalVideo.title} - Reactions | Pure Reactions"
  description={seoDescription}
  canonical="/reactions/{slug}"
  keywords="reactions to {originalVideo.title}, {originalVideo.author}, reaction videos, pure reactions"
  image={originalVideo.thumbnailUrl}
  type="collection"
/>

<svelte:head>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html schemaMarkup}
</svelte:head>

<div>
  <header class="mx-auto max-w-6xl px-4 pt-10 pb-4 sm:px-6 lg:px-10">
    <p class="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
      Reactions to Original Content
    </p>
    <h1 class="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl">
      {originalVideo.title || 'Original Video'}
    </h1>
    {#if originalVideo.author}
      <p class="mt-1 text-sm text-text-muted">
        by
        {#if originalVideo.authorUrl}
          <a href={originalVideo.authorUrl} target="_blank" rel="noopener noreferrer" class="hover:text-accent-primary">
            {originalVideo.author}
          </a>
        {:else}
          {originalVideo.author}
        {/if}
      </p>
    {/if}
    <p class="mt-3 text-sm text-text-muted">
      {reactions.length}
      {reactions.length === 1 ? 'reaction' : 'reactions'}
    </p>
  </header>

  {#if originalVideo.thumbnailUrl}
    <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 pb-6">
      <img
        src={originalVideo.thumbnailUrl}
        alt={originalVideo.title || 'Original video thumbnail'}
        class="w-full rounded-lg object-cover aspect-video"
        width={originalVideo.thumbnailWidth || 1280}
        height={originalVideo.thumbnailHeight || 720}
      />
    </div>
  {/if}

  {#if originalVideo.description}
    <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 pb-6">
      <p class="text-sm text-text-muted leading-relaxed">
        {originalVideo.description}
      </p>
    </div>
  {/if}

  <ReactionsList reactions={reactions} />
</div>

<style>
</style>
