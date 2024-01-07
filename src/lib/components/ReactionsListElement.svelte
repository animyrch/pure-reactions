<script>
    import { onMount } from "svelte";
    import {
        getBasicVideoDetailsWithEmbedApi,
        getAuthorFromAuthorUrl
    } from '$lib/helpers/youtube';
    import ReactionThumbnail from "$lib/components/ReactionThumbnail.svelte";
    
    export let reaction;

    const reactionPageId = reaction.id;
    const reactionVideoId = reaction.data['reactionVideoId'];
    const originalVideoId = reaction.data['originalVideoId'];
    let reactionVideoTitle;
    let reactionVideoAuthor;
    let originalVideoTitle;
    let originalVideoAuthor;

    onMount(async () => {
        getBasicVideoDetailsWithEmbedApi(reactionVideoId).then(reactionVideoDetails => {
            reactionVideoAuthor = getAuthorFromAuthorUrl(reactionVideoDetails?.author_url);
            reactionVideoTitle = reactionVideoDetails?.title;
        });
        getBasicVideoDetailsWithEmbedApi(originalVideoId).then(originalVideoDetails => {
            originalVideoAuthor = getAuthorFromAuthorUrl(originalVideoDetails?.author_url);
            originalVideoTitle = originalVideoDetails?.title;
        });
    });
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