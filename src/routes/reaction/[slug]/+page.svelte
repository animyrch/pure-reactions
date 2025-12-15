<script>
  import { page } from '$app/stores';
  import CreatorDetails from '$lib/components/Video/CreatorDetails.svelte';
  import PlaylistQueue from '$lib/components/Video/PlaylistQueue.svelte';
  import OtherReactions from '$lib/components/Video/OtherReactions.svelte';
  import SubtleLoader from '$lib/components/design-system/SubtleLoader.svelte';
  import FullscreenChrome from '$lib/components/reaction/FullscreenChrome.svelte';
  import ControlDock from '$lib/components/reaction/ControlDock.svelte';
  import MissingReactionPlaceholder from '$lib/components/reaction/MissingReactionPlaceholder.svelte';
  import QueueProgressPill from '$lib/components/reaction/QueueProgressPill.svelte';
  import { useTwinPlayers, CONTROLS_FADE_CLASS } from '$lib/composables/useTwinPlayers';
  import { reactionDial } from '$lib/stores/reactionDial';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { onDestroy } from 'svelte';
  import { showToast } from '$lib/stores/toast';
  import { TOASTS } from '$lib/constants/toasts';

  export let data;

  const { state, actions } = useTwinPlayers({ data });

  let overlayRef;

  $: stickyControlsClass = $state.isFullscreen ? CONTROLS_FADE_CLASS : 'opacity-100';
  $: overlayRef && actions.registerOverlayRef(overlayRef);
  $: actions.handleSlugChange($page.params.slug);

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

  $: if (!$state.isReactionMissing && reactionVideoIdError) {
    reactionVideoIdError = '';
  }

  const handlePlayStateChanged = (event) => {
    actions.handlePlayStateChange(event.detail.isPlaying);
  };

  $: if (browser && !$state.isLoading) {
    reactionDial.updateContext({
      isUsersOwnVideo: $state.isUsersOwnVideo,
      canShowEditModeButton: $state.canShowEditModeButton,
      canShowCloseEditModeButton: $state.canShowCloseEditModeButton,
      isPublished: $state.isPublished,
      isReactionMissing: $state.isReactionMissing,
      isFullscreen: $state.isFullscreen,
      handlers: {
        enterEditMode: () => {
          if (!browser) return;
          goto(`/edit-reaction/${$state.pageSlug}`);
        },
        closeEditMode: null,
        setIsPublished: actions.setIsPublished,
        setIsUnpublished: actions.setIsUnpublished,
        openWithFullscreen: actions.openWithFullscreen,
        openWithHalfscreen: actions.openWithHalfscreen
      }
    });
  }

  onDestroy(() => {
    reactionDial.reset();
  });
</script>

<div class={$state.isLoading ? '' : 'hidden'}>
  <div class="flex justify-center py-24">
    <SubtleLoader label="Loading reaction experience" />
  </div>
</div>

<div class={`website-inner-container bg-background text-text-primary ${$state.isLoading ? 'hidden' : ''}`}>
    {#if $state.isReactionMissing && !$state.isUsersOwnVideo}
      <p class="mb-4 rounded-md bg-warning/10 px-4 py-3 text-sm text-warning">
  Warning: The reaction video id is missing. This reaction page will stay hidden until a video id is added in the
  <a class="underline" href={`/edit-reaction/${$state.pageSlug}`}>edit view</a>
        and published again.
      </p>
    {/if}
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
          {:else if $state.isUsersOwnVideo}
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
      <div class="mx-auto w-full px-4 pt-6 sm:px-6 lg:px-10">
        {#if $state.queueSlug}
          <div class="mb-4 flex items-center justify-between">
            <QueueProgressPill queueSlug={$state.queueSlug} index={$state.queueIndex} />
            <span class="text-xs text-text-muted"></span>
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
