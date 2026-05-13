import { normalizeOriginalVideoPlatform } from '$lib/helpers/platform';
import { originalVideoMetadataToFirestoreFields } from '$lib/helpers/originalVideo';
import { fetchTikTokOriginalVideoMetadata } from '$lib/server/originalVideoMetadata';

const ENRICHMENT_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/videos';
const YOUTUBE_TIMEOUT_MS = 8000;

function getYoutubeId(data) {
  const candidates = [data?.youtubeId, data?.youtube?.id, data?.reactionVideoId];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function getOriginalYoutubeId(data) {
  const candidates = [data?.originalVideoId, data?.originalYoutube?.id, data?.originalYoutube?.meta?.videoId];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function getOriginalTikTokId(data) {
  const candidates = [data?.originalVideoId, data?.originalTikTok?.meta?.videoId];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return date;
  }
  return null;
}

function isStale(lastEnrichedAt) {
  const date = toDate(lastEnrichedAt);
  if (!date) return true;
  return Date.now() - date.getTime() > ENRICHMENT_TTL_MS;
}

function isMetaComplete(meta, youtubeId) {
  if (!meta || typeof meta !== 'object') return false;
  if (meta.videoId && youtubeId && meta.videoId !== youtubeId) return false;
  if (!meta.title || !meta.thumbnail || !meta.publishedAt) return false;
  if (!Number.isFinite(meta.durationSeconds)) return false;
  if (!meta.description) return false;
  return true;
}

function isTikTokMetaComplete(meta, videoId) {
  if (!meta || typeof meta !== 'object') return false;
  if (meta.videoId && videoId && meta.videoId !== videoId) return false;
  if (!meta.title || !meta.thumbnail || !meta.authorUrl) return false;
  return true;
}

function parseIsoDurationToSeconds(duration) {
  if (typeof duration !== 'string') return null;
  const match = duration.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return null;
  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function pickLargestThumbnail(thumbnails) {
  if (!thumbnails || typeof thumbnails !== 'object') return null;
  const candidates = Object.values(thumbnails).filter((thumb) => thumb && typeof thumb.url === 'string');
  if (!candidates.length) return null;

  const scored = candidates.map((thumb) => {
    const width = typeof thumb.width === 'number' ? thumb.width : 0;
    const height = typeof thumb.height === 'number' ? thumb.height : 0;
    const area = width > 0 && height > 0 ? width * height : 0;
    const withinTarget = width <= 1280 && height <= 720 && area > 0;
    return { ...thumb, area, withinTarget };
  });

  const preferred = scored.filter((thumb) => thumb.withinTarget);
  const list = preferred.length ? preferred : scored;
  list.sort((a, b) => b.area - a.area);
  return list[0]?.url || null;
}

async function fetchYoutubeMeta(youtubeId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing YOUTUBE_API_KEY for YouTube enrichment.');
  }

  const url = new URL(YOUTUBE_API_URL);
  url.searchParams.set('part', 'snippet,contentDetails');
  url.searchParams.set('id', youtubeId);
  url.searchParams.set('key', apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YOUTUBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`YouTube API request failed (${response.status}): ${body.slice(0, 200)}`);
    }

    const payload = await response.json();
    const item = payload?.items?.[0];
    if (!item) {
      return null;
    }

    return { snippet: item.snippet, contentDetails: item.contentDetails };
  } finally {
    clearTimeout(timeout);
  }
}

function compactMeta(meta) {
  const cleaned = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

function buildMetaFromResponse(response, youtubeId) {
  const snippet = response?.snippet || {};
  const contentDetails = response?.contentDetails || {};
  const durationSeconds = parseIsoDurationToSeconds(contentDetails.duration);
  const thumbnail = pickLargestThumbnail(snippet.thumbnails);

  return compactMeta({
    videoId: youtubeId,
    title: snippet.title,
    description: snippet.description,
    thumbnail,
    publishedAt: snippet.publishedAt,
    durationSeconds
  });
}

export async function enrichReactionDocument({ adminDb, adminFieldValue, collectionName, reactionId, force = false }) {
  const docRef = adminDb.collection(collectionName).doc(reactionId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    return { found: false, updated: false, reason: 'not-found' };
  }

  const data = snapshot.data();
  const reactionYoutubeId = getYoutubeId(data);
  const originalPlatform = normalizeOriginalVideoPlatform(data?.originalVideoPlatform);
  const originalYoutubeId = originalPlatform === 'youtube' ? getOriginalYoutubeId(data) : null;
  const originalTikTokId = originalPlatform === 'tiktok' ? getOriginalTikTokId(data) : null;

  if (!reactionYoutubeId && !originalYoutubeId && !originalTikTokId) {
    return { found: true, updated: false, reason: 'missing-youtube-id' };
  }

  const reactionNeedsUpdate =
    Boolean(reactionYoutubeId) &&
    (force || !isMetaComplete(data?.youtube?.meta, reactionYoutubeId) || isStale(data?.lastEnrichedAt));

  const originalNeedsUpdate =
    originalPlatform === 'youtube'
      ? Boolean(originalYoutubeId) &&
        (force || !isMetaComplete(data?.originalYoutube?.meta, originalYoutubeId) ||
          isStale(data?.originalYoutube?.lastEnrichedAt))
      : Boolean(originalTikTokId) &&
        (force || !isTikTokMetaComplete(data?.originalTikTok?.meta, originalTikTokId) ||
          isStale(data?.originalTikTok?.lastEnrichedAt));

  if (!reactionNeedsUpdate && !originalNeedsUpdate) {
    return { found: true, updated: false, reason: 'meta-fresh' };
  }

  let reactionResponse = null;
  let originalResponse = null;
  let originalTikTokResponse = null;

  if (reactionNeedsUpdate) {
    reactionResponse = await fetchYoutubeMeta(reactionYoutubeId);
  }

  if (originalNeedsUpdate) {
    if (originalPlatform === 'youtube') {
      if (originalYoutubeId === reactionYoutubeId && reactionResponse) {
        originalResponse = reactionResponse;
      } else {
        originalResponse = await fetchYoutubeMeta(originalYoutubeId);
      }
    } else {
      originalTikTokResponse = await fetchTikTokOriginalVideoMetadata({
        videoId: originalTikTokId,
        videoUrl: data?.originalVideoUrl,
      });
    }
  }

  const updates = {};
  if (reactionResponse) {
    const meta = buildMetaFromResponse(reactionResponse, reactionYoutubeId);
    if (Object.keys(meta).length > 0) {
      updates.youtube = { meta };
      updates.lastEnrichedAt = adminFieldValue.serverTimestamp();
    }
  }

  if (originalResponse) {
    const meta = buildMetaFromResponse(originalResponse, originalYoutubeId);
    if (Object.keys(meta).length > 0) {
      updates.originalYoutube = {
        meta,
        lastEnrichedAt: adminFieldValue.serverTimestamp()
      };
    }
  }

  if (originalTikTokResponse?.meta && Object.keys(originalTikTokResponse.meta).length > 0) {
    updates.originalTikTok = {
      meta: originalTikTokResponse.meta,
      lastEnrichedAt: adminFieldValue.serverTimestamp()
    };
    Object.assign(updates, originalVideoMetadataToFirestoreFields(originalTikTokResponse.metadata));
  }

  if (Object.keys(updates).length === 0) {
    return { found: true, updated: false, reason: 'no-updates' };
  }

  await docRef.set(updates, { merge: true });

  return {
    found: true,
    updated: true,
    reason: 'enriched',
    reactionYoutubeId,
    originalYoutubeId,
    originalTikTokId
  };
}