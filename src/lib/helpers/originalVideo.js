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
  const authorUrl = trimString(
    firstDefined(
      reactionData?.originalVideoAuthorUrl,
      sourceMeta?.authorUrl,
      platform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK
        ? buildTikTokAuthorUrl(authorHandle)
        : buildYouTubeAuthorUrl(author),
    ),
  );
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
    originalVideoAuthorUrl: trimString(metadata.authorUrl),
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