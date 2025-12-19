<script>
  import VideoControl from "$lib/components/Video/VideoControl.svelte";

  export let isFullscreen = false;
  export let stickyControlsClass = "opacity-100";
  export let bothVideosStarted = false;
  export let isPlaylist = false;
  export let isPlaylistAutoPlay = false;
  export let showCinematicBars = false;

  export let onPlayStateChanged = () => {};
  export let onSyncVideos = () => {};
  export let onToggleAutoPlaylist = () => {};
  export let onToggleBars = () => {};
  export let onEnterFullscreen = () => {};

  export let currentTime = 0;
  export let duration = 0;
  export let onSeek = (time) => {};
</script>

<div
  class={`controls-dock group pointer-events-none ${isFullscreen ? "fixed inset-x-0 bottom-12 z-50 flex justify-center px-6" : "sticky top-6 z-30 mt-10 flex justify-center w-full px-4"}`}
>
  <div
    class={`controls-surface pointer-events-auto rounded-full bg-overlay px-4 py-xs shadow-elevated transition duration-slow ease-cinematic ${stickyControlsClass} w-full max-w-5xl`}
  >
    <VideoControl
      {bothVideosStarted}
      {isPlaylist}
      {isPlaylistAutoPlay}
      {showCinematicBars}
      {isFullscreen}
      {currentTime}
      {duration}
      on:playStateChanged={onPlayStateChanged}
      on:syncVideos={onSyncVideos}
      on:toggleAutoPlaylist={onToggleAutoPlaylist}
      on:toggleBars={onToggleBars}
      on:enterFullscreen={onEnterFullscreen}
      on:seek={(e) => onSeek(e.detail.time)}
    />
  </div>
</div>
