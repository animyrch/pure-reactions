<script>
    import ReactionThumbnail from "$lib/components/ReactionThumbnail.svelte";
    
    export let reaction;

    const reactionPageId = reaction.id;
    const reactionVideoId = reaction?.data?.reactionVideoId;
    const originalVideoId = reaction?.data?.originalVideoId;
    const reactionVideoTitle = reaction?.data?.reactionVideoTitle;
    const reactionVideoAuthor = reaction?.data?.reactionVideoAuthor;
    const originalVideoTitle = reaction?.data?.originalVideoTitle;
    const originalVideoAuthor = reaction?.data?.originalVideoAuthor;
</script>

<div>
    <ReactionThumbnail
        {reactionPageId}
        {reactionVideoId}
        {originalVideoId}
        {reactionVideoTitle}
        {originalVideoTitle}
        {reactionVideoAuthor}
        {originalVideoAuthor}
    />
</div>