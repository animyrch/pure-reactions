export const CLAIM_TOKEN_SEGMENTS = 4;
export const CLAIM_TOKEN_SEGMENT_LENGTH = 4;
export const CLAIM_TOKEN_EXPIRY_DAYS = 14;

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

const getReviewedClaimLabel = (hasApprovedClaim, hasRejectedClaim) => {
  if (hasApprovedClaim) return 'Claim approved';
  if (hasRejectedClaim) return 'Claim rejected';
  return 'Claim reviewed';
};

const getTrimmedUrl = (value) => (typeof value === 'string' ? value.trim() : '');

export const buildAttributionDisplay = ({
  reactionVideoAuthor,
  reactorDisplayName,
  reactorId,
  isVerifiedCreator
}) => {
  const channelHandle = normalizeText(reactionVideoAuthor);
  const channelName = channelHandle;
  const showHandleRow = Boolean(channelHandle && channelHandle !== channelName);

  const userName = normalizeText(reactorDisplayName);
  const emailPrefix = extractEmailPrefix(reactorDisplayName);
  const displayUserName = emailPrefix || userName || 'Pure Reactions user';

  const profileUrl = reactorId ? `/user/${reactorId}` : '';
  const youtubeUrl = channelHandle ? `https://www.youtube.com/${channelHandle}` : '';

  const primaryPrefix = isVerifiedCreator ? 'Reaction by' : 'Sync created by';
  const primaryName = isVerifiedCreator ? (channelName || 'Verified creator') : displayUserName;
  const primaryHref = isVerifiedCreator ? youtubeUrl : profileUrl;
  const primaryLinkLabel = isVerifiedCreator
    ? `Open ${primaryName} on YouTube`
    : `Open Pure Reactions profile for ${displayUserName}`;
  const primaryLinkTarget = isVerifiedCreator ? '_blank' : undefined;
  const primaryLinkRel = isVerifiedCreator ? 'noopener noreferrer' : undefined;

  return {
    channelHandle,
    channelName,
    channelDisplayName: channelName || channelHandle || 'Unknown channel',
    showHandleRow,
    displayUserName,
    profileUrl,
    youtubeUrl,
    hasYoutubeUrl: Boolean(youtubeUrl),
    primaryPrefix,
    primaryName,
    primaryHref,
    primaryLinkLabel,
    primaryLinkTarget,
    primaryLinkRel
  };
};

export const buildAttributionVerificationState = ({
  verificationRecord,
  claimRecord,
  reactorId,
  channelHandle
}) => {
  const isChannelVerified =
    verificationRecord?.status === 'approved' || claimRecord?.status === 'approved';

  const verifiedClaimUserId =
    verificationRecord?.userId ||
    extractClaimUserId(verificationRecord?.claimId) ||
    (claimRecord?.status === 'approved' ? claimRecord?.userId : '');

  const normalizedReactorId = normalizeId(reactorId);
  const normalizedClaimUserId = normalizeId(verifiedClaimUserId);

  const claimIdMatchesReactor =
    Boolean(verificationRecord?.claimId && channelHandle && normalizedReactorId) &&
    verificationRecord.claimId === `${channelHandle}__${normalizedReactorId}`;

  const shouldHideAttribution =
    Boolean(isChannelVerified && normalizedClaimUserId && normalizedReactorId) &&
    (normalizedClaimUserId === normalizedReactorId || claimIdMatchesReactor);

  return {
    isChannelVerified,
    verifiedClaimUserId,
    normalizedReactorId,
    normalizedClaimUserId,
    claimIdMatchesReactor,
    shouldHideAttribution,
    debug: {
      claimId: verificationRecord?.claimId || '',
      verificationStatus: verificationRecord?.status || '',
      claimUserId: normalizedClaimUserId || '',
      reactorId: normalizedReactorId || '',
      shouldHide: shouldHideAttribution ? 'true' : 'false'
    }
  };
};

export const buildClaimControlsState = ({
  isVerifiedCreator,
  channelHandle,
  isChannelVerified,
  claimRecord,
  claimLookupState,
  viewerId
}) => {
  const canShowClaimControls = !isVerifiedCreator && Boolean(channelHandle) && !isChannelVerified;
  const hasPendingClaim = claimRecord?.status === 'pending';
  const hasApprovedClaim = claimRecord?.status === 'approved';
  const hasRejectedClaim = claimRecord?.status === 'rejected';
  const hasReviewedClaim = Boolean(claimRecord?.status) && claimRecord?.status !== 'pending';
  const isClaimLookupLoading = claimLookupState === 'loading';
  const showLoginCta = canShowClaimControls && !viewerId;
  const showPendingCta = canShowClaimControls && viewerId && hasPendingClaim;
  const showReviewedCta = canShowClaimControls && viewerId && hasReviewedClaim;
  const showClaimCta =
    canShowClaimControls &&
    viewerId &&
    !hasPendingClaim &&
    !hasReviewedClaim &&
    !isClaimLookupLoading;
  const showLookupCta = canShowClaimControls && viewerId && isClaimLookupLoading;

  return {
    canShowClaimControls,
    hasPendingClaim,
    hasApprovedClaim,
    hasRejectedClaim,
    hasReviewedClaim,
    isClaimLookupLoading,
    showLoginCta,
    showPendingCta,
    showReviewedCta,
    showClaimCta,
    showLookupCta,
    reviewedClaimLabel: getReviewedClaimLabel(hasApprovedClaim, hasRejectedClaim),
    showInfoTip: showClaimCta || showLoginCta
  };
};

export const generateVerificationToken = ({ crypto } = {}) => {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const totalLength = CLAIM_TOKEN_SEGMENTS * CLAIM_TOKEN_SEGMENT_LENGTH;
  const values = new Uint8Array(totalLength);

  if (crypto?.getRandomValues) {
    crypto.getRandomValues(values);
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

export const getClaimDraftState = ({
  verificationVideoUrl,
  hasConfirmedControl,
  isSubmittingClaim
}) => {
  const trimmedVerificationVideoUrl = getTrimmedUrl(verificationVideoUrl);
  return {
    trimmedVerificationVideoUrl,
    isClaimSubmissionDisabled:
      Boolean(isSubmittingClaim) || !trimmedVerificationVideoUrl || !hasConfirmedControl
  };
};

export const getClaimDraftError = ({
  viewerId,
  channelHandle,
  trimmedVerificationVideoUrl,
  hasConfirmedControl
}) => {
  if (!viewerId) return 'Log in to claim this channel.';
  if (!channelHandle) return 'Missing YouTube channel handle.';
  if (!trimmedVerificationVideoUrl) return 'Add the verification video URL.';
  if (!hasConfirmedControl) return 'Confirm you control this YouTube channel.';
  return '';
};
