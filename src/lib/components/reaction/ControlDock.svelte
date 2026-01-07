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
  class={`controls-dock group pointer-events-none ${isFullscreen ? "fixed inset-x-0 bottom-12 z-50 flex w-full px-6" : "fixed bottom-4 left-0 right-0 z-50 w-full px-4 md:sticky md:top-6 md:mt-10 md:bottom-auto md:px-4 sm:px-6 lg:px-10"}`}
>
  <div
    class={`controls-surface pointer-events-auto w-full rounded-full bg-overlay px-4 py-xs shadow-elevated transition duration-slow ease-cinematic ${stickyControlsClass}`}
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
