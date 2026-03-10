<script>
    import { goto } from '$app/navigation'
    import { buildYouTubeThumbnailUrl } from '$lib/helpers/originalVideo';
    import { getCompensatedReactionTime } from '$lib/helpers/reaction';

    export let index = 0;
    export let playlistItem = {};
    export let currentlyViewed = '';
    export let playlistId = '';
    export let playlistDocumentId = '';
    export let isCreation = true;
    export let targetReactionDocumentId = '';
    export let startTime = 0;
    export let playlistBufferTime = 0;
    export let onSelect = null;

    const navigate = async () => {
        if (typeof onSelect === 'function') {
            await onSelect({ index, playlistItem, targetReactionDocumentId });
            return;
        }
        if (isCreation) {
            const reactionVideoTime = getCompensatedReactionTime(startTime, playlistBufferTime || 0);
            const originalVideoId = playlistItem?.originalVideoId || playlistItem?.snippet?.resourceId?.videoId;
            const originalVideoPlatform = playlistItem?.originalVideoPlatform || 'youtube';
            const originalVideoUrl = playlistItem?.originalVideoUrl || '';
            const params = new URLSearchParams();
            params.set('id', originalVideoId);
            params.set('playlistDocumentId', playlistDocumentId);
            params.set('sequenceIndex', String(index));
            params.set('platform', originalVideoPlatform);
            params.set('playlistBufferTime', String(reactionVideoTime));
            if (playlistId) {
                params.set('playlist', playlistId);
            }
            if (originalVideoUrl) {
                params.set('originalUrl', originalVideoUrl);
            }
            await goto(`/backend?${params.toString()}`);
        } else {
            await goto(`/reaction/${targetReactionDocumentId}?playlistId=${playlistDocumentId}`);
        }
        location.reload();
    };

    $: isActive = currentlyViewed === (playlistItem?.originalVideoId || playlistItem?.snippet?.resourceId?.videoId);
    $: title = playlistItem?.title ?? playlistItem?.snippet?.title ?? 'Untitled video';
    $: channelTitle = playlistItem?.channelTitle ?? playlistItem?.snippet?.channelTitle;
    $: thumbnailUrl =
        playlistItem?.thumbnailUrl ??
        playlistItem?.snippet?.thumbnails?.maxres?.url ??
        playlistItem?.snippet?.thumbnails?.standard?.url ??
        playlistItem?.snippet?.thumbnails?.high?.url ??
        playlistItem?.snippet?.thumbnails?.medium?.url ??
        playlistItem?.snippet?.thumbnails?.default?.url ??
        buildYouTubeThumbnailUrl(
            playlistItem?.originalVideoPlatform === 'tiktok'
                ? ''
                : playlistItem?.originalVideoId || playlistItem?.snippet?.resourceId?.videoId,
        ) ??
        '';

    const baseButtonClasses = 'group relative flex w-full items-center gap-sm rounded-md px-sm py-xs text-left transition duration-subtle ease-cinematic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background';
    const activeButtonClasses = 'ml-xs bg-elevated pl-md text-text-primary shadow-surface';
    const inactiveButtonClasses = 'bg-transparent pl-sm text-text-secondary hover:bg-surface/60 hover:text-text-primary';

    $: buttonClasses = `${baseButtonClasses} ${isActive ? activeButtonClasses : inactiveButtonClasses}`;
    $: thumbnailWrapperClasses = `relative flex h-16 w-28 shrink-0 overflow-hidden rounded-sm bg-surface ${isActive ? 'shadow-surface' : ''}`;
    const baseSeparatorClasses = 'h-px bg-border-subtle/60';
    $: separatorClasses = `${baseSeparatorClasses} ${isActive ? 'ml-xs w-[calc(100%-0.5rem)]' : 'w-full'}`;
</script>

<div class="flex flex-col gap-xs">
    <button
        type="button"
        class={buttonClasses}
        on:click={navigate}
        aria-current={isActive ? 'true' : undefined}
    >
        {#if isActive}
            <span class="absolute left-0 top-0 h-full w-[3px] rounded-l-md bg-accent-primary" aria-hidden="true" />
        {/if}

        <span class={thumbnailWrapperClasses}>
            {#if thumbnailUrl}
                <img
                    src={thumbnailUrl}
                    alt={title}
                    class="h-full w-full object-cover object-center transition duration-slow ease-cinematic group-hover:scale-[1.02]"
                    loading="lazy"
                />
            {:else}
                <span class="flex h-full w-full items-center justify-center text-xs text-text-muted">
                    No preview
                </span>
            {/if}
        </span>

        <span class="flex min-w-0 flex-1 flex-col">
            <span class={`text-sm font-medium leading-tight ${isActive ? 'text-text-primary' : 'text-current'} truncate`}>
                {title}
            </span>
            {#if channelTitle}
                <span class="mt-1 text-xs text-text-muted">
                    {channelTitle}
                </span>
            {/if}
        </span>
    </button>

    <div class={separatorClasses} aria-hidden="true" />
</div>