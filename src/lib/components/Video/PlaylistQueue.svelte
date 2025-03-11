<script>
    import PlaylistQueueItem from "./PlaylistQueueItem.svelte";

    export let playlistItems = [];
    export let currentlyViewed = '';
    export let playlistId = '';
    export let playlistDocumentId = '';
</script>

<div>
    {#each playlistItems as playlistItem, index (index)}
        <div key={playlistItem?.playlistId}>
        <PlaylistQueueItem
            {playlistItem}
            {currentlyViewed}
            {playlistId}
            {playlistDocumentId}
        />
        </div>
    {/each}
</div>