<script>
  import SEO from '$lib/components/SEO.svelte';
  import ReactionsList from '$lib/components/ReactionsList.svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  export let data = {};

  $: originalVideo = data?.originalVideo ?? {};
  $: reactions = data?.reactions ?? [];
  $: slug = data?.slug ?? '';

  const TITLE_NOISE_SUFFIX =
    /\s*(?:\(|\[)?(?:m\/v|m-v|mv|official\s+music\s+video|official\s+lyric\s+video|official\s+video)(?:\)|\])?\s*$/i;

  const quotedTitle = (title, author) => {
    const full = typeof title === 'string' ? title.trim() : '';
    if (!full) return 'this video';

    let short = full.replace(TITLE_NOISE_SUFFIX, '').trim();
    const authorName = typeof author === 'string' ? author.trim() : '';
    if (authorName) {
      const escaped = authorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      short = short.replace(new RegExp(`^${escaped}\\s*[-:–—|]\\s*`, 'i'), '').trim();
    }
    short = short.replace(/^['"“”‘’]+|['"“”‘’]+$/g, '').trim();
    return short || full;
  };

  const formatDuration = (seconds) => {
    const total = Number(seconds);
    if (!Number.isFinite(total) || total <= 0) return '';
    const rounded = Math.round(total);
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const secs = rounded % 60;
    const paddedSeconds = String(secs).padStart(2, '0');
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
    }
    return `${minutes}:${paddedSeconds}`;
  };

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

  $: durationLabel = formatDuration(originalVideo.durationSeconds);
  $: creatorCountLabel =
    reactions.length === 1
      ? '1 creator reacted to this video'
      : `${reactions.length} creators reacted to this video`;
  $: watchAllLabel =
    reactions.length === 1
      ? 'Watch All 1 Reaction'
      : `Watch All ${reactions.length} Reactions`;
  $: heroDescription = originalVideo.author
    ? `Watch creators react to ${originalVideo.author}'s '${quotedTitle(originalVideo.title, originalVideo.author)}' in sync with the original music video. Different perspectives, genuine reactions, all in one place.`
    : `Watch creators react to '${quotedTitle(originalVideo.title, originalVideo.author)}' in sync with the original music video. Different perspectives, genuine reactions, all in one place.`;

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
  <header class="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 lg:px-10">
    <div class="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
      {#if originalVideo.thumbnailUrl}
        <div class="relative w-full shrink-0 overflow-hidden rounded-xl lg:w-[28rem]">
          <img
            src={originalVideo.thumbnailUrl}
            alt={originalVideo.title || 'Original video thumbnail'}
            class="aspect-video w-full object-cover"
            width={originalVideo.thumbnailWidth || 1280}
            height={originalVideo.thumbnailHeight || 720}
          />
          <span class="absolute bottom-3 left-3 rounded-md bg-black/75 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
            Original Video
          </span>
        </div>
      {/if}

      <div class="flex min-w-0 flex-1 flex-col">
        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
          Reactions to Original Content
        </p>
        <h1 class="mt-2 text-2xl font-bold text-text-primary sm:text-3xl lg:text-4xl">
          {originalVideo.title || 'Original Video'}
        </h1>

        {#if originalVideo.author || durationLabel}
          <p class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
            {#if originalVideo.platform === 'tiktok'}
              <svg class="h-4 w-4 text-text-primary" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M14.5 3c.4 2.4 1.8 4.1 4.2 4.4v2.7c-1.5 0-2.9-.5-4.1-1.3v6.7c0 3.4-2.7 6.1-6.2 6.1S2.2 19 2.2 15.5 4.9 9.4 8.4 9.4c.4 0 .8 0 1.2.1v2.8c-.4-.2-.8-.3-1.2-.3-1.9 0-3.4 1.5-3.4 3.5s1.5 3.5 3.4 3.5 3.4-1.5 3.4-3.5V3h2.7z" />
              </svg>
            {:else}
              <svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <rect width="24" height="24" rx="5" fill="#ff0033" />
                <path d="M10 8.2v7.6l6.2-3.8L10 8.2z" fill="#fff" />
              </svg>
            {/if}
            {#if originalVideo.author}
              <span>{originalVideo.author}</span>
            {/if}
            {#if originalVideo.author && durationLabel}
              <span aria-hidden="true">•</span>
            {/if}
            {#if durationLabel}
              <span>{durationLabel}</span>
            {/if}
          </p>
        {/if}

        <p class="mt-3 max-w-3xl text-sm leading-relaxed text-text-muted">
          {heroDescription}
        </p>

        <div class="mt-auto flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p class="flex items-center gap-2 text-sm text-text-muted">
            <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
              <circle cx="9" cy="8" r="2.4" />
              <circle cx="16" cy="9" r="2" />
              <path stroke-linecap="round" d="M4.8 18.2c.5-2.4 2.3-3.7 4.2-3.7s3.7 1.3 4.2 3.7" />
              <path stroke-linecap="round" d="M13.2 14.7c1.5-.3 3 .4 3.8 2.1" />
            </svg>
            <span>{creatorCountLabel}</span>
          </p>
          {#if reactions.length > 0}
            <button
              type="button"
              on:click={handlePlayAll}
              class="inline-flex items-center justify-center gap-3 rounded-full bg-accent-secondary px-6 py-3 text-base font-semibold text-white transition hover:bg-accent-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={watchAllLabel}
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5-11-6.5z" />
              </svg>
              {watchAllLabel}
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
              </svg>
            </button>
          {/if}
        </div>
      </div>
    </div>
  </header>

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
