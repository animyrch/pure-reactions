<script>
    import VideoAuthor from '$lib/components/VideoAuthor.svelte';

    export let reactionPageId;
    export let reactionVideoId;
    export let originalVideoId;
    export let reactionVideoTitle;
    export let originalVideoTitle;
    export let reactionVideoAuthor;
    export let originalVideoAuthor;
</script>

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
    <div class="flex gap-2">
        <p>{reactionVideoTitle || originalVideoTitle}</p>
    </div>
    {#if reactionVideoAuthor}
        <VideoAuthor
            videoAuthor={reactionVideoAuthor}
        />
    {/if}
</div>
<hr class="h-px my-8 bg-gray-200 border-0 dark:bg-gray-700">

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