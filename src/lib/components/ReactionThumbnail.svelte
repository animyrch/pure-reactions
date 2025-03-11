<script>
    import VideoAuthor from '$lib/components/VideoAuthor.svelte';
    import ThumbnailContext from '$lib/components/Video/ThumbnailContext.svelte';

    export let reactionPageId;
    export let reactionVideoId;
    export let originalVideoId;
    export let reactionVideoTitle;
    export let originalVideoTitle;
    export let reactionVideoAuthor;
    export let playlistId;
    // path is /reaction/ + reactionPageId and we added query parameter playlistId if exists
    const reactionRedirectionPath = `/reaction/${reactionPageId}${playlistId ? `?playlistId=${playlistId}` : ''}`;
</script>

<a href={reactionRedirectionPath}>
    <div class="thumbnails-container">
        <div class="original-thumbnail-container">
            <img src={`https://img.youtube.com/vi/${originalVideoId}/mqdefault.jpg`} alt="Video Thumbnail">
        </div>
        <div class="reaction-thumbnail-container">
            <img src={`https://img.youtube.com/vi/${reactionVideoId}/mqdefault.jpg`} alt="Video Thumbnail">
        </div>
    </div>
</a>
<div class="flex items-center">
    <div
        class="flex-1 truncate"
    >
        <div
        >
            <p
                class="truncate"
                title="{reactionVideoTitle || originalVideoTitle}"
            >{reactionVideoTitle || originalVideoTitle}</p>
        </div>
        {#if reactionVideoAuthor}
            <VideoAuthor
                videoAuthor={reactionVideoAuthor}
                showLinks={false}
                isReactor
            />
        {/if}
    </div>
    <div
        class="flex-shrink-0"
    >
        <ThumbnailContext
            reactionPageId={reactionPageId}
            reactionVideoAuthor={reactionVideoAuthor}
        />
    </div>
</div>
<hr class="h-px my-8 bg-gray-200 border-0 dark:bg-gray-700">

<style>
    .thumbnails-container {
        position: relative;
    }
    .original-thumbnail-container img {
        width: 100%;
        object-fit: contain;
        border: solid 1px black;
    }
    .reaction-thumbnail-container img {
        border: solid 1px white;
        border-top: black;
        object-fit: contain;
        width: 50%;
        position: absolute;
        top: 0;
        right: 0;
    }
</style>