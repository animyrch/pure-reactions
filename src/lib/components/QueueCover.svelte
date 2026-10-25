<script>
    import { queueCoverImageUrl, queueCoverPresentation } from '$lib/helpers/queueCover';

    export let videoIds = [];

    $: cover = queueCoverPresentation(videoIds);
    $: images = cover.videoIds
        .map((videoId) => ({ videoId, src: queueCoverImageUrl(videoId) }))
        .filter((image) => image.src);
</script>

<div class="queue-cover" data-queue-cover={cover.layout} aria-hidden="true">
    {#if cover.layout === 'quadrants'}
        <div class="queue-cover-quadrants">
            {#each images as image, index (`${image.videoId}-${index}`)}
                <img
                    src={image.src}
                    alt=""
                    data-queue-cover-video={image.videoId}
                    loading="lazy"
                    decoding="async"
                />
            {/each}
        </div>
    {:else if cover.layout === 'single' && images[0]}
        <img
            class="queue-cover-single"
            src={images[0].src}
            alt=""
            data-queue-cover-video={images[0].videoId}
            loading="lazy"
            decoding="async"
        />
    {:else}
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
    {/if}
</div>

<style>
    .queue-cover {
        width: 100%;
        height: 100%;
    }

    .queue-cover-quadrants {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        width: 100%;
        height: 100%;
        gap: 2px;
        background: #0b1018;
    }

    .queue-cover-quadrants img,
    .queue-cover-single {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
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
</style>
