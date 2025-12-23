<script>
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { onDestroy, onMount } from "svelte";
  import CreatorDetails from "$lib/components/Video/CreatorDetails.svelte";
  import PlaylistQueue from "$lib/components/Video/PlaylistQueue.svelte";
  import OtherReactions from "$lib/components/Video/OtherReactions.svelte";
  import SubtleLoader from "$lib/components/design-system/SubtleLoader.svelte";
  import FullscreenChrome from "$lib/components/reaction/FullscreenChrome.svelte";
  import ControlDock from "$lib/components/reaction/ControlDock.svelte";
  import MissingReactionPlaceholder from "$lib/components/reaction/MissingReactionPlaceholder.svelte";
  import { useTwinPlayers, CONTROLS_FADE_CLASS } from "$lib/composables/useTwinPlayers";
  import { reactionDial } from "$lib/stores/reactionDial";
  import { showToast } from "$lib/stores/toast";
  import { TOASTS } from "$lib/constants/toasts";
  import { getPlaylist } from "$lib/helpers/firebase";

  export let data;

  // We start with an empty reaction slug and load the selected one client-side.
  const { state, actions } = useTwinPlayers({ data: { slug: "", userId: data?.userId } });

  let overlayRef;
  $: stickyControlsClass = $state.isFullscreen ? CONTROLS_FADE_CLASS : "opacity-100";
  $: overlayRef && actions.registerOverlayRef(overlayRef);

  let playlistSlug = "";
  let playlistDocumentLocal = null;
  let playlistInitError = "";

  $: playlistOwnerId = ($state.playlistDocument ?? playlistDocumentLocal)?.reactorId;
  $: isPlaylistOwner = Boolean(data?.userId && playlistOwnerId && playlistOwnerId === data.userId);

  const normalizeSelectedOriginalId = (playlistDoc, selectedOriginalId) => {
    const originals = Array.isArray(playlistDoc?.originalVideoIds)
      ? playlistDoc.originalVideoIds
      : [];

    if (!originals.length) return { index: -1, originalVideoId: "" };
    if (!selectedOriginalId) return { index: 0, originalVideoId: originals[0] };

    const index = originals.indexOf(selectedOriginalId);
    if (index >= 0) return { index, originalVideoId: selectedOriginalId };
    return { index: 0, originalVideoId: originals[0] };
  };

  const setUrlSelectedItem = (originalVideoId, { replace = false } = {}) => {
    if (!browser) return;
    const url = new URL(window.location.href);
    if (originalVideoId) {
      url.searchParams.set("item", originalVideoId);
    } else {
      url.searchParams.delete("item");
    }
    if (replace) {
      window.history.replaceState(window.history.state, "", url.toString());
    } else {
      window.history.pushState(window.history.state, "", url.toString());
    }
  };

  const loadSelectedReaction = async ({ preserveReactionTime = false } = {}) => {
    if (!browser) return;
    playlistInitError = "";

    try {
      const playlistDoc = await getPlaylist(playlistSlug);
      playlistDocumentLocal = playlistDoc;

      const reactionIds = Array.isArray(playlistDoc?.reactionBinomeIds)
        ? playlistDoc.reactionBinomeIds
        : [];

      if (!reactionIds.length) {
        playlistInitError = "Playlist not found or empty.";
        return;
      }

      const selectedFromUrl = $page.url.searchParams.get("item");
      const { index, originalVideoId } = normalizeSelectedOriginalId(
        playlistDoc,
        selectedFromUrl,
      );

      const reactionDocumentId = reactionIds[index] ?? reactionIds[0];

      await actions.setPlaylistDocumentId(playlistSlug);
      setUrlSelectedItem(originalVideoId, { replace: true });
      await actions.loadReactionInPlace(reactionDocumentId, { preserveReactionTime });
    } catch (error) {
      console.error("Failed to load playlist", error);
      playlistInitError = "Unable to load playlist.";
    }
  };

  const handlePlaylistSelect = async ({ index }) => {
    const playlistDoc = $state.playlistDocument ?? playlistDocumentLocal;
    const reactionIds = Array.isArray(playlistDoc?.reactionBinomeIds)
      ? playlistDoc.reactionBinomeIds
      : [];
    const originalIds = Array.isArray(playlistDoc?.originalVideoIds)
      ? playlistDoc.originalVideoIds
      : [];

    const reactionDocumentId = reactionIds[index];
    const originalVideoId = originalIds[index];
    if (!reactionDocumentId) return;

    setUrlSelectedItem(originalVideoId);
    await actions.loadReactionInPlace(reactionDocumentId, { preserveReactionTime: true });
  };

  onMount(async () => {
    playlistSlug = $page.params.slug;
    if (!playlistSlug) return;

    await loadSelectedReaction({ preserveReactionTime: false });
  });

  $: if (browser && playlistSlug) {
    // Keep dial context in sync as playback state changes.
    reactionDial.updateContext({
      isUsersOwnVideo: isPlaylistOwner,
      canShowEditModeButton: isPlaylistOwner,
      canShowCloseEditModeButton: false,
      isPublished: $state.isPublished,
      isReactionMissing: $state.isReactionMissing,
      isFullscreen: $state.isFullscreen,
      handlers: {
        enterEditMode: isPlaylistOwner
          ? () => {
              if (!browser) return;
              const playlistId = playlistSlug;
              const item = $state.originalVideoId || $page.url.searchParams.get('item');
              const query = new URLSearchParams();
              if (playlistId) query.set('playlistId', playlistId);
              if (item) query.set('item', item);
              const suffix = query.toString() ? `?${query.toString()}` : '';
              goto(`/edit-reaction/${$state.pageSlug}${suffix}`);
            }
          : null,
        editPlaylist: playlistSlug
          ? () => {
              if (!browser) return;
              window.location.href = `/batch-edit?playlistDocumentId=${playlistSlug}`;
            }
          : null,
        closeEditMode: null,
        setIsPublished: actions.setIsPublished,
        setIsUnpublished: actions.setIsUnpublished,
        openWithFullscreen: actions.openWithFullscreen,
        openWithHalfscreen: actions.openWithHalfscreen,
      },
    });
  }

  onDestroy(() => {
    reactionDial.reset();
  });

  const handlePlayStateChanged = (event) => {
    actions.handlePlayStateChange(event.detail.isPlaying);
  };

  const handleMissingReactionSubmit = async () => {
    if (browser) {
      showToast("This playlist item is missing a reaction video.", TOASTS.INFO);
    }
  };
</script>

<div class={$state.isLoading ? "" : "hidden"}>
  <div class="flex justify-center py-24">
    <SubtleLoader label="Loading playlist experience" />
  </div>
</div>

<div class={`website-inner-container bg-background text-text-primary ${$state.isLoading ? "hidden" : ""}`}>
  {#if playlistInitError}
    <p class="mb-4 rounded-md bg-warning/10 px-4 py-3 text-sm text-warning">
      {playlistInitError}
    </p>
  {/if}

  <section
    class={`theater-wrapper ${
      $state.isFullscreen
        ? "fixed inset-0 z-50 m-0 h-screen w-screen overflow-hidden rounded-none bg-black px-0 py-0 text-text-primary shadow-none"
        : "relative mx-auto my-10 w-full max-w-none rounded-2xl bg-surface/80 px-4 py-8 text-text-primary shadow-elevated backdrop-blur sm:px-6 lg:px-10 xl:rounded-3xl"
    }`}
  >
    {#if $state.isFullscreen}
      <FullscreenChrome
        isControlSurfaceVisible={$state.isControlSurfaceVisible}
        isExitButtonExpanded={$state.isExitButtonExpanded}
        showCinematicBars={$state.showCinematicBars}
        isReactionMissing={$state.isReactionMissing}
        bind:overlayRef
        onExitClick={actions.handleExitFullscreenClick}
        onExitEnter={actions.handleExitButtonEnter}
        onExitLeave={actions.handleExitButtonLeave}
        onPointerMove={actions.handleFullscreenPointerMove}
        onPointerDown={actions.handleFullscreenPointerDown}
        onPointerLeave={actions.scheduleHideControls}
      />
    {:else}
      <div class="grid gap-6 md:grid-cols-2 xl:gap-8">
        <div class="relative overflow-hidden rounded-xl bg-black shadow-elevated">
          <div class="relative aspect-[16/9] sm:aspect-[3/2]">
            <div id="player-original" class="absolute inset-0 h-full w-full"></div>
          </div>
          {#if $state.showCinematicBars}
            <div
              class="pointer-events-none absolute inset-x-0 top-0 h-[12%] bg-gradient-to-b from-black via-black/80 to-transparent"
              aria-hidden="true"
            ></div>
            <div
              class="pointer-events-none absolute inset-x-0 bottom-0 h-[12%] bg-gradient-to-t from-black via-black/80 to-transparent"
              aria-hidden="true"
            ></div>
          {/if}
        </div>

        {#if !$state.isReactionMissing}
          <div class="relative overflow-hidden rounded-xl bg-black/80 shadow-surface">
            <div class="relative aspect-[16/9] sm:aspect-[3/2]">
              <div id="player-reaction" class="absolute inset-0 h-full w-full"></div>
            </div>
            {#if $state.showCinematicBars}
              <div
                class="pointer-events-none absolute inset-x-0 top-0 h-[12%] bg-gradient-to-b from-black via-black/80 to-transparent"
                aria-hidden="true"
              ></div>
              <div
                class="pointer-events-none absolute inset-x-0 bottom-0 h-[12%] bg-gradient-to-t from-black via-black/80 to-transparent"
                aria-hidden="true"
              ></div>
            {/if}
          </div>
        {:else}
          <MissingReactionPlaceholder
            loading={false}
            error={""}
            on:submit={handleMissingReactionSubmit}
          />
        {/if}
      </div>
    {/if}

    {#if $state.playerOriginal && ($state.playerReaction || $state.isReactionMissing)}
      <ControlDock
        isFullscreen={$state.isFullscreen}
        stickyControlsClass={stickyControlsClass}
        bothVideosStarted={$state.bothVideosStarted}
        isPlaylist={true}
        isPlaylistAutoPlay={$state.isPlaylistAutoPlay}
        showCinematicBars={$state.showCinematicBars}
        onPlayStateChanged={handlePlayStateChanged}
        onSyncVideos={actions.syncVideos}
        onToggleAutoPlaylist={actions.toggleAutoPlaylist}
        onToggleBars={actions.toggleCinematicBars}
        onEnterFullscreen={actions.openWithFullscreen}
        currentTime={$state.reactionCurrentTime}
        duration={$state.reactionDuration}
        onSeek={actions.seekTo}
      />
    {/if}
  </section>

  {#if !$state.isFullscreen}
    <div class="mx-auto w-full px-4 pt-6 sm:px-6 lg:px-10">
      <CreatorDetails
        originalVideoAuthor={$state.originalVideoAuthor}
        originalVideoTitle={$state.originalVideoTitle}
        originalVideoId={$state.originalVideoId}
        reactionVideoAuthor={$state.reactionVideoAuthor}
        reactionVideoTitle={$state.reactionVideoTitle}
        reactionVideoId={$state.reactionVideoId}
        pageSlug={$state.pageSlug}
        isUsersOwnVideo={$state.isUsersOwnVideo}
        reactorId={$state.reactorId}
      />

      {#if $state.originalVideoId && playlistSlug}
        <div class="mt-8">
          <PlaylistQueue
            playlistItems={$state.playlistItems}
            playlistDocument={$state.playlistDocument ?? playlistDocumentLocal}
            currentlyViewed={$state.originalVideoId}
            playlistId={$state.youtubePlaylistId}
            playlistDocumentId={playlistSlug}
            isCreation={false}
            onSelect={handlePlaylistSelect}
          />
        </div>
      {/if}
    </div>

    {#if !$state.isEditModeOn && $state.originalVideoId && $state.reactionVideoId}
      <OtherReactions
        originalVideoId={$state.originalVideoId}
        reactionVideoId={$state.reactionVideoId}
      />
    {/if}
  {/if}
</div>

<style>
  .website-inner-container {
    margin: 0;
    width: 100%;
  }

  :global(body.reaction-fullscreen) {
    overflow: hidden;
  }
</style>
