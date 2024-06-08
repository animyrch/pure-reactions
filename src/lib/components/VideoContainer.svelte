<script>
    import { onMount } from 'svelte';
    import { isMobileDevice } from '$lib/helpers/system';

    let shouldHideVideoDetails;
    
    onMount(async () => {
      shouldHideVideoDetails = !!isMobileDevice();
    });
</script>

<div class="video-container">
    <slot />
</div>

<style>
  .video-container {
    width: 100%;
  }
</style>