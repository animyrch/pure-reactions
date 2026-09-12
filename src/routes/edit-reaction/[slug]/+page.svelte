<script>
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { onDestroy } from "svelte";
  import CreatorDetails from "$lib/components/Video/CreatorDetails.svelte";
  import PlaylistQueue from "$lib/components/Video/PlaylistQueue.svelte";
  import SubtleLoader from "$lib/components/design-system/SubtleLoader.svelte";
  import CinematicButton from "$lib/components/design-system/CinematicButton.svelte";
  import WalkalongClue from "$lib/components/design-system/WalkalongClue.svelte";
  import FullscreenChrome from "$lib/components/reaction/FullscreenChrome.svelte";
  import ControlDock from "$lib/components/reaction/ControlDock.svelte";
  import EditorPanelsV2 from "$lib/components/reaction/EditorPanelsV2.svelte";
  import MissingReactionPlaceholder from "$lib/components/reaction/MissingReactionPlaceholder.svelte";
  import {
    useTwinPlayers,
    CONTROLS_FADE_CLASS,
  } from "$lib/composables/useTwinPlayers";
  import { reactionDial } from "$lib/stores/reactionDial";
  import { showToast } from "$lib/stores/toast";
  import { TOASTS } from "$lib/constants/toasts";
  import { userExtraDataStore } from "$lib/stores/userExtraData";

  export let data;
  const { state, actions } = useTwinPlayers({ data, enableAutoPlay: false });

  let overlayRef;

  let seenClues = null;
  let editUserId = data?.userId ?? '';

  const loadSeenClues = () => {
    const storeData = $userExtraDataStore.userExtraData;
    return storeData?.seenWalkalongClues ?? (() => {
      try { return JSON.parse(localStorage.getItem('seenWalkalongClues') || '[]'); } catch { return []; }
    })();
  };

  $: if (browser) {
    const storeSeenClues = $userExtraDataStore.userExtraData?.seenWalkalongClues;
    if (Array.isArray(storeSeenClues)) {
      seenClues = storeSeenClues;
    } else if (seenClues === null) {
      seenClues = loadSeenClues();
    }
  }

  const handleClueDismiss = ({ detail }) => {
    userExtraDataStore.markClueSeen($userExtraDataStore.userExtraData, detail.userId, detail.clueId);
    const nextSeenClues = Array.isArray(seenClues) ? seenClues : [];
    if (!nextSeenClues.includes(detail.clueId)) {
      seenClues = [...nextSeenClues, detail.clueId];
    }
  };

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

  const handleSetIntroBufferTime = async (value) => {
    await actions.editActionEntryPoint(() => actions.setIntroBufferTime(value));
  };

  const handleSetOffsetStartTime = async (value) => {
    await actions.editActionEntryPoint(() => actions.setOffsetStartTime(value));
  };

  const handleSetReactionFinishTime = async (value) => {
    await actions.editActionEntryPoint(() =>
      actions.setReactionFinishTime(value),
    );
  };

  const handleSetSoundLevel = async (value) => {
    await actions.editActionEntryPoint(() => actions.setSoundLevel(value));
  };

  const handleSetReactionMuteMode = async (value) => {
    await actions.editActionEntryPoint(() =>
      actions.setReactionMuteMode(value),
    );
  };

  const handleSetFullscreenPrimaryVideo = async (value) => {
    await actions.editActionEntryPoint(() =>
      actions.setFullscreenPrimaryVideo(value),
    );
  };

  const handleSetFullscreenOverlayWidthPercent = async (value) => {
    await actions.editActionEntryPoint(() =>
      actions.setFullscreenOverlayWidthPercent(value),
    );
  };

  const handleSetFullscreenOverlayCorner = async (value) => {
    await actions.editActionEntryPoint(() =>
      actions.setFullscreenOverlayCorner(value),
    );
  };

  let isOverlayPositionPanelOpen = false;

  const handleToggleOverlayPositionPanel = () => {
    isOverlayPositionPanelOpen = !isOverlayPositionPanelOpen;
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

  $: if (browser && !$state.isLoading) {
    reactionDial.updateContext({
      isUsersOwnVideo: $state.isUsersOwnVideo,
      canShowEditModeButton: false,
      canShowCloseEditModeButton: $state.isUsersOwnVideo && $state.isEditModeOn,
      isPublished: $state.isPublished,
      isReactionMissing: $state.isReactionMissing,
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
  {#if !$state.isFullscreen}
    <div
      class="mx-auto flex w-full flex-wrap items-center justify-between gap-3 px-4 pt-6 sm:px-6 lg:px-10"
    >
      <h1 class="text-xl font-semibold text-text-primary">Edit Reaction</h1>
      <div class="flex items-center gap-2">
        
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

    <div class="mx-auto w-full px-4 sm:px-6 lg:px-10">
      <div class="mt-6 rounded-2xl bg-surface/80 p-6 shadow-elevated">
        <EditorPanelsV2
          isReactionMissing={$state.isReactionMissing}
          isEditModeOn={$state.isEditModeOn}
          isFineTuneModeOn={$state.isFineTuneModeOn}
          isPlaylist={Boolean($state.youtubePlaylistId)}
          reactionVideoId={$state.reactionVideoId}
          {reactionVideoIdError}
          {isSettingReactionVideoId}
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
          onSetOffsetStartTime={handleSetOffsetStartTime}
          onSetIntroBufferTime={handleSetIntroBufferTime}
          onSetReactionFinishTime={handleSetReactionFinishTime}
          onSetSoundLevel={handleSetSoundLevel}
          onSetReactionMuteMode={handleSetReactionMuteMode}
          onSetFullscreenPrimaryVideo={handleSetFullscreenPrimaryVideo}
          onSetFullscreenOverlayWidthPercent={handleSetFullscreenOverlayWidthPercent}
          onSetFullscreenOverlayCorner={handleSetFullscreenOverlayCorner}
          onToggleFineTuneMode={actions.toggleFineTuneMode}
          onToggleOverlayPositionPanel={handleToggleOverlayPositionPanel}
          {isOverlayPositionPanelOpen}
          onSeek={actions.seekTo}
        />
      </div>
      {#if !$state.isReactionMissing && !$state.isPublished}
        <div class="mt-4">
          <WalkalongClue
            clueId="publish.first"
            message="Publish makes this reaction visible publicly. It stays private until you publish. Use the speed dial (bottom-right) to publish."
            helpHref="/insights/create-your-first-reaction"
            {seenClues}
            userId={editUserId}
            on:dismiss={handleClueDismiss}
          />
        </div>
      {/if}
    </div>
  {/if}

  <section
    class={`theater-wrapper ${
      $state.isFullscreen
        ? "fixed inset-0 z-50 m-0 h-screen w-screen overflow-hidden rounded-none bg-black px-0 py-0 text-text-primary shadow-none"
        : "relative mx-auto my-6 w-full max-w-none rounded-2xl bg-surface/80 px-4 py-8 text-text-primary shadow-elevated backdrop-blur sm:px-6 lg:px-10 xl:rounded-3xl"
    }`}
  >
    {#if $state.isFullscreen}
      <FullscreenChrome
        isControlSurfaceVisible={$state.isControlSurfaceVisible}
        isExitButtonExpanded={$state.isExitButtonExpanded}
        showCinematicBars={$state.showCinematicBars}
        isReactionMissing={$state.isReactionMissing}
        fullscreenPrimaryVideo={$state.fullscreenPrimaryVideo}
        fullscreenOverlayWidthPercent={$state.fullscreenOverlayWidthPercent}
        fullscreenOverlayCorner={$state.fullscreenOverlayCorner}
        fullscreenOverlayVisible={$state.fullscreenOverlayVisible}
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
        <div
          class="relative overflow-hidden rounded-xl bg-black shadow-elevated"
        >
          {#if $state.originalVideoPlatform === 'tiktok'}
            <!-- TikTok: keep the same height as the 16:9 container, centre the 9:16 iframe inside -->
            <div class="relative aspect-[16/9] sm:aspect-[3/2]">
              <div class="absolute inset-0 flex items-center justify-center">
                <div
                  class="relative h-full overflow-hidden bg-black"
                  style="aspect-ratio: 9/16;"
                >
                  <div
                    id="player-original"
                    class="h-full w-full"
                  ></div>
                </div>
              </div>
            </div>
          {:else}
            <div class="relative aspect-[16/9] sm:aspect-[3/2]">
              <div
                id="player-original"
                class="absolute inset-0 h-full w-full"
              ></div>
            </div>
          {/if}
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
          <div
            class="relative overflow-hidden rounded-xl bg-black/80 shadow-surface"
          >
            <div class="relative aspect-[16/9] sm:aspect-[3/2]">
              <div
                id="player-reaction"
                class="absolute inset-0 h-full w-full"
              ></div>
            </div>
          </div>
          <WalkalongClue
            clueId="editor.preview"
            message="Play to confirm the faces and original stay in sync. Offset and buffer are optional fine-tuning — most reactions work without them."
            helpHref="/insights/create-your-first-reaction"
            {seenClues}
            userId={editUserId}
            on:dismiss={handleClueDismiss}
          />
        {:else}
          <WalkalongClue
            clueId="editor.link-reaction"
            message="Upload your recording to YouTube (unlisted is fine), then paste the URL here. The two videos stay separate — Pure Reactions only syncs the playback."
            helpHref="/insights/create-your-first-reaction"
            {seenClues}
            userId={editUserId}
            on:dismiss={handleClueDismiss}
          />
          <MissingReactionPlaceholder
            loading={isSettingReactionVideoId}
            error={reactionVideoIdError}
            on:submit={handleMissingReactionSubmit}
          />
        {/if}
      </div>
    {/if}

    {#if $state.playerOriginal && $state.playerReaction}
      <ControlDock
        isFullscreen={$state.isFullscreen}
        {stickyControlsClass}
        bothVideosStarted={$state.bothVideosStarted}
        isPlaylist={Boolean($state.playlistDocumentId)}
        isPlaylistAutoPlay={$state.isPlaylistAutoPlay}
        showAutoPlayButton={false}
        showCinematicBars={$state.showCinematicBars}
        onPlayStateChanged={handlePlayStateChanged}
        onSyncVideos={actions.syncVideos}
        onToggleAutoPlaylist={actions.toggleAutoPlaylist}
        onToggleBars={actions.toggleCinematicBars}
        onEnterFullscreen={actions.openWithFullscreen}
        currentTime={$state.reactionCurrentTime}
        duration={$state.reactionDuration}
        seekMin={$state.offsetStartTime || 0}
        seekMax={Math.min(
          $state.reactionFinishTime || 0,
          $state.reactionDuration || 0,
        )}
        onSeek={actions.seekTo}
      />
    {/if}
  </section>

  {#if !$state.isFullscreen}
    <div class="mx-auto w-full px-4 pb-10 sm:px-6 lg:px-10">
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

  :global(body.reaction-fullscreen) {
    overflow: hidden;
  }
</style>
