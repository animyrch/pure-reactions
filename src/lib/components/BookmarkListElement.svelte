<script>
    import { onMount } from "svelte";
    import {
        getBasicVideoDetailsWithEmbedApi,
        getAuthorFromAuthorUrl
    } from '$lib/helpers/youtube';
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
    };

    onMount(async () => {
        await loadReaction(reactionBinomeId);
        if (reactionVideoId) {
            getBasicVideoDetailsWithEmbedApi(reactionVideoId).then(reactionVideoDetails => {
                reactionVideoAuthor = getAuthorFromAuthorUrl(reactionVideoDetails?.author_url);
                reactionVideoTitle = reactionVideoDetails?.title;
            });
        }
        if (originalVideoId) {
            getBasicVideoDetailsWithEmbedApi(originalVideoId).then(originalVideoDetails => {
                originalVideoAuthor = getAuthorFromAuthorUrl(originalVideoDetails?.author_url);
                originalVideoTitle = originalVideoDetails?.title;
            });
        }
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
