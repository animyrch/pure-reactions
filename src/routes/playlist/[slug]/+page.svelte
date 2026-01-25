<script>
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { onDestroy, onMount } from "svelte";
  import CreatorDetails from "$lib/components/Video/CreatorDetails.svelte";
  import PlaylistQueue from "$lib/components/Video/PlaylistQueue.svelte";
  import OtherReactions from "$lib/components/Video/OtherReactions.svelte";
  import SubtleLoader from "$lib/components/design-system/SubtleLoader.svelte";
  import ReactionStage from "$lib/components/reaction/ReactionStage.svelte";
  import AttributionBlock from "$lib/components/reaction/AttributionBlock.svelte";
  import {
    useTwinPlayers,
    CONTROLS_FADE_CLASS,
  } from "$lib/composables/useTwinPlayers";
  import { reactionDial } from "$lib/stores/reactionDial";
  import { showToast } from "$lib/stores/toast";
  import { TOASTS } from "$lib/constants/toasts";
  import { getPlaylist } from "$lib/helpers/firebase";

  export let data;

  // We start with an empty reaction slug and load the selected one client-side.
  const { state, actions } = useTwinPlayers({
    data: { slug: "", userId: data?.userId },
  });

  let overlayRef;
  $: stickyControlsClass = $state.isFullscreen
    ? CONTROLS_FADE_CLASS
    : "opacity-100";
  $: overlayRef && actions.registerOverlayRef(overlayRef);

  let isCurrentReactionCreator = false;
  $: isCurrentReactionCreator = Boolean(
    data?.userId && $state.reactorId && data.userId === $state.reactorId,
  );

  let playlistSlug = "";
  let playlistDocumentLocal = null;
  let playlistInitError = "";

  $: playlistOwnerId = ($state.playlistDocument ?? playlistDocumentLocal)
    ?.reactorId;
  $: isPlaylistOwner = Boolean(
    data?.userId && playlistOwnerId && playlistOwnerId === data.userId,
  );

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

  const loadSelectedReaction = async ({
    preserveReactionTime = false,
  } = {}) => {
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
      await actions.loadReactionInPlace(reactionDocumentId, {
        preserveReactionTime,
      });
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
    actions.setPlaylistSelectionIndex(index);

    if (browser) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    await actions.loadReactionInPlace(reactionDocumentId, {
      preserveReactionTime: false,
      autoPlay: true,
    });
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
      canShowEditPlaylistButton: Boolean(
        playlistSlug && isCurrentReactionCreator,
      ),
      handlers: {
        enterEditMode: isPlaylistOwner
          ? () => {
              if (!browser) return;
              const playlistId = playlistSlug;
              const item =
                $state.originalVideoId || $page.url.searchParams.get("item");
              const query = new URLSearchParams();
              if (playlistId) query.set("playlistId", playlistId);
              if (item) query.set("item", item);
              const suffix = query.toString() ? `?${query.toString()}` : "";
              // Hard navigate so editor always starts from a clean player state.
              window.location.assign(
                `/edit-reaction/${$state.pageSlug}${suffix}`,
              );
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

<div
  class={`website-inner-container bg-background text-text-primary ${$state.isLoading ? "hidden" : ""}`}
>
  {#if playlistInitError}
    <p class="mb-4 rounded-md bg-warning/10 px-4 py-3 text-sm text-warning">
      {playlistInitError}
    </p>
  {/if}

  <ReactionStage
    isFullscreen={$state.isFullscreen}
    isControlSurfaceVisible={$state.isControlSurfaceVisible}
    isExitButtonExpanded={$state.isExitButtonExpanded}
    showCinematicBars={$state.showCinematicBars}
    isReactionMissing={$state.isReactionMissing}
    isUsersOwnVideo={isPlaylistOwner}
    playerOriginal={$state.playerOriginal}
    playerReaction={$state.playerReaction}
    {stickyControlsClass}
    bothVideosStarted={$state.bothVideosStarted}
    isPlaylist={true}
    isPlaylistAutoPlay={$state.isPlaylistAutoPlay}
    reactionCurrentTime={$state.reactionCurrentTime}
    reactionDuration={$state.reactionDuration}
    offsetStartTime={$state.offsetStartTime}
    reactionFinishTime={$state.reactionFinishTime}
    fullscreenPrimaryVideo={$state.fullscreenPrimaryVideo}
    fullscreenOverlayWidthPercent={$state.fullscreenOverlayWidthPercent}
    fullscreenOverlayCorner={$state.fullscreenOverlayCorner}
    fullscreenOverlayVisible={$state.fullscreenOverlayVisible}
    missingReactionLoading={false}
    missingReactionError=""
    alwaysShowMissingPlaceholder={true}
    bind:overlayRef
    on:exitClick={actions.handleExitFullscreenClick}
    on:exitEnter={actions.handleExitButtonEnter}
    on:exitLeave={actions.handleExitButtonLeave}
    on:pointerMove={actions.handleFullscreenPointerMove}
    on:pointerDown={actions.handleFullscreenPointerDown}
    on:pointerLeave={actions.scheduleHideControls}
    on:missingReactionSubmit={handleMissingReactionSubmit}
    on:playStateChanged={handlePlayStateChanged}
    on:syncVideos={actions.syncVideos}
    on:toggleAutoPlaylist={actions.toggleAutoPlaylist}
    on:toggleCinematicBars={actions.toggleCinematicBars}
    on:enterFullscreen={actions.openWithFullscreen}
    on:seek={(e) => actions.seekTo(e.detail)}
  />

  {#if !$state.isFullscreen}
    <div class="mx-auto w-full px-4 pt-6 sm:px-6 lg:px-10">
      <div class="mb-4">
        <AttributionBlock
          isVerifiedCreator={$state.isCreatorVerified}
          reactionVideoAuthor={$state.reactionVideoAuthor}
          reactionChannelName={$state.reactionChannelName}
          reactorDisplayName={$state.reactorDisplayName}
          reactorId={$state.reactorId}
        />
      </div>
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
        reactorDisplayName={$state.reactorDisplayName}
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
