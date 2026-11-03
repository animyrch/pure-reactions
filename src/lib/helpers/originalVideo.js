import {
  ORIGINAL_VIDEO_PLATFORMS,
  normalizeOriginalVideoPlatform,
} from '$lib/helpers/platform';
import { downloadBasicVideoDetails } from '$lib/helpers/youtube';

const trimString = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const firstDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
};

/**
 * Generate a canonical slug for the original video.
 * Format: [original-video-title-slugified]-[original-video-author-slugified]
 *
 * This slug is used for SEO-friendly canonical URLs and collision avoidance.
 *
 * @param {string} title - Original video title
 * @param {string} author - Original video author/creator
 * @returns {string} Generated slug (e.g., 'blackpink-how-you-like-that-blackpink')
 */
export const generateOriginalVideoSlug = (title, author) => {
  const slugifyPart = (part, isTitle = false) => {
    if (!part || typeof part !== 'string') {
      return '';
    }

    // Convert to lowercase
    let slug = part.toLowerCase();

    // Strip noisy suffixes from title only
    if (isTitle) {
      slug = slug
        .replace(/\s*\(?m\/v\)?|\s*\(?m-v\)?|\s*\(?mv\)?|\s*\[?official\s+video\]?|\s*\[?official\s+music\s+video\]?|\s*\[?official\s+lyric\s+video\]?\s*$/gi, '')
        .trim();
    }

    // Remove special characters and replace spaces/separators with hyphens
    slug = slug.replace(/[^a-z0-9]+/g, '-');

    // Trim leading and trailing hyphens
    slug = slug.replace(/^-+|-+$/g, '');

    return slug;
  };

  const titleSlug = slugifyPart(title, true);
  const authorSlug = slugifyPart(author, false);

  // Build the final slug with safety fallbacks
  const parts = [];
  if (titleSlug) parts.push(titleSlug);
  if (authorSlug) parts.push(authorSlug);

  // Fallback to a generic slug if both parts are empty
  if (parts.length === 0) {
    return 'original-content';
  }

  return parts.join('-');
};

const compactObject = (value) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => {
      if (entryValue === undefined || entryValue === null) {
        return false;
      }
      if (typeof entryValue === 'string') {
        return entryValue.trim().length > 0;
      }
      return true;
    }),
  );

export const buildYouTubeVideoUrl = (videoId) => {
  const normalizedVideoId = trimString(videoId);
  return normalizedVideoId
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(normalizedVideoId)}`
    : undefined;
};

const firstNonEmptyString = (...values) => {
  for (const value of values) {
    const trimmed = trimString(value);
    if (trimmed) return trimmed;
  }
  return undefined;
};

/**
 * Thumbnail for an original-video hub.
 * Stored `originalVideoThumbnailUrl` is often empty; enrichment keeps the
 * image on originalYoutube/originalTikTok meta instead.
 */
const originalVideoThumbnailSource = (reactionData = {}) => {
  const platform = normalizeOriginalVideoPlatform(reactionData?.originalVideoPlatform);
  const sourceMeta =
    platform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK
      ? reactionData?.originalTikTok?.meta || {}
      : reactionData?.originalYoutube?.meta || {};

  return { platform, sourceMeta };
};

const thumbnailDimensions = (reactionData, sourceMeta) => ({
  thumbnailWidth: toFiniteNumber(
    firstDefined(reactionData?.originalVideoThumbnailWidth, sourceMeta?.thumbnailWidth),
  ) ?? null,
  thumbnailHeight: toFiniteNumber(
    firstDefined(reactionData?.originalVideoThumbnailHeight, sourceMeta?.thumbnailHeight),
  ) ?? null,
});

export const pickOriginalVideoThumbnail = (reactionData = {}) => {
  const { platform, sourceMeta } = originalVideoThumbnailSource(reactionData);
  const storedThumbnailUrl = firstNonEmptyString(
    reactionData?.originalVideoThumbnailUrl,
    sourceMeta?.thumbnail,
  );
  const thumbnailUrl = storedThumbnailUrl
    || (platform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK
      ? undefined
      : buildYouTubeThumbnailUrl(reactionData?.originalVideoId));

  return {
    thumbnailUrl: thumbnailUrl ?? null,
    ...thumbnailDimensions(reactionData, sourceMeta),
  };
};

export const pickOriginalVideoThumbnailFromReactions = (reactions = []) => {
  let fallback = null;

  for (const reactionData of reactions) {
    const { platform, sourceMeta } = originalVideoThumbnailSource(reactionData);
    const storedThumbnailUrl = firstNonEmptyString(
      reactionData?.originalVideoThumbnailUrl,
      sourceMeta?.thumbnail,
    );
    if (storedThumbnailUrl) {
      return {
        thumbnailUrl: storedThumbnailUrl,
        ...thumbnailDimensions(reactionData, sourceMeta),
      };
    }

    if (!fallback && platform !== ORIGINAL_VIDEO_PLATFORMS.TIKTOK) {
      const constructed = buildYouTubeThumbnailUrl(reactionData?.originalVideoId);
      if (constructed) {
        fallback = {
          thumbnailUrl: constructed,
          ...thumbnailDimensions(reactionData, sourceMeta),
        };
      }
    }
  }

  return fallback ?? { thumbnailUrl: null, thumbnailWidth: null, thumbnailHeight: null };
};

/**
 * Other original-video hubs for the same original creator.
 * Input is published reactions for that author, newest first.
 * Each distinct originalVideoSlug other than the current hub becomes one card.
 */
export const buildOtherOriginalHubs = (reactions = [], currentSlug = '') => {
  const groups = new Map();

  for (const reaction of reactions) {
    const data = reaction?.data && typeof reaction.data === 'object' ? reaction.data : reaction;
    const slug = trimString(data?.originalVideoSlug);
    if (!slug || slug === currentSlug) continue;

    const bucket = groups.get(slug);
    if (bucket) {
      bucket.push(data);
    } else {
      groups.set(slug, [data]);
    }
  }

  return [...groups.entries()].map(([slug, records]) => {
    const titled = records.find((record) => trimString(record.originalVideoTitle));
    const thumbnail = pickOriginalVideoThumbnailFromReactions(records);
    return {
      slug,
      title: trimString(titled?.originalVideoTitle) || 'Original Video',
      thumbnailUrl: thumbnail.thumbnailUrl,
      thumbnailWidth: thumbnail.thumbnailWidth,
      thumbnailHeight: thumbnail.thumbnailHeight,
      reactionCount: records.length,
    };
  });
};

export const buildYouTubeThumbnailUrl = (
  videoId,
  { variant = 'hqdefault', format = 'jpg' } = {},
) => {
  const normalizedVideoId = trimString(videoId);
  return normalizedVideoId
    ? `https://i.ytimg.com/vi/${encodeURIComponent(normalizedVideoId)}/${variant}.${format}`
    : undefined;
};

export const buildYouTubeAuthorUrl = (author) => {
  const normalizedAuthor = trimString(author);
  if (!normalizedAuthor) {
    return undefined;
  }

  return `https://www.youtube.com/${normalizedAuthor.replace(/^\/+/, '')}`;
};

export const buildTikTokAuthorUrl = (authorHandle) => {
  const normalizedHandle = trimString(authorHandle)?.replace(/^@/, '');
  return normalizedHandle
    ? `https://www.tiktok.com/@${encodeURIComponent(normalizedHandle)}`
    : undefined;
};

const YOUTUBE_PROFILE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const TIKTOK_PROFILE_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com']);
const RESERVED_PROFILE_SEGMENTS = new Set([
  'about',
  'account',
  'attribution_link',
  'channel',
  'clip',
  'create',
  'embed',
  'feed',
  'gaming',
  'hashtag',
  'iframe_api',
  'live',
  'login',
  'logout',
  'playlist',
  'post',
  'premium',
  'redirect',
  'results',
  'shorts',
  'signin',
  'signup',
  'upload',
  'user',
  'watch',
]);
const PROFILE_HANDLE = /^@[\p{L}\p{N}._-]{1,64}$/u;
const PROFILE_CUSTOM_SEGMENT = /^[\p{L}\p{N}][\p{L}\p{N}._ &'+-]{0,79}$/u;
const YOUTUBE_CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

const isCustomProfileSegment = (segment) =>
  PROFILE_CUSTOM_SEGMENT.test(segment) && !RESERVED_PROFILE_SEGMENTS.has(segment.toLowerCase());

const isYouTubeProfilePath = (parts) => {
  if (parts.length === 1 && PROFILE_HANDLE.test(parts[0])) return true;
  if (parts.length === 1 && isCustomProfileSegment(parts[0])) return true;
  if (parts.length === 2 && parts[0] === 'channel' && YOUTUBE_CHANNEL_ID.test(parts[1])) return true;
  if (
    parts.length === 2 &&
    (parts[0] === 'c' || parts[0] === 'user') &&
    isCustomProfileSegment(parts[1])
  ) {
    return true;
  }
  return false;
};

const isTikTokProfilePath = (parts) => parts.length === 1 && PROFILE_HANDLE.test(parts[0]);

// Reject C0 controls, DEL, and backslash before URL parsing. The URL parser
// treats "\" as "/" on YouTube and TikTok hosts, which would hide the character.
const hasDisallowedProfileCharacter = (value) => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f || code === 0x5c) return true;
  }
  return false;
};

/**
 * Owner-controlled author URLs are rendered as the public creator link.
 * Only https YouTube and TikTok profile addresses are returned.
 */
export const safeCreatorProfileHref = (value) => {
  if (typeof value !== 'string') return undefined;
  const candidate = value.trim();
  if (!candidate || hasDisallowedProfileCharacter(candidate)) return undefined;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return undefined;
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.port) return undefined;

  const host = url.hostname.toLowerCase();
  const youtube = YOUTUBE_PROFILE_HOSTS.has(host);
  const tiktok = TIKTOK_PROFILE_HOSTS.has(host);
  if (!youtube && !tiktok) return undefined;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(url.pathname).replace(/\/+$/, '');
  } catch {
    return undefined;
  }

  const parts = decodedPath.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part.includes('%'))) return undefined;

  const allowed = youtube ? isYouTubeProfilePath(parts) : isTikTokProfilePath(parts);
  if (!allowed) return undefined;

  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  return `${url.origin}${pathname}`;
};

export const buildTikTokVideoUrl = ({ videoId, authorHandle, authorUrl } = {}) => {
  const normalizedVideoId = trimString(videoId);
  if (!normalizedVideoId) {
    return undefined;
  }

  const normalizedHandle = trimString(authorHandle)?.replace(/^@/, '');
  if (normalizedHandle) {
    return `https://www.tiktok.com/@${encodeURIComponent(normalizedHandle)}/video/${encodeURIComponent(normalizedVideoId)}`;
  }

  const normalizedAuthorUrl = trimString(authorUrl)?.replace(/\/$/, '');
  return normalizedAuthorUrl ? `${normalizedAuthorUrl}/video/${encodeURIComponent(normalizedVideoId)}` : undefined;
};

export const normalizeOriginalVideoMetadata = (reactionData = {}) => {
  const platform = normalizeOriginalVideoPlatform(reactionData?.originalVideoPlatform);
  const originalVideoId = trimString(reactionData?.originalVideoId);
  const sourceMeta =
    platform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK
      ? reactionData?.originalTikTok?.meta || {}
      : reactionData?.originalYoutube?.meta || {};
  const authorHandle = trimString(
    firstDefined(reactionData?.originalVideoAuthorHandle, sourceMeta?.authorHandle),
  );
  const author = trimString(
    firstDefined(
      reactionData?.originalVideoAuthor,
      sourceMeta?.authorName,
      authorHandle ? `@${authorHandle.replace(/^@/, '')}` : undefined,
    ),
  );
  const authorUrl = [
    reactionData?.originalVideoAuthorUrl,
    sourceMeta?.authorUrl,
    platform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK
      ? buildTikTokAuthorUrl(authorHandle)
      : buildYouTubeAuthorUrl(author),
  ].reduce((found, candidate) => found || safeCreatorProfileHref(candidate), undefined);
  const title = trimString(
    firstDefined(
      reactionData?.originalVideoTitle,
      sourceMeta?.title,
      platform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK && originalVideoId
        ? `TikTok video ${originalVideoId}`
        : undefined,
    ),
  );
  const description = trimString(
    firstDefined(
      reactionData?.originalVideoDescription,
      sourceMeta?.description,
      platform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK ? sourceMeta?.title : undefined,
    ),
  );
  const thumbnailUrl = trimString(
    firstDefined(reactionData?.originalVideoThumbnailUrl, sourceMeta?.thumbnail),
  );
  const thumbnailWidth = toFiniteNumber(
    firstDefined(reactionData?.originalVideoThumbnailWidth, sourceMeta?.thumbnailWidth),
  );
  const thumbnailHeight = toFiniteNumber(
    firstDefined(reactionData?.originalVideoThumbnailHeight, sourceMeta?.thumbnailHeight),
  );
  const providerName = trimString(
    firstDefined(
      reactionData?.originalVideoProviderName,
      sourceMeta?.providerName,
      platform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK ? 'TikTok' : 'YouTube',
    ),
  );
  const providerUrl = trimString(
    firstDefined(
      reactionData?.originalVideoProviderUrl,
      sourceMeta?.providerUrl,
      platform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK ? 'https://www.tiktok.com' : 'https://www.youtube.com',
    ),
  );
  const canonicalUrl = trimString(
    firstDefined(
      reactionData?.originalVideoUrl,
      sourceMeta?.canonicalUrl,
      platform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK
        ? buildTikTokVideoUrl({
            videoId: originalVideoId,
            authorHandle,
            authorUrl,
          })
        : buildYouTubeVideoUrl(originalVideoId),
    ),
  );

  return {
    platform,
    videoId: originalVideoId,
    title,
    author,
    authorHandle,
    authorUrl,
    description,
    thumbnailUrl,
    thumbnailWidth,
    thumbnailHeight,
    providerName,
    providerUrl,
    canonicalUrl,
    meta: sourceMeta,
    lastEnrichedAt:
      platform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK
        ? reactionData?.originalTikTok?.lastEnrichedAt
        : reactionData?.originalYoutube?.lastEnrichedAt,
  };
};

export const originalVideoMetadataToFirestoreFields = (metadata = {}) =>
  compactObject({
    originalVideoTitle: trimString(metadata.title),
    originalVideoAuthor: trimString(metadata.author),
    originalVideoAuthorHandle: trimString(metadata.authorHandle),
    originalVideoAuthorUrl: safeCreatorProfileHref(metadata.authorUrl),
    originalVideoDescription: trimString(metadata.description),
    originalVideoThumbnailUrl: trimString(metadata.thumbnailUrl),
    originalVideoThumbnailWidth: toFiniteNumber(metadata.thumbnailWidth),
    originalVideoThumbnailHeight: toFiniteNumber(metadata.thumbnailHeight),
    originalVideoProviderName: trimString(metadata.providerName),
    originalVideoProviderUrl: trimString(metadata.providerUrl),
    originalVideoUrl: trimString(metadata.canonicalUrl),
  });

export const fetchOriginalVideoMetadata = async ({ platform, videoId, videoUrl } = {}) => {
  const normalizedPlatform = normalizeOriginalVideoPlatform(platform);
  const normalizedVideoId = trimString(videoId);
  const normalizedVideoUrl = trimString(videoUrl);

  if (!normalizedVideoId) {
    return normalizeOriginalVideoMetadata({
      originalVideoPlatform: normalizedPlatform,
      originalVideoId: normalizedVideoId,
      originalVideoUrl: normalizedVideoUrl,
    });
  }

  if (normalizedPlatform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK) {
    const params = new URLSearchParams({
      platform: normalizedPlatform,
      videoId: normalizedVideoId,
    });
    if (normalizedVideoUrl) {
      params.set('videoUrl', normalizedVideoUrl);
    }

    const response = await fetch(`/api/original-video/metadata?${params.toString()}`);
    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(details || `Failed to fetch TikTok metadata (${response.status})`);
    }

    const payload = await response.json();
    return normalizeOriginalVideoMetadata({
      originalVideoPlatform: normalizedPlatform,
      originalVideoId: normalizedVideoId,
      originalVideoUrl: normalizedVideoUrl,
      ...originalVideoMetadataToFirestoreFields(payload?.metadata || {}),
      originalTikTok: payload?.rawMeta
        ? {
            meta: payload.rawMeta,
          }
        : undefined,
    });
  }

  const { videoAuthor, videoTitle } = await downloadBasicVideoDetails(normalizedVideoId);
  return normalizeOriginalVideoMetadata({
    originalVideoPlatform: normalizedPlatform,
    originalVideoId: normalizedVideoId,
    originalVideoUrl: normalizedVideoUrl || buildYouTubeVideoUrl(normalizedVideoId),
    originalVideoTitle: trimString(videoTitle),
    originalVideoAuthor: trimString(videoAuthor),
    originalVideoAuthorUrl: buildYouTubeAuthorUrl(videoAuthor),
    originalVideoProviderName: 'YouTube',
    originalVideoProviderUrl: 'https://www.youtube.com',
  });
};