<script>
  import CreatorDetails from "$lib/components/Video/CreatorDetails.svelte";
  import PlaylistQueue from "$lib/components/Video/PlaylistQueue.svelte";
  import OtherReactions from "$lib/components/Video/OtherReactions.svelte";
  import YouTubeDiscussion from "$lib/components/Video/YouTubeDiscussion.svelte";
  import AttributionBlock from "$lib/components/reaction/AttributionBlock.svelte";

  export let reactionState = {};
  export let viewerId = undefined;
  export let isEditModeOn = false;
  export let includePlaylistQueue = true;
  export let includeOtherReactions = true;
  export let includeDiscussion = true;
  export let playlistDocument = null;
  export let playlistDocumentId = "";
  export let onPlaylistSelect = null;

  let hasOtherReactions = false;

  $: showOtherReactionsColumn =
    includeOtherReactions &&
    !isEditModeOn &&
    reactionState?.originalVideoId &&
    reactionState?.reactionVideoId;
  $: placeSimilarAside = showOtherReactionsColumn && hasOtherReactions;
  $: resolvedPlaylistDocument = playlistDocument ?? reactionState?.playlistDocument;
  $: resolvedPlaylistDocumentId = playlistDocumentId || reactionState?.playlistDocumentId;
</script>

<div class="grid grid-cols-1 gap-8 items-start w-full {placeSimilarAside ? 'lg:grid-cols-[minmax(0,1fr)_22.333rem]' : ''}">
  <div class="flex min-w-0 flex-col gap-6 {placeSimilarAside ? 'lg:col-start-1 lg:row-start-1' : ''}">
    <div data-testid="reaction-metadata">
      <CreatorDetails
        originalVideoAuthor={reactionState?.originalVideoAuthor}
        originalVideoAuthorUrl={reactionState?.originalVideoAuthorUrl}
        originalVideoTitle={reactionState?.originalVideoTitle}
        originalVideoId={reactionState?.originalVideoId}
        originalVideoUrl={reactionState?.originalVideoUrl}
        originalVideoDescription={reactionState?.originalVideoDescription}
        originalVideoPlatform={reactionState?.originalVideoPlatform}
        reactionVideoAuthor={reactionState?.reactionVideoAuthor}
        reactionVideoTitle={reactionState?.reactionVideoTitle}
        reactionVideoId={reactionState?.reactionVideoId}
        reactionVideoDescription={reactionState?.reactionVideoDescription}
        pageSlug={reactionState?.pageSlug}
        isUsersOwnVideo={reactionState?.isUsersOwnVideo}
        reactorId={reactionState?.reactorId}
        reactorDisplayName={reactionState?.reactorDisplayName}
      />
      <div class="mt-3 sm:mt-4">
        <AttributionBlock
          reactionVideoAuthor={reactionState?.reactionVideoAuthor}
          reactorDisplayName={reactionState?.reactorDisplayName}
          reactorId={reactionState?.reactorId}
          {viewerId}
        />
      </div>
    </div>

    {#if includePlaylistQueue && reactionState?.originalVideoId && resolvedPlaylistDocumentId}
      <div class="w-full">
        <PlaylistQueue
          playlistItems={reactionState?.playlistItems}
          playlistDocument={resolvedPlaylistDocument}
          currentlyViewed={reactionState?.originalVideoId}
          playlistId={reactionState?.youtubePlaylistId}
          playlistDocumentId={resolvedPlaylistDocumentId}
          currentIndex={reactionState?.currentIndexInPlaylist}
          isCreation={false}
          onSelect={onPlaylistSelect}
        />
      </div>
    {/if}
  </div>

  {#if showOtherReactionsColumn}
    <div class="flex min-w-0 flex-col gap-6 {placeSimilarAside ? 'lg:col-start-2 lg:row-start-1 lg:row-span-2' : ''} {hasOtherReactions ? '' : 'hidden'}">
      <OtherReactions
        originalVideoId={reactionState?.originalVideoId}
        reactionVideoId={reactionState?.reactionVideoId}
        originalVideoTitle={reactionState?.originalVideoTitle}
        originalVideoAuthor={reactionState?.originalVideoAuthor}
        bind:hasOtherReactions={hasOtherReactions}
      />
    </div>
  {/if}

  {#if includeDiscussion && !isEditModeOn}
    <div class="min-w-0 {placeSimilarAside ? 'lg:col-start-1 lg:row-start-2' : ''}">
      <YouTubeDiscussion
        reactionVideoId={reactionState?.reactionVideoId}
        originalVideoId={reactionState?.originalVideoId}
        originalVideoPlatform={reactionState?.originalVideoPlatform}
      />
    </div>
  {/if}
</div>
