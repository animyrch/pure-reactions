import { ORIGINAL_VIDEO_PLATFORMS, normalizeOriginalVideoPlatform } from '$lib/helpers/platform';
import {
  buildTikTokAuthorUrl,
  buildTikTokVideoUrl,
  normalizeOriginalVideoMetadata,
} from '$lib/helpers/originalVideo';

const TIKTOK_OEMBED_URL = 'https://www.tiktok.com/oembed';
const TIKTOK_TIMEOUT_MS = 8000;

const trimString = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
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

export const buildTikTokMetaFromOEmbed = (payload, { videoId, videoUrl } = {}) => {
  const normalizedVideoId = trimString(videoId);
  const authorHandle = trimString(payload?.author_unique_id);
  const authorUrl =
    trimString(payload?.author_url) || buildTikTokAuthorUrl(authorHandle);
  const canonicalUrl =
    trimString(videoUrl) ||
    buildTikTokVideoUrl({
      videoId: normalizedVideoId,
      authorHandle,
      authorUrl,
    });

  return compactObject({
    videoId: normalizedVideoId || trimString(payload?.embed_product_id),
    title: trimString(payload?.title),
    description: trimString(payload?.title),
    authorName: trimString(payload?.author_name),
    authorHandle,
    authorUrl,
    thumbnail: trimString(payload?.thumbnail_url),
    thumbnailWidth: toFiniteNumber(payload?.thumbnail_width),
    thumbnailHeight: toFiniteNumber(payload?.thumbnail_height),
    providerName: trimString(payload?.provider_name) || 'TikTok',
    providerUrl: trimString(payload?.provider_url) || 'https://www.tiktok.com',
    embedType: trimString(payload?.embed_type) || trimString(payload?.type),
    embedHtml: trimString(payload?.html),
    embedProductId: trimString(payload?.embed_product_id),
    canonicalUrl,
  });
};

export const fetchTikTokOriginalVideoMetadata = async ({ videoId, videoUrl } = {}) => {
  const normalizedVideoId = trimString(videoId);
  const resolvedUrl = trimString(videoUrl);

  if (!normalizedVideoId || !resolvedUrl) {
    return {
      meta: null,
      metadata: normalizeOriginalVideoMetadata({
        originalVideoPlatform: ORIGINAL_VIDEO_PLATFORMS.TIKTOK,
        originalVideoId: normalizedVideoId,
        originalVideoUrl: resolvedUrl,
      }),
    };
  }

  const requestUrl = new URL(TIKTOK_OEMBED_URL);
  requestUrl.searchParams.set('url', resolvedUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIKTOK_TIMEOUT_MS);

  try {
    const response = await fetch(requestUrl, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`TikTok oEmbed request failed (${response.status}): ${details.slice(0, 200)}`);
    }

    const payload = await response.json();
    const meta = buildTikTokMetaFromOEmbed(payload, {
      videoId: normalizedVideoId,
      videoUrl: resolvedUrl,
    });

    return {
      meta,
      metadata: normalizeOriginalVideoMetadata({
        originalVideoPlatform: ORIGINAL_VIDEO_PLATFORMS.TIKTOK,
        originalVideoId: normalizedVideoId,
        originalVideoUrl: resolvedUrl,
        originalVideoTitle: meta?.title,
        originalVideoAuthor: meta?.authorName,
        originalVideoAuthorHandle: meta?.authorHandle,
        originalVideoAuthorUrl: meta?.authorUrl,
        originalVideoDescription: meta?.description,
        originalVideoThumbnailUrl: meta?.thumbnail,
        originalVideoThumbnailWidth: meta?.thumbnailWidth,
        originalVideoThumbnailHeight: meta?.thumbnailHeight,
        originalVideoProviderName: meta?.providerName,
        originalVideoProviderUrl: meta?.providerUrl,
        originalTikTok: {
          meta,
        },
      }),
    };
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchOriginalVideoMetadataForPlatform = async ({
  platform,
  videoId,
  videoUrl,
} = {}) => {
  const normalizedPlatform = normalizeOriginalVideoPlatform(platform);

  if (normalizedPlatform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK) {
    return fetchTikTokOriginalVideoMetadata({ videoId, videoUrl });
  }

  return {
    meta: null,
    metadata: normalizeOriginalVideoMetadata({
      originalVideoPlatform: normalizedPlatform,
      originalVideoId: videoId,
      originalVideoUrl: videoUrl,
    }),
  };
};