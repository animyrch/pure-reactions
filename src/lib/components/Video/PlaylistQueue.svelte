<script>
    import PlaylistQueueItem from "./PlaylistQueueItem.svelte";

    export let playlistItems = [];
    export let currentlyViewed = '';
    export let playlistId = '';
</script>

<div>
    Playlist Queue
    {#each playlistItems as playlistItem, index (index)}
        <div key={playlistItem.playlistId}>
        <PlaylistQueueItem
            {playlistItem}
            {currentlyViewed}
            {playlistId}
        />
        </div>
    {/each}
</div>