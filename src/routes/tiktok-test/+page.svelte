<script>
  import { onMount } from 'svelte';

  const tiktokVideoId = '7056208472144235823';
  const tiktokOrigin = 'https://www.tiktok.com';
  const tiktokVideoUrl =
    'https://www.tiktok.com/@jamiestreck518/video/7056208472144235823?_r=1&_t=ZP-91mlPkPpRRn';
  const tiktokEmbedUrl = `https://www.tiktok.com/player/v1/${tiktokVideoId}?autoplay=1&muted=0&controls=1&play_button=1&volume_control=1&fullscreen_button=1&description=1`;

  let iframeElement;

  const postToPlayer = (type, value) => {
    iframeElement?.contentWindow?.postMessage(
      {
        type,
        value,
        'x-tiktok-player': true,
      },
      tiktokOrigin,
    );
  };

  const requestPlaybackWithSound = () => {
    postToPlayer('unMute');
    postToPlayer('play');
  };

  onMount(() => {
    const handleMessage = (event) => {
      if (event.origin !== tiktokOrigin) return;

      const message = event.data;
      if (!message || typeof message !== 'object') return;

      if (message.type === 'onPlayerReady') {
        requestPlaybackWithSound();

        // Retry once after readiness in case the first unmute races player initialization.
        window.setTimeout(requestPlaybackWithSound, 250);
      }

      if (message.type === 'onStateChange' && message.value === 1) {
        postToPlayer('unMute');
      }
    };

    window.addEventListener('message', handleMessage);

    const loadTimer = window.setTimeout(requestPlaybackWithSound, 400);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(loadTimer);
    };
  });
</script>

<svelte:head>
  <title>TikTok Embed Test</title>
  <meta
    name="description"
    content="Test page for embedding a TikTok video inside Pure Reactions."
  />
</svelte:head>

<section class="mx-auto flex min-h-[70vh] w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
  <div class="space-y-3">
    <p class="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
      External Embed Test
    </p>
    <h1 class="text-3xl font-semibold text-text sm:text-4xl">TikTok Iframe Test Page</h1>
    <p class="max-w-2xl text-sm leading-7 text-text-muted sm:text-base">
      This route uses TikTok&apos;s documented player embed and sends play and unmute messages after
      the player is ready. Browser autoplay policy can still override sound until the user
      interacts with the iframe.
    </p>
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
    <div class="overflow-hidden rounded-[2rem] border border-white/10 bg-black/40 p-3 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div class="relative mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-[1.5rem] bg-black">
        <iframe
          bind:this={iframeElement}
          title="TikTok video from @jamiestreck518"
          src={tiktokEmbedUrl}
          class="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; fullscreen"
          allowfullscreen
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
      </div>
    </div>

    <div class="space-y-4 rounded-[2rem] border border-white/10 bg-surface/80 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.2)]">
      <h2 class="text-lg font-semibold text-text">Embed Details</h2>
      <div class="space-y-2 text-sm leading-6 text-text-muted">
        <p>
          Route: <a class="text-text underline decoration-white/30 underline-offset-4" href="/tiktok-test">/tiktok-test</a>
        </p>
        <p>
          Original post:
          <a
            class="break-all text-text underline decoration-white/30 underline-offset-4"
            href={tiktokVideoUrl}
            target="_blank"
            rel="noreferrer"
          >
            {tiktokVideoUrl}
          </a>
        </p>
        <p>
          Embed source:
          <a
            class="break-all text-text underline decoration-white/30 underline-offset-4"
            href={tiktokEmbedUrl}
            target="_blank"
            rel="noreferrer"
          >
            {tiktokEmbedUrl}
          </a>
        </p>
      </div>
      <p class="text-sm leading-6 text-text-muted">
        TikTok still controls the final playback policy inside the iframe. This page now requests
        autoplay and sends a documented unmute command, but some browsers will continue to require a
        user gesture before audio can start.
      </p>
    </div>
  </div>
</section>