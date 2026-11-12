import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLECTION_TIKTOK_METADATA_CACHE } from '#lib/constants/firebase.js';
import {
  TIKTOK_METADATA_CACHE_LOCK_TTL_MS,
  TIKTOK_METADATA_FRESH_MS,
  buildTikTokMetadataSnapshot,
  isFreshTikTokMetadataSnapshot,
  resolveCachedTikTokMetadata,
} from '#lib/helpers/tiktokMetadataCache.js';
import { fetchTikTokOriginalVideoMetadata } from '#lib/server/originalVideoMetadata.js';
import { createFirestoreTikTokMetadataCacheStore } from '#lib/server/tiktokMetadataCache.js';

const adminState = vi.hoisted(() => ({ adminDb: null }));

vi.mock('#lib/server/firebaseAdmin.js', () => ({
  initializeFirebaseAdmin: vi.fn(async () => ({ adminDb: adminState.adminDb })),
}));

const VIDEO_ID = '7056208472144235823';
const CANONICAL = `https://www.tiktok.com/@creator/video/${VIDEO_ID}`;
const NOW = 1_700_000_000_000;

const STORED_META = {
  videoId: VIDEO_ID,
  title: 'Stored caption',
  description: 'Stored caption',
  authorName: 'Creator',
  authorHandle: 'creator',
  authorUrl: 'https://www.tiktok.com/@creator',
  thumbnail: 'https://example.test/thumb.jpg',
  providerName: 'TikTok',
  providerUrl: 'https://www.tiktok.com',
  canonicalUrl: CANONICAL,
};

function createMemoryStore() {
  const docs = new Map();
  return {
    docs,
    async readFresh(videoId, at) {
      const snapshot = docs.get(videoId);
      return isFreshTikTokMetadataSnapshot(snapshot, at) ? snapshot : null;
    },
    async claim(videoId, claimedAt) {
      const existing = docs.get(videoId);
      if (isFreshTikTokMetadataSnapshot(existing, claimedAt)) return { state: 'ready', snapshot: existing };
      if (
        existing?.status === 'pending' &&
        typeof existing.lockedAt === 'number' &&
        claimedAt - existing.lockedAt < TIKTOK_METADATA_CACHE_LOCK_TTL_MS
      ) {
        return { state: 'pending' };
      }
      const lockId = `lock-${claimedAt}-${docs.size}`;
      docs.set(videoId, { status: 'pending', videoId, lockedAt: claimedAt, lockId });
      return { state: 'claimed', lockId };
    },
    async write(videoId, snapshot, lockId) {
      const existing = docs.get(videoId);
      if (existing?.status !== 'pending' || existing.lockId !== lockId) return false;
      docs.set(videoId, { ...snapshot });
      return true;
    },
    async release(videoId, lockId) {
      const existing = docs.get(videoId);
      if (existing?.status === 'pending' && existing.lockId === lockId) docs.delete(videoId);
    },
    async waitForFresh(videoId) {
      const snapshot = docs.get(videoId);
      return isFreshTikTokMetadataSnapshot(snapshot, NOW) ? snapshot : null;
    },
  };
}

function createFakeAdminDb() {
  const docs = new Map();
  let tail = Promise.resolve();

  function makeRef(path) {
    return {
      path,
      async get() {
        if (!docs.has(path)) return { exists: false, data: () => undefined };
        return { exists: true, data: () => structuredClone(docs.get(path)) };
      },
    };
  }

  return {
    docs,
    collection(name) {
      return {
        doc(id) {
          return makeRef(`${name}/${id}`);
        },
      };
    },
    runTransaction(fn) {
      const run = tail.then(async () => {
        const transaction = {
          async get(ref) {
            return ref.get();
          },
          set(ref, data) {
            docs.set(ref.path, structuredClone(data));
          },
          delete(ref) {
            docs.delete(ref.path);
          },
        };
        return fn(transaction);
      });
      tail = run.then(
        () => {},
        () => {},
      );
      return run;
    },
  };
}

function oEmbedPayload() {
  return {
    title: 'Live caption',
    author_name: 'Creator',
    author_unique_id: 'creator',
    author_url: 'https://www.tiktok.com/@creator',
    thumbnail_url: 'https://example.test/live.jpg',
    thumbnail_width: 720,
    thumbnail_height: 1280,
    provider_name: 'TikTok',
    provider_url: 'https://www.tiktok.com',
    type: 'video',
    html: '<blockquote>embed</blockquote>',
    embed_product_id: VIDEO_ID,
  };
}

beforeEach(() => {
  adminState.adminDb = null;
  vi.unstubAllGlobals();
});

describe('TikTok metadata snapshots', () => {
  it('treats a successful answer as fresh until expiresAt', () => {
    const snapshot = buildTikTokMetadataSnapshot({
      videoId: VIDEO_ID,
      canonicalUrl: CANONICAL,
      meta: STORED_META,
      now: NOW,
    });

    expect(snapshot.expiresAt).toBe(NOW + TIKTOK_METADATA_FRESH_MS);
    expect(isFreshTikTokMetadataSnapshot(snapshot, NOW + 1000)).toBe(true);
    expect(isFreshTikTokMetadataSnapshot(snapshot, snapshot.expiresAt)).toBe(false);
    expect(snapshot.meta).toEqual(STORED_META);
    expect(snapshot).not.toHaveProperty('errorBody');
  });

  it('serves a fresh snapshot without calling TikTok', async () => {
    const store = createMemoryStore();
    store.docs.set(
      VIDEO_ID,
      buildTikTokMetadataSnapshot({
        videoId: VIDEO_ID,
        canonicalUrl: CANONICAL,
        meta: STORED_META,
        now: NOW,
      }),
    );
    const fetchMetadata = vi.fn();

    const result = await resolveCachedTikTokMetadata({
      videoId: VIDEO_ID,
      canonicalUrl: CANONICAL,
      store,
      fetchMetadata,
      inflight: new Map(),
      now: () => NOW + 60_000,
    });

    expect(result.cache).toBe('hit');
    expect(result.meta.title).toBe('Stored caption');
    expect(fetchMetadata).not.toHaveBeenCalled();
  });

  it('stores a successful answer and does not store a failed one', async () => {
    const store = createMemoryStore();
    const fetchMetadata = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('TikTok oEmbed request failed (404): secret-body'), { name: 'TikTokOEmbedError' }))
      .mockResolvedValueOnce({ meta: STORED_META });

    await expect(
      resolveCachedTikTokMetadata({
        videoId: VIDEO_ID,
        canonicalUrl: CANONICAL,
        store,
        fetchMetadata,
        inflight: new Map(),
        now: () => NOW,
      }),
    ).rejects.toThrow(/404/);
    expect(store.docs.has(VIDEO_ID)).toBe(false);

    const saved = await resolveCachedTikTokMetadata({
      videoId: VIDEO_ID,
      canonicalUrl: CANONICAL,
      store,
      fetchMetadata,
      inflight: new Map(),
      now: () => NOW,
    });

    expect(saved.cache).toBe('miss');
    const stored = store.docs.get(VIDEO_ID);
    expect(stored.outcome).toBe('ok');
    expect(stored.meta).toEqual(STORED_META);
    expect(JSON.stringify(stored)).not.toContain('secret-body');
  });
});

describe('fetchTikTokOriginalVideoMetadata cache', () => {
  it('does not call TikTok when the video id is not a TikTok id', async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);

    const result = await fetchTikTokOriginalVideoMetadata({
      videoId: 'not-a-video',
      videoUrl: CANONICAL,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.cache).toBe('skip');
    expect(result.meta).toBeNull();
  });

  it('returns the fetched answer when the cache write fails', async () => {
    const adminDb = createFakeAdminDb();
    const runTransaction = adminDb.runTransaction.bind(adminDb);
    adminDb.runTransaction = (fn) =>
      runTransaction(async (transaction) => {
        const set = transaction.set.bind(transaction);
        transaction.set = (ref, data) => {
          if (data?.outcome === 'ok') throw new Error('cache write failed');
          set(ref, data);
        };
        return fn(transaction);
      });
    adminState.adminDb = adminDb;
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => oEmbedPayload(),
      text: async () => '',
    }));
    vi.stubGlobal('fetch', fetchImpl);

    const result = await fetchTikTokOriginalVideoMetadata({
      videoId: VIDEO_ID,
      videoUrl: CANONICAL,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.cache).toBe('bypass');
    expect(result.meta.title).toBe('Live caption');
  });

  it('calls TikTok when Firebase Admin is not configured', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => oEmbedPayload(),
      text: async () => '',
    }));
    vi.stubGlobal('fetch', fetchImpl);

    const result = await fetchTikTokOriginalVideoMetadata({
      videoId: VIDEO_ID,
      videoUrl: CANONICAL,
    });

    expect(result.cache).toBe('bypass');
    expect(result.meta.title).toBe('Live caption');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reuses a stored answer and does not call TikTok again', async () => {
    const adminDb = createFakeAdminDb();
    adminState.adminDb = adminDb;
    const store = createFirestoreTikTokMetadataCacheStore(adminDb, COLLECTION_TIKTOK_METADATA_CACHE);
    await adminDb.collection(COLLECTION_TIKTOK_METADATA_CACHE).doc(VIDEO_ID);
    adminDb.docs.set(
      `${COLLECTION_TIKTOK_METADATA_CACHE}/${VIDEO_ID}`,
      buildTikTokMetadataSnapshot({
        videoId: VIDEO_ID,
        canonicalUrl: CANONICAL,
        meta: STORED_META,
        now: Date.now(),
      }),
    );
    expect(store).toBeTruthy();

    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);

    const first = await fetchTikTokOriginalVideoMetadata({
      videoId: VIDEO_ID,
      videoUrl: CANONICAL,
    });
    const second = await fetchTikTokOriginalVideoMetadata({
      videoId: VIDEO_ID,
      videoUrl: CANONICAL,
    });

    expect(first.cache).toBe('hit');
    expect(second.cache).toBe('hit');
    expect(first.meta.title).toBe('Stored caption');
    expect(first.metadata.title).toBe('Stored caption');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('saves the first successful oEmbed answer under the video id', async () => {
    adminState.adminDb = createFakeAdminDb();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => oEmbedPayload(),
      text: async () => '',
    }));
    vi.stubGlobal('fetch', fetchImpl);

    const first = await fetchTikTokOriginalVideoMetadata({
      videoId: VIDEO_ID,
      videoUrl: CANONICAL,
    });
    const second = await fetchTikTokOriginalVideoMetadata({
      videoId: VIDEO_ID,
      videoUrl: CANONICAL,
    });

    expect(first.cache).toBe('miss');
    expect(second.cache).toBe('hit');
    expect(second.meta.title).toBe('Live caption');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const stored = adminState.adminDb.docs.get(`${COLLECTION_TIKTOK_METADATA_CACHE}/${VIDEO_ID}`);
    expect(stored.outcome).toBe('ok');
    expect(stored.meta.embedHtml).toBe('<blockquote>embed</blockquote>');
    expect(stored.expiresAt).toBeGreaterThan(stored.fetchedAt);
  });
});
