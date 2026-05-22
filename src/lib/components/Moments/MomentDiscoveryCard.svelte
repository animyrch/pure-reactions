<script>
  import { buildYouTubeThumbnailUrl } from '$lib/helpers/originalVideo';
  import { buildMomentPagePath } from '$lib/helpers/momentsFirestore';

  export let moment = {};

  $: momentId = moment.objectID || moment.id;
  $: href = buildMomentPagePath(momentId);
  $: title = moment.title || 'Untitled moment';
  $: originalTitle = moment.originalVideoTitle || 'Original video';
  $: reactionCount = Number(moment.reactionCount) || 0;
  $: thumbnail =
    moment.originalVideoThumbnailUrl ||
    buildYouTubeThumbnailUrl(moment.originalVideoId) ||
    '';
  $: tags = Array.isArray(moment.tags) ? moment.tags.slice(0, 3) : [];
</script>

<article class="group flex h-full flex-col overflow-hidden rounded-2xl border border-border-strong/40 bg-surface/80 shadow-surface transition duration-300 ease-cinematic hover:border-border-strong/70 hover:shadow-elevated">
  <a
    {href}
    class="relative block aspect-video overflow-hidden bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    aria-label={`Open moment: ${title}`}
  >
    {#if thumbnail}
      <img
        src={thumbnail}
        alt=""
        class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
        loading="lazy"
        decoding="async"
      />
    {:else}
      <div class="flex h-full items-center justify-center text-sm text-text-muted">No preview</div>
    {/if}
    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
      <p class="text-xs uppercase tracking-wide text-white/70">Original</p>
      <p class="line-clamp-1 text-sm font-medium text-white">{originalTitle}</p>
    </div>
  </a>

  <div class="flex flex-1 flex-col gap-3 p-4">
    <a {href} class="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm">
      <h2 class="line-clamp-2 text-lg font-semibold text-text-primary group-hover:text-white">
        {title}
      </h2>
    </a>

    <p class="text-sm text-text-secondary">
      {reactionCount} {reactionCount === 1 ? 'reaction' : 'reactions'}
    </p>

    {#if tags.length}
      <ul class="flex flex-wrap gap-2" aria-label="Tags">
        {#each tags as tag}
          <li class="rounded-full bg-background/80 px-2.5 py-0.5 text-xs text-text-muted">{tag}</li>
        {/each}
      </ul>
    {/if}
  </div>
</article>
