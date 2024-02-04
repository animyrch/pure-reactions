<script>
    import { onMount } from 'svelte';
    import DownTriangle from '$lib/icons/DownTriangle.svelte';
    import UpTriangle from '$lib/icons/UpTriangle.svelte';
    import { isMobileDevice } from '$lib/helpers/system';
    import VideoAuthor from '$lib/components/VideoAuthor.svelte';

    export let videoAuthor;
    export let videoTitle;

    let shouldHideVideoDetails;
    
    onMount(async () => {
      shouldHideVideoDetails = !!isMobileDevice();
    });

    const toggleVideoDetailsButton = () => {
      shouldHideVideoDetails = !shouldHideVideoDetails;
    };
</script>

<div class="video-container">
    <slot />
    <button>
      {#if shouldHideVideoDetails}
        <button on:click={toggleVideoDetailsButton}>
          <DownTriangle />
        </button>
      {/if}
      {#if !shouldHideVideoDetails}
      <button on:click={toggleVideoDetailsButton}>
        <UpTriangle />
      </button>
      {/if}
    </button>
    {#if !shouldHideVideoDetails}
      {#if videoTitle}
        <p>{videoTitle}</p>
      {/if}
      {#if videoAuthor}
        <VideoAuthor
          {videoAuthor}
        />
      {/if}
    {/if}
    <div>
  </div>
</div>

<style>
  .video-container {
    width: 100%;
  }
</style>