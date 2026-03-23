<script>
    import { ThumbsUpOutline } from 'flowbite-svelte-icons';

    export let videoId;
    export let platform = 'youtube';
    export let originalVideoUrl = '';

    function openOriginalVideo() {
        let url;
        if (platform === 'tiktok') {
            if (!originalVideoUrl) return;
            url = originalVideoUrl;
        } else {
            url = `https://www.youtube.com/watch?v=${videoId}&like=1`;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    $: isTikTokWithoutUrl = platform === 'tiktok' && !originalVideoUrl;
</script>

{#if !isTikTokWithoutUrl}
<button
    on:click={openOriginalVideo}
    title={platform === 'tiktok' ? 'View on TikTok' : 'Like on YouTube'}
>
    <ThumbsUpOutline size="sm"/>                 
</button>
{/if}