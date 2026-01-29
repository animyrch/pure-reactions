<script>
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { copyToClipboard } from '$lib/helpers/system';
  import {
    createYoutubeChannelClaim,
    getYoutubeChannelClaim,
    getYoutubeChannelVerification
  } from '$lib/helpers/firebase';
  import { showToast } from '$lib/stores/toast';
  import { TOASTS } from '$lib/constants/toasts';
  import { onDestroy } from 'svelte';
  import AttributionPrimaryInfo from './AttributionPrimaryInfo.svelte';
  import AttributionClaimControls from './AttributionClaimControls.svelte';
  import AttributionClaimModal from './AttributionClaimModal.svelte';
  import AttributionVerifiedBadge from './AttributionVerifiedBadge.svelte';
  import {
    CLAIM_TOKEN_EXPIRY_DAYS,
    buildAttributionDisplay,
    buildAttributionVerificationState,
    buildClaimControlsState,
    generateVerificationToken,
    getClaimDraftError,
    getClaimDraftState
  } from '$lib/helpers/reactionAttribution';

  export let isVerifiedCreator = false;
  export let reactionVideoAuthor;
  export let reactorDisplayName;
  export let reactorId;
  export let viewerId;

  let channelHandle = '';
  let channelDisplayName = '';
  let showHandleRow = false;
  let youtubeUrl = '';
  let hasYoutubeUrl = false;
  let primaryPrefix = '';
  let primaryName = '';
  let primaryHref = '';
  let primaryLinkLabel = '';
  let primaryLinkTarget = undefined;
  let primaryLinkRel = undefined;

  let claimRecord = null;
  let claimLookupState = 'idle';
  let claimLookupError = '';
  let claimLookupKey = '';
  let verificationRecord = null;
  let verificationLookupState = 'idle';
  let verificationLookupKey = '';

  let isChannelVerified = false;
  let shouldHideAttribution = false;
  let debugClaimId = '';
  let debugVerificationStatus = '';
  let debugClaimUserId = '';
  let debugReactorId = '';
  let debugShouldHide = 'false';

  let canShowClaimControls = false;
  let hasPendingClaim = false;
  let hasReviewedClaim = false;
  let showLoginCta = false;
  let showPendingCta = false;
  let showReviewedCta = false;
  let showClaimCta = false;
  let showLookupCta = false;
  let reviewedClaimLabel = '';
  let showInfoTip = false;

  let isClaimModalOpen = false;
  let verificationToken = '';
  let verificationVideoUrl = '';
  let trimmedVerificationVideoUrl = '';
  let hasConfirmedControl = false;
  let claimError = '';
  let isSubmittingClaim = false;
  let isClaimSubmissionDisabled = true;

  let isMounted = true;
  onDestroy(() => {
    isMounted = false;
  });

  $: {
    const displayState = buildAttributionDisplay({
      reactionVideoAuthor,
      reactorDisplayName,
      reactorId,
      isVerifiedCreator
    });
    channelHandle = displayState.channelHandle;
    channelDisplayName = displayState.channelDisplayName;
    showHandleRow = displayState.showHandleRow;
    youtubeUrl = displayState.youtubeUrl;
    hasYoutubeUrl = displayState.hasYoutubeUrl;
    primaryPrefix = displayState.primaryPrefix;
    primaryName = displayState.primaryName;
    primaryHref = displayState.primaryHref;
    primaryLinkLabel = displayState.primaryLinkLabel;
    primaryLinkTarget = displayState.primaryLinkTarget;
    primaryLinkRel = displayState.primaryLinkRel;
  }

  $: {
    const verificationState = buildAttributionVerificationState({
      verificationRecord,
      claimRecord,
      reactorId,
      channelHandle
    });
    isChannelVerified = verificationState.isChannelVerified;
    shouldHideAttribution = verificationState.shouldHideAttribution;
    debugClaimId = verificationState.debug.claimId;
    debugVerificationStatus = verificationState.debug.verificationStatus;
    debugClaimUserId = verificationState.debug.claimUserId;
    debugReactorId = verificationState.debug.reactorId;
    debugShouldHide = verificationState.debug.shouldHide;
  }

  $: {
    const claimControlsState = buildClaimControlsState({
      isVerifiedCreator,
      channelHandle,
      isChannelVerified,
      claimRecord,
      claimLookupState,
      viewerId
    });
    canShowClaimControls = claimControlsState.canShowClaimControls;
    hasPendingClaim = claimControlsState.hasPendingClaim;
    hasReviewedClaim = claimControlsState.hasReviewedClaim;
    showLoginCta = claimControlsState.showLoginCta;
    showPendingCta = claimControlsState.showPendingCta;
    showReviewedCta = claimControlsState.showReviewedCta;
    showClaimCta = claimControlsState.showClaimCta;
    showLookupCta = claimControlsState.showLookupCta;
    reviewedClaimLabel = claimControlsState.reviewedClaimLabel;
    showInfoTip = claimControlsState.showInfoTip;
  }

  $: {
    const claimDraftState = getClaimDraftState({
      verificationVideoUrl,
      hasConfirmedControl,
      isSubmittingClaim
    });
    trimmedVerificationVideoUrl = claimDraftState.trimmedVerificationVideoUrl;
    isClaimSubmissionDisabled = claimDraftState.isClaimSubmissionDisabled;
  }

  const resetClaimDraft = () => {
    verificationVideoUrl = '';
    hasConfirmedControl = false;
    claimError = '';
  };

  const ensureVerificationToken = () => {
    if (!verificationToken) {
      verificationToken = generateVerificationToken({
        crypto: browser ? window?.crypto : undefined
      });
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

  const openClaimModal = () => {
    if (!viewerId || !channelHandle || hasPendingClaim || hasReviewedClaim) return;
    resetClaimDraft();
    ensureVerificationToken();
    isClaimModalOpen = true;
  };

  const copyToken = () => {
    if (!verificationToken || !browser) return;
    copyToClipboard(verificationToken);
    showToast('Verification token copied.', TOASTS.SUCCESS);
  };

  const submitClaim = async () => {
    const validationError = getClaimDraftError({
      viewerId,
      channelHandle,
      trimmedVerificationVideoUrl,
      hasConfirmedControl
    });

    if (validationError) {
      claimError = validationError;
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
        verificationVideoUrl: trimmedVerificationVideoUrl,
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
    class="flex flex-col gap-3 rounded-xl border border-border-strong/20 bg-surface/60 px-3 py-2 text-xs text-text-muted shadow-surface/40 backdrop-blur sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    aria-label="Attribution"
    data-testid="attribution-block"
    data-debug-channel-handle={channelHandle}
    data-debug-reactor-id={debugReactorId}
    data-debug-claim-user-id={debugClaimUserId}
    data-debug-claim-id={debugClaimId}
    data-debug-verification-status={debugVerificationStatus}
    data-debug-should-hide={debugShouldHide}
  >
    <AttributionPrimaryInfo
      primaryPrefix={primaryPrefix}
      primaryName={primaryName}
      primaryHref={primaryHref}
      primaryLinkLabel={primaryLinkLabel}
      primaryLinkTarget={primaryLinkTarget}
      primaryLinkRel={primaryLinkRel}
      isVerifiedCreator={isVerifiedCreator}
      isChannelVerified={isChannelVerified}
    />

    {#if canShowClaimControls}
      <div class="flex w-full items-center sm:w-auto sm:justify-end">
        <AttributionClaimControls
          showLoginCta={showLoginCta}
          showLookupCta={showLookupCta}
          showPendingCta={showPendingCta}
          showReviewedCta={showReviewedCta}
          showClaimCta={showClaimCta}
          reviewedClaimLabel={reviewedClaimLabel}
          showInfoTip={showInfoTip}
          onLogin={() => goto('/login')}
          onClaim={openClaimModal}
        />
      </div>
    {/if}
    {#if claimLookupState === 'error' && claimLookupError}
      <p class="mt-1 text-[0.7rem] text-red-400 sm:w-full">{claimLookupError}</p>
    {/if}
  </section>
{:else if isChannelVerified}
  <div class="flex justify-center">
    <AttributionVerifiedBadge />
  </div>
{/if}

<AttributionClaimModal
  bind:open={isClaimModalOpen}
  channelDisplayName={channelDisplayName}
  channelHandle={channelHandle}
  showHandleRow={showHandleRow}
  youtubeUrl={youtubeUrl}
  hasYoutubeUrl={hasYoutubeUrl}
  verificationToken={verificationToken}
  bind:verificationVideoUrl
  bind:hasConfirmedControl
  claimError={claimError}
  isSubmittingClaim={isSubmittingClaim}
  isSubmitDisabled={isClaimSubmissionDisabled}
  onCopyToken={copyToken}
  onSubmit={submitClaim}
/>
