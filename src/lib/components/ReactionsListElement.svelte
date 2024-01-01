<script>
    import { onMount } from "svelte";
    import {
        getBasicVideoDetailsWithEmbedApi,
        getAuthorFromAuthorUrl
    } from '$lib/helpers/youtube';
    
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
    <a href={`/reaction/${reactionPageId}`}>
        <div class="thumbnails-container">
            <div class="reaction-thumbnail-container">
                <img src={`https://img.youtube.com/vi/${reactionVideoId}/hqdefault.jpg`} alt="Video Thumbnail">
            </div>
            <div class="original-thumbnail-container">
                <img src={`https://img.youtube.com/vi/${originalVideoId}/hqdefault.jpg`} alt="Video Thumbnail">
            </div>
        </div>
    </a>
    <div>
        <p>{reactionVideoTitle || originalVideoTitle}</p>
        <p>{reactionVideoAuthor || originalVideoAuthor}</p>
    </div>
</div>

<style>
    .thumbnails-container {
        position: relative;
    }
    .reaction-thumbnail-container img {
        width: 100%;
        object-fit: contain;
        border: solid 1px black;
    }
    .original-thumbnail-container img {
        border: solid 1px white;
        border-top: black;
        object-fit: contain;
        width: 50%;
        position: absolute;
        z-index: 2;
        top: 0;
    }
</style>