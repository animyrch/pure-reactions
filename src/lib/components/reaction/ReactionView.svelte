<script>
  import SEO from '$lib/components/SEO.svelte';
  import SubtleLoader from '$lib/components/design-system/SubtleLoader.svelte';
  import ReactionStage from '$lib/components/reaction/ReactionStage.svelte';
  export let reaction;
  export let state;
  export let actions;
  export let overlayRef;

  // Forward touch event handlers for swipe navigation
  export let onTouchStart = null;
  export let onTouchEnd = null;
  export let onNext = null;
  export let nextDisabled = false;
  export let nextAriaLabel = "Next reaction";

  // ReactionStage forwards { isPlaying }. handlePlayStateChange only pauses when that flag is false.
  const handlePlayStateChanged = (event) => {
    actions.handlePlayStateChange(event?.detail?.isPlaying === true);
  };
</script>

<SEO
  title={reaction?.reactionVideoTitle || reaction?.originalVideoTitle || 'Reaction'}
  description={reaction?.description || reaction?.originalVideoDescription || 'Watch this reaction on Pure Reactions.'}
  type="video.other"
  image={reaction?.thumbnailUrl}
  canonical={`/reaction/${reaction?.slug || ''}`}
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
    bothVideosStarted={state.bothVideosStarted}
    reactionCurrentTime={state.reactionCurrentTime}
    reactionDuration={state.reactionDuration}
    offsetStartTime={state.offsetStartTime}
    reactionFinishTime={state.reactionFinishTime}
    fullscreenPrimaryVideo={state.fullscreenPrimaryVideo}
    fullscreenOverlayWidthPercent={state.fullscreenOverlayWidthPercent}
    fullscreenOverlayCorner={state.fullscreenOverlayCorner}
    fullscreenOverlayVisible={state.fullscreenOverlayVisible}
    bind:overlayRef
    on:exitClick={actions.handleExitFullscreenClick}
    on:exitEnter={actions.handleExitButtonEnter}
    on:exitLeave={actions.handleExitButtonLeave}
    on:pointerMove={actions.handleFullscreenPointerMove}
    on:pointerDown={actions.handleFullscreenPointerDown}
    on:pointerLeave={actions.scheduleHideControls}
    on:playStateChanged={handlePlayStateChanged}
    on:syncVideos={actions.syncVideos}
    on:toggleAutoPlaylist={actions.toggleAutoPlaylist}
    on:toggleCinematicBars={actions.toggleCinematicBars}
    on:enterFullscreen={actions.openWithFullscreen}
    on:seek={(e) => actions.seekTo(e.detail)}
    onTouchStart={onTouchStart}
    onTouchEnd={onTouchEnd}
    {onNext}
    {nextDisabled}
    {nextAriaLabel}
  />
  {#if !state.isFullscreen}
    <div class="mx-auto w-full px-4 pt-2 pb-8 sm:px-6 lg:px-10" data-testid="reaction-content">
      <slot />
    </div>
  {/if}
</div>
