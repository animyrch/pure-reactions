<script>
  import SEO from '$lib/components/SEO.svelte';
  import SubtleLoader from '$lib/components/design-system/SubtleLoader.svelte';
  import ReactionStage from '$lib/components/reaction/ReactionStage.svelte';
  // Props: reaction, state, actions, overlayRef, extra (optional)
  export let reaction;
  export let state;
  export let actions;
  export let overlayRef;
  export let extra = {};
  // Optionally pass in extra props for playlist, queue, etc.
  // This component is meant to unify the viewing experience for both normal and moment reactions.

  // Forward touch event handlers for swipe navigation
  export let onTouchStart = null;
  export let onTouchEnd = null;
</script>

<SEO
  title={reaction?.reactionVideoTitle || reaction?.originalVideoTitle || 'Reaction'}
  description={reaction?.description || reaction?.originalVideoDescription || 'Watch this reaction on Pure Reactions.'}
  type="video.other"
  image={reaction?.thumbnailUrl}
  canonical={extra.canonical || `/reaction/${reaction?.slug || ''}`}
  robots={reaction?.isPublished === false ? 'noindex, follow' : 'index, follow'}
/>

<!-- Loading overlay -->
{#if state.isLoading}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-background">
    <SubtleLoader label="Loading reaction experience" />
  </div>
{/if}

<div class="website-inner-container bg-background text-text-primary" aria-hidden={state.isLoading}>
  <ReactionStage
    isFullscreen={state.isFullscreen}
    isControlSurfaceVisible={state.isControlSurfaceVisible}
    isExitButtonExpanded={state.isExitButtonExpanded}
    showCinematicBars={state.showCinematicBars}
    isReactionMissing={state.isReactionMissing}
    isUsersOwnVideo={state.isUsersOwnVideo}
    playerOriginal={state.playerOriginal}
    playerReaction={state.playerReaction}
    originalVideoPlatform={state.originalVideoPlatform}
    stickyControlsClass={extra.stickyControlsClass || 'opacity-100'}
    bothVideosStarted={state.bothVideosStarted}
    isPlaylist={!!extra.isPlaylist}
    isPlaylistAutoPlay={!!extra.isPlaylistAutoPlay}
    reactionCurrentTime={state.reactionCurrentTime}
    reactionDuration={state.reactionDuration}
    offsetStartTime={state.offsetStartTime}
    reactionFinishTime={state.reactionFinishTime}
    fullscreenPrimaryVideo={state.fullscreenPrimaryVideo}
    fullscreenOverlayWidthPercent={state.fullscreenOverlayWidthPercent}
    fullscreenOverlayCorner={state.fullscreenOverlayCorner}
    fullscreenOverlayVisible={state.fullscreenOverlayVisible}
    missingReactionLoading={extra.isSettingReactionVideoId}
    missingReactionError={extra.reactionVideoIdError}
    bind:overlayRef
    on:exitClick={actions.handleExitFullscreenClick}
    on:exitEnter={actions.handleExitButtonEnter}
    on:exitLeave={actions.handleExitButtonLeave}
    on:pointerMove={actions.handleFullscreenPointerMove}
    on:pointerDown={actions.handleFullscreenPointerDown}
    on:pointerLeave={actions.scheduleHideControls}
    on:missingReactionSubmit={extra.handleMissingReactionSubmit}
    on:playStateChanged={extra.handlePlayStateChanged || actions.handlePlayStateChange}
    on:syncVideos={actions.syncVideos}
    on:toggleAutoPlaylist={actions.toggleAutoPlaylist}
    on:toggleCinematicBars={actions.toggleCinematicBars}
    on:enterFullscreen={actions.openWithFullscreen}
    on:seek={extra.handleSeek || ((e) => actions.seekTo(e.detail))}
    onTouchStart={onTouchStart}
    onTouchEnd={onTouchEnd}
  />
  {#if !state.isFullscreen}
    <div class="mx-auto w-full px-4 pt-6 pb-8 sm:px-6 lg:px-10" data-testid="reaction-content">
      <slot />
    </div>
  {/if}
</div>
