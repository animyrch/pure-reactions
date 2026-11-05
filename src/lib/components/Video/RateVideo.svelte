<script>
    import { ThumbsUpOutline } from 'flowbite-svelte-icons';
    import { resolveTikTokWatchUrl } from '$lib/helpers/platform';

    export let videoId;
    export let platform = 'youtube';
    export let originalVideoUrl = '';
    export let authorHandle = '';
    export let authorUrl = '';

    $: tiktokWatchUrl = platform === 'tiktok'
        ? resolveTikTokWatchUrl({
            videoId,
            authorHandle,
            authorUrl,
            originalVideoUrl,
        })
        : '';

    function openOriginalVideo() {
        if (platform === 'tiktok') {
            if (!tiktokWatchUrl) return;
            window.open(tiktokWatchUrl, '_blank', 'noopener,noreferrer');
            return;
        }
        if (!videoId) return;
        window.open(`https://www.youtube.com/watch?v=${videoId}&like=1`, '_blank', 'noopener,noreferrer');
    }

    $: isTikTokWithoutUrl = platform === 'tiktok' && !tiktokWatchUrl;
</script>

{#if !isTikTokWithoutUrl}
<button
    on:click={openOriginalVideo}
    title={platform === 'tiktok' ? 'View on TikTok' : 'Like on YouTube'}
>
    <ThumbsUpOutline size="sm"/>                 
</button>
{/if}