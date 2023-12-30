<script>
    import {
      getBasicVideoDetailsWithEmbedApi,
      getAuthorFromAuthorUrl
    } from '$lib/helpers/youtube';
    import { beforeUpdate } from 'svelte';
    export let videoId;

    let videoTitle;
    let videoCreator;

    beforeUpdate(async () => {
      if (videoId) {
        const videoDetails = await getBasicVideoDetailsWithEmbedApi(videoId);
        videoTitle = videoDetails.title;
        videoCreator = getAuthorFromAuthorUrl(videoDetails.author_url);
      }
    });
</script>

<div class="video-container">
    <slot />
    <div>
      {#if videoTitle}
        <p>{videoTitle}</p>
      {/if}
      {#if videoCreator}
        <p>{videoCreator}</p>
      {/if}
  </div>
</div>

<style>
  .video-container {
    width: 100%;
  }
</style>