<script>
    import { ThumbsUpOutline } from 'flowbite-svelte-icons';

    export let videoId;

    function promptLikeOnYouTube(videoId) {
        const url = `https://www.youtube.com/watch?v=${videoId}&like=1`;
        window.open(url, '_blank');
    }
</script>

<button
    on:click={() => promptLikeOnYouTube(videoId)}
    title="Like on YouTube"
>
    <ThumbsUpOutline size="sm"/>                 
</button>