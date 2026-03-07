<script>
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import BookmarkManagement from '../BookmarkManagement.svelte';
    import FollowManagement from '$lib/components/FollowManagement.svelte';
    import RateVideo from '$lib/components/Video/RateVideo.svelte';
    import { linkifyText } from '$lib/helpers/system';

    export let originalVideoTitle;
    export let originalVideoAuthor;
    export let originalVideoAuthorUrl;
    export let originalVideoPlatform = 'youtube';
    export let reactionVideoTitle;
    export let reactionVideoAuthor;
    export let reactorId;
    export let pageSlug;
    export let isUsersOwnVideo;
    export let reactionVideoId;
    export let originalVideoId;
    export let originalVideoDescription;
    export let reactionVideoDescription;

    const createAvatarPlaceholder = (_name) => '/by-icon.svg';

    $: originalAvatarSrc = createAvatarPlaceholder(originalVideoAuthor);
    $: reactionAvatarSrc = createAvatarPlaceholder(reactionVideoAuthor);

    const youtubeChannelUrl = (author) => (author ? `https://www.youtube.com/${author}` : undefined);
    $: originalAuthorHref =
        originalVideoAuthorUrl ||
        (originalVideoPlatform === 'youtube' ? youtubeChannelUrl(originalVideoAuthor) : undefined);
    $: originalAuthorPlatformLabel = originalVideoPlatform === 'tiktok' ? 'TikTok' : 'YouTube';

        let viewerData;
        $: viewerData = $userExtraDataStore?.userExtraData;
    $: canUseActions = Boolean(viewerData) && !isUsersOwnVideo;

    let isOriginalDescriptionExpanded = false;
    let isReactionDescriptionExpanded = false;

    $: showOriginalDescriptionToggle =
        typeof originalVideoDescription === 'string' && originalVideoDescription.trim().length > 200;
    $: showReactionDescriptionToggle =
        typeof reactionVideoDescription === 'string' && reactionVideoDescription.trim().length > 200;

    $: showOriginalActions = Boolean(originalVideoId);
    $: showReactionActions = Boolean(reactionVideoId) || Boolean(canUseActions);
</script>

<section class="details-grid" aria-label="Creator details">
    <article class="column original" aria-labelledby="original-heading">
        {#if showOriginalActions}
            <div class="header-actions">
                {#if originalVideoId}
                    <RateVideo videoId={originalVideoId} />
                {/if}
            </div>
        {/if}

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
                        href={originalAuthorHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Visit ${originalVideoAuthor} on ${originalAuthorPlatformLabel}`}
                    >
                        {originalVideoAuthor}
                    </a>
                {:else}
                    <p class="author muted">Unknown creator</p>
                {/if}
            </div>
        </div>

        {#if originalVideoDescription}
            <div class="video-description">
                <p
                    id="original-description"
                    class={`description-text ${isOriginalDescriptionExpanded || !showOriginalDescriptionToggle ? 'expanded' : 'clamped'}`}
                >
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html linkifyText(originalVideoDescription)}
                </p>
                {#if showOriginalDescriptionToggle}
                    <button
                        type="button"
                        class="description-toggle"
                        aria-expanded={isOriginalDescriptionExpanded}
                        aria-controls="original-description"
                        on:click={() => (isOriginalDescriptionExpanded = !isOriginalDescriptionExpanded)}
                    >
                        {isOriginalDescriptionExpanded ? 'Show less' : 'Show more'}
                    </button>
                {/if}
            </div>
        {/if}
    </article>

    <article class="column reaction" aria-labelledby="reaction-heading">
        {#if showReactionActions}
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
        {/if}

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

        {#if reactionVideoDescription}
            <div class="video-description">
                <p
                    id="reaction-description"
                    class={`description-text ${isReactionDescriptionExpanded || !showReactionDescriptionToggle ? 'expanded' : 'clamped'}`}
                >
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html linkifyText(reactionVideoDescription)}
                </p>
                {#if showReactionDescriptionToggle}
                    <button
                        type="button"
                        class="description-toggle"
                        aria-expanded={isReactionDescriptionExpanded}
                        aria-controls="reaction-description"
                        on:click={() => (isReactionDescriptionExpanded = !isReactionDescriptionExpanded)}
                    >
                        {isReactionDescriptionExpanded ? 'Show less' : 'Show more'}
                    </button>
                {/if}
            </div>
        {/if}
    </article>
</section>

<style>
    .details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        align-items: start;
        gap: 1.25rem;
        padding: 1.25rem;
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
        min-width: 0;
    }

    .header-actions {
        align-self: flex-start;
        justify-content: flex-start;
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

    .video-description {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .description-text {
        margin: 0;
        font-size: 0.85rem;
        line-height: 1.5;
        color: rgba(199, 203, 215, 0.85);
        word-break: break-word;
        white-space: pre-line;
    }

    .description-text :global(a) {
        color: rgba(92, 178, 255, 0.9);
        text-decoration: underline;
        text-underline-offset: 2px;
        overflow-wrap: break-word;
    }

    .description-text :global(a:hover),
    .description-text :global(a:focus-visible) {
        color: rgba(130, 197, 255, 0.95);
        outline: none;
    }

    .description-text.clamped {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 5;
        overflow: hidden;
    }

    .description-toggle {
        align-self: flex-start;
        border: none;
        background: transparent;
        padding: 0;
        font-size: 0.8rem;
        font-weight: 600;
        color: rgba(92, 178, 255, 0.9);
        cursor: pointer;
    }

    .description-toggle:hover,
    .description-toggle:focus-visible {
        color: rgba(130, 197, 255, 0.95);
        outline: none;
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
        gap: 0.4rem;
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

    @media (min-width: 769px) {
        .details-grid {
            padding: 1.5rem;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            grid-template-rows: auto auto auto auto;
            column-gap: 1.75rem;
            row-gap: 1.25rem;
        }

        .column {
            display: contents;
        }

        .column.original .header-actions {
            grid-column: 1;
            grid-row: 1;
        }

        .column.original .column-header {
            grid-column: 1;
            grid-row: 2;
        }

        .column.original .identity {
            grid-column: 1;
            grid-row: 3;
        }

        .column.original .video-description {
            grid-column: 1;
            grid-row: 4;
        }

        .column.reaction .header-actions {
            grid-column: 2;
            grid-row: 1;
        }

        .column.reaction .column-header {
            grid-column: 2;
            grid-row: 2;
        }

        .column.reaction .identity {
            grid-column: 2;
            grid-row: 3;
        }

        .column.reaction .video-description {
            grid-column: 2;
            grid-row: 4;
        }

        .header-actions {
            justify-self: start;
            gap: 0.5rem;
        }
    }
</style>
