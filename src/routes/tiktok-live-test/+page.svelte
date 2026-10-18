<script>
    /* global YT */
    import { onMount } from 'svelte';
    import SEO from '$lib/components/SEO.svelte';
    import { describeTikTokLiveStatus } from '$lib/helpers/tiktokLive';

    export let data;

    const DELAY_SECONDS = 6;

    let player = null;
    let playerReady = false;
    let playerError = '';
    let delaySeconds = DELAY_SECONDS;
    let pendingLabel = '';
    let delayTimer = null;

    $: live = data.live;
    $: reactorSrc = data.frame === 'direct' ? live.pageUrl : live.embedUrl;
    $: statusLabel = live.isLive ? 'Live' : describeTikTokLiveStatus(live.userStatus ?? live.roomStatus);
    $: pageFramingLabel = live.pageFraming?.frameable
        ? 'Frameable'
        : live.pageFraming?.xFrameOptions
          ? `Blocked (${live.pageFraming.xFrameOptions})`
          : 'Unknown';
    $: embedFramingLabel = live.embedFraming?.frameable
        ? 'No frame block on the embed response'
        : live.embedHeadError
          ? live.embedHeadError
          : live.embedFraming?.xFrameOptions
            ? `Blocked (${live.embedFraming.xFrameOptions})`
            : 'Unknown';

    function clearDelay() {
        if (delayTimer) {
            clearTimeout(delayTimer);
            delayTimer = null;
        }
        pendingLabel = '';
    }

    function onPlayerReady() {
        playerReady = true;
    }

    function onPlayerError() {
        playerError = 'YouTube refused to play this video.';
    }

    function loadYouTubePlayer() {
        const host = document.getElementById('tiktok-test-original');
        if (!host || player) return;

        player = new YT.Player('tiktok-test-original', {
            videoId: data.originalVideoId,
            playerVars: {
                autoplay: 0,
                controls: 1,
                rel: 0,
                modestbranding: 1,
                enablejsapi: 1
            },
            events: {
                onReady: onPlayerReady,
                onError: onPlayerError
            }
        });
    }

    function ensureYouTubeApi() {
        if (window.YT && typeof window.YT.Player === 'function') {
            loadYouTubePlayer();
            return;
        }

        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previous?.();
            loadYouTubePlayer();
        };

        if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(tag);
        }
    }

    function playOriginalNow() {
        clearDelay();
        player?.playVideo();
    }

    function pauseOriginal() {
        clearDelay();
        player?.pauseVideo();
    }

    function playOriginalAfterDelay() {
        clearDelay();
        const wait = Math.min(30, Math.max(0, Number(delaySeconds) || 0));
        delaySeconds = wait;
        if (!playerReady) return;
        if (wait === 0) {
            playOriginalNow();
            return;
        }
        pendingLabel = `Original starts in ${wait}s`;
        delayTimer = setTimeout(() => {
            pendingLabel = '';
            delayTimer = null;
            player?.playVideo();
        }, wait * 1000);
    }

    onMount(() => {
        ensureYouTubeApi();
        return () => clearDelay();
    });
</script>

<SEO
    title="TikTok live reaction test"
    description="Test page that places a TikTok LIVE next to a separate original video."
    robots="noindex, nofollow"
/>

<main class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
    <header class="flex flex-col gap-3">
        <p class="text-xs uppercase tracking-[0.22em] text-text-muted">Test</p>
        <h1 class="text-3xl font-semibold text-text-primary">TikTok live as the reactor</h1>
        <p class="max-w-3xl text-sm leading-6 text-text-secondary">
            Same idea as the Twitch session: the reactor stays on TikTok, and the original plays from YouTube beside it.
            This page uses
            <a class="text-accent-primary underline-offset-2 hover:underline" href={live.pageUrl} target="_blank" rel="noreferrer">@{live.uniqueId}</a>.
            There is no host remote, so the original starts when you press play.
        </p>
    </header>

    <section class="grid gap-3 rounded-2xl border border-border-subtle bg-surface p-4 text-sm text-text-secondary md:grid-cols-4">
        <div>
            <p class="text-xs uppercase tracking-wide text-text-muted">Reactor</p>
            <p class="mt-1 text-text-primary">{live.nickname || live.uniqueId}</p>
            <p>@{live.uniqueId}</p>
        </div>
        <div>
            <p class="text-xs uppercase tracking-wide text-text-muted">Live status</p>
            <p class="mt-1 text-text-primary" data-live-status={live.isLive ? 'live' : 'offline'}>{statusLabel}</p>
            {#if live.title}
                <p>{live.title}</p>
            {/if}
            {#if live.error}
                <p class="text-danger">{live.error}</p>
            {/if}
        </div>
        <div>
            <p class="text-xs uppercase tracking-wide text-text-muted">/@user/live framing</p>
            <p class="mt-1 text-text-primary">{pageFramingLabel}</p>
        </div>
        <div>
            <p class="text-xs uppercase tracking-wide text-text-muted">/embed/@user/live</p>
            <p class="mt-1 text-text-primary">{embedFramingLabel}</p>
        </div>
    </section>

    <form class="flex flex-wrap items-end gap-3" method="GET">
        <label class="flex flex-col gap-1 text-xs text-text-muted">
            TikTok username
            <input
                class="rounded-lg border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary"
                name="user"
                value={live.uniqueId}
            />
        </label>
        <label class="flex flex-col gap-1 text-xs text-text-muted">
            Original YouTube id
            <input
                class="rounded-lg border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary"
                name="v"
                value={data.originalVideoId}
            />
        </label>
        <label class="flex flex-col gap-1 text-xs text-text-muted">
            Reactor frame
            <select
                class="rounded-lg border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary"
                name="frame"
            >
                <option value="embed" selected={data.frame === 'embed'}>Embed player</option>
                <option value="direct" selected={data.frame === 'direct'}>Direct live page</option>
            </select>
        </label>
        <button
            class="rounded-full bg-accent-primary px-4 py-2 text-sm font-medium text-background"
            type="submit"
        >
            Reload
        </button>
    </form>

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <section class="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
            <div class="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                <div>
                    <p class="text-xs uppercase tracking-[0.18em] text-text-muted">Reactor</p>
                    <h2 class="text-base font-semibold text-text-primary">TikTok LIVE</h2>
                </div>
                <span class="rounded-full bg-elevated px-2 py-1 text-xs text-text-secondary">
                    {data.frame === 'direct' ? 'Direct page' : 'Embed player'}
                </span>
            </div>
            <div class="bg-black">
                <iframe
                    title="TikTok live reactor"
                    src={reactorSrc}
                    class="aspect-[9/16] max-h-[78vh] w-full border-0"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowfullscreen
                    data-reactor-frame={data.frame}
                ></iframe>
            </div>
            <p class="px-4 py-3 text-xs leading-5 text-text-muted">
                The direct live URL sends a same-origin frame rule, so a Twitch-style iframe of
                <span class="text-text-secondary">/@{live.uniqueId}/live</span>
                stays blank. The embed route is the one this test can actually show.
            </p>
        </section>

        <section class="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
            <div class="border-b border-border-subtle px-4 py-3">
                <p class="text-xs uppercase tracking-[0.18em] text-text-muted">Original</p>
                <h2 class="text-base font-semibold text-text-primary">YouTube video {data.originalVideoId}</h2>
            </div>
            <div class="relative aspect-video bg-black">
                <div id="tiktok-test-original" class="h-full w-full"></div>
            </div>
            <div class="flex flex-wrap items-center gap-3 px-4 py-4">
                <button
                    type="button"
                    class="rounded-full bg-accent-primary px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
                    on:click={playOriginalNow}
                    disabled={!playerReady}
                >
                    Play original
                </button>
                <button
                    type="button"
                    class="rounded-full border border-border-strong px-4 py-2 text-sm text-text-primary disabled:opacity-50"
                    on:click={pauseOriginal}
                    disabled={!playerReady}
                >
                    Pause
                </button>
                <label class="flex items-center gap-2 text-sm text-text-secondary">
                    Delay
                    <input
                        class="w-16 rounded-lg border border-border-subtle bg-elevated px-2 py-1 text-text-primary"
                        type="number"
                        min="0"
                        max="30"
                        bind:value={delaySeconds}
                    />
                    s
                </label>
                <button
                    type="button"
                    class="rounded-full border border-border-strong px-4 py-2 text-sm text-text-primary disabled:opacity-50"
                    on:click={playOriginalAfterDelay}
                    disabled={!playerReady}
                    data-delay-play
                >
                    Play after delay
                </button>
                {#if pendingLabel}
                    <p class="text-sm text-accent-tertiary" data-delay-pending>{pendingLabel}</p>
                {/if}
                {#if playerError}
                    <p class="text-sm text-danger">{playerError}</p>
                {/if}
            </div>
            <p class="px-4 pb-4 text-xs leading-5 text-text-muted">
                The {DELAY_SECONDS}-second delay matches the cushion on the Twitch test. Use it when the reactor speaks, then see whether the original lines up with what they are watching.
            </p>
        </section>
    </div>
</main>
