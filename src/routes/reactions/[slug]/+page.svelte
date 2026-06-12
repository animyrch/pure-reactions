<script>
  import SEO from '$lib/components/SEO.svelte';
  import ReactionsList from '$lib/components/ReactionsList.svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  export let data = {};

  $: originalVideo = data?.originalVideo ?? {};
  $: reactions = data?.reactions ?? [];
  $: slug = data?.slug ?? '';

  const handlePlayAll = async () => {
    if (!reactions.length) return;

    // Create an ad-hoc queue with all reactions
    const reactionIds = reactions.map((r) => r.id);
    const firstReactionId = reactionIds[0];

    // Build query params for ad-hoc queue mode
    const params = new URLSearchParams();
    params.set('adHocQueue', JSON.stringify(reactionIds));
    params.set('adHocQueueIndex', '0');
    params.set('queueAutoPlay', 'true');

    if (browser) {
      await goto(`/reaction/${firstReactionId}?${params.toString()}`);
    }
  };

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

  // Use `data` directly here (it's always defined) so compiled bundles
  // don't accidentally reference `reactions` / `originalVideo` before
  // those local variables are initialized.
  const seoDescription = `Watch ${ (data?.reactions ?? []).length } reactions to "${data?.originalVideo?.title || ''}" by ${data?.originalVideo?.author || ''}. Synchronized, fair-use-free reactions with twin-player technology on Pure Reactions.`;
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
  <header class="mx-auto max-w-6xl px-4 pt-10 pb-6 sm:px-6 lg:px-10">
    <p class="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
      Reactions to Original Content
    </p>
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-2">
      <div class="flex-1">
        <h1 class="text-2xl font-semibold text-text-primary sm:text-3xl">
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
        <p class="mt-2 text-sm text-text-muted">
          Watch multiple creators react in sync with the original video.
        </p>
      </div>
      {#if reactions.length > 0}
        <button
          on:click={handlePlayAll}
          class="px-4 py-2 bg-accent-primary text-white font-semibold rounded-lg hover:bg-opacity-90 transition-all duration-200 shrink-0"
          aria-label="Play all reactions"
        >
          Play All
        </button>
      {/if}
    </div>
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
