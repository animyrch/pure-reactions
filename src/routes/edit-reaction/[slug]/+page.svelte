<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { onDestroy, tick } from 'svelte';
  import CreatorDetails from '$lib/components/Video/CreatorDetails.svelte';
  import PlaylistQueue from '$lib/components/Video/PlaylistQueue.svelte';
  import SubtleLoader from '$lib/components/design-system/SubtleLoader.svelte';
  import CinematicButton from '$lib/components/design-system/CinematicButton.svelte';
  import FullscreenChrome from '$lib/components/reaction/FullscreenChrome.svelte';
  import ControlDock from '$lib/components/reaction/ControlDock.svelte';
  import EditorPanelsV2 from '$lib/components/reaction/EditorPanelsV2.svelte';
  import MissingReactionPlaceholder from '$lib/components/reaction/MissingReactionPlaceholder.svelte';
  import { useTwinPlayers, CONTROLS_FADE_CLASS } from '$lib/composables/useTwinPlayers';
  import { reactionDial } from '$lib/stores/reactionDial';
  import { showToast } from '$lib/stores/toast';
  import { TOASTS } from '$lib/constants/toasts';

  export let data;
  const { state, actions } = useTwinPlayers({ data });

  let overlayRef;
  let editSectionRef;
  let hasScrolledToEditor = false;
  let isScrollPending = false;
  let scrollFrame;

  $: stickyControlsClass = $state.isFullscreen ? CONTROLS_FADE_CLASS : 'opacity-100';
  $: overlayRef && actions.registerOverlayRef(overlayRef);
  $: actions.handleSlugChange($page.params.slug);

  const handlePlayStateChanged = (event) => {
    actions.handlePlayStateChange(event.detail.isPlaying);
  };

  let isSettingReactionVideoId = false;
  let reactionVideoIdError = '';

  const handleSetReactionVideoId = async (value) => {
    const trimmed = value?.trim?.() ?? '';
    if (!trimmed) {
      reactionVideoIdError = 'Enter a YouTube URL or ID before continuing.';
      return;
    }
    reactionVideoIdError = '';
    isSettingReactionVideoId = true;
    try {
      await actions.editActionEntryPoint(() => actions.setReactionVideoId(trimmed));
    } catch (error) {
      console.error('Failed to set reaction video ID', error);
      reactionVideoIdError = 'We couldn\'t load that video. Double-check the link or ID and try again.';
      if (browser) {
        showToast('Unable to load that reaction video. Check the ID and try again.', TOASTS.WARNING);
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
    await actions.editActionEntryPoint(() => actions.setReactionFinishTime(value));
  };

  const handleSetSoundLevel = async (value) => {
    await actions.editActionEntryPoint(() => actions.setSoundLevel(value));
  };

  const handleSetReactionMuteMode = async (value) => {
    await actions.editActionEntryPoint(() => actions.setReactionMuteMode(value));
  };

  const handleExitEditor = () => {
    if ($state.isEditModeOn) {
      actions.closeEditMode();
    }
    if (!browser) return;
    goto(`/reaction/${$state.pageSlug}`);
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
    reactionVideoIdError = '';
  }

  $: if (browser && !$state.isLoading && $state.isUsersOwnVideo && !$state.isEditModeOn) {
    actions.enterEditMode();
  }

  // Bring the editor controls into view once the layout is ready.
  const scrollEditorIntoView = async () => {
    if (isScrollPending) return;
    isScrollPending = true;
    await tick();
    if (!editSectionRef) {
      isScrollPending = false;
      return;
    }
    scrollFrame = requestAnimationFrame(() => {
      if (!editSectionRef) {
        isScrollPending = false;
        return;
      }
      editSectionRef.scrollIntoView({ behavior: 'smooth', block: 'start' });
      hasScrolledToEditor = true;
      isScrollPending = false;
      scrollFrame = undefined;
    });
  };

  $: if (!hasScrolledToEditor && browser && !$state.isLoading && !$state.isFullscreen && editSectionRef) {
    scrollEditorIntoView();
  }

  $: if (browser && !$state.isLoading) {
    reactionDial.updateContext({
      isUsersOwnVideo: $state.isUsersOwnVideo,
      canShowEditModeButton: false,
      canShowCloseEditModeButton: $state.isUsersOwnVideo && $state.isEditModeOn,
      isPublished: $state.isPublished,
      isReactionMissing: $state.isReactionMissing,
      isFullscreen: $state.isFullscreen,
      handlers: {
        enterEditMode: null,
        closeEditMode: handleExitEditor,
        setIsPublished: actions.setIsPublished,
        setIsUnpublished: actions.setIsUnpublished,
        openWithFullscreen: actions.openWithFullscreen,
        openWithHalfscreen: actions.openWithHalfscreen
      }
    });
  }

  onDestroy(() => {
    if (browser && scrollFrame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(scrollFrame);
    }
    reactionDial.reset();
  });
</script>

<div class={$state.isLoading ? '' : 'hidden'}>
  <div class="flex justify-center py-24">
    <SubtleLoader label="Loading editor" />
  </div>
</div>

<div class={`website-inner-container bg-background text-text-primary ${$state.isLoading ? 'hidden' : ''}`}>
  {#if !$state.isFullscreen}
    <div class="mx-auto flex w-full flex-wrap items-center justify-between gap-3 px-4 pt-6 sm:px-6 lg:px-10">
      <h1 class="text-xl font-semibold text-text-primary">Edit Reaction</h1>
      <div class="flex items-center gap-2">
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

  <section
    class={`theater-wrapper ${$state.isFullscreen
      ? 'fixed inset-0 z-50 m-0 h-screen w-screen overflow-hidden rounded-none bg-black px-0 py-0 text-text-primary shadow-none'
      : 'relative mx-auto my-6 w-full max-w-none rounded-2xl bg-surface/80 px-4 py-8 text-text-primary shadow-elevated backdrop-blur sm:px-6 lg:px-10 xl:rounded-3xl'
    }`}
  >
    {#if $state.isFullscreen}
      <FullscreenChrome
        isControlSurfaceVisible={$state.isControlSurfaceVisible}
        isExitButtonExpanded={$state.isExitButtonExpanded}
        showCinematicBars={$state.showCinematicBars}
        isReactionMissing={$state.isReactionMissing}
        bind:overlayRef={overlayRef}
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
            <div class="pointer-events-none absolute inset-x-0 top-0 h-[12%] bg-gradient-to-b from-black via-black/80 to-transparent" aria-hidden="true"></div>
            <div class="pointer-events-none absolute inset-x-0 bottom-0 h-[12%] bg-gradient-to-t from-black via-black/80 to-transparent" aria-hidden="true"></div>
          {/if}
        </div>
        {#if !$state.isReactionMissing}
          <div class="relative overflow-hidden rounded-xl bg-black/80 shadow-surface">
            <div class="relative aspect-[16/9] sm:aspect-[3/2]">
              <div id="player-reaction" class="absolute inset-0 h-full w-full"></div>
            </div>
          </div>
        {:else}
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
        stickyControlsClass={stickyControlsClass}
        bothVideosStarted={$state.bothVideosStarted}
        isPlaylist={Boolean($state.playlistDocumentId)}
        isPlaylistAutoPlay={$state.isPlaylistAutoPlay}
        showCinematicBars={$state.showCinematicBars}
        onPlayStateChanged={handlePlayStateChanged}
        onSyncVideos={actions.syncVideos}
        onToggleAutoPlaylist={actions.toggleAutoPlaylist}
        onToggleBars={actions.toggleCinematicBars}
        onEnterFullscreen={actions.openWithFullscreen}
      />
    {/if}
  </section>

  {#if !$state.isFullscreen}
    <div class="mx-auto w-full px-4 pb-10 sm:px-6 lg:px-10">
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

      <div
        class="mt-10 rounded-2xl bg-surface/80 p-6 shadow-elevated"
        bind:this={editSectionRef}
      >
        <EditorPanelsV2
          isReactionMissing={$state.isReactionMissing}
          isEditModeOn={$state.isEditModeOn}
          isFineTuneModeOn={$state.isFineTuneModeOn}
          isPlaylist={Boolean($state.youtubePlaylistId)}
          reactionVideoId={$state.reactionVideoId}
          reactionVideoIdError={reactionVideoIdError}
          isSettingReactionVideoId={isSettingReactionVideoId}
          offsetStartTime={$state.offsetStartTime}
          introBufferTime={$state.introBufferTime}
          reactionFinishTime={$state.reactionFinishTime}
          soundLevel={$state.soundLevel}
          isReactionMuteModeEnabled={$state.isReactionMuteModeEnabled}
          playerConfigs={$state.playerConfigs}
          volumeConfigs={$state.volumeConfigs}
          stateTimeline={$state.stateTimeline}
          volumeTimeline={$state.volumeTimeline}
          playbackRateConfigs={$state.playbackRateConfigs}
          playbackRateTimeline={$state.playbackRateTimeline}
          reactionCurrentTime={$state.reactionCurrentTime}
          reactionDuration={$state.reactionDuration}
          playerEventTimeline={$state.playerEventTimeline}
          onCreatePlayerConfig={actions.createPlayerConfig}
          onCreateVolumeConfig={actions.createVolumeConfig}
          onCreatePlaybackRateConfig={actions.createPlaybackRateConfig}
          onUpdatePlayerConfig={actions.updatePlayerConfig}
          onDeletePlayerConfig={actions.deletePlayerConfig}
          onUpdateVolumeConfig={actions.updateVolumeConfig}
          onDeleteVolumeConfig={actions.deleteVolumeConfig}
          onUpdatePlaybackRateConfig={actions.updatePlaybackRateConfig}
          onDeletePlaybackRateConfig={actions.deletePlaybackRateConfig}
          onSetReactionVideoId={handleSetReactionVideoId}
          onSetOffsetStartTime={handleSetOffsetStartTime}
          onSetIntroBufferTime={handleSetIntroBufferTime}
          onSetReactionFinishTime={handleSetReactionFinishTime}
          onSetSoundLevel={handleSetSoundLevel}
          onSetReactionMuteMode={handleSetReactionMuteMode}
          onToggleFineTuneMode={actions.toggleFineTuneMode}
        />
      </div>
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

