<script>
    import ReactionThumbnail from '$lib/components/ReactionThumbnail.svelte';

    export let item;
    export let index = 0;

    const isPlaylist = item?.type === 'playlist';
    const isReaction = item?.type === 'reaction';

    $: reactionSource = isReaction ? item?.reaction : item?.playlist?.firstReaction;
    $: reactionData = reactionSource?.data;
    $: reactionPageId = reactionSource?.id;
    $: reactionVideoId = reactionData?.reactionVideoId;
    $: originalVideoId = reactionData?.originalVideoId;
    $: reactionVideoTitle = reactionData?.reactionVideoTitle;
    $: originalVideoTitle = reactionData?.originalVideoTitle;
    $: reactionVideoAuthor = reactionData?.reactionVideoAuthor;
    $: playlistId = isPlaylist ? item?.playlist?.id : reactionData?.playlistId;

    $: hasData = Boolean(reactionPageId && reactionData);
    $: cardLabel = item?.label || (isPlaylist ? 'Playlist reaction' : 'Reaction binome');
    $: binomeCount = item?.playlist?.data?.reactionBinomeIds?.length ?? 0;
    $: subtitle = isPlaylist
        ? `${binomeCount} binome${binomeCount === 1 ? '' : 's'} in playlist`
        : reactionVideoAuthor
            ? `by ${reactionVideoAuthor}`
            : 'Reaction';
    $: title = reactionVideoTitle || originalVideoTitle || cardLabel;
</script>

<div class="queue-card">
    <div class="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-text-muted">
        <span aria-hidden="true">#{index + 1}</span>
        <span class="badge">{cardLabel}</span>
    </div>

    {#if hasData}
        <ReactionThumbnail
            {reactionPageId}
            {reactionVideoId}
            {originalVideoId}
            {reactionVideoTitle}
            {originalVideoTitle}
            {reactionVideoAuthor}
            {playlistId}
            interactive
        />
        <div class="mt-3 space-y-1">
            <p class="truncate text-sm font-semibold text-text-primary" title={title}>{title}</p>
            <p class="text-xs text-text-muted" title={subtitle}>{subtitle}</p>
        </div>
    {:else}
        <div class="fallback">
            <p class="text-sm font-semibold text-text-primary">Missing binome data</p>
            <p class="text-xs text-text-muted">Add a valid id to this queue item to render a thumbnail.</p>
        </div>
    {/if}
</div>

<style>
    .queue-card {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        border-radius: 0.9rem;
        padding: 1rem;
        background: linear-gradient(135deg, rgba(15, 17, 21, 0.92), rgba(26, 29, 36, 0.78));
        border: 1px solid rgba(255, 255, 255, 0.04);
        box-shadow: 0 18px 40px rgba(5, 8, 12, 0.32);
    }

    .queue-card:hover,
    .queue-card:focus-within {
        transform: translateY(-2px);
        box-shadow: 0 22px 48px rgba(5, 8, 12, 0.38);
        transition: transform 200ms ease, box-shadow 200ms ease;
    }

    .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.15rem 0.55rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #cdd3e0;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
    }

    .fallback {
        padding: 1rem;
        border-radius: 0.75rem;
        background: rgba(255, 255, 255, 0.02);
        border: 1px dashed rgba(255, 255, 255, 0.08);
    }
</style>
