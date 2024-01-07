<script>
    import {
      getBasicVideoDetailsWithEmbedApi,
      getAuthorFromAuthorUrl
    } from '$lib/helpers/youtube';
    import { beforeUpdate, onMount } from 'svelte';
    import DownTriangle from '$lib/icons/DownTriangle.svelte';
    import UpTriangle from '$lib/icons/UpTriangle.svelte';
    import { isMobileDevice } from '$lib/helpers/system';

    export let videoId;

    let videoTitle;
    let videoCreator;
    let shouldHideVideoDetails;
    
    onMount(async () => {
      shouldHideVideoDetails = !!isMobileDevice();
    });

    beforeUpdate(async () => {
      if (videoId) {
        const videoDetails = await getBasicVideoDetailsWithEmbedApi(videoId);
        videoTitle = videoDetails.title;
        videoCreator = getAuthorFromAuthorUrl(videoDetails.author_url);
      }
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
      {#if videoCreator}
        <div class="flex gap-2 m-1">
          <p>{videoCreator}</p>
        </div>
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