<script>
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import BookmarkManagement from '../BookmarkManagement.svelte';
    import FollowManagement from '$lib/components/FollowManagement.svelte';
    import RateVideo from '$lib/components/Video/RateVideo.svelte';
    import { ArrowUpRightFromSquareOutline } from 'flowbite-svelte-icons';

    export let originalVideoTitle;
    export let originalVideoAuthor;
    export let reactionVideoTitle;
    export let reactionVideoAuthor;
    export let reactorId;
    export let pageSlug;
    export let isUsersOwnVideo;
    export let reactionVideoId;
    export let originalVideoId;

    const createAvatarPlaceholder = (name) => {
        const initial = (name?.trim()?.charAt(0) || '?').toUpperCase();
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><defs><linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#1f2a37'/><stop offset='100%' stop-color='#2f3a4b'/></linearGradient></defs><rect width='96' height='96' fill='url(#grad)' rx='48'/><text x='50%' y='55%' font-size='42' font-family='Manrope, Arial, sans-serif' font-weight='600' fill='#f5f7fa' text-anchor='middle'>${initial}</text></svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    };

    $: originalAvatarSrc = createAvatarPlaceholder(originalVideoAuthor);
    $: reactionAvatarSrc = createAvatarPlaceholder(reactionVideoAuthor);

    const youtubeWatchUrl = (videoId) => (videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined);
    const youtubeChannelUrl = (author) => (author ? `https://www.youtube.com/${author}` : undefined);

        let viewerData;
        $: viewerData = $userExtraDataStore?.userExtraData;
    $: canUseActions = Boolean(viewerData) && !isUsersOwnVideo;
</script>

<section class="details-grid" aria-label="Creator details">
    <article class="column" aria-labelledby="original-heading">
        <header class="column-header">
            <h2 id="original-heading" class="video-heading">
                {#if originalVideoTitle}
                    {originalVideoTitle}
                {:else}
                    Original video
                {/if}
            </h2>
            <div class="header-actions">
                {#if originalVideoId}
                    <RateVideo videoId={originalVideoId} />
                {/if}
                {#if originalVideoId}
                                <a
                        class="link-out"
                        href={youtubeWatchUrl(originalVideoId)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        View on YouTube
                                    <ArrowUpRightFromSquareOutline style="width:1.05rem;height:1.05rem;" />
                    </a>
                {/if}
            </div>
        </header>

        <div class="identity">
            <img
                src={originalAvatarSrc}
                alt={originalVideoAuthor ? `${originalVideoAuthor} avatar` : 'Original creator'}
                loading="lazy"
                width="48"
                height="48"
            />
            <div class="identity-text">
                {#if originalVideoAuthor}
                    <a
                        class="author"
                        href={youtubeChannelUrl(originalVideoAuthor)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Visit ${originalVideoAuthor} on YouTube`}
                    >
                        {originalVideoAuthor}
                    </a>
                {:else}
                    <p class="author muted">Unknown creator</p>
                {/if}
            </div>
        </div>
    </article>

    <article class="column" aria-labelledby="reaction-heading">
        <header class="column-header">
            <h2 id="reaction-heading" class="video-heading">
                {#if reactionVideoTitle}
                    {reactionVideoTitle}
                {:else}
                    Reaction video
                {/if}
            </h2>
            <div class="header-actions">
                {#if reactionVideoId}
                    <RateVideo videoId={reactionVideoId} />
                {/if}
                {#if canUseActions}
                    <BookmarkManagement slug={pageSlug} />
                {/if}
                {#if canUseActions && reactionVideoAuthor}
                    <FollowManagement
                        reactionCreator={reactionVideoAuthor}
                        {reactorId}
                        follows={viewerData?.follows}
                    />
                {/if}
                {#if reactionVideoId}
                    <a
                        class="link-out"
                        href={youtubeWatchUrl(reactionVideoId)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        View on YouTube
                                <ArrowUpRightFromSquareOutline style="width:1.05rem;height:1.05rem;" />
                    </a>
                {/if}
            </div>
        </header>

        <div class="identity">
            <img
                src={reactionAvatarSrc}
                alt={reactionVideoAuthor ? `${reactionVideoAuthor} avatar` : 'Reactor'}
                loading="lazy"
                width="48"
                height="48"
            />
            <div class="identity-text">
                {#if reactionVideoAuthor}
                    <a
                        class="author"
                        href={youtubeChannelUrl(reactionVideoAuthor)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Visit ${reactionVideoAuthor} on YouTube`}
                    >
                        {reactionVideoAuthor}
                    </a>
                {:else}
                    <p class="author muted">Unknown reactor</p>
                {/if}
            </div>
        </div>
    </article>
</section>

<style>
    .details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.75rem;
        padding: 1.5rem;
        border-radius: 1rem;
        background: rgba(12, 15, 21, 0.72);
        border: 1px solid rgba(255, 255, 255, 0.05);
        box-shadow: 0 28px 48px rgba(5, 8, 12, 0.35);
    }

    .column {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .column-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
    }

    .video-heading {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 600;
        line-height: 1.4;
        color: #f5f7fa;
        max-width: 32ch;
    }

    .identity {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
    }

    .identity img {
        width: 48px;
        height: 48px;
        border-radius: 999px;
        object-fit: cover;
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 6px 14px rgba(5, 8, 12, 0.32);
    }

    .identity-text {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .author {
        font-size: 0.9rem;
        color: #c7cbd7;
        text-decoration: none;
        transition: color 220ms ease;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .author:hover,
    .author:focus-visible {
        color: #5cb2ff;
        outline: none;
    }

    .muted {
        color: rgba(139, 146, 163, 0.72);
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .link-out {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.85rem;
        font-weight: 500;
        color: #5cb2ff;
        text-decoration: none;
        padding: 0.35rem 0.6rem;
        border-radius: 999px;
        background: rgba(92, 178, 255, 0.12);
        transition: background-color 240ms ease, color 240ms ease;
    }

    .link-out:hover,
    .link-out:focus-visible {
        color: #f5f7fa;
        background: rgba(92, 178, 255, 0.22);
        outline: none;
    }

            :global(.header-actions button) {
                border: none;
        width: 2.2rem;
        height: 2.2rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: rgba(26, 31, 41, 0.78);
        color: #f5f7fa;
        box-shadow: 0 8px 18px rgba(5, 8, 12, 0.32);
        transition: transform 200ms ease, background-color 200ms ease;
    }

    :global(.header-actions button:hover),
    :global(.header-actions button:focus-visible) {
        transform: translateY(-1px);
        background: rgba(45, 52, 66, 0.9);
        outline: none;
    }

    :global(.header-actions button svg) {
        width: 1.1rem;
        height: 1.1rem;
    }

    @media (max-width: 768px) {
        .details-grid {
            padding: 1.25rem;
            gap: 1.25rem;
        }

        .column-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
        }

        .header-actions {
            gap: 0.4rem;
        }
    }
</style>
