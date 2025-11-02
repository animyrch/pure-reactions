<script>
  import { page } from '$app/stores';
  import ReactionBinomeTopActions from '$lib/components/Video/ReactionBinomeTopActions.svelte';
  import CreatorDetails from '$lib/components/Video/CreatorDetails.svelte';
  import PlaylistQueue from '$lib/components/Video/PlaylistQueue.svelte';
  import OtherReactions from '$lib/components/Video/OtherReactions.svelte';
  import SubtleLoader from '$lib/components/design-system/SubtleLoader.svelte';
  import FullscreenChrome from '$lib/components/reaction/FullscreenChrome.svelte';
  import ControlDock from '$lib/components/reaction/ControlDock.svelte';
  import EditorPanels from '$lib/components/reaction/EditorPanels.svelte';
  import { useTwinPlayers, CONTROLS_FADE_CLASS } from '$lib/composables/useTwinPlayers';

  export let data;

  const { state, actions } = useTwinPlayers({ data });

  let overlayRef;

  $: stickyControlsClass = $state.bothVideosStarted ? CONTROLS_FADE_CLASS : 'opacity-100';
  $: overlayRef && actions.registerOverlayRef(overlayRef);
  $: actions.handleSlugChange($page.params.slug);

  const handlePlayStateChanged = (event) => {
    actions.handlePlayStateChange(event.detail.isPlaying);
  };

  const handleSetReactionVideoId = async (value) => {
    await actions.editActionEntryPoint(() => actions.setReactionVideoId(value));
  };

  const handleSetIntroBufferTime = async (value) => {
    await actions.editActionEntryPoint(() => actions.setIntroBufferTime(value));
  };

  const handleSetSoundLevel = async (value) => {
    await actions.editActionEntryPoint(() => actions.setSoundLevel(value));
  };
</script>

<div class={$state.isLoading ? '' : 'hidden'}>
  <div class="flex justify-center py-24">
    <SubtleLoader label="Loading reaction experience" />
  </div>
</div>

<div class={`website-inner-container bg-background text-text-primary ${$state.isLoading ? 'hidden' : ''}`}>
    {#if $state.isReactionMissing}
      <p class="mb-4 rounded-md bg-warning/10 px-4 py-3 text-sm text-warning">
        Warning: The reaction video id is missing. This reaction page will stay hidden until a video id is added below and published again.
      </p>
    {/if}

    <ReactionBinomeTopActions
      isUsersOwnVideo={$state.isUsersOwnVideo}
      canShowEditModeButton={$state.canShowEditModeButton}
      canShowCloseEditModeButton={$state.canShowCloseEditModeButton}
      isPublished={$state.isPublished}
      isReactionMissing={$state.isReactionMissing}
      isFullscreen={$state.isFullscreen}
      on:enterEditMode={actions.enterEditMode}
      on:closeEditMode={actions.closeEditMode}
      on:setIsPublished={actions.setIsPublished}
      on:setIsUnpublished={actions.setIsUnpublished}
      on:openWithFullscreen={actions.openWithFullscreen}
      on:openWithHalfscreen={actions.openWithHalfscreen}
    />

    <section
      class={`theater-wrapper ${$state.isFullscreen
        ? 'fixed inset-0 z-50 m-0 h-screen w-screen overflow-hidden rounded-none bg-black px-0 py-0 text-text-primary shadow-none'
        : 'relative mx-auto my-10 w-full max-w-none rounded-2xl bg-surface/80 px-4 py-8 text-text-primary shadow-elevated backdrop-blur sm:px-6 lg:px-10 xl:rounded-3xl'
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

      <EditorPanels
        isReactionMissing={$state.isReactionMissing}
        isEditModeOn={$state.isEditModeOn}
        isFineTuneModeOn={$state.isFineTuneModeOn}
        reactionVideoId={$state.reactionVideoId}
        introBufferTime={$state.introBufferTime}
        soundLevel={$state.soundLevel}
        playerConfigs={$state.playerConfigs}
        volumeConfigs={$state.volumeConfigs}
        stateTimeline={$state.stateTimeline}
        volumeTimeline={$state.volumeTimeline}
        playbackRateConfigs={$state.playbackRateConfigs}
        playbackRateTimeline={$state.playbackRateTimeline}
        onSetReactionVideoId={handleSetReactionVideoId}
        onSetIntroBufferTime={handleSetIntroBufferTime}
        onSetSoundLevel={handleSetSoundLevel}
        onToggleFineTuneMode={actions.toggleFineTuneMode}
      />
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
