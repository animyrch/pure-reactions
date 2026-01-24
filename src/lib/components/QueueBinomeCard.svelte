<script>
    import ReactionThumbnail from '$lib/components/ReactionThumbnail.svelte';

    export let item;
    export let index = 0;
    export let linkless = false;

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
    $: reactorDisplayName = reactionData?.reactorDisplayName;
    $: playlistId = isPlaylist ? item?.playlist?.id : reactionData?.playlistId;

    $: hasData = Boolean(reactionPageId && reactionData);
</script>

<div class="queue-card">
    <div class="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-text-muted">
        <span aria-hidden="true">#{index + 1}</span>
        <span></span>
    </div>

    {#if hasData}
        <ReactionThumbnail
            {reactionPageId}
            {reactionVideoId}
            {originalVideoId}
            {reactionVideoTitle}
            {originalVideoTitle}
            {reactionVideoAuthor}
            {reactorDisplayName}
            {playlistId}
            linkless={linkless}
            showContextMenu={!linkless}
            interactive
        />
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

</style>
