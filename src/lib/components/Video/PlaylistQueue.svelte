<script>
    import PlaylistQueueItem from "./PlaylistQueueItem.svelte";
    import { getPlaylist } from '$lib/helpers/firebase';
    import { onMount } from "svelte";
    import { fetchFirstPlaylistVideos } from '$lib/helpers/youtube';

    export let currentlyViewed = '';
    export let playlistId = '';
    export let playlistDocumentId = '';
    export let isCreation = true;
    export let startTime = 0;
    export let playlistBufferTime = 0;
    export let playlistItems = [];
    export let playlistDocument;

    onMount(async () => {
        if (!playlistItems?.length && playlistId) {
            playlistItems = await fetchFirstPlaylistVideos(playlistId);
        }
        if (!playlistDocument && playlistDocumentId) {
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
                    {startTime}
                    {playlistBufferTime}
                    targetReactionDocumentId={playlistDocument?.reactionBinomeIds?.[index]}
                />
        </div>
    {/each}
</div>