<script>
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { Button, Modal } from 'flowbite-svelte';
  import { copyToClipboard } from '$lib/helpers/system';
  import {
    createYoutubeChannelClaim,
    getYoutubeChannelClaim,
    getYoutubeChannelVerification
  } from '$lib/helpers/firebase';
  import { showToast } from '$lib/stores/toast';
  import { TOASTS } from '$lib/constants/toasts';
  import { onDestroy } from 'svelte';

  export let isVerifiedCreator = false;
  export let reactionVideoAuthor;
  export let reactorDisplayName;
  export let reactorId;
  export let viewerId;

  const CLAIM_TOKEN_SEGMENTS = 4;
  const CLAIM_TOKEN_SEGMENT_LENGTH = 4;
  const CLAIM_TOKEN_EXPIRY_DAYS = 14;

  const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');
  const normalizeId = (value) => (typeof value === 'string' ? value.trim() : '');

  const extractEmailPrefix = (value) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const atIndex = trimmed.indexOf('@');
    if (atIndex <= 0 || atIndex === trimmed.length - 1) return '';
    return trimmed.slice(0, atIndex);
  };

  const extractClaimUserId = (claimId) => {
    if (typeof claimId !== 'string') return '';
    const separator = '__';
    const sepIndex = claimId.lastIndexOf(separator);
    if (sepIndex <= 0 || sepIndex === claimId.length - separator.length) return '';
    return claimId.slice(sepIndex + separator.length);
  };

  const generateVerificationToken = () => {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const totalLength = CLAIM_TOKEN_SEGMENTS * CLAIM_TOKEN_SEGMENT_LENGTH;
    const values = new Uint8Array(totalLength);
    if (browser && window?.crypto?.getRandomValues) {
      window.crypto.getRandomValues(values);
    } else {
      for (let i = 0; i < totalLength; i += 1) {
        values[i] = Math.floor(Math.random() * 256);
      }
    }
    const chars = Array.from(values, (value) => charset[value % charset.length]);
    const segments = [];
    for (let i = 0; i < CLAIM_TOKEN_SEGMENTS; i += 1) {
      const start = i * CLAIM_TOKEN_SEGMENT_LENGTH;
      segments.push(chars.slice(start, start + CLAIM_TOKEN_SEGMENT_LENGTH).join(''));
    }
    return `PR-${segments.join('-')}`;
  };

  $: channelHandle = normalizeText(reactionVideoAuthor);
  $: channelName = channelHandle;
  $: showHandleRow = Boolean(channelHandle && channelHandle !== channelName);
  $: userName = normalizeText(reactorDisplayName);
  $: emailPrefix = extractEmailPrefix(reactorDisplayName);
  $: displayUserName = emailPrefix || userName || 'Pure Reactions user';

  $: profileUrl = reactorId ? `/user/${reactorId}` : '';
  $: youtubeUrl = channelHandle ? `https://www.youtube.com/${channelHandle}` : '';

  $: primaryPrefix = isVerifiedCreator ? 'Reaction by' : 'Sync created by';
  $: primaryName = isVerifiedCreator ? (channelName || 'Verified creator') : displayUserName;
  $: primaryHref = isVerifiedCreator ? youtubeUrl : profileUrl;

  $: primaryLinkLabel = isVerifiedCreator
    ? `Open ${primaryName} on YouTube`
    : `Open Pure Reactions profile for ${displayUserName}`;
  $: profileLinkLabel = `Open Pure Reactions profile for ${displayUserName}`;
  let claimRecord = null;
  let claimLookupState = 'idle';
  let claimLookupError = '';
  let claimLookupKey = '';
  let verificationRecord = null;
  let verificationLookupState = 'idle';
  let verificationLookupKey = '';

  let isClaimModalOpen = false;
  let verificationToken = '';
  let verificationVideoUrl = '';
  let hasConfirmedControl = false;
  let claimError = '';
  let isSubmittingClaim = false;

  let isMounted = true;
  onDestroy(() => {
    isMounted = false;
  });

  const resetClaimDraft = () => {
    verificationVideoUrl = '';
    hasConfirmedControl = false;
    claimError = '';
  };

  const ensureVerificationToken = () => {
    if (!verificationToken) {
      verificationToken = generateVerificationToken();
    }
  };

  const loadClaimRecord = async (nextKey, nextViewerId, nextChannelId) => {
    claimLookupState = 'loading';
    claimLookupError = '';
    try {
      const record = await getYoutubeChannelClaim({
        youtubeChannelId: nextChannelId,
        userId: nextViewerId
      });
      if (!isMounted || claimLookupKey !== nextKey) return;
      claimRecord = record;
      claimLookupState = 'success';
    } catch (error) {
      if (!isMounted || claimLookupKey !== nextKey) return;
      claimLookupState = 'error';
      claimLookupError = 'Unable to load claim status.';
      console.error('Failed to load channel claim', error);
    }
  };

  const loadVerificationRecord = async (nextKey, nextChannelId) => {
    verificationLookupState = 'loading';
    try {
      const record = await getYoutubeChannelVerification({
        youtubeChannelId: nextChannelId
      });
      if (!isMounted || verificationLookupKey !== nextKey) return;
      verificationRecord = record;
      verificationLookupState = 'success';
    } catch (error) {
      if (!isMounted || verificationLookupKey !== nextKey) return;
      verificationLookupState = 'error';
      console.error('Failed to load channel verification', error);
    }
  };

  $: if (browser) {
    const nextKey = viewerId && channelHandle ? `${viewerId}:${channelHandle}` : '';
    if (nextKey !== claimLookupKey) {
      claimLookupKey = nextKey;
      claimRecord = null;
      claimLookupError = '';
      claimLookupState = nextKey ? 'loading' : 'idle';
      verificationToken = '';
      resetClaimDraft();
      if (nextKey) {
        loadClaimRecord(nextKey, viewerId, channelHandle);
      }
    }
  }

  $: if (browser) {
    const nextVerificationKey = channelHandle || '';
    if (nextVerificationKey !== verificationLookupKey) {
      verificationLookupKey = nextVerificationKey;
      verificationRecord = null;
      verificationLookupState = nextVerificationKey ? 'loading' : 'idle';
      if (nextVerificationKey) {
        loadVerificationRecord(nextVerificationKey, channelHandle);
      }
    }
  }

  $: isChannelVerified =
    verificationRecord?.status === 'approved' || claimRecord?.status === 'approved';
  $: verifiedClaimUserId =
    verificationRecord?.userId ||
    extractClaimUserId(verificationRecord?.claimId) ||
    (claimRecord?.status === 'approved' ? claimRecord?.userId : '');
  $: normalizedReactorId = normalizeId(reactorId);
  $: normalizedClaimUserId = normalizeId(verifiedClaimUserId);
  $: claimIdMatchesReactor =
    Boolean(verificationRecord?.claimId && channelHandle && normalizedReactorId) &&
    verificationRecord.claimId === `${channelHandle}__${normalizedReactorId}`;
  $: shouldHideAttribution =
    Boolean(isChannelVerified && normalizedClaimUserId && normalizedReactorId) &&
    (normalizedClaimUserId === normalizedReactorId || claimIdMatchesReactor);
  $: debugClaimId = verificationRecord?.claimId || '';
  $: debugVerificationStatus = verificationRecord?.status || '';
  $: debugClaimUserId = normalizedClaimUserId || '';
  $: debugReactorId = normalizedReactorId || '';
  $: debugShouldHide = shouldHideAttribution ? 'true' : 'false';
  $: canShowClaimControls = !isVerifiedCreator && Boolean(channelHandle) && !isChannelVerified;
  $: hasPendingClaim = claimRecord?.status === 'pending';
  $: hasApprovedClaim = claimRecord?.status === 'approved';
  $: hasRejectedClaim = claimRecord?.status === 'rejected';
  $: hasReviewedClaim = Boolean(claimRecord?.status) && claimRecord?.status !== 'pending';
  $: isClaimLookupLoading = claimLookupState === 'loading';
  $: showLoginCta = canShowClaimControls && !viewerId;
  $: showPendingCta = canShowClaimControls && viewerId && hasPendingClaim;
  $: showReviewedCta = canShowClaimControls && viewerId && hasReviewedClaim;
  $: showClaimCta =
    canShowClaimControls && viewerId && !hasPendingClaim && !hasReviewedClaim && !isClaimLookupLoading;
  $: showLookupCta = canShowClaimControls && viewerId && isClaimLookupLoading;

  const openClaimModal = () => {
    if (!viewerId || !channelHandle || hasPendingClaim || hasReviewedClaim) return;
    resetClaimDraft();
    ensureVerificationToken();
    isClaimModalOpen = true;
  };

  const closeClaimModal = () => {
    isClaimModalOpen = false;
  };

  const copyToken = () => {
    if (!verificationToken || !browser) return;
    copyToClipboard(verificationToken);
    showToast('Verification token copied.', TOASTS.SUCCESS);
  };

  const submitClaim = async () => {
    if (!viewerId) {
      claimError = 'Log in to claim this channel.';
      return;
    }
    if (!channelHandle) {
      claimError = 'Missing YouTube channel handle.';
      return;
    }
    const trimmedUrl = verificationVideoUrl?.trim?.() || '';
    if (!trimmedUrl) {
      claimError = 'Add the verification video URL.';
      return;
    }
    if (!hasConfirmedControl) {
      claimError = 'Confirm you control this YouTube channel.';
      return;
    }

    ensureVerificationToken();
    isSubmittingClaim = true;
    claimError = '';

    try {
      const existing = await getYoutubeChannelClaim({
        youtubeChannelId: channelHandle,
        userId: viewerId
      });

      if (existing?.status === 'pending') {
        claimRecord = existing;
        showToast('Claim already submitted.', TOASTS.INFO);
        isClaimModalOpen = false;
        return;
      }

      if (existing && existing.status && existing.status !== 'pending') {
        claimRecord = existing;
        claimError = 'Your previous claim has already been reviewed.';
        return;
      }

      const expiresAt = new Date(Date.now() + CLAIM_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const created = await createYoutubeChannelClaim({
        youtubeChannelId: channelHandle,
        userId: viewerId,
        youtubeChannelUrl: youtubeUrl || '',
        verificationToken,
        verificationVideoUrl: trimmedUrl,
        expiresAt
      });

      claimRecord = created ? { ...created, status: 'pending' } : { status: 'pending' };
      showToast('Claim submitted for review.', TOASTS.SUCCESS);
      isClaimModalOpen = false;
    } catch (error) {
      console.error('Failed to submit channel claim', error);
      claimError = 'Unable to submit the claim. Please try again.';
    } finally {
      isSubmittingClaim = false;
    }
  };
</script>

{#if !shouldHideAttribution}
<section
  class="flex items-center justify-between gap-3 rounded-xl border border-border-strong/20 bg-surface/60 px-3 py-2 text-xs text-text-muted shadow-surface/40 backdrop-blur"
  aria-label="Attribution"
  data-testid="attribution-block"
  data-debug-channel-handle={channelHandle}
  data-debug-reactor-id={debugReactorId}
  data-debug-claim-user-id={debugClaimUserId}
  data-debug-claim-id={debugClaimId}
  data-debug-verification-status={debugVerificationStatus}
  data-debug-should-hide={debugShouldHide}
>
  <div class="min-w-0 flex items-center gap-2 text-text-muted">
    <span class="shrink-0">{primaryPrefix}:</span>
    {#if primaryHref}
      <a
        class="max-w-[14rem] truncate text-text-primary transition hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:max-w-[20rem]"
        href={primaryHref}
        title={primaryName}
        aria-label={primaryLinkLabel}
        target={isVerifiedCreator ? '_blank' : undefined}
        rel={isVerifiedCreator ? 'noopener noreferrer' : undefined}
      >
        {primaryName}
      </a>
    {:else}
      <span class="max-w-[14rem] truncate text-text-primary sm:max-w-[20rem]" title={primaryName}>
        {primaryName}
      </span>
    {/if}

    {#if isChannelVerified}
      <span
        class="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-200"
        aria-label="Verified channel"
      >
        Verified channel
      </span>
    {/if}

    {#if isVerifiedCreator}
      <span
        class="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-200"
        aria-label="Verified creator"
      >
        <svg
          class="h-3 w-3"
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
        Verified
      </span>
    {:else}
      <span
        class="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-text-muted"
        aria-label="Third-party sync"
      >
        Third-party
      </span>
    {/if}
  </div>

  {#if canShowClaimControls}
    <div class="flex shrink-0 items-center gap-2">
      {#if showLoginCta}
        <button
          type="button"
          class="text-xs font-medium text-text-muted underline decoration-white/20 underline-offset-4 transition hover:text-text-primary hover:decoration-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          on:click|stopPropagation={() => goto('/login')}
        >
          Log in to claim
        </button>
      {:else if showLookupCta}
        <span class="text-xs text-text-muted">Checking…</span>
      {:else if showPendingCta}
        <span class="text-xs text-text-muted">Claim pending</span>
      {:else if showReviewedCta}
        <span class="text-xs text-text-muted">
          {#if hasApprovedClaim}
            Claim approved
          {:else if hasRejectedClaim}
            Claim rejected
          {:else}
            Claim reviewed
          {/if}
        </span>
      {:else if showClaimCta}
        <button
          type="button"
          class="text-xs font-medium text-text-muted underline decoration-white/20 underline-offset-4 transition hover:text-text-primary hover:decoration-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          on:click|stopPropagation={openClaimModal}
        >
          Claim this channel
        </button>
      {/if}

      {#if showClaimCta || showLoginCta}
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
{/if}

{#if claimLookupState === 'error' && claimLookupError}
  <p class="mt-1 text-[0.7rem] text-red-400">{claimLookupError}</p>
{/if}
</section>
{:else if isChannelVerified}
  <div
    class="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-200"
    aria-label="Verified channel"
  >
    Verified channel
  </div>
{/if}

<Modal
  bind:open={isClaimModalOpen}
  size="lg"
  autoclose={false}
  class="!bg-[#0b0f17] border border-white/20 shadow-[0_25px_80px_rgba(0,0,0,0.65)] ring-1 ring-white/10"
  bodyClass="bg-transparent"
>
  <div class="space-y-4">
    <div>
      <h3 class="text-lg font-semibold text-text-primary">Claim this reaction channel</h3>
      <p class="mt-1 text-sm text-text-muted">
        Syncing reactions is always allowed. Claiming is only used to verify channel ownership on Pure Reactions.
      </p>
    </div>

    <div class="rounded-xl border border-white/10 bg-white/5 p-3">
      <p class="text-[0.7rem] font-semibold uppercase tracking-wide text-text-muted">Channel information</p>
      <dl class="mt-2 space-y-1 text-sm text-text-primary">
        <div class="flex flex-wrap items-center gap-2">
          <dt class="text-text-muted">Name:</dt>
          <dd>{channelName || channelHandle || 'Unknown channel'}</dd>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <dt class="text-text-muted">URL:</dt>
          <dd>
            {#if youtubeUrl}
              <a
                class="text-accent-primary transition hover:text-accent-primary/80"
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {youtubeUrl}
              </a>
            {:else}
              <span class="text-text-muted">Not available</span>
            {/if}
          </dd>
        </div>
        {#if showHandleRow}
          <div class="flex flex-wrap items-center gap-2">
            <dt class="text-text-muted">Channel handle:</dt>
            <dd>{channelHandle}</dd>
          </div>
        {/if}
      </dl>
    </div>

    <div class="rounded-xl border border-white/10 bg-white/5 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="text-[0.7rem] font-semibold uppercase tracking-wide text-text-muted">Verification token</p>
          <p class="mt-1 font-mono text-sm text-text-primary">{verificationToken}</p>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          on:click={copyToken}
        >
          Copy token
        </button>
      </div>
      <ul class="mt-3 list-disc space-y-1 pl-4 text-xs text-text-muted">
        <li>Upload a public or unlisted video on this YouTube channel.</li>
        <li>Paste this token exactly into the video description.</li>
        <li>Submit the video link below.</li>
      </ul>
    </div>

    <div class="space-y-3">
      <label class="block text-sm font-medium text-text-primary" for="verification-video-url">
        Verification video URL
      </label>
      <input
        id="verification-video-url"
        type="url"
        class="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        placeholder="https://www.youtube.com/watch?v=..."
        bind:value={verificationVideoUrl}
        required
      />

      <label class="flex items-start gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          class="mt-1 h-4 w-4 rounded border-white/20 bg-white/10 text-accent-primary focus:ring-focus"
          bind:checked={hasConfirmedControl}
        />
        <span>I confirm that I control this YouTube channel</span>
      </label>
    </div>

    {#if claimError}
      <p class="text-sm text-red-400">{claimError}</p>
    {/if}

    <div class="flex flex-wrap justify-end gap-3">
      <Button color="alternative" on:click={closeClaimModal} disabled={isSubmittingClaim}>
        Cancel
      </Button>
      <Button
        on:click={submitClaim}
        disabled={isSubmittingClaim || !verificationVideoUrl?.trim?.() || !hasConfirmedControl}
        class="bg-accent-primary text-text-primary hover:bg-accent-primary/90"
      >
        {#if isSubmittingClaim}
          Submitting...
        {:else}
          Submit for verification
        {/if}
      </Button>
    </div>
  </div>
</Modal>
