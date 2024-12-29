<script>
    export let playlistItem = {};
    export let currentlyViewed = '';
    export let playlistId = '';
</script>

<div
    class={currentlyViewed === playlistItem.snippet.resourceId.videoId ? 'bg-gray-200 dark:bg-gray-700' : ''}
>
    playlistItem: {JSON.stringify(playlistItem.snippet.resourceId.videoId)}
    {currentlyViewed}
    <a href={`/backend?id=${playlistItem.snippet.resourceId.videoId}&playlist=${playlistId}`}>
        <div>
            <div class="original-thumbnail-container">
                <img src={playlistItem.snippet.thumbnails.default.url} alt={playlistItem.snippet.title}>
            </div>
        </div>
    </a>
    <hr class="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700">
</div>