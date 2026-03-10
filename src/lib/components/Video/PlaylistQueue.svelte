<script>
    import PlaylistQueueItem from "./PlaylistQueueItem.svelte";
    import { getPlaylist } from '$lib/helpers/firebase';
    import { getPlaylistSequenceItems, toPlaylistQueueItem } from '$lib/helpers/reactionSequence';
    import { onMount } from "svelte";
    import { fetchFirstPlaylistVideos } from '$lib/helpers/youtube';

    export let currentlyViewed = '';
    export let playlistId = '';
    export let playlistDocumentId = '';
    export let isCreation = true;
    export let startTime = 0;
    export let playlistBufferTime = 0;
    export let playlistItems = [];
    export let playlistDocument = null;
    export let onSelect = null;
    export let currentIndex = -1;
    export let hideCurrentItem = false;

    $: normalizedCurrentIndex = Number.isFinite(Number(currentIndex))
        ? Math.max(-1, Math.trunc(Number(currentIndex)))
        : -1;
    $: visiblePlaylistItems =
        hideCurrentItem && normalizedCurrentIndex >= 0
            ? playlistItems.slice(normalizedCurrentIndex + 1)
            : playlistItems;

    onMount(async () => {
        if (!playlistDocument && playlistDocumentId) {
            playlistDocument = await getPlaylist(playlistDocumentId);
        }
        if (!playlistItems?.length && playlistDocument) {
            const sequenceItems = getPlaylistSequenceItems(playlistDocument);
            if (sequenceItems.length) {
                playlistItems = sequenceItems.map((item, index) =>
                    toPlaylistQueueItem(item, index),
                );
            }
        }
        if (!playlistItems?.length && playlistId) {
            playlistItems = await fetchFirstPlaylistVideos(playlistId);
        }
    });
</script>

<div>
    {#each visiblePlaylistItems as playlistItem, visibleIndex (playlistItem?.id || playlistItem?.playlistId || playlistItem?.originalVideoId || playlistItem?.snippet?.resourceId?.videoId || visibleIndex)}
        {@const index = hideCurrentItem && normalizedCurrentIndex >= 0
            ? normalizedCurrentIndex + visibleIndex + 1
            : visibleIndex}
        <div key={playlistItem?.id || playlistItem?.playlistId || index}>
                <PlaylistQueueItem
                    {index}
                    {playlistItem}
                    {currentlyViewed}
                    {playlistId}
                    {playlistDocumentId}
                    {isCreation}
                    {startTime}
                    {playlistBufferTime}
                    targetReactionDocumentId={playlistDocument?.reactionBinomeIds?.[index]}
                    {onSelect}
                />
        </div>
    {/each}
</div>