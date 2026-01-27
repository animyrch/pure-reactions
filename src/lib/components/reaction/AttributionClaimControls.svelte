<script>
  export let showLoginCta = false;
  export let showLookupCta = false;
  export let showPendingCta = false;
  export let showReviewedCta = false;
  export let showClaimCta = false;
  export let reviewedClaimLabel = '';
  export let showInfoTip = false;
  export let onLogin = () => {};
  export let onClaim = () => {};
</script>

<div class="flex shrink-0 items-center gap-2">
  {#if showLoginCta}
    <button
      type="button"
      class="text-xs font-medium text-text-muted underline decoration-white/20 underline-offset-4 transition hover:text-text-primary hover:decoration-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      on:click|stopPropagation={onLogin}
    >
      Log in to claim
    </button>
  {:else if showLookupCta}
    <span class="text-xs text-text-muted">Checking...</span>
  {:else if showPendingCta}
    <span class="text-xs text-text-muted">Claim pending</span>
  {:else if showReviewedCta}
    <span class="text-xs text-text-muted">{reviewedClaimLabel}</span>
  {:else if showClaimCta}
    <button
      type="button"
      class="text-xs font-medium text-text-muted underline decoration-white/20 underline-offset-4 transition hover:text-text-primary hover:decoration-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      on:click|stopPropagation={onClaim}
    >
      Claim this channel
    </button>
  {/if}

  {#if showInfoTip}
    <span
      class="group relative inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/10 text-[0.65rem] text-text-muted"
      aria-label="Claiming lets you verify channel ownership on Pure Reactions."
    >
      ?
      <span
        class="pointer-events-none absolute bottom-full right-0 z-10 mb-2 hidden w-52 rounded-lg border border-white/10 bg-[#0b0f17] px-2 py-1 text-[0.65rem] text-text-primary shadow-lg group-hover:block"
        role="tooltip"
      >
        If this is your channel, claiming it lets you verify ownership on Pure Reactions.
      </span>
    </span>
  {/if}
</div>
