#!/usr/bin/env node

import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// Options (env vars):
// - FIREBASE_SERVICE_ACCOUNT: JSON string or file path (required)
// - YOUTUBE_API_KEY: YouTube Data API v3 key (required)
// - PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES: collection name (default: reactions-prod)
// - ENRICHMENT_LIMIT: max docs per run (default: 1000)
const DEFAULT_COLLECTION = 'reactions-prod';
const DEFAULT_LIMIT = 1000;
const ENRICHMENT_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/videos';
const YOUTUBE_TIMEOUT_MS = 8000;

function loadDotEnvIfPresent(envPath = '.env') {
  const abs = path.resolve(process.cwd(), envPath);
  if (!fs.existsSync(abs)) return;

  const raw = fs.readFileSync(abs, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function resolveServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is required (JSON string or file path).');
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is empty.');
  }

  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }

  const abs = path.resolve(process.cwd(), trimmed);
  if (!fs.existsSync(abs)) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT path not found: ${abs}`);
  }

  const content = fs.readFileSync(abs, 'utf8');
  return JSON.parse(content);
}

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

function parseIsoDurationToSeconds(duration) {
  if (typeof duration !== 'string') return null;
  const match = duration.match(/^P(?:(\\d+)D)?(?:T(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?)?$/);
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
    console.error('Missing YOUTUBE_API_KEY for YouTube enrichment', { youtubeId });
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
      console.warn('YouTube API request failed', { youtubeId, status, body: body.slice(0, 200) });
      return null;
    }

    const payload = await response.json();
    const item = payload?.items?.[0];
    if (!item) {
      console.warn('YouTube API returned no items', { youtubeId });
      return null;
    }

    return { snippet: item.snippet, contentDetails: item.contentDetails };
  } catch (error) {
    console.warn('YouTube API request error', { youtubeId, error: error?.message, type: error?.name });
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

async function enrichDoc(doc) {
  const data = doc.data();
  const youtubeId = getYoutubeId(data);
  const originalYoutubeId = getOriginalYoutubeId(data);

  if (!youtubeId && !originalYoutubeId) {
    return { updated: false, reason: 'missing-youtube-id' };
  }

  const meta = data?.youtube?.meta;
  const originalMeta = data?.originalYoutube?.meta;
  const reactionNeedsUpdate =
    Boolean(youtubeId) && (!isMetaComplete(meta, youtubeId) && (isStale(data?.lastEnrichedAt) || !meta));
  const originalNeedsUpdate =
    Boolean(originalYoutubeId) &&
    (!isMetaComplete(originalMeta, originalYoutubeId) &&
      (isStale(data?.originalYoutube?.lastEnrichedAt) || !originalMeta));

  if (!reactionNeedsUpdate && !originalNeedsUpdate) {
    return { updated: false, reason: 'meta-fresh' };
  }

  let reactionResponse = null;
  let originalResponse = null;

  if (reactionNeedsUpdate) {
    reactionResponse = await fetchYoutubeMeta(youtubeId);
  }

  if (originalNeedsUpdate) {
    if (originalYoutubeId === youtubeId && reactionResponse) {
      originalResponse = reactionResponse;
    } else {
      originalResponse = await fetchYoutubeMeta(originalYoutubeId);
    }
  }

  const updates = {};
  if (reactionResponse) {
    const newMeta = buildMetaFromResponse(reactionResponse, youtubeId);
    if (Object.keys(newMeta).length > 0) {
      updates.youtube = { meta: newMeta };
      updates.lastEnrichedAt = admin.firestore.FieldValue.serverTimestamp();
    }
  }

  if (originalResponse) {
    const newMeta = buildMetaFromResponse(originalResponse, originalYoutubeId);
    if (Object.keys(newMeta).length > 0) {
      updates.originalYoutube = {
        meta: newMeta,
        lastEnrichedAt: admin.firestore.FieldValue.serverTimestamp()
      };
    }
  }

  if (Object.keys(updates).length === 0) {
    return { updated: false, reason: 'youtube-fetch-failed' };
  }

  await doc.ref.set(updates, { merge: true });

  return { updated: true, reason: 'updated' };
}

async function run() {
  loadDotEnvIfPresent('.env');

  const collection = process.env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES || DEFAULT_COLLECTION;
  const limit = Number(process.env.ENRICHMENT_LIMIT || DEFAULT_LIMIT);
  const serviceAccount = resolveServiceAccount();

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id
    });
  }

  const db = admin.firestore();

  let snapshot = await db.collection(collection).where('isPublished', '==', true).limit(limit).get();
  if (snapshot.empty) {
    snapshot = await db.collection(collection).where('published', '==', true).limit(limit).get();
  }

  if (snapshot.empty) {
    console.log(`[enrich-youtube] No published docs found in ${collection}`);
    return;
  }

  let updated = 0;
  let skipped = 0;
  const reasons = {};

  for (const doc of snapshot.docs) {
    const result = await enrichDoc(doc);
    if (result.updated) {
      updated += 1;
      continue;
    }
    skipped += 1;
    reasons[result.reason] = (reasons[result.reason] || 0) + 1;
  }

  console.log(`[enrich-youtube] Collection=${collection} scanned=${snapshot.size} updated=${updated} skipped=${skipped}`);
  console.log('[enrich-youtube] Skip reasons:', reasons);
}

run().catch((error) => {
  console.error('[enrich-youtube] Failed:', error);
  process.exitCode = 1;
});
