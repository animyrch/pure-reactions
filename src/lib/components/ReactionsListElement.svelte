<script>
    import ReactionThumbnail from '$lib/components/ReactionThumbnail.svelte';
    import {
        momentIdFromReactionData,
        resolveReactionListItemType
    } from '$lib/helpers/reactionListItem';

    export let reaction;

    const playlistId = reaction?.data?.playlistId;
    const itemType = resolveReactionListItemType(reaction);
    const momentId = itemType === 'moment' ? momentIdFromReactionData(reaction?.data) : '';
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
        {momentId}
        {itemType}
        queueTitle={queueTitle}
        queueSlug={queueSlug}
        interactive
    />
</div>
