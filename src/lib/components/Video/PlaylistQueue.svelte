<script>
    import PlaylistQueueItem from "./PlaylistQueueItem.svelte";
    import { getPlaylist } from '$lib/helpers/firebase';
    import { onMount } from "svelte";

    export let playlistItems = [];
    export let currentlyViewed = '';
    export let playlistId = '';
    export let playlistDocumentId = '';
    export let isCreation = true;
    let playlistDocument;
    onMount(async () => {
        playlistDocument = await getPlaylist(playlistDocumentId);
    });
</script>

<div>
    {#each playlistItems as playlistItem, index (index)}
        <div key={playlistItem?.playlistId}>
            {#if playlistDocument}
                <PlaylistQueueItem
                    {playlistItem}
                    {currentlyViewed}
                    {playlistId}
                    {playlistDocumentId}
                    {isCreation}
                    targetReactionDocumentId={playlistDocument.reactionBinomeIds[index]}
                />
            {/if}
        </div>
    {/each}
</div>