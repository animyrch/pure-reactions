<script>
    import { goto } from '$app/navigation'
    import { getCompensatedReactionTime } from '$lib/helpers/reaction';

    export let playlistItem = {};
    export let currentlyViewed = '';
    export let playlistId = '';
    export let playlistDocumentId = '';
    export let isCreation = true;
    export let targetReactionDocumentId = '';
    export let startTime = 0;
    export let playlistBufferTime = 0;

    const navigate = async () => {
        if (isCreation) {
            const reactionVideoTime = getCompensatedReactionTime(startTime, playlistBufferTime || 0);
            await goto(`/backend?id=${playlistItem?.snippet?.resourceId?.videoId}&playlist=${playlistId}&playlistDocumentId=${playlistDocumentId}&playlistBufferTime=${reactionVideoTime}`);
        } else {
            await goto(`/reaction/${targetReactionDocumentId}?playlistId=${playlistDocumentId}`);
        }
        location.reload();
    };
</script>

<div
    class={currentlyViewed === playlistItem?.snippet?.resourceId?.videoId ? 'bg-gray-200 dark:bg-gray-700' : ''}
>
    <a href="#" on:click|preventDefault={navigate}>
        <div>
            {playlistItem?.snippet?.title}
            <div class="original-thumbnail-container">
                <img src={playlistItem?.snippet?.thumbnails?.default?.url} alt={playlistItem.snippet?.title}>
            </div>
        </div>
    </a>
    <hr class="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700">
</div>