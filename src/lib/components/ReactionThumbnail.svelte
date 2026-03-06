<script>
    import { onMount } from "svelte";
    import VideoAuthor from "$lib/components/VideoAuthor.svelte";
    import ThumbnailContext from "$lib/components/Video/ThumbnailContext.svelte";

    export let reactionPageId;
    export let reactionVideoId;
    export let originalVideoId;
    export let reactionVideoTitle;
    export let originalVideoTitle;
    export let reactionVideoAuthor;
    export let reactorDisplayName;
    export let playlistId;
    export let itemType = "reaction";
    export let queueTitle = "";
    export let queueSlug = "";
    export let interactive = false;
    export let linkless = false;
    export let showContextMenu = true;

    const isQueue = itemType === "queue";
    const isPlaylist = itemType === "playlist";

    const playlistQuery = originalVideoId
        ? `?${new URLSearchParams({ item: originalVideoId }).toString()}`
        : "";
    const reactionRedirectionPath = isQueue
        ? `/queue/${queueSlug || reactionPageId}`
        : isPlaylist && playlistId
          ? `/playlist/${playlistId}${playlistQuery}`
          : `/reaction/${reactionPageId}${playlistId ? `?playlistId=${playlistId}` : ""}`;

    const displayTitle = isQueue
        ? queueTitle
        : reactionVideoTitle || originalVideoTitle || "Untitled Reaction";
    const thumbnailAlt = reactionVideoTitle
        ? `Reaction: ${reactionVideoTitle}`
        : originalVideoTitle
          ? `Original: ${originalVideoTitle}`
          : "Reaction thumbnail";

    const linkLabel = isQueue
        ? `Open queue: ${queueTitle}`
        : isPlaylist
          ? `Open playlist: ${reactionVideoTitle || "Playlist"}`
          : reactionVideoTitle
            ? `Open reaction: ${reactionVideoTitle}`
            : originalVideoTitle
              ? `Open reaction: ${originalVideoTitle}`
              : undefined;

    const thumbnailVariants = [
        { key: "mqdefault", width: 320 },
        { key: "hqdefault", width: 480 },
        { key: "sddefault", width: 640 },
    ];

    const buildYouTubeSrc = (videoId, variant, format = "jpg") => {
        if (!videoId) return "";
        if (format === "webp") {
            return `https://i.ytimg.com/vi_webp/${videoId}/${variant}.webp`;
        }
        return `https://i.ytimg.com/vi/${videoId}/${variant}.${format}`;
    };

    const buildSrcSet = (videoId, format) => {
        if (!videoId) return undefined;
        return thumbnailVariants
            .map(
                ({ key, width }) =>
                    `${buildYouTubeSrc(videoId, key, format)} ${width}w`,
            )
            .join(", ");
    };

    const normalizeAuthor = (value) =>
        typeof value === "string" ? value.trim() : "";

    $: mainVideoId = reactionVideoId || originalVideoId;
    $: mainWebpSrcSet = buildSrcSet(mainVideoId, "webp");
    $: mainJpegSrcSet = buildSrcSet(mainVideoId, "jpg");
    $: displayReactorName =
        normalizeAuthor(reactorDisplayName) ||
        normalizeAuthor(reactionVideoAuthor);

    let isThumbnailLoaded = false;
    let imgEl;

    $: skeletonVisible = isQueue ? false : !isThumbnailLoaded;

    const handleThumbLoad = () => {
        isThumbnailLoaded = true;
    };

    onMount(() => {
        if (imgEl?.complete) {
            isThumbnailLoaded = true;
        }
    });
</script>

<div
    class="thumbnail-card group rounded-2xl border border-border-strong/30 bg-surface/50 text-text-primary shadow-surface transition-all duration-300 hover:border-border-strong hover:shadow-elevated"
    data-interactive={interactive ? "true" : undefined}
    class:is-queue={isQueue}
    class:is-playlist={isPlaylist}
>
    {#if linkless}
        <div class="thumbnail-link block" aria-hidden="true">
            <div class="thumbnail-wrapper">
                {#if isQueue}
                    <div class="queue-badge">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M4 7V4h3" />
                            <path d="M20 4h-3v3" />
                            <path d="M4 17v3h3" />
                            <path d="M20 20h-3v-3" />
                            <rect x="9" y="9" width="6" height="6" />
                        </svg>
                        <span>QUEUE</span>
                    </div>
                {:else if isPlaylist}
                    <div class="playlist-badge">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <line x1="8" y1="6" x2="21" y2="6"></line>
                            <line x1="8" y1="12" x2="21" y2="12"></line>
                            <line x1="8" y1="18" x2="21" y2="18"></line>
                            <line x1="3" y1="6" x2="3.01" y2="6"></line>
                            <line x1="3" y1="12" x2="3.01" y2="12"></line>
                            <line x1="3" y1="18" x2="3.01" y2="18"></line>
                        </svg>
                        <span>PLAYLIST</span>
                    </div>
                {/if}
                {#if isQueue}
                    <div class="queue-placeholder">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="64"
                            height="64"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M4 7V4h3" />
                            <path d="M20 4h-3v3" />
                            <path d="M4 17v3h3" />
                            <path d="M20 20h-3v-3" />
                            <rect x="9" y="9" width="6" height="6" />
                        </svg>
                        <p class="queue-placeholder-text">Reaction Queue</p>
                    </div>
                {:else}
                    <div
                        class="thumbnail-skeleton"
                        class:hidden={!skeletonVisible}
                        aria-hidden="true"
                    ></div>
                    {#if mainVideoId}
                        <picture
                            class="thumbnail-image"
                            class:loaded={isThumbnailLoaded}
                        >
                            {#if mainWebpSrcSet}
                                <source
                                    type="image/webp"
                                    srcset={mainWebpSrcSet}
                                    sizes="(max-width: 640px) 100vw, 640px"
                                />
                            {/if}
                            {#if mainJpegSrcSet}
                                <source
                                    type="image/jpeg"
                                    srcset={mainJpegSrcSet}
                                    sizes="(max-width: 640px) 100vw, 640px"
                                />
                            {/if}
                            <img
                                bind:this={imgEl}
                                src={buildYouTubeSrc(mainVideoId, "mqdefault")}
                                alt={thumbnailAlt}
                                loading="lazy"
                                decoding="async"
                                on:load={handleThumbLoad}
                            />
                        </picture>
                    {/if}
                {/if}
            </div>
        </div>
    {:else}
        <a
            class="thumbnail-link block focus-visible:outline-none"
            href={reactionRedirectionPath}
            aria-label={linkLabel}
        >
            <div class="thumbnail-wrapper">
                {#if isQueue}
                    <div class="queue-badge">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M4 7V4h3" />
                            <path d="M20 4h-3v3" />
                            <path d="M4 17v3h3" />
                            <path d="M20 20h-3v-3" />
                            <rect x="9" y="9" width="6" height="6" />
                        </svg>
                        <span>QUEUE</span>
                    </div>
                {:else if isPlaylist}
                    <div class="playlist-badge">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <line x1="8" y1="6" x2="21" y2="6"></line>
                            <line x1="8" y1="12" x2="21" y2="12"></line>
                            <line x1="8" y1="18" x2="21" y2="18"></line>
                            <line x1="3" y1="6" x2="3.01" y2="6"></line>
                            <line x1="3" y1="12" x2="3.01" y2="12"></line>
                            <line x1="3" y1="18" x2="3.01" y2="18"></line>
                        </svg>
                        <span>PLAYLIST</span>
                    </div>
                {/if}
                {#if isQueue}
                    <div class="queue-placeholder">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="64"
                            height="64"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M4 7V4h3" />
                            <path d="M20 4h-3v3" />
                            <path d="M4 17v3h3" />
                            <path d="M20 20h-3v-3" />
                            <rect x="9" y="9" width="6" height="6" />
                        </svg>
                        <p class="queue-placeholder-text">Reaction Queue</p>
                    </div>
                {:else}
                    <div
                        class="thumbnail-skeleton"
                        class:hidden={!skeletonVisible}
                        aria-hidden="true"
                    ></div>
                    {#if mainVideoId}
                        <picture
                            class="thumbnail-image"
                            class:loaded={isThumbnailLoaded}
                        >
                            {#if mainWebpSrcSet}
                                <source
                                    type="image/webp"
                                    srcset={mainWebpSrcSet}
                                    sizes="(max-width: 640px) 100vw, 640px"
                                />
                            {/if}
                            {#if mainJpegSrcSet}
                                <source
                                    type="image/jpeg"
                                    srcset={mainJpegSrcSet}
                                    sizes="(max-width: 640px) 100vw, 640px"
                                />
                            {/if}
                            <img
                                bind:this={imgEl}
                                src={buildYouTubeSrc(mainVideoId, "mqdefault")}
                                alt={thumbnailAlt}
                                loading="lazy"
                                decoding="async"
                                on:load={handleThumbLoad}
                            />
                        </picture>
                    {/if}
                {/if}
            </div>
        </a>
    {/if}

    <div class="thumbnail-content flex items-start gap-md">
        {#if linkless}
            <div
                class="min-w-0 flex-1 rounded-sm"
                title={displayTitle}
            >
                <p class="truncate text-sm font-semibold text-text-primary">
                    {displayTitle}
                </p>
                {#if !isQueue && displayReactorName}
                    <VideoAuthor
                        videoAuthor={displayReactorName}
                        showLinks={false}
                        isReactor
                    />
                {:else if isQueue}
                    <p class="text-xs text-text-muted">Collection of reactions</p>
                {/if}
            </div>
        {:else}
            <a
                class="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:underline"
                href={reactionRedirectionPath}
                title={displayTitle}
            >
                <p class="truncate text-sm font-semibold text-text-primary">
                    {displayTitle}
                </p>
                {#if !isQueue && displayReactorName}
                    <VideoAuthor
                        videoAuthor={displayReactorName}
                        showLinks={false}
                        isReactor
                    />
                {:else if isQueue}
                    <p class="text-xs text-text-muted">Collection of reactions</p>
                {/if}
            </a>
        {/if}
        {#if !isQueue && showContextMenu}
            <ThumbnailContext {reactionPageId} {reactionVideoAuthor} />
        {/if}
    </div>
</div>

<style>
    a {
        text-decoration: none;
    }
    .thumbnail-card {
        position: relative;
    }
    .thumbnail-card.is-queue {
        border: 2px solid rgba(99, 102, 241, 0.3);
        background: linear-gradient(
            135deg,
            rgba(99, 102, 241, 0.05),
            rgba(139, 92, 246, 0.05)
        );
    }
    .thumbnail-card.is-queue:hover {
        border-color: rgba(99, 102, 241, 0.5);
        box-shadow: 0 8px 32px rgba(99, 102, 241, 0.15);
    }
    .queue-badge {
        position: absolute;
        top: 0.5rem;
        left: 0.5rem;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.625rem;
        background: rgba(99, 102, 241, 0.95);
        color: white;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        border-radius: 999px;
    }
    .thumbnail-card.is-playlist {
        border: 2px solid rgba(244, 114, 182, 0.3);
        background: linear-gradient(
            135deg,
            rgba(244, 114, 182, 0.05),
            rgba(236, 72, 153, 0.05)
        );
    }
    .thumbnail-card.is-playlist:hover {
        border-color: rgba(244, 114, 182, 0.5);
        box-shadow: 0 8px 32px rgba(244, 114, 182, 0.15);
    }
    .playlist-badge {
        position: absolute;
        top: 0.5rem;
        left: 0.5rem;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.625rem;
        background: rgba(244, 114, 182, 0.95);
        color: white;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        border-radius: 999px;
    }
    .playlist-badge svg {
        width: 14px;
        height: 14px;
    }
    .queue-badge svg {
        width: 14px;
        height: 14px;
    }
    .thumbnail-wrapper {
        position: relative;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        border-radius: 1rem 1rem 0 0;
        background: linear-gradient(
            135deg,
            rgba(15, 17, 21, 0.9),
            rgba(25, 29, 36, 0.8)
        );
    }
    .queue-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        background: linear-gradient(
            135deg,
            rgba(99, 102, 241, 0.15),
            rgba(139, 92, 246, 0.15)
        );
        color: rgba(167, 139, 250, 0.9);
    }
    .queue-placeholder svg {
        opacity: 0.8;
    }
    .queue-placeholder-text {
        font-size: 0.875rem;
        font-weight: 600;
        letter-spacing: 0.025em;
        opacity: 0.9;
    }
    .thumbnail-content {
        padding: 1rem;
    }
    .thumbnail-skeleton {
        position: absolute;
        inset: 0;
        background: linear-gradient(
            135deg,
            rgba(30, 41, 59, 0.8),
            rgba(15, 23, 42, 0.85)
        );
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }
    .thumbnail-skeleton::after {
        content: "";
        width: 120%;
        height: 100%;
        background: linear-gradient(
            90deg,
            transparent,
            rgba(148, 163, 184, 0.2),
            transparent
        );
        animation: skeletonPulse 1.4s ease-in-out infinite;
    }
    .thumbnail-image {
        position: relative;
        display: block;
        height: 100%;
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
    .group:hover .thumbnail-image img {
        transform: scale(1.03);
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
        .group:hover .thumbnail-image img {
            transform: none;
        }
    }
</style>
