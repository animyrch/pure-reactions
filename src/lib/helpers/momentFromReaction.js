import { assertMomentReady } from '#lib/helpers/moments.js';
import { reactionPageTitle } from '#lib/helpers/reactionListItem.js';
import {
  buildTikTokVideoUrl,
  buildYouTubeVideoUrl,
  generateOriginalVideoSlug
} from '#lib/helpers/originalVideo.js';
import { isTikTokPlatform, normalizeOriginalVideoPlatform } from '#lib/helpers/platform.js';
import { validateMomentReactionFromReactionData } from '#lib/helpers/momentReactionValidation.ts';
import { buildWatchDurationPatch } from '#lib/helpers/watchDuration.js';

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

const reactionDataOf = (reaction) => reaction?.data || reaction || {};

const reactionIdOf = (reaction) => trimmed(reaction?.id) || trimmed(reactionDataOf(reaction).id);

/**
 * A moment is created from a full reaction the signed-in user owns.
 * Moment reactions are already slices, so they are not a source.
 */
export const isOwnedSourceReaction = (reaction, userId) => {
  const data = reactionDataOf(reaction);
  if (!reactionIdOf(reaction) || !trimmed(userId)) return false;
  if (data.reactorId !== userId) return false;
  if (data.isMomentReaction === true) return false;
  return trimmed(data.originalVideoId).length > 0;
};

export const assessSourceReaction = (reaction, userId) => {
  if (!reactionIdOf(reaction)) {
    return { ok: false, error: 'That reaction could not be found.' };
  }
  const data = reactionDataOf(reaction);
  if (data.isMomentReaction === true) {
    return { ok: false, error: 'Choose a full reaction. This one is already a moment reaction.' };
  }
  if (!trimmed(userId) || data.reactorId !== userId) {
    return { ok: false, error: 'You can only create a moment from a reaction you created.' };
  }
  if (!trimmed(data.originalVideoId)) {
    return { ok: false, error: 'That reaction has no original video yet.' };
  }
  const originalVideoUrl = originalVideoUrlFromReaction(reaction);
  if (!originalVideoUrl) {
    return { ok: false, error: 'That reaction has no original video link yet.' };
  }
  return { ok: true, reaction };
};

export const originalVideoUrlFromReaction = (reaction) => {
  const data = reactionDataOf(reaction);
  const direct = trimmed(data.originalVideoUrl);
  if (direct) return direct;
  const platform = normalizeOriginalVideoPlatform(data.originalVideoPlatform);
  if (isTikTokPlatform(platform)) {
    return buildTikTokVideoUrl({
      videoId: data.originalVideoId,
      authorHandle: data.originalVideoAuthorHandle,
      authorUrl: data.originalVideoAuthorUrl
    }) || '';
  }
  return buildYouTubeVideoUrl(data.originalVideoId) || '';
};

export const sourceReactionOptionLabel = (reaction) => {
  const data = reactionDataOf(reaction);
  const title = reactionPageTitle({
    customReactionTitle: data.customReactionTitle,
    reactionVideoTitle: data.reactionVideoTitle,
    originalVideoTitle: data.originalVideoTitle,
    fallback: 'Untitled reaction'
  });
  return data.isPublished === true ? title : `${title} (unpublished)`;
};

export const formatAnchorClock = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '';
  const total = Math.floor(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
};

export const existingMomentOptionLabel = (moment) => {
  const title = trimmed(moment?.title) || 'Untitled moment';
  const clock = formatAnchorClock(moment?.momentTimeSeconds);
  return clock ? `${title} · anchor ${clock}` : title;
};

export const sortMomentsByAnchor = (moments = []) =>
  [...moments].sort((left, right) => {
    const leftAnchor = Number(left?.momentTimeSeconds);
    const rightAnchor = Number(right?.momentTimeSeconds);
    const leftValue = Number.isFinite(leftAnchor) ? leftAnchor : Number.POSITIVE_INFINITY;
    const rightValue = Number.isFinite(rightAnchor) ? rightAnchor : Number.POSITIVE_INFINITY;
    if (leftValue !== rightValue) return leftValue - rightValue;
    return String(left?.id || '').localeCompare(String(right?.id || ''));
  });

const readNonNegativeSeconds = (value) => {
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 10) / 10;
};

/**
 * Use an existing moment for this original video, or a new anchor time.
 * `selectedMomentId` of `new` always creates a moment.
 */
export const resolveMomentTarget = ({
  moments = [],
  selectedMomentId = '',
  title = '',
  anchorSeconds,
  originalVideoUrl = ''
} = {}) => {
  const selected = trimmed(selectedMomentId);
  if (selected && selected !== 'new') {
    const moment = moments.find((entry) => entry?.id === selected);
    if (!moment) {
      return { ok: false, error: 'Choose one of the moments for this original video.' };
    }
    const anchor = Number(moment.momentTimeSeconds);
    if (!Number.isFinite(anchor) || anchor < 0) {
      return { ok: false, error: 'That moment has no anchor time.' };
    }
    return {
      ok: true,
      mode: 'existing',
      momentId: moment.id,
      momentTimeSeconds: anchor,
      title: trimmed(moment.title)
    };
  }

  const anchor = readNonNegativeSeconds(anchorSeconds);
  if (anchor === null) {
    return { ok: false, error: 'Enter the anchor time in the original video (0 or greater).' };
  }
  const ready = assertMomentReady({
    title,
    originalVideoUrl,
    momentTimeSeconds: anchor
  });
  if (!ready.ok) return ready;
  return {
    ok: true,
    mode: 'new',
    momentId: '',
    momentTimeSeconds: ready.value.momentTimeSeconds,
    title: ready.value.title,
    originalVideoUrl: ready.value.originalVideoUrl
  };
};

export const readSliceBounds = (start, end) => {
  if (typeof start === 'string' && start.trim() === '') {
    return { ok: false, error: 'Enter the reaction start time.' };
  }
  if (typeof end === 'string' && end.trim() === '') {
    return { ok: false, error: 'Enter the reaction end time.' };
  }
  const offsetStartTime = readNonNegativeSeconds(start);
  const reactionFinishTime = readNonNegativeSeconds(end);
  if (offsetStartTime === null) {
    return { ok: false, error: 'Enter a reaction start time of 0 or greater.' };
  }
  if (reactionFinishTime === null || reactionFinishTime <= offsetStartTime) {
    return { ok: false, error: 'Enter a reaction end time after the start.' };
  }
  return { ok: true, offsetStartTime, reactionFinishTime };
};

export const assessReactionSlice = (source, {
  momentTimeSeconds,
  offsetStartTime,
  reactionFinishTime
} = {}) => validateMomentReactionFromReactionData({
  ...reactionDataOf(source),
  offsetStartTime,
  reactionFinishTime
}, Number(momentTimeSeconds));

const SLICE_COPY_KEYS = [
  'reactionVideoId',
  'reactionVideoTitle',
  'reactionVideoAuthor',
  'reactionVideoDescription',
  'customReactionTitle',
  'originalVideoId',
  'originalVideoTitle',
  'originalVideoAuthor',
  'originalVideoAuthorHandle',
  'originalVideoAuthorUrl',
  'originalVideoDescription',
  'originalVideoThumbnailUrl',
  'originalVideoThumbnailWidth',
  'originalVideoThumbnailHeight',
  'originalVideoProviderName',
  'originalVideoProviderUrl',
  'originalVideoUrl',
  'originalVideoPlatform',
  'originalVideoSlug',
  'stateTimeline',
  'volumeTimeline',
  'reactionVolumeTimeline',
  'playbackTimeline',
  'overlayVisibilityTimeline',
  'reactionConfigs',
  'volumeConfigs',
  'reactionVolumeConfigs',
  'playbackRateConfigs',
  'timeOffset',
  'globalGain',
  'muteReactionWhileOriginalPlays',
  'fullscreenPrimaryVideo',
  'fullscreenOverlayWidthPercent',
  'fullscreenOverlayCorner',
  'youtube',
  'originalYoutube',
  'originalTikTok'
];

const copySliceValue = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    const text = value.trim();
    return text || undefined;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length ? value : undefined;
  if (typeof value === 'object') return Object.keys(value).length ? value : undefined;
  return undefined;
};

/**
 * Published moment reaction cut from a full reaction.
 * The full reaction is not changed. `sourceReactionId` is the way back.
 */
export const buildMomentSliceDocument = (source, {
  momentId,
  momentTimeSeconds,
  offsetStartTime,
  reactionFinishTime,
  userId,
  reactorDisplayName = ''
} = {}) => {
  const data = reactionDataOf(source);
  const fields = {
    isMomentReaction: true,
    isPublished: true,
    momentId: trimmed(momentId),
    momentOriginalTimeSeconds: Number(momentTimeSeconds),
    offsetStartTime: Number(offsetStartTime),
    reactionFinishTime: Number(reactionFinishTime),
    sourceReactionId: reactionIdOf(source),
    reactorId: trimmed(userId),
    fullscreenPrimaryVideo: 'original',
    fullscreenOverlayWidthPercent: 35,
    fullscreenOverlayCorner: 'top-right'
  };

  const displayName = trimmed(reactorDisplayName);
  if (displayName) fields.reactorDisplayName = displayName;

  for (const key of SLICE_COPY_KEYS) {
    const copied = copySliceValue(data[key]);
    if (copied !== undefined) fields[key] = copied;
  }

  if (data.remixMode === true) fields.remixMode = true;

  if (!trimmed(fields.originalVideoSlug)) {
    const slug = generateOriginalVideoSlug(fields.originalVideoTitle, fields.originalVideoAuthor);
    if (slug) fields.originalVideoSlug = slug;
  }

  return {
    ...fields,
    ...buildWatchDurationPatch(fields)
  };
};

export const buildCreateMomentPath = (reactionId) => {
  const id = trimmed(reactionId);
  if (!id) return '/moments/from-reaction';
  return `/moments/from-reaction?reaction=${encodeURIComponent(id)}`;
};

export const canOfferCreateMoment = ({
  isUsersOwnVideo = false,
  isMomentReaction = false,
  pageSlug = ''
} = {}) => Boolean(isUsersOwnVideo) && isMomentReaction !== true && trimmed(pageSlug).length > 0;

export const fullReactionPath = (reactionId) => {
  const id = trimmed(reactionId);
  return id ? `/reaction/${id}` : '';
};

export const shouldShowFullReactionLink = (reaction) => {
  const id = reactionIdOf(reaction);
  if (!id) return false;
  const data = reactionDataOf(reaction);
  return data.isPublished === true && data.isMomentReaction !== true;
};
