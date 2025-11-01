<script>
    import { onMount } from 'svelte';
    import ReactionThumbnail from '$lib/components/ReactionThumbnail.svelte';

    export let reaction;

    const reactionPageId = reaction?.id;
    const reactionVideoId = reaction?.data?.reactionVideoId;
    const originalVideoId = reaction?.data?.originalVideoId;
    const reactionVideoTitle = reaction?.data?.reactionVideoTitle;
    const reactionVideoAuthor = reaction?.data?.reactionVideoAuthor;
    const originalVideoTitle = reaction?.data?.originalVideoTitle;
    const playlistId = reaction?.data?.playlistId;

    let rootEl;
    let isVisible = false;

    onMount(() => {
        if (!rootEl) {
            isVisible = true;
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        isVisible = true;
                        observer.disconnect();
                    }
                });
            },
            {
                threshold: 0.12,
                rootMargin: '0px 0px -10% 0px',
            }
        );

        observer.observe(rootEl);

        return () => observer.disconnect();
    });

    const headline = reactionVideoTitle || originalVideoTitle || 'Untitled reaction';
    const authorLabel = reactionVideoAuthor ? `by ${reactionVideoAuthor}` : 'Reaction';
</script>

<article
    bind:this={rootEl}
    class={`card transition duration-slow ease-cinematic ${isVisible ? 'card-visible' : ''}`}
>
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
</article>

<style>
    .card {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        border-radius: 0.9rem;
        padding: 0.85rem;
        background: rgba(17, 21, 28, 0.52);
        border: 1px solid rgba(255, 255, 255, 0.04);
        box-shadow: 0 6px 18px rgba(5, 8, 12, 0.24);
        opacity: 0;
        transform: translateY(12px) scale(0.97);
        transition-property: opacity, transform, box-shadow;
    }

    .card-visible {
        opacity: 1;
        transform: translateY(0) scale(1);
    }

    .card:hover,
    .card:focus-within {
        transform: translateY(-2px) scale(1.01);
        box-shadow: 0 18px 36px rgba(5, 8, 12, 0.34);
    }

    .card-meta {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding-inline: 0.2rem;
    }

    .title {
        font-size: 0.95rem;
        font-weight: 600;
        color: #f5f7fa;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .author {
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(197, 203, 215, 0.88);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    @media (max-width: 640px) {
        .card {
            padding: 0.75rem;
        }

        .title {
            font-size: 0.9rem;
        }

        .author {
            font-size: 0.72rem;
        }
    }
</style>