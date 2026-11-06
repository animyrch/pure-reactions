import { COLLECTION_REACTION_BINOMES, COLLECTION_YOUTUBE_COMMENT_CACHE } from '$lib/constants/firebase';
import {
  YOUTUBE_COMMENT_CACHE_LOCK_TTL_MS,
  YOUTUBE_COMMENT_FETCH_TIMEOUT_MS,
  buildCommentApiResponse,
  buildYouTubeCommentThreadUrl,
  interpretYouTubeCommentResponse,
  isFreshCommentSnapshot,
  reactionGrantsCommentLookup,
  resolveCachedYouTubeComments,
} from '$lib/helpers/youtubeCommentsCache';
import { initializeFirebaseAdmin } from '$lib/server/firebaseAdmin';

/**
 * Firestore snapshot and YouTube HTTP for comment previews.
 * Freshness, catalog matching, and response shape live in youtubeCommentsCache.js.
 */

const inflight = new Map();
const WAIT_SLICE_MS = 200;
let loggedCacheBypass = false;

function withoutNulls(value) {
  if (Array.isArray(value)) return value.map((entry) => withoutNulls(entry));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined && entry !== null)
      .map(([key, entry]) => [key, withoutNulls(entry)]),
  );
}

function logCacheBypass() {
  if (loggedCacheBypass) return;
  loggedCacheBypass = true;
  console.warn(
    'YouTube comment cache is disabled because Firebase Admin is not configured. Comment requests will not call YouTube.',
  );
}

export function createFirestoreYouTubeCommentCacheStore(
  adminDb,
  collectionName = COLLECTION_YOUTUBE_COMMENT_CACHE,
  {
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    lockTtlMs = YOUTUBE_COMMENT_CACHE_LOCK_TTL_MS,
    now = () => Date.now(),
  } = {},
) {
  const docRef = (videoId) => adminDb.collection(collectionName).doc(videoId);

  async function readRaw(videoId) {
    const snap = await docRef(videoId).get();
    return snap.exists ? snap.data() : null;
  }

  return {
    async readFresh(videoId, at) {
      const snapshot = await readRaw(videoId);
      return isFreshCommentSnapshot(snapshot, at) ? snapshot : null;
    },
    async claim(videoId, claimedAt) {
      const ref = docRef(videoId);
      const lockId = `${claimedAt}-${Math.random().toString(36).slice(2, 10)}`;
      return adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const data = snap.exists ? snap.data() : null;
        if (isFreshCommentSnapshot(data, claimedAt)) {
          return { state: 'ready', snapshot: data };
        }
        if (
          data?.status === 'pending' &&
          typeof data.lockedAt === 'number' &&
          claimedAt - data.lockedAt < lockTtlMs
        ) {
          return { state: 'pending' };
        }
        transaction.set(ref, {
          status: 'pending',
          videoId,
          lockedAt: claimedAt,
          lockId,
        });
        return { state: 'claimed', lockId };
      });
    },
    async write(videoId, snapshot, lockId) {
      const ref = docRef(videoId);
      return adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const data = snap.exists ? snap.data() : null;
        if (data?.status !== 'pending' || data.lockId !== lockId) return false;
        transaction.set(ref, withoutNulls({ ...snapshot, lockId: '', lockedAt: 0 }));
        return true;
      });
    },
    async release(videoId, lockId) {
      const ref = docRef(videoId);
      await adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) return;
        const data = snap.data();
        if (data?.status === 'pending' && data.lockId === lockId) transaction.delete(ref);
      });
    },
    async waitForFresh(videoId) {
      const deadline = now() + lockTtlMs;
      const maxSpins = Math.ceil(lockTtlMs / WAIT_SLICE_MS) + 1;
      for (let spin = 0; spin < maxSpins && now() < deadline; spin += 1) {
        await sleep(WAIT_SLICE_MS);
        const snapshot = await readRaw(videoId);
        if (isFreshCommentSnapshot(snapshot, now())) return snapshot;
        if (!snapshot || snapshot.status !== 'pending') return null;
      }
      return null;
    },
  };
}

export async function reactionGrantsStoredComments(
  adminDb,
  videoId,
  collectionName = COLLECTION_REACTION_BINOMES,
) {
  const collection = adminDb.collection(collectionName);
  const [byReaction, byOriginal] = await Promise.all([
    collection.where('reactionVideoId', '==', videoId).limit(1).get(),
    collection.where('originalVideoId', '==', videoId).limit(1).get(),
  ]);
  return [...byReaction.docs, ...byOriginal.docs].some((entry) =>
    reactionGrantsCommentLookup(entry.data(), videoId),
  );
}

async function fetchText(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    const bodyText = await response.text();
    return { ok: response.ok, status: response.status, bodyText };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchYouTubeCommentThread({
  apiKey,
  videoId,
  fetchImpl = fetch,
  timeoutMs = YOUTUBE_COMMENT_FETCH_TIMEOUT_MS,
}) {
  const url = buildYouTubeCommentThreadUrl({ apiKey, videoId });
  try {
    const { ok, status, bodyText } = await fetchText(fetchImpl, url, timeoutMs);
    if (!ok) {
      console.error('YouTube commentThreads request failed', { status, videoId });
    }
    return interpretYouTubeCommentResponse(bodyText, { ok, status, videoId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('YouTube commentThreads request failed', {
      videoId,
      message: message.replace(/key=[^&\s]+/gi, 'key=redacted'),
    });
    return { outcome: 'error', errorKind: 'timeout', comments: [] };
  }
}

function unavailableResponse() {
  return {
    status: 500,
    body: { status: 'error', error: 'Error fetching YouTube comments', comments: [] },
    headers: { 'Cache-Control': 'no-store' },
  };
}

export async function resolveStoredYouTubeComments({ videoId, apiKey }) {
  const { adminDb } = await initializeFirebaseAdmin();
  if (!adminDb) {
    logCacheBypass();
    return buildCommentApiResponse({ videoId, outcome: 'empty', comments: [], cache: 'skip' });
  }

  try {
    return await resolveCachedYouTubeComments({
      videoId,
      store: createFirestoreYouTubeCommentCacheStore(adminDb),
      isKnownVideo: (id) => reactionGrantsStoredComments(adminDb, id),
      fetchComments: (id) => fetchYouTubeCommentThread({ apiKey, videoId: id }),
      inflight,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      'YouTube comment cache failed',
      message.replace(/key=[^&\s]+/gi, 'key=redacted'),
    );
    return unavailableResponse();
  }
}
