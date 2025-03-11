<script>
    import ReactionThumbnail from "$lib/components/ReactionThumbnail.svelte";
    
    export let playlist;
    console.log(playlist, 'playlist');
    const reaction = playlist.firstReactionBinomeData;
    const reactionPageId = playlist.data?.reactionBinomeIds?.[0];
    const reactionVideoId = reaction?.reactionVideoId;
    const originalVideoId = reaction?.originalVideoId;
    const reactionVideoTitle = reaction?.reactionVideoTitle;
    const reactionVideoAuthor = reaction?.reactionVideoAuthor;
    const originalVideoTitle = reaction?.originalVideoTitle;
    const playlistId = playlist.id;
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
    />
</div>
