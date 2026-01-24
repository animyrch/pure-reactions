<script>
    import ReactionThumbnail from '$lib/components/ReactionThumbnail.svelte';

    export let reaction;

    const playlistId = reaction?.data?.playlistId;
    const itemType = reaction?.type === 'queue'
        ? 'queue'
        : playlistId
          ? 'playlist'
          : reaction?.type || 'reaction';
    const reactionPageId = reaction?.id;
    const reactionVideoId = reaction?.data?.reactionVideoId;
    const originalVideoId = reaction?.data?.originalVideoId;
    const reactionVideoTitle = reaction?.data?.reactionVideoTitle;
    const reactionVideoAuthor = reaction?.data?.reactionVideoAuthor;
    const reactorDisplayName = reaction?.data?.reactorDisplayName;
    const originalVideoTitle = reaction?.data?.originalVideoTitle;
    const queueTitle = reaction?.data?.title;
    const queueSlug = reaction?.data?.slug;
</script>

<div>
    <ReactionThumbnail
        {reactionPageId}
        {reactionVideoId}
        {originalVideoId}
        {reactionVideoTitle}
        {originalVideoTitle}
        {reactionVideoAuthor}
        {reactorDisplayName}
        {playlistId}
        {itemType}
        queueTitle={queueTitle}
        queueSlug={queueSlug}
        interactive
    />
</div>
