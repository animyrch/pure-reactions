<script>
    import VideoAuthor from '$lib/components/VideoAuthor.svelte';
    import ThumbnailContext from '$lib/components/Video/ThumbnailContext.svelte';

    export let reactionPageId;
    export let reactionVideoId;
    export let originalVideoId;
    export let reactionVideoTitle;
    export let originalVideoTitle;
    export let reactionVideoAuthor;
    export let playlistId;
    export let interactive = false;

    const reactionRedirectionPath = `/reaction/${reactionPageId}${playlistId ? `?playlistId=${playlistId}` : ''}`;
    const originalAlt = originalVideoTitle ? `Original: ${originalVideoTitle}` : 'Original video thumbnail';
    const reactionAlt = reactionVideoTitle ? `Reaction: ${reactionVideoTitle}` : 'Reaction video thumbnail';
    const linkLabel = reactionVideoTitle
        ? `Open reaction: ${reactionVideoTitle}`
        : originalVideoTitle
            ? `Open reaction: ${originalVideoTitle}`
            : undefined;

    const thumbnailVariants = [
        { key: 'mqdefault', width: 320 },
        { key: 'hqdefault', width: 480 },
        { key: 'sddefault', width: 640 }
    ];

    const buildYouTubeSrc = (videoId, variant, format = 'jpg') => {
        if (!videoId) return '';
        if (format === 'webp') {
            return `https://i.ytimg.com/vi_webp/${videoId}/${variant}.webp`;
        }
        return `https://i.ytimg.com/vi/${videoId}/${variant}.${format}`;
    };

    const buildSrcSet = (videoId, format) => {
        if (!videoId) return undefined;
        return thumbnailVariants
            .map(({ key, width }) => `${buildYouTubeSrc(videoId, key, format)} ${width}w`)
            .join(', ');
    };

    $: originalWebpSrcSet = buildSrcSet(originalVideoId, 'webp');
    $: originalJpegSrcSet = buildSrcSet(originalVideoId, 'jpg');
    $: reactionWebpSrcSet = buildSrcSet(reactionVideoId, 'webp');
    $: reactionJpegSrcSet = buildSrcSet(reactionVideoId, 'jpg');

    let isOriginalLoaded = false;
    let isReactionLoaded = false;

    $: skeletonVisible = !(isOriginalLoaded && isReactionLoaded);

    const handleOriginalLoad = () => {
        isOriginalLoaded = true;
    };

    const handleReactionLoad = () => {
        isReactionLoaded = true;
    };
</script>

<div
    class="thumbnail-card group flex flex-col gap-sm rounded-md bg-surface p-sm text-text-primary shadow-surface transition duration-deliberate ease-cinematic hover:shadow-elevated focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-background"
    data-interactive={interactive ? 'true' : undefined}
>
    <a
        class="thumbnail-link block focus-visible:outline-none"
        href={reactionRedirectionPath}
        aria-label={linkLabel}
    >
        <div class="thumbnail-shell">
            <div class="thumbnail-wrapper">
                <div class="thumbnail-skeleton" class:hidden={!skeletonVisible} aria-hidden="true"></div>
                <picture class="thumbnail-image original" class:loaded={isOriginalLoaded}>
                    {#if originalWebpSrcSet}
                        <source
                            type="image/webp"
                            srcset={originalWebpSrcSet}
                            sizes="(max-width: 640px) 100vw, 640px"
                        />
                    {/if}
                    {#if originalJpegSrcSet}
                        <source
                            type="image/jpeg"
                            srcset={originalJpegSrcSet}
                            sizes="(max-width: 640px) 100vw, 640px"
                        />
                    {/if}
                    <img
                        src={buildYouTubeSrc(originalVideoId, 'mqdefault')}
                        alt={originalAlt}
                        loading="lazy"
                        decoding="async"
                        on:load={handleOriginalLoad}
                    />
                </picture>
                <picture class="thumbnail-image reaction" class:loaded={isReactionLoaded}>
                    {#if reactionWebpSrcSet}
                        <source
                            type="image/webp"
                            srcset={reactionWebpSrcSet}
                            sizes="(max-width: 640px) 40vw, 220px"
                        />
                    {/if}
                    {#if reactionJpegSrcSet}
                        <source
                            type="image/jpeg"
                            srcset={reactionJpegSrcSet}
                            sizes="(max-width: 640px) 40vw, 220px"
                        />
                    {/if}
                    <img
                        src={buildYouTubeSrc(reactionVideoId, 'mqdefault')}
                        alt={reactionAlt}
                        loading="lazy"
                        decoding="async"
                        on:load={handleReactionLoad}
                    />
                </picture>
            </div>
        </div>
    </a>

    <div class="flex items-center gap-md">
        <a
            class="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:underline"
            href={reactionRedirectionPath}
            title={reactionVideoTitle || originalVideoTitle}
        >
            <p class="truncate text-sm font-semibold text-text-primary">
                {reactionVideoTitle || originalVideoTitle}
            </p>
            {#if reactionVideoAuthor}
                <VideoAuthor
                    videoAuthor={reactionVideoAuthor}
                    showLinks={false}
                    isReactor
                />
            {/if}
        </a>
        <ThumbnailContext
            reactionPageId={reactionPageId}
            reactionVideoAuthor={reactionVideoAuthor}
        />
    </div>
</div>

<style>
    a {
        text-decoration: none;
    }
    .thumbnail-card {
        position: relative;
    }
    .thumbnail-shell {
        position: relative;
        border-radius: 0.5rem;
        overflow: hidden;
    }
    .thumbnail-wrapper {
        position: relative;
        aspect-ratio: 16 / 9;
        border-radius: 0.5rem;
        overflow: hidden;
        background: linear-gradient(135deg, rgba(15, 17, 21, 0.9), rgba(25, 29, 36, 0.8));
        contain: layout paint style;
    }
    .thumbnail-skeleton {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.85));
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }
    .thumbnail-skeleton::after {
        content: '';
        width: 120%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.2), transparent);
        animation: skeletonPulse 1.4s ease-in-out infinite;
    }
    .thumbnail-image {
        position: relative;
        display: block;
    }
    .thumbnail-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transform: scale(1.01);
        transition:
            opacity 320ms cubic-bezier(0.33, 1, 0.68, 1),
            transform 320ms cubic-bezier(0.33, 1, 0.68, 1);
        will-change: opacity, transform;
    }
    .thumbnail-image.original img {
        transform: scale(1);
    }
    .thumbnail-image.reaction {
        position: absolute;
        top: 0;
        right: 0;
        width: 33%;
        max-width: 220px;
        aspect-ratio: 16 / 9;
        box-shadow: 0 18px 40px rgba(5, 8, 12, 0.35);
        transform: translate(12%, -12%) scale(0.96);
        transition: transform 320ms cubic-bezier(0.33, 1, 0.68, 1);
    }
    .thumbnail-image.reaction img {
        width: 100%;
        height: 100%;
    }
    .group:hover .thumbnail-image.original img {
        transform: scale(1.02);
    }
    .group:hover .thumbnail-image.reaction {
        transform: translate(12%, -12%) scale(1.02);
    }
    .thumbnail-image.loaded img {
        opacity: 1;
    }
    @keyframes skeletonPulse {
        0% {
            transform: translateX(-60%);
        }
        50% {
            transform: translateX(0%);
        }
        100% {
            transform: translateX(60%);
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .thumbnail-skeleton::after {
            animation: none;
        }
        .thumbnail-image img {
            transition: none;
            transform: none;
        }
        .thumbnail-image.reaction {
            transition: none;
            transform: translate(12%, -12%) scale(0.96);
        }
        .group:hover .thumbnail-image.original img {
            transform: none;
        }
        .group:hover .thumbnail-image.reaction {
            transform: translate(12%, -12%) scale(0.96);
        }
    }
</style>