<script>
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import BookmarkManagement from '../BookmarkManagement.svelte';
    import FollowManagement from '$lib/components/FollowManagement.svelte';
    import RateVideo from '$lib/components/Video/RateVideo.svelte';

    export let originalVideoTitle;
    export let originalVideoAuthor;
    export let reactionVideoTitle;
    export let reactionVideoAuthor;
    export let reactorId;
    export let pageSlug;
    export let isUsersOwnVideo;
    export let reactionVideoId;
    export let originalVideoId;

    const createAvatarPlaceholder = (_name) => '/by-icon.svg';

    $: originalAvatarSrc = createAvatarPlaceholder(originalVideoAuthor);
    $: reactionAvatarSrc = createAvatarPlaceholder(reactionVideoAuthor);

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
        </header>

        <div class="identity">
            <img
                src={originalAvatarSrc}
                alt={originalVideoAuthor ? `${originalVideoAuthor} avatar` : 'Original creator'}
                loading="lazy"
                width="48"
                height="48"
            />
            <div class="identity-text m-auto">
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

        <div class="header-actions">
            {#if originalVideoId}
                <RateVideo videoId={originalVideoId} />
            {/if}
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
        </header>

        <div class="identity flex justify-center items-center gap-4">
            <img
                src={reactionAvatarSrc}
                alt={reactionVideoAuthor ? `${reactionVideoAuthor} avatar` : 'Reactor'}
                loading="lazy"
                width="48"
                height="48"
            />
            <div class="identity-text m-auto">
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
        display: grid;
        grid-template-columns: 1fr auto;
        grid-template-areas:
            'heading actions'
            'identity identity';
        gap: 1.25rem;
    }

    .column-header {
        grid-area: heading;
        min-width: 0;
    }

    .header-actions {
        grid-area: actions;
        justify-self: end;
        align-self: start;
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
        grid-area: identity;
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

        .column {
            grid-template-columns: 1fr;
            grid-template-areas:
                'heading'
                'identity'
                'actions';
        }

        .header-actions {
            justify-self: start;
        }

        .header-actions {
            gap: 0.4rem;
        }
    }
</style>
