import {
  ORIGINAL_VIDEO_PLATFORMS,
  normalizeOriginalVideoPlatform,
  resolveTikTokAuthorUrl,
  resolveTikTokWatchUrl,
  sanitizeTikTokHandle,
  sanitizeTikTokVideoId,
} from '#lib/helpers/platform.js';
import { normalizeOriginalVideoMetadata } from '#lib/helpers/originalVideo.js';
import { initializeFirebaseAdmin } from '#lib/server/firebaseAdmin.js';
import { resolveStoredTikTokMetadata } from '#lib/server/tiktokMetadataCache.js';

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

export class TikTokOEmbedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TikTokOEmbedError';
  }
}

export const buildTikTokMetaFromOEmbed = (payload, { videoId, videoUrl } = {}) => {
  const normalizedVideoId = trimString(videoId);
  const authorHandle = sanitizeTikTokHandle(payload?.author_unique_id) || undefined;
  const authorUrl = resolveTikTokAuthorUrl({
    authorHandle,
    authorUrl: payload?.author_url,
  }) || undefined;
  const canonicalUrl = resolveTikTokWatchUrl({
    videoId: normalizedVideoId,
    authorHandle,
    authorUrl,
    originalVideoUrl: videoUrl,
  }) || undefined;

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
    providerUrl: 'https://www.tiktok.com',
    embedType: trimString(payload?.embed_type) || trimString(payload?.type),
    embedHtml: trimString(payload?.html),
    embedProductId: trimString(payload?.embed_product_id),
    canonicalUrl,
  });
};

const emptyTikTokMetadata = (videoId, videoUrl) => ({
  cache: 'skip',
  meta: null,
  metadata: normalizeOriginalVideoMetadata({
    originalVideoPlatform: ORIGINAL_VIDEO_PLATFORMS.TIKTOK,
    originalVideoId: videoId,
    originalVideoUrl: videoUrl,
  }),
});

const packTikTokMetadata = (meta, videoId, videoUrl, cache) => ({
  cache,
  meta,
  metadata: normalizeOriginalVideoMetadata({
    originalVideoPlatform: ORIGINAL_VIDEO_PLATFORMS.TIKTOK,
    originalVideoId: videoId,
    originalVideoUrl: videoUrl,
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
});

const requestTikTokOEmbed = async ({ videoId, videoUrl }) => {
  const requestUrl = new URL(TIKTOK_OEMBED_URL);
  requestUrl.searchParams.set('url', videoUrl);

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
      throw new TikTokOEmbedError(
        `TikTok oEmbed request failed (${response.status}): ${details.slice(0, 200)}`,
      );
    }

    const payload = await response.json();
    return {
      meta: buildTikTokMetaFromOEmbed(payload, { videoId, videoUrl }),
    };
  } catch (error) {
    if (error instanceof TikTokOEmbedError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new TikTokOEmbedError(`TikTok oEmbed request failed: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchTikTokOriginalVideoMetadata = async ({ videoId, videoUrl, beforeUpstream } = {}) => {
  const normalizedVideoId = sanitizeTikTokVideoId(trimString(videoId)) || undefined;
  const resolvedUrl = resolveTikTokWatchUrl({
    videoId: normalizedVideoId,
    originalVideoUrl: videoUrl,
  }) || undefined;

  if (!normalizedVideoId || !resolvedUrl) {
    return emptyTikTokMetadata(normalizedVideoId, resolvedUrl);
  }

  let fetchedResult;
  const live = async () => {
    if (fetchedResult) return fetchedResult;
    if (beforeUpstream) await beforeUpstream();
    fetchedResult = await requestTikTokOEmbed({ videoId: normalizedVideoId, videoUrl: resolvedUrl });
    return fetchedResult;
  };

  try {
    const { adminDb } = await initializeFirebaseAdmin();
    if (!adminDb) {
      const fetched = await live();
      return packTikTokMetadata(fetched.meta, normalizedVideoId, resolvedUrl, 'bypass');
    }

    const cached = await resolveStoredTikTokMetadata({
      adminDb,
      videoId: normalizedVideoId,
      canonicalUrl: resolvedUrl,
      fetchMetadata: live,
    });
    return packTikTokMetadata(
      cached.meta,
      normalizedVideoId,
      cached.canonicalUrl || resolvedUrl,
      cached.cache,
    );
  } catch (error) {
    if (error instanceof TikTokOEmbedError || error?.name === 'TikTokOEmbedError' || error?.rateLimitResponse) {
      throw error;
    }
    console.error('TikTok metadata cache failed', error);
    const fetched = await live();
    return packTikTokMetadata(fetched.meta, normalizedVideoId, resolvedUrl, 'bypass');
  }
};

export const fetchOriginalVideoMetadataForPlatform = async ({
  platform,
  videoId,
  videoUrl,
  beforeUpstream,
} = {}) => {
  const normalizedPlatform = normalizeOriginalVideoPlatform(platform);

  if (normalizedPlatform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK) {
    return fetchTikTokOriginalVideoMetadata({ videoId, videoUrl, beforeUpstream });
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
