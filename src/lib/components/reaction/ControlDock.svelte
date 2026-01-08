<script>
  import VideoControl from "$lib/components/Video/VideoControl.svelte";

  export let isFullscreen = false;
  export let stickyControlsClass = "opacity-100";
  export let bothVideosStarted = false;
  export let isPlaylist = false;
  export let isPlaylistAutoPlay = false;
  export let showAutoPlayButton = true;
  export let showCinematicBars = false;

  export let onPlayStateChanged = () => {};
  export let onSyncVideos = () => {};
  export let onToggleAutoPlaylist = () => {};
  export let onToggleBars = () => {};
  export let onEnterFullscreen = () => {};

  export let currentTime = 0;
  export let duration = 0;
  export let seekMin = 0;
  export let seekMax;
  export let onSeek = (_time) => {};
</script>

<div
  class={`controls-dock group pointer-events-none ${isFullscreen ? "controls-dock--fullscreen fixed inset-x-0 z-50 flex w-full px-3 sm:px-6" : "relative z-10 mt-4 w-full px-4 md:mt-8 md:px-4 sm:px-6 lg:px-10"}`}
>
  <div
    class={`controls-surface pointer-events-auto mx-auto w-full max-w-[920px] transition-opacity duration-slow ease-cinematic ${stickyControlsClass} ${isFullscreen ? "max-w-[720px]" : ""}`}
  >
    <VideoControl
      {bothVideosStarted}
      {isPlaylist}
      {isPlaylistAutoPlay}
      {showAutoPlayButton}
      {showCinematicBars}
      {isFullscreen}
      {currentTime}
      {duration}
      {seekMin}
      {seekMax}
      on:playStateChanged={onPlayStateChanged}
      on:syncVideos={onSyncVideos}
      on:toggleAutoPlaylist={onToggleAutoPlaylist}
      on:toggleBars={onToggleBars}
      on:enterFullscreen={onEnterFullscreen}
      on:seek={(e) => onSeek(e.detail.time)}
    />
  </div>
</div>

<style>
  .controls-dock--fullscreen {
    bottom: max(12px, env(safe-area-inset-bottom));
  }

  @media (hover: none) and (pointer: coarse) and (orientation: landscape) and (max-width: 1023px) {
    .controls-dock {
      position: fixed;
      left: 0;
      right: 0;
      top: auto;
      bottom: 0;
      margin-top: 0;
      padding-left: 12px;
      padding-right: 12px;
      z-index: 60;
    }

  }
</style>
