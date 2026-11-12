import { COLLECTION_TIKTOK_METADATA_CACHE } from '#lib/constants/firebase.js';
import {
  TIKTOK_METADATA_CACHE_LOCK_TTL_MS,
  isFreshTikTokMetadataSnapshot,
  resolveCachedTikTokMetadata,
} from '#lib/helpers/tiktokMetadataCache.js';

/**
 * Firestore snapshot for TikTok oEmbed answers.
 * Freshness and response shape live in tiktokMetadataCache.js.
 * Client SDKs cannot read this collection. The Admin SDK is the only writer.
 */

const inflight = new Map();
const WAIT_SLICE_MS = 200;

function withoutNulls(value) {
  if (Array.isArray(value)) return value.map((entry) => withoutNulls(entry));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined && entry !== null)
      .map(([key, entry]) => [key, withoutNulls(entry)]),
  );
}

export function createFirestoreTikTokMetadataCacheStore(
  adminDb,
  collectionName = COLLECTION_TIKTOK_METADATA_CACHE,
  {
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    lockTtlMs = TIKTOK_METADATA_CACHE_LOCK_TTL_MS,
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
      return isFreshTikTokMetadataSnapshot(snapshot, at) ? snapshot : null;
    },
    async claim(videoId, claimedAt) {
      const ref = docRef(videoId);
      const lockId = `${claimedAt}-${Math.random().toString(36).slice(2, 10)}`;
      return adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const data = snap.exists ? snap.data() : null;
        if (isFreshTikTokMetadataSnapshot(data, claimedAt)) {
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
        if (isFreshTikTokMetadataSnapshot(snapshot, now())) return snapshot;
        if (!snapshot || snapshot.status !== 'pending') return null;
      }
      return null;
    },
  };
}

export async function resolveStoredTikTokMetadata({ adminDb, videoId, canonicalUrl, fetchMetadata }) {
  return resolveCachedTikTokMetadata({
    videoId,
    canonicalUrl,
    store: createFirestoreTikTokMetadataCacheStore(adminDb),
    fetchMetadata,
    inflight,
  });
}
