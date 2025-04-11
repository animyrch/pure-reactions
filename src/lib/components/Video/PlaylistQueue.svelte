<script>
    import PlaylistQueueItem from "./PlaylistQueueItem.svelte";
    import { getPlaylist } from '$lib/helpers/firebase';
    import { onMount } from "svelte";
    import { fetchFirstPlaylistVideos } from '$lib/helpers/youtube';

    export let currentlyViewed = '';
    export let playlistId = '';
    export let playlistDocumentId = '';
    export let isCreation = true;
    let playlistItems = [];
    let playlistDocument;

    onMount(async () => {
        playlistItems = await fetchFirstPlaylistVideos(playlistId);
        if (playlistDocumentId) {
            playlistDocument = await getPlaylist(playlistDocumentId);
        }
    });
</script>

<div>
    {#each playlistItems as playlistItem, index (index)}
        <div key={playlistItem?.playlistId}>
                <PlaylistQueueItem
                    {playlistItem}
                    {currentlyViewed}
                    {playlistId}
                    {playlistDocumentId}
                    {isCreation}
                    targetReactionDocumentId={playlistDocument?.reactionBinomeIds?.[index]}
                />
        </div>
    {/each}
</div>