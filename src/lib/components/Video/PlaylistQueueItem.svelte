<script>
    import { goto } from '$app/navigation'
    export let playlistItem = {};
    export let currentlyViewed = '';
    export let playlistId = '';
    export let playlistDocumentId = '';
    const navigate = async () => {
        await goto(`/backend?id=${playlistItem?.snippet?.resourceId?.videoId}&playlist=${playlistId}&playlistDocumentId=${playlistDocumentId}`);
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