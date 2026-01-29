import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue } from 'firebase-admin/firestore';

initializeApp();

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
  return true;
}

function shouldEnrich(afterData, beforeData, youtubeId) {
  if (!youtubeId) return false;

  const meta = afterData?.youtube?.meta;
  const metaComplete = isMetaComplete(meta, youtubeId);
  const stale = isStale(afterData?.lastEnrichedAt);

  const beforeId = getYoutubeId(beforeData);
  const idChanged = Boolean(beforeData && beforeId && beforeId !== youtubeId);
  const metaIdMismatch = Boolean(meta?.videoId && meta.videoId !== youtubeId);
  const missingInitialMeta = !metaComplete && !afterData?.lastEnrichedAt;

  return idChanged || metaIdMismatch || stale || missingInitialMeta;
}

function shouldEnrichOriginal(afterData, beforeData, youtubeId) {
  if (!youtubeId) return false;

  const meta = afterData?.originalYoutube?.meta;
  const metaComplete = isMetaComplete(meta, youtubeId);
  const stale = isStale(afterData?.originalYoutube?.lastEnrichedAt);

  const beforeId = getOriginalYoutubeId(beforeData);
  const idChanged = Boolean(beforeData && beforeId && beforeId !== youtubeId);
  const metaIdMismatch = Boolean(meta?.videoId && meta.videoId !== youtubeId);
  const missingInitialMeta = !metaComplete && !afterData?.originalYoutube?.lastEnrichedAt;

  return idChanged || metaIdMismatch || stale || missingInitialMeta;
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
    logger.error('Missing YOUTUBE_API_KEY for YouTube enrichment', { youtubeId });
    return null;
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
      const status = response.status;
      const body = await response.text().catch(() => '');
      const isTransient = status === 429 || status >= 500;
      const log = isTransient ? logger.warn : logger.error;
      log('YouTube API request failed', {
        youtubeId,
        status,
        body: body.slice(0, 200)
      });
      return null;
    }

    const payload = await response.json();
    const item = payload?.items?.[0];
    if (!item) {
      logger.warn('YouTube API returned no items', { youtubeId });
      return null;
    }

    return { snippet: item.snippet, contentDetails: item.contentDetails };
  } catch (error) {
    logger.warn('YouTube API request error', {
      youtubeId,
      error: error?.message,
      type: error?.name
    });
    return null;
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

async function enrichReaction(snapshot, beforeData) {
  const afterData = snapshot.data();
  if (!afterData) return;

  const reactionYoutubeId = getYoutubeId(afterData);
  const originalYoutubeId = getOriginalYoutubeId(afterData);
  const shouldEnrichReaction = reactionYoutubeId && shouldEnrich(afterData, beforeData, reactionYoutubeId);
  const shouldEnrichOriginalMeta = originalYoutubeId && shouldEnrichOriginal(afterData, beforeData, originalYoutubeId);

  if (!shouldEnrichReaction && !shouldEnrichOriginalMeta) return;

  logger.info('Enriching YouTube metadata', {
    reactionId: snapshot.id,
    reactionYoutubeId,
    originalYoutubeId,
    shouldEnrichReaction,
    shouldEnrichOriginal: shouldEnrichOriginalMeta
  });

  let reactionResponse = null;
  let originalResponse = null;

  if (shouldEnrichReaction) {
    reactionResponse = await fetchYoutubeMeta(reactionYoutubeId);
  }

  if (shouldEnrichOriginalMeta) {
    if (originalYoutubeId === reactionYoutubeId && reactionResponse) {
      originalResponse = reactionResponse;
    } else {
      originalResponse = await fetchYoutubeMeta(originalYoutubeId);
    }
  }

  const updates = {};
  if (reactionResponse) {
    const meta = buildMetaFromResponse(reactionResponse, reactionYoutubeId);
    if (Object.keys(meta).length > 0) {
      updates.youtube = { meta };
      updates.lastEnrichedAt = FieldValue.serverTimestamp();
    }
  }

  if (originalResponse) {
    const meta = buildMetaFromResponse(originalResponse, originalYoutubeId);
    if (Object.keys(meta).length > 0) {
      updates.originalYoutube = {
        meta,
        lastEnrichedAt: FieldValue.serverTimestamp()
      };
    }
  }

  if (Object.keys(updates).length === 0) return;

  await snapshot.ref.set(updates, { merge: true });
}

export const enrichReactionYoutubeOnCreate = onDocumentCreated('reactions/{id}', async (event) => {
  if (!event?.data) return;
  await enrichReaction(event.data, null);
});

export const enrichReactionYoutubeOnUpdate = onDocumentUpdated('reactions/{id}', async (event) => {
  if (!event?.data) return;
  await enrichReaction(event.data.after, event.data.before?.data?.());
});
