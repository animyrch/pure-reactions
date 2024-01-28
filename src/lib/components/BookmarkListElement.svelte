<script>
    import { onMount } from "svelte";
    import { getReaction } from '$lib/helpers/firebase';
    import ReactionThumbnail from "$lib/components/ReactionThumbnail.svelte";
    
    export let reactionBinomeId;

    let reactionPageId;
    let reactionVideoId;
    let originalVideoId;
    let reactionVideoTitle;
    let reactionVideoAuthor;
    let originalVideoTitle;
    let originalVideoAuthor;

    const loadReaction = async (reactionBinomeId) => {
        const reaction = await getReaction(reactionBinomeId);
        reactionPageId = reaction?.id;
        reactionVideoId = reaction?.reactionVideoId;
        originalVideoId = reaction?.originalVideoId;
        reactionVideoAuthor = reaction?.reactionVideoAuthor;
        reactionVideoTitle = reaction?.reactionVideoTitle;
        originalVideoAuthor = reaction?.originalVideoAuthor;
        originalVideoTitle = reaction?.originalVideoTitle;
    };

    onMount(async () => {
        await loadReaction(reactionBinomeId);
    });
</script>

<div>
    {#if reactionPageId}
        <ReactionThumbnail
            {reactionPageId}
            {reactionVideoId}
            {originalVideoId}
            {reactionVideoTitle}
            {originalVideoTitle}
            {reactionVideoAuthor}
            {originalVideoAuthor}
        />
    {/if}
</div>
