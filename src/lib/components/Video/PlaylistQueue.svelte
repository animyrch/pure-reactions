<script>
    import PlaylistQueueItem from "./PlaylistQueueItem.svelte";
    import { getPlaylist } from '$lib/helpers/firebase';
    import { onMount } from "svelte";
    import { fetchFirstPlaylistVideos } from '$lib/helpers/youtube';
    import { env } from '$env/dynamic/public';

    export let currentlyViewed = '';
    export let playlistId = '';
    export let playlistDocumentId = '';
    export let isCreation = true;
    let playlistItems = [];
    let playlistDocument;
    onMount(async () => {
        playlistItems = await fetchFirstPlaylistVideos(playlistId, env.PUBLIC_YOUTUBE_API_KEY);
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