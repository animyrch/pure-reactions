<script>
    import VideoAuthor from '$lib/components/VideoAuthor.svelte';
    import { DotsVerticalOutline } from 'flowbite-svelte-icons';
    import { Popover, Button } from 'flowbite-svelte';

    export let reactionPageId;
    export let reactionVideoId;
    export let originalVideoId;
    export let reactionVideoTitle;
    export let originalVideoTitle;
    export let reactionVideoAuthor;
</script>

<a href={`/reaction/${reactionPageId}`}>
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
        <button
            id="{`offset-${reactionPageId}`}"
        >
            <DotsVerticalOutline size="md"/>
        </button>
        <Popover class="w-42 text-sm font-light z-100" placement="left" triggeredBy="{`#offset-${reactionPageId}`}" trigger="click">
            <ul>
                <li class="flex items-center mb-1 z-100">
                    <a target="_blank" href={`https://www.youtube.com/${reactionVideoAuthor}`}>Open Youtube Page</a>
                </li>
                <li class="flex items-center mb-1">
                    <a href={`reactor/${reactionVideoAuthor}`}>Open Reactor Page</a>
                </li>
            </ul>
        </Popover>
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
        z-index: 2;
        top: 0;
        right: 0;
    }
</style>