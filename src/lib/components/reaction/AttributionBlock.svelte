<script>
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  export let isVerifiedCreator = false;
  export let reactionVideoAuthor;
  export let reactionChannelName;
  export let reactorDisplayName;
  export let reactorId;

  const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

  $: channelHandle = normalizeText(reactionVideoAuthor);
  $: channelName = normalizeText(reactionChannelName) || channelHandle;
  $: userName = normalizeText(reactorDisplayName);
  $: displayUserName = userName || 'Pure Reactions user';

  $: profileUrl = reactorId ? `/user/${reactorId}` : '';
  $: youtubeUrl = channelHandle ? `https://www.youtube.com/${channelHandle}` : '';

  $: primaryPrefix = isVerifiedCreator ? 'Reaction by' : 'Sync created by';
  $: primaryName = isVerifiedCreator ? (channelName || 'Verified creator') : displayUserName;
  $: primaryHref = isVerifiedCreator ? youtubeUrl : profileUrl;

  $: primaryLinkLabel = isVerifiedCreator
    ? `Open ${primaryName} on YouTube`
    : `Open Pure Reactions profile for ${displayUserName}`;
  $: profileLinkLabel = `Open Pure Reactions profile for ${displayUserName}`;
</script>

<section
  class="rounded-2xl border border-border-strong/30 bg-surface/70 px-4 py-3 shadow-surface backdrop-blur transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
  aria-label="Attribution"
  role={primaryHref ? 'link' : undefined}
  tabindex={primaryHref ? 0 : undefined}
  on:click={(event) => {
    if (!primaryHref) return;
    if (event?.target?.closest?.('a')) return;
    if (!browser) return;
    if (isVerifiedCreator) {
      window.open(primaryHref, '_blank', 'noopener');
    } else {
      goto(primaryHref);
    }
  }}
  on:keydown={(event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!primaryHref) return;
    if (!browser) return;
    if (isVerifiedCreator) {
      window.open(primaryHref, '_blank', 'noopener');
    } else {
      goto(primaryHref);
    }
  }}
>
  <div class="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-primary">
    <span class="font-medium text-text-secondary">{primaryPrefix}</span>
    {#if primaryHref}
      <a
        class="max-w-[16rem] truncate text-text-primary transition hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:max-w-[24rem]"
        href={primaryHref}
        title={primaryName}
        aria-label={primaryLinkLabel}
        target={isVerifiedCreator ? '_blank' : undefined}
        rel={isVerifiedCreator ? 'noopener noreferrer' : undefined}
      >
        {primaryName}
      </a>
    {:else}
      <span class="max-w-[16rem] truncate sm:max-w-[24rem]" title={primaryName}>
        {primaryName}
      </span>
    {/if}

    {#if isVerifiedCreator}
      <span
        class="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-emerald-200"
        aria-label="Verified creator"
      >
        <svg
          class="h-3.5 w-3.5"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M6.5 11.2L3.8 8.5L2.8 9.5L6.5 13.2L13.2 6.5L12.2 5.5L6.5 11.2Z"
            fill="currentColor"
          />
        </svg>
        Verified creator
      </span>
    {:else}
      <span
        class="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-text-muted"
        aria-label="Third-party sync"
      >
        Third-party sync
      </span>
    {/if}
  </div>

  <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
    {#if profileUrl}
      <a
        class="transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        href={profileUrl}
        aria-label={profileLinkLabel}
        title={profileLinkLabel}
      >
        View profile
      </a>
    {:else}
      <span>Profile unavailable</span>
    {/if}

    {#if isVerifiedCreator && youtubeUrl}
      <span aria-hidden="true">|</span>
      <a
        class="transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        href={youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${primaryName} on YouTube`}
        title="Open verified YouTube channel"
      >
        YouTube channel
      </a>
    {/if}
  </div>
</section>
