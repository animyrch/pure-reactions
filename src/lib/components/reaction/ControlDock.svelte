<script>
  import VideoControl from '$lib/components/Video/VideoControl.svelte';

  export let isFullscreen = false;
  export let stickyControlsClass = 'opacity-100';
  export let bothVideosStarted = false;
  export let isPlaylist = false;
  export let isPlaylistAutoPlay = false;
  export let showCinematicBars = false;

  export let onPlayStateChanged = () => {};
  export let onSyncVideos = () => {};
  export let onToggleAutoPlaylist = () => {};
  export let onToggleBars = () => {};
</script>

<div class={`controls-dock group pointer-events-none ${isFullscreen ? 'fixed inset-x-0 bottom-12 z-50 flex justify-center px-6' : 'sticky top-6 z-30 mt-10 flex justify-center'}`}>
  <div class={`controls-surface pointer-events-auto rounded-full bg-overlay px-sm py-xs shadow-elevated transition duration-slow ease-cinematic ${stickyControlsClass}`}>
    <VideoControl
      {bothVideosStarted}
      isPlaylist={isPlaylist}
      {isPlaylistAutoPlay}
      {showCinematicBars}
      on:playStateChanged={onPlayStateChanged}
      on:syncVideos={onSyncVideos}
      on:toggleAutoPlaylist={onToggleAutoPlaylist}
      on:toggleBars={onToggleBars}
    />
  </div>
</div>
