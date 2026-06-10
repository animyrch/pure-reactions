<script>
  import SEO from '$lib/components/SEO.svelte';
  import ReactionsList from '$lib/components/ReactionsList.svelte';
  import ReactionThumbnail from '$lib/components/ReactionThumbnail.svelte';

  export let data;

  const { originalVideo, reactions, slug } = data;
  const canonicalUrl = `/reactions/${slug}`;
</script>

<SEO
  title="Reactions to {originalVideo.title}"
  description="See how different creators are reacting to {originalVideo.title} by {originalVideo.author}."
  canonical={canonicalUrl}
  image={originalVideo.thumbnailUrl}
/>

<div class="container mx-auto px-4 py-8">
  <div class="space-y-8">
    <a href={slug ? `/reactions/${slug}` : '#'} class="block focus:outline-none" aria-label={originalVideo.title ? `View reactions to ${originalVideo.title}` : 'View reactions'}>
      <div class="rounded-lg border border-white/8 bg-surface p-4">
        <ReactionThumbnail
          linkless={true}
          originalVideoId={originalVideo.videoId || originalVideo.id || originalVideo.originalVideoId}
          originalVideoTitle={originalVideo.title}
          reactionVideoAuthor={originalVideo.author}
          interactive={false}
          showContextMenu={false}
        />
      </div>
    </a>
    <div>
      <h2 class="text-2xl font-bold text-text-primary mb-4">
        All Reactions
      </h2>
      <ReactionsList {reactions} />
    </div>
  </div>
</div>
