<script>
    export let reactions;
</script>
<div>
    {#each reactions as reaction, index (index)}
      <a href={`/reaction/${reaction.id}`}>
          <div class="thumbnails-container">
              <div class="reaction-thumbnail-container">
                  <img src={`https://img.youtube.com/vi/${reaction.data['reaction-video-id']}/hqdefault.jpg`} alt="Video Thumbnail">
              </div>
              <div class="original-thumbnail-container">
                  <img src={`https://img.youtube.com/vi/${reaction.data['original-video-id']}/hqdefault.jpg`} alt="Video Thumbnail">
              </div>
          </div>
      </a>
    {/each}
</div>


<style>
    .thumbnails-container {
        position: relative;
    }
    .reaction-thumbnail-container img {
        width: 100%;
        object-fit: contain;
        border: solid 1px black;
    }
    .original-thumbnail-container img {
        border: solid 1px white;
        border-top: black;
        object-fit: contain;
        width: 50%;
        position: absolute;
        z-index: 10;
        top: 0;
    }
</style>