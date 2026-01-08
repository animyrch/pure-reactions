<script>
  import { page } from "$app/stores";
  import CreatorDetails from "$lib/components/Video/CreatorDetails.svelte";
  import PlaylistQueue from "$lib/components/Video/PlaylistQueue.svelte";
  import OtherReactions from "$lib/components/Video/OtherReactions.svelte";
  import SubtleLoader from "$lib/components/design-system/SubtleLoader.svelte";
  import QueueProgressPill from "$lib/components/reaction/QueueProgressPill.svelte";
  import ReactionStage from "$lib/components/reaction/ReactionStage.svelte";
  import {
    useTwinPlayers,
    CONTROLS_FADE_CLASS,
  } from "$lib/composables/useTwinPlayers";
  import { reactionDial } from "$lib/stores/reactionDial";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { onDestroy } from "svelte";
  import { showToast } from "$lib/stores/toast";
  import { TOASTS } from "$lib/constants/toasts";

  export let data;

  const { state, actions } = useTwinPlayers({ data });

  let overlayRef;

  let isCurrentReactionCreator = false;
  $: isCurrentReactionCreator = Boolean(
    data?.userId && $state.reactorId && data.userId === $state.reactorId,
  );

  $: stickyControlsClass = $state.isFullscreen
    ? CONTROLS_FADE_CLASS
    : "opacity-100";
  $: overlayRef && actions.registerOverlayRef(overlayRef);
  $: actions.handleSlugChange($page.params.slug);

  let isSettingReactionVideoId = false;
  let reactionVideoIdError = "";
  let queueHasNext = false;
  let queueHasNextLoading = false;

  const refreshQueueHasNext = async () => {
    if (!$state.queueSlug) {
      queueHasNext = false;
      return;
    }
    queueHasNextLoading = true;
    try {
      queueHasNext = await actions.hasNextInQueue();
    } catch (error) {
      console.error("Failed to check next queue item", error);
      queueHasNext = false;
    } finally {
      queueHasNextLoading = false;
    }
  };

  const handleGoToNextInQueue = async () => {
    if (!$state.queueSlug) return;
    try {
      const result = await actions.navigateToNextReactionInQueue();
      if (!result?.ok && result?.reason === "end-of-queue" && browser) {
        showToast("End of queue.", TOASTS.INFO);
      }
    } catch (error) {
      console.error("Failed to navigate to next queue item", error);
      if (browser) {
        showToast("Unable to open the next queue item.", TOASTS.WARNING);
      }
    }
  };

  const handleSetReactionVideoId = async (value) => {
    const trimmed = value?.trim?.() ?? "";
    if (!trimmed) {
      reactionVideoIdError = "Enter a YouTube URL or ID before continuing.";
      return;
    }
    reactionVideoIdError = "";
    isSettingReactionVideoId = true;
    try {
      await actions.editActionEntryPoint(() =>
        actions.setReactionVideoId(trimmed),
      );
    } catch (error) {
      console.error("Failed to set reaction video ID", error);
      reactionVideoIdError =
        "We couldn't load that video. Double-check the link or ID and try again.";
      if (browser) {
        showToast(
          "Unable to load that reaction video. Check the ID and try again.",
          TOASTS.WARNING,
        );
      }
    } finally {
      isSettingReactionVideoId = false;
    }
  };

  const handleMissingReactionSubmit = async (event) => {
    await handleSetReactionVideoId(event.detail.value);
  };

  $: if (!$state.isReactionMissing && reactionVideoIdError) {
    reactionVideoIdError = "";
  }

  const handlePlayStateChanged = (event) => {
    actions.handlePlayStateChange(event.detail.isPlaying);
  };

  const getEditReactionHref = () => {
    const query = new URLSearchParams();
    if ($state.playlistDocumentId) {
      query.set("playlistId", $state.playlistDocumentId);
      if ($state.originalVideoId) {
        query.set("item", $state.originalVideoId);
      }
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return `/edit-reaction/${$state.pageSlug}${suffix}`;
  };

  $: if (browser && !$state.isLoading) {
    refreshQueueHasNext();
    reactionDial.updateContext({
      isUsersOwnVideo: $state.isUsersOwnVideo,
      canShowEditModeButton: $state.canShowEditModeButton,
      canShowCloseEditModeButton: $state.canShowCloseEditModeButton,
      isPublished: $state.isPublished,
      isReactionMissing: $state.isReactionMissing,
      isFullscreen: $state.isFullscreen,
      canShowEditPlaylistButton:
        Boolean($state.playlistDocumentId) && isCurrentReactionCreator,
      handlers: {
        enterEditMode: () => {
          if (!browser) return;
          // Hard navigate so editor always starts from a clean player state.
          window.location.assign(getEditReactionHref());
        },
        editPlaylist: $state.playlistDocumentId
          ? () => {
              if (!browser) return;
              goto(
                `/batch-edit?playlistDocumentId=${$state.playlistDocumentId}`,
              );
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
</script>

<div class={$state.isLoading ? "" : "hidden"}>
  <div class="flex justify-center py-24">
    <SubtleLoader label="Loading reaction experience" />
  </div>
</div>

<div
  class={`website-inner-container bg-background text-text-primary ${$state.isLoading ? "hidden" : ""}`}
>
  {#if $state.isReactionMissing && !$state.isUsersOwnVideo}
    <p class="mb-4 rounded-md bg-warning/10 px-4 py-3 text-sm text-warning">
      Warning: The reaction video id is missing. This reaction page will stay
      hidden until a video id is added in the
      <a class="underline" href={getEditReactionHref()} data-sveltekit-reload
        >edit view</a
      >
      and published again.
    </p>
  {/if}
  <ReactionStage
    isFullscreen={$state.isFullscreen}
    isControlSurfaceVisible={$state.isControlSurfaceVisible}
    isExitButtonExpanded={$state.isExitButtonExpanded}
    showCinematicBars={$state.showCinematicBars}
    isReactionMissing={$state.isReactionMissing}
    isUsersOwnVideo={$state.isUsersOwnVideo}
    playerOriginal={$state.playerOriginal}
    playerReaction={$state.playerReaction}
    {stickyControlsClass}
    bothVideosStarted={$state.bothVideosStarted}
    isPlaylist={Boolean($state.playlistDocumentId)}
    isPlaylistAutoPlay={$state.isPlaylistAutoPlay}
    reactionCurrentTime={$state.reactionCurrentTime}
    reactionDuration={$state.reactionDuration}
    offsetStartTime={$state.offsetStartTime}
    reactionFinishTime={$state.reactionFinishTime}
    missingReactionLoading={isSettingReactionVideoId}
    missingReactionError={reactionVideoIdError}
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
      {#if $state.queueSlug}
        <div class="mb-4 flex items-center justify-between">
          <QueueProgressPill
            queueSlug={$state.queueSlug}
            index={$state.queueIndex}
          />
          {#if queueHasNext}
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-text-primary backdrop-blur transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50"
              on:click={handleGoToNextInQueue}
              disabled={queueHasNextLoading}
              aria-label="Go to next item in queue"
              title="Next in queue"
            >
              Next
              <span class="text-text-muted" aria-hidden="true">→</span>
            </button>
          {/if}
        </div>
      {/if}

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

      {#if $state.originalVideoId && $state.playlistDocumentId}
        <div class="mt-8">
          <PlaylistQueue
            playlistItems={$state.playlistItems}
            playlistDocument={$state.playlistDocument}
            currentlyViewed={$state.originalVideoId}
            playlistId={$state.youtubePlaylistId}
            playlistDocumentId={$state.playlistDocumentId}
            isCreation={false}
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
