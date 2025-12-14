<script>
    import { onMount } from 'svelte';
    import ReactionThumbnail from '$lib/components/ReactionThumbnail.svelte';

    export let reaction;

    const itemType = reaction?.type || 'reaction';
    const reactionPageId = reaction?.id;
    const reactionVideoId = reaction?.data?.reactionVideoId;
    const originalVideoId = reaction?.data?.originalVideoId;
    const reactionVideoTitle = reaction?.data?.reactionVideoTitle;
    const reactionVideoAuthor = reaction?.data?.reactionVideoAuthor;
    const originalVideoTitle = reaction?.data?.originalVideoTitle;
    const playlistId = reaction?.data?.playlistId;
    const setTitle = reaction?.data?.title;
    const setSlug = reaction?.data?.slug;

    let rootEl;
    let isVisible = false;

    const headline = reactionVideoTitle || originalVideoTitle || setTitle || 'Untitled reaction';
    const authorLabel = reactionVideoAuthor ? `by ${reactionVideoAuthor}` : 'Reaction';
</script>

<div>
    <ReactionThumbnail
        {reactionPageId}
        {reactionVideoId}
        {originalVideoId}
        {reactionVideoTitle}
        {originalVideoTitle}
        {reactionVideoAuthor}
        {playlistId}
        {itemType}
        {setTitle}
        {setSlug}
        interactive
    />
</div>
