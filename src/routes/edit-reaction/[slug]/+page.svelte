<script>
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { onDestroy } from "svelte";
  import CreatorDetails from "$lib/components/Video/CreatorDetails.svelte";
  import PlaylistQueue from "$lib/components/Video/PlaylistQueue.svelte";
  import SubtleLoader from "$lib/components/design-system/SubtleLoader.svelte";
  import CinematicButton from "$lib/components/design-system/CinematicButton.svelte";
  import HelpfulTip from "$lib/components/design-system/HelpfulTip.svelte";
  import EditorPanelsV2 from "$lib/components/reaction/EditorPanelsV2.svelte";
  import ReactionStage from "$lib/components/reaction/ReactionStage.svelte";
  import {
    useTwinPlayers,
    CONTROLS_FADE_CLASS,
  } from "$lib/composables/useTwinPlayers";
  import { reactionDial } from "$lib/stores/reactionDial";
  import { showToast } from "$lib/stores/toast";
  import { TOASTS } from "$lib/constants/toasts";
  import { resolvePlaybackFrameKind } from "$lib/helpers/reactionListItem";

  export let data;
  const { state, actions } = useTwinPlayers({ data, enableAutoPlay: false });

  $: playbackFrameKind = resolvePlaybackFrameKind({
    queueSlug: $state.queueSlug,
    playlistId: $state.playlistDocumentId,
    isMomentReaction: $state.isMomentReaction,
    momentId: $state.momentId,
  });

  let overlayRef;

  const handlePlaylistQueueSelect = async ({ targetReactionDocumentId }) => {
    if (!targetReactionDocumentId) return;
    await goto(
      `/edit-reaction/${targetReactionDocumentId}${$page.url.search}${$page.url.hash}`,
    );
    location.reload();
  };

  $: stickyControlsClass = $state.isFullscreen
    ? CONTROLS_FADE_CLASS
    : "opacity-100";
  $: overlayRef && actions.registerOverlayRef(overlayRef);
  $: actions.handleSlugChange($page.params.slug);

  const handlePlayStateChanged = (event) => {
    actions.handlePlayStateChange(event.detail.isPlaying);
  };

  let isSettingReactionVideoId = false;
  let reactionVideoIdError = "";

  let isSettingRemixMode = false;

  const handleSetRemixMode = async (enabled) => {
    isSettingRemixMode = true;
    try {
      await actions.editActionEntryPoint(() => actions.setRemixMode(enabled));
    } finally {
      isSettingRemixMode = false;
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
    let shouldReload = false;
    try {
      await actions.editActionEntryPoint(() =>
        actions.setReactionVideoId(trimmed),
      );
      // The reaction player is created on load, so a new or changed ID
      // only shows up after a full reload.
      shouldReload = browser;
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
      if (shouldReload) {
        location.reload();
      } else {
        isSettingReactionVideoId = false;
      }
    }
  };

  const handleMissingReactionSubmit = async (event) => {
    await handleSetReactionVideoId(event.detail.value);
  };

  const handleSaveGeneralSettings = async (patch) => {
    await actions.editActionEntryPoint(async () => {
      if ("offsetStartTime" in patch) {
        await actions.setOffsetStartTime(patch.offsetStartTime);
      }
      if ("reactionFinishTime" in patch) {
        await actions.setReactionFinishTime(patch.reactionFinishTime);
      }
      if ("customReactionTitle" in patch) {
        await actions.setCustomReactionTitle(patch.customReactionTitle);
      }
      if ("introBufferTime" in patch) {
        await actions.setIntroBufferTime(patch.introBufferTime);
      }
      if ("soundLevel" in patch) {
        await actions.setSoundLevel(patch.soundLevel);
      }
      if ("isReactionMuteModeEnabled" in patch) {
        await actions.setReactionMuteMode(patch.isReactionMuteModeEnabled);
      }
      if ("fullscreenPrimaryVideo" in patch) {
        await actions.setFullscreenPrimaryVideo(patch.fullscreenPrimaryVideo);
      }
      if ("fullscreenOverlayWidthPercent" in patch) {
        await actions.setFullscreenOverlayWidthPercent(
          patch.fullscreenOverlayWidthPercent,
        );
      }
      if ("fullscreenOverlayCorner" in patch) {
        await actions.setFullscreenOverlayCorner(patch.fullscreenOverlayCorner);
      }
    });
  };

  const handleExitEditor = () => {
    if ($state.isEditModeOn) {
      actions.closeEditMode();
    }
    if (!browser) return;

    const playlistSlugFromUrl = $page.url.searchParams.get("playlistId");
    const itemFromUrl = $page.url.searchParams.get("item");
    const playlistSlug = $state.playlistDocumentId ?? playlistSlugFromUrl;

    if (playlistSlug) {
      const originalVideoId = $state.originalVideoId ?? itemFromUrl;
      const itemQuery = originalVideoId
        ? `?item=${encodeURIComponent(originalVideoId)}`
        : "";
      // Hard navigate to ensure a fresh player state.
      window.location.assign(`/playlist/${playlistSlug}${itemQuery}`);
      return;
    }

    // Hard navigate to ensure a fresh player state.
    window.location.assign(`/reaction/${$state.pageSlug}`);
  };

  let hasCheckedOwnership = false;

  // Redirect viewers without edit permissions back to the playback route.
  $: if (!hasCheckedOwnership && browser && !$state.isLoading) {
    hasCheckedOwnership = true;
    if (!$state.isUsersOwnVideo) {
      goto(`/reaction/${$state.pageSlug}`);
    }
  }

  $: if (!$state.isReactionMissing && reactionVideoIdError) {
    reactionVideoIdError = "";
  }

  $: if (
    browser &&
    !$state.isLoading &&
    $state.isUsersOwnVideo &&
    !$state.isEditModeOn
  ) {
    actions.enterEditMode();
  }

  // General settings take two fifths beside the stage, which takes three.
  // Fine-tune keeps the timeline full width under the player.
  $: generalSettingsSplit = !$state.isFullscreen && !$state.isFineTuneModeOn;
  // The player stage is half the viewport by itself. The title above it
  // is outside that box, so on first paint the stage runs past the midpoint.
  $: fineTuneHalf = !$state.isFullscreen && $state.isFineTuneModeOn;

  $: if (browser && !$state.isLoading) {
    reactionDial.updateContext({
      isUsersOwnVideo: $state.isUsersOwnVideo,
      canShowEditModeButton: false,
      canShowCloseEditModeButton: $state.isUsersOwnVideo && $state.isEditModeOn,
      isPublished: $state.isPublished,
      isReactionMissing: $state.isReactionMissing,
      remixMode: $state.remixMode,
      isFullscreen: $state.isFullscreen,
      canShowEditPlaylistButton: false,
      handlers: {
        enterEditMode: null,
        closeEditMode: handleExitEditor,
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
    <SubtleLoader label="Loading editor" />
  </div>
</div>

<div
  class={`website-inner-container bg-background text-text-primary ${$state.isLoading ? "hidden" : ""}`}
>
  {#snippet editorPanels()}
    <EditorPanelsV2
      isReactionMissing={$state.isReactionMissing}
      isEditModeOn={$state.isEditModeOn}
      isFineTuneModeOn={$state.isFineTuneModeOn}
      isPlaylist={Boolean($state.youtubePlaylistId)}
      reactionVideoId={$state.reactionVideoId}
      reactionVideoTitle={$state.reactionVideoTitle}
      customReactionTitle={$state.customReactionTitle}
      {reactionVideoIdError}
      {isSettingReactionVideoId}
      remixMode={$state.remixMode}
      {isSettingRemixMode}
      offsetStartTime={$state.offsetStartTime}
      introBufferTime={$state.introBufferTime}
      reactionFinishTime={$state.reactionFinishTime}
      soundLevel={$state.soundLevel}
      isReactionMuteModeEnabled={$state.isReactionMuteModeEnabled}
      playerConfigs={$state.playerConfigs}
      volumeConfigs={$state.volumeConfigs}
      reactionVolumeConfigs={$state.reactionVolumeConfigs}
      stateTimeline={$state.stateTimeline}
      volumeTimeline={$state.volumeTimeline}
      reactionVolumeTimeline={$state.reactionVolumeTimeline}
      playbackRateConfigs={$state.playbackRateConfigs}
      playbackRateTimeline={$state.playbackRateTimeline}
      overlayVisibilityTimeline={$state.overlayVisibilityTimeline}
      reactionCurrentTime={$state.reactionCurrentTime}
      reactionDuration={$state.reactionDuration}
      originalCurrentTime={$state.originalCurrentTime}
      originalDuration={$state.originalDuration}
      playerEventTimeline={$state.playerEventTimeline}
      fullscreenPrimaryVideoDefault={$state.fullscreenPrimaryVideoDefault}
      fullscreenOverlayWidthPercent={$state.fullscreenOverlayWidthPercent}
      fullscreenOverlayCorner={$state.fullscreenOverlayCorner}
      originalVideoPlatform={$state.originalVideoPlatform}
      onCreatePlayerConfig={actions.createPlayerConfig}
      onCreateVolumeConfig={actions.createVolumeConfig}
      onCreateReactionVolumeConfig={actions.createReactionVolumeConfig}
      onCreatePlaybackRateConfig={actions.createPlaybackRateConfig}
      onCreateOverlayVisibilityConfig={actions.createOverlayVisibilityConfig}
      onUpdatePlayerConfig={actions.updatePlayerConfig}
      onDeletePlayerConfig={actions.deletePlayerConfig}
      onUpdateVolumeConfig={actions.updateVolumeConfig}
      onDeleteVolumeConfig={actions.deleteVolumeConfig}
      onUpdateReactionVolumeConfig={actions.updateReactionVolumeConfig}
      onDeleteReactionVolumeConfig={actions.deleteReactionVolumeConfig}
      onUpdatePlaybackRateConfig={actions.updatePlaybackRateConfig}
      onDeletePlaybackRateConfig={actions.deletePlaybackRateConfig}
      onUpdateOverlayVisibilityConfig={actions.updateOverlayVisibilityConfig}
      onDeleteOverlayVisibilityConfig={actions.deleteOverlayVisibilityConfig}
      onSetReactionVideoId={handleSetReactionVideoId}
      onSetRemixMode={handleSetRemixMode}
      onSaveGeneralSettings={handleSaveGeneralSettings}
      onSeek={actions.seekTo}
    />
  {/snippet}

  <div class={fineTuneHalf ? "edit-finetune-top" : ""}>
  {#if !$state.isFullscreen}
    <div
      class="mx-auto flex w-full shrink-0 flex-wrap items-center justify-between gap-3 px-4 pt-6 sm:px-6 lg:px-10"
    >
      <h1 class="text-xl font-semibold text-text-primary">Edit Reaction</h1>
      <div class="flex items-center gap-2">
        <HelpfulTip
          variant="tooltip"
          placement="bottom"
          label="About fine-tune mode"
        >
          {$state.remixMode
            ? "Remix mode times every cue to the original video. Click a track to add or fix pauses, volume, or speed. The original stays fullscreen, so there is no overlay track. To zoom into a section, press and drag across any track, then release."
            : "Cues from your recording are already on the timeline. Click a track to add or fix pauses, volume, speed, or overlay. To zoom into a section, press and drag across any track, then release."}
        </HelpfulTip>
        <CinematicButton
          type="button"
          size="sm"
          variant={$state.isFineTuneModeOn ? "muted" : "secondary"}
          on:click={actions.toggleFineTuneMode}
        >
          <span
            >{$state.isFineTuneModeOn
              ? "Disable fine-tune mode"
              : "Enable fine-tune mode"}</span
          >
        </CinematicButton>
        <CinematicButton
          variant="secondary"
          size="sm"
          ariaLabel="Return to reaction page"
          on:click={handleExitEditor}
        >
          <span>View Live Page</span>
        </CinematicButton>

      </div>
    </div>
  {/if}

  <div
    class={generalSettingsSplit
      ? "edit-general-layout mx-auto w-full lg:grid lg:grid-cols-5 lg:items-start lg:gap-6 lg:px-10 lg:pt-6"
      : fineTuneHalf
        ? "edit-finetune-stage"
        : ""}
  >
    <div
      class={generalSettingsSplit
        ? "min-w-0 lg:col-span-3 lg:col-start-3 lg:row-start-1 lg:sticky lg:top-24 lg:z-10 lg:self-start"
        : fineTuneHalf
          ? "flex min-h-0 flex-1 flex-col"
          : ""}
    >
      <ReactionStage
        limitToHalfScreen={fineTuneHalf}
        isFullscreen={$state.isFullscreen}
        isControlSurfaceVisible={$state.isControlSurfaceVisible}
        isExitButtonExpanded={$state.isExitButtonExpanded}
        showCinematicBars={$state.showCinematicBars}
        isReactionMissing={$state.isReactionMissing}
        remixMode={$state.remixMode}
        isUsersOwnVideo={$state.isUsersOwnVideo}
        playerOriginal={$state.playerOriginal}
        playerReaction={$state.playerReaction}
        originalVideoPlatform={$state.originalVideoPlatform}
        {stickyControlsClass}
        bothVideosStarted={$state.bothVideosStarted}
        isPlaylist={Boolean($state.playlistDocumentId)}
        isPlaylistAutoPlay={$state.isPlaylistAutoPlay}
        itemType={playbackFrameKind}
        showAutoPlayButton={false}
        reactionCurrentTime={$state.reactionCurrentTime}
        reactionDuration={$state.reactionDuration}
        originalCurrentTime={$state.originalCurrentTime}
        originalDuration={$state.originalDuration}
        offsetStartTime={$state.offsetStartTime}
        reactionFinishTime={$state.reactionFinishTime}
        fullscreenPrimaryVideo={$state.fullscreenPrimaryVideo}
        fullscreenOverlayWidthPercent={$state.fullscreenOverlayWidthPercent}
        fullscreenOverlayCorner={$state.fullscreenOverlayCorner}
        fullscreenOverlayVisible={$state.fullscreenOverlayVisible}
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
    </div>

    {#if !$state.isFullscreen && !fineTuneHalf}
      <div
        class={generalSettingsSplit
          ? "mx-auto mt-6 w-full min-w-0 px-4 sm:px-6 lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:mt-0 lg:px-0"
          : "mx-auto mt-6 w-full px-4 sm:px-6 lg:px-10"}
      >
          {@render editorPanels()}
      </div>
    {/if}
  </div>
  </div>

  {#if fineTuneHalf}
    <div class="mx-auto mt-6 w-full px-4 sm:px-6 lg:px-10">
      {@render editorPanels()}
    </div>
  {/if}

  {#if !$state.isFullscreen}
    <div
      class={`mx-auto w-full px-4 pb-10 sm:px-6 lg:px-10 ${generalSettingsSplit ? "lg:mt-8" : ""}`}
    >
      <CreatorDetails
        originalVideoAuthor={$state.originalVideoAuthor}
        originalVideoAuthorUrl={$state.originalVideoAuthorUrl}
        originalVideoTitle={$state.originalVideoTitle}
        originalVideoId={$state.originalVideoId}
        originalVideoUrl={$state.originalVideoUrl}
        originalVideoPlatform={$state.originalVideoPlatform}
        reactionVideoAuthor={$state.reactionVideoAuthor}
        reactionVideoTitle={$state.reactionVideoTitle}
        reactionVideoId={$state.reactionVideoId}
        pageSlug={$state.pageSlug}
        isUsersOwnVideo={$state.isUsersOwnVideo}
        reactorId={$state.reactorId}
        reactorDisplayName={$state.reactorDisplayName}
      />

      {#if $state.originalVideoId && $state.playlistDocumentId}
        <div class="mt-8">
          <PlaylistQueue
            playlistItems={$state.playlistItems}
            playlistDocument={$state.playlistDocument}
            currentlyViewed={$state.originalVideoId}
            playlistId={$state.youtubePlaylistId}
            playlistDocumentId={$state.playlistDocumentId}
            currentIndex={$state.currentIndexInPlaylist}
            isCreation={false}
            onSelect={handlePlaylistQueueSelect}
          />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .website-inner-container {
    margin: 0;
    width: 100%;
  }

  /* Title sits above this. Only the player stage is half the viewport. */
  .edit-finetune-top {
    display: flex;
    flex-direction: column;
  }

  .edit-finetune-stage {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    height: 50vh;
    height: 50dvh;
    min-height: 0;
  }

  /* The stage's own page gutters and 80% cap are for the full-width player.
     Inside the three-fifths column those insets would shrink it a second time. */
  @media (min-width: 1024px) {
    .edit-general-layout :global(.theater-wrapper:not(.theater-wrapper--fullscreen)) {
      width: 100%;
      max-width: none;
      margin: 0;
      padding-left: 1rem;
      padding-right: 1rem;
    }

    .edit-general-layout
      :global(.theater-wrapper:not(.theater-wrapper--fullscreen) .controls-dock) {
      padding-left: 1rem;
      padding-right: 1rem;
    }
  }

  :global(body.reaction-fullscreen) {
    overflow: hidden;
  }
</style>
