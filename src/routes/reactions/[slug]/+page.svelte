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
    const itemListElements = reactions.slice(0, 10).map((reaction, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `https://purereactions.com/reaction/${reaction.id}`,
      name: reaction.data?.title || 'Reaction Video',
    }));

    const json = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Best Reactions to ${originalVideo.title}`,
      description: `Watch multiple reactions to ${originalVideo.title} in sync with the original video. Compare creators, binge reactions, and explore different perspectives in one place.`,
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
        name: `${reactions.length} reactions`,
      },
      itemListElement: itemListElements,
    }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    return `<script type="application/ld+json">${json}<` + `/script>`;
  })();

  // Use `data` directly here (it's always defined) so compiled bundles
  // don't accidentally reference `reactions` / `originalVideo` before
  // those local variables are initialized.
  const seoDescription = `Watch multiple reactions to ${data?.originalVideo?.title || ''} in sync with the original video. Compare creators, binge reactions, and explore different perspectives in one place.`;
</script>

<SEO
  title="Best Reactions to {originalVideo.title} | PureReactions"
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
          Best Reactions to {originalVideo.title || 'Original Video'}
        </h1>
        {#if originalVideo.author}
          <p class="mt-2 text-sm text-text-muted">
            Watch multiple creators react to {originalVideo.author}'s {originalVideo.title} in sync with the original music video.
          </p>
        {/if}
        <p class="mt-3 text-sm text-text-muted font-semibold">
          {reactions.length === 1 ? `${reactions.length} reaction available` : `Watch ${reactions.length} creators react to this video`}
        </p>
      </div>
      {#if reactions.length > 0}
        <button
          on:click={handlePlayAll}
          class="px-4 py-2 bg-accent-primary text-white font-semibold rounded-lg hover:bg-opacity-90 transition-all duration-200 shrink-0"
          aria-label="Watch all reactions"
        >
          Watch All Reactions
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
        Explore multiple reactions to {originalVideo.author ? `${originalVideo.author}'s` : ''} {originalVideo.title}. Compare how different creators respond to the same moments, choreography, visuals, vocals, and standout highlights throughout the video.
      </p>
    </div>
  {/if}

  <ReactionsList reactions={reactions} />

  {#if reactions.length > 0}
    <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-10">
      <p class="text-sm text-text-muted leading-relaxed">
        Looking for more reactions to {originalVideo.author || 'this video'}? Explore additional reaction collections, compare creators, and discover new perspectives on your favorite music videos.
      </p>
    </div>
  {/if}
</div>

<style>
</style>
