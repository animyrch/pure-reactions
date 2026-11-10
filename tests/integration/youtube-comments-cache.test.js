import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../src/routes/api/youtube/comments/[videoId]/+server.js';
import { COLLECTION_REACTION_BINOMES, COLLECTION_YOUTUBE_COMMENT_CACHE } from '$lib/constants/firebase';
import {
  YOUTUBE_COMMENT_CACHE_CONTROL,
  YOUTUBE_COMMENT_CACHE_LOCK_TTL_MS,
  YOUTUBE_COMMENT_ERROR_MS,
  YOUTUBE_COMMENT_FETCH_TIMEOUT_MS,
  YOUTUBE_COMMENT_FRESH_MS,
  YOUTUBE_COMMENT_QUIET_MS,
  buildYouTubeCommentThreadUrl,
  interpretYouTubeCommentResponse,
  isFreshCommentSnapshot,
  prepareYouTubeCommentsResponse,
  reactionGrantsCommentLookup,
  resolveCachedYouTubeComments,
} from '$lib/helpers/youtubeCommentsCache';
import {
  createFirestoreYouTubeCommentCacheStore,
  fetchYouTubeCommentThread,
  reactionGrantsStoredComments,
  resolveStoredYouTubeComments,
} from '$lib/server/youtubeCommentsCache';

const adminState = vi.hoisted(() => ({ adminDb: null }));

vi.mock('$env/dynamic/private', () => ({
  env: {},
}));

vi.mock('$lib/server/firebaseAdmin', () => ({
  initializeFirebaseAdmin: vi.fn(async () => ({ adminDb: adminState.adminDb })),
}));

const VIDEO_ID = 'abcdefghijk';
const OTHER_VIDEO_ID = 'bcdefghijkl';
const TIKTOK_ID = '7056208472144235823';
const API_KEY = 'secret-api-key';
const UPSTREAM_BODY = 'dailyLimitExceeded super-secret-upstream-body';

function thread(index) {
  return {
    id: `thread-${index}`,
    snippet: {
      totalReplyCount: index,
      topLevelComment: {
        id: `comment-${index}`,
        snippet: {
          authorDisplayName: `Viewer ${index}`,
          authorChannelUrl: 'https://www.youtube.com/channel/UC1',
          authorProfileImageUrl: 'https://yt3.ggpht.com/a',
          textDisplay: `Hello ${index}`,
          textOriginal: `Hello ${index}`,
          publishedAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          likeCount: index,
          viewerRating: 'none',
          authorChannelId: { value: 'UC1' },
        },
      },
    },
  };
}

function successBody(count = 1) {
  return JSON.stringify({ items: Array.from({ length: count }, (_, index) => thread(index + 1)) });
}

function createMemoryStore() {
  const docs = new Map();
  return {
    docs,
    async readFresh(videoId, at) {
      const snapshot = docs.get(videoId);
      return isFreshCommentSnapshot(snapshot, at) ? snapshot : null;
    },
    async claim(videoId, claimedAt) {
      const existing = docs.get(videoId);
      if (isFreshCommentSnapshot(existing, claimedAt)) return { state: 'ready', snapshot: existing };
      if (
        existing?.status === 'pending' &&
        typeof existing.lockedAt === 'number' &&
        claimedAt - existing.lockedAt < YOUTUBE_COMMENT_CACHE_LOCK_TTL_MS
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
      return isFreshCommentSnapshot(snapshot, snapshot?.fetchedAt ?? 0) ? snapshot : null;
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

  function isDirectChild(path, prefix) {
    if (!path.startsWith(`${prefix}/`)) return false;
    return !path.slice(prefix.length + 1).includes('/');
  }

  function collection(prefix) {
    return {
      doc(id) {
        return makeRef(`${prefix}/${id}`);
      },
      where(field, _op, value) {
        const filters = [[field, value]];
        const query = {
          where(nextField, _nextOp, nextValue) {
            filters.push([nextField, nextValue]);
            return query;
          },
          limit(count) {
            const matched = [];
            for (const [path, data] of docs.entries()) {
              const matches = filters.every(([key, expected]) => data?.[key] === expected);
              if (isDirectChild(path, prefix) && matches) matched.push(data);
            }
            const rows = matched.slice(0, count);
            return {
              async get() {
                return {
                  empty: rows.length === 0,
                  docs: rows.map((data) => ({ data: () => structuredClone(data) })),
                };
              },
            };
          },
        };
        return query;
      },
    };
  }

  return {
    docs,
    collection(name) {
      return collection(name);
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

function seedReaction(adminDb, id, data) {
  adminDb.docs.set(`${COLLECTION_REACTION_BINOMES}/${id}`, data);
}

beforeEach(() => {
  adminState.adminDb = null;
  vi.unstubAllGlobals();
});

describe('YouTube comment snapshots', () => {
  it('rejects a video id before calling YouTube', async () => {
    const resolve = vi.fn();
    const response = await prepareYouTubeCommentsResponse({
      videoId: 'bad id',
      apiKey: API_KEY,
      resolve,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ status: 'error', error: 'Invalid video ID', comments: [] });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('returns placeholder comments when no API key is configured', async () => {
    const resolve = vi.fn();
    const response = await prepareYouTubeCommentsResponse({
      videoId: VIDEO_ID,
      apiKey: '',
      resolve,
    });

    expect(response.status).toBe(200);
    expect(response.body.isPlaceholder).toBe(true);
    expect(response.body.comments).toHaveLength(3);
    expect(response.headers['Cache-Control']).toBe(YOUTUBE_COMMENT_CACHE_CONTROL);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('serves a fresh snapshot without checking the catalog or calling YouTube', async () => {
    const store = createMemoryStore();
    const now = 1_000;
    store.docs.set(VIDEO_ID, {
      status: 'ready',
      videoId: VIDEO_ID,
      outcome: 'ok',
      comments: [
        {
          threadId: 'thread-1',
          commentId: 'comment-1',
          authorDisplayName: 'Stored',
          textDisplay: 'Kept',
          likeCount: 2,
          replyCount: 1,
        },
      ],
      fetchedAt: now,
      expiresAt: now + YOUTUBE_COMMENT_FRESH_MS,
    });
    const fetchComments = vi.fn();
    const isKnownVideo = vi.fn();

    const response = await resolveCachedYouTubeComments({
      videoId: VIDEO_ID,
      store,
      isKnownVideo,
      fetchComments,
      inflight: new Map(),
      now: () => now + 60_000,
    });

    expect(response.headers['x-youtube-comment-cache']).toBe('hit');
    expect(response.body.comments[0].textDisplay).toBe('Kept');
    expect(response.body.comments[0].viewThreadUrl).toBe(
      'https://www.youtube.com/watch?v=abcdefghijk&lc=comment-1',
    );
    expect(fetchComments).not.toHaveBeenCalled();
    expect(isKnownVideo).not.toHaveBeenCalled();
  });

  it('returns an empty preview for an unknown video and does not store it', async () => {
    const store = createMemoryStore();
    const fetchComments = vi.fn();

    const response = await resolveCachedYouTubeComments({
      videoId: VIDEO_ID,
      store,
      isKnownVideo: async () => false,
      fetchComments,
      inflight: new Map(),
      now: () => 5_000,
    });

    expect(response.headers['x-youtube-comment-cache']).toBe('skip');
    expect(response.headers['Cache-Control']).toBe('no-store');
    expect(response.body.status).toBe('empty');
    expect(fetchComments).not.toHaveBeenCalled();
    expect(store.docs.size).toBe(0);
  });

  it('fetches a reaction video once and then serves the snapshot', async () => {
    const store = createMemoryStore();
    const fetchComments = vi.fn(async () =>
      interpretYouTubeCommentResponse(successBody(), { ok: true, status: 200, videoId: VIDEO_ID }),
    );
    const request = {
      videoId: VIDEO_ID,
      store,
      isKnownVideo: async () => true,
      fetchComments,
      now: () => 10_000,
    };

    const miss = await resolveCachedYouTubeComments({ ...request, inflight: new Map() });
    const hit = await resolveCachedYouTubeComments({ ...request, inflight: new Map() });

    expect(miss.headers['x-youtube-comment-cache']).toBe('miss');
    expect(hit.headers['x-youtube-comment-cache']).toBe('hit');
    expect(hit.headers['Cache-Control']).toBe(YOUTUBE_COMMENT_CACHE_CONTROL);
    expect(fetchComments).toHaveBeenCalledTimes(1);
    expect(hit.body.comments).toHaveLength(1);
    expect(hit.body.comments[0].authorDisplayName).toBe('Viewer 1');
    const stored = store.docs.get(VIDEO_ID);
    expect(stored.comments[0].viewerRating).toBeUndefined();
    expect(stored.comments[0].textOriginal).toBeUndefined();
    expect(stored.comments[0].viewThreadUrl).toBeUndefined();
    expect(JSON.stringify(stored)).not.toContain(API_KEY);
    expect(stored.expiresAt - stored.fetchedAt).toBe(YOUTUBE_COMMENT_FRESH_MS);
  });

  it('refetches a normal snapshot after one day', async () => {
    const store = createMemoryStore();
    const now = 20_000;
    store.docs.set(VIDEO_ID, {
      status: 'ready',
      videoId: VIDEO_ID,
      outcome: 'ok',
      comments: [],
      fetchedAt: now,
      expiresAt: now + YOUTUBE_COMMENT_FRESH_MS,
    });
    const fetchComments = vi.fn(async () =>
      interpretYouTubeCommentResponse(successBody(), { ok: true, status: 200, videoId: VIDEO_ID }),
    );

    const response = await resolveCachedYouTubeComments({
      videoId: VIDEO_ID,
      store,
      isKnownVideo: async () => true,
      fetchComments,
      inflight: new Map(),
      now: () => now + YOUTUBE_COMMENT_FRESH_MS,
    });

    expect(response.headers['x-youtube-comment-cache']).toBe('miss');
    expect(fetchComments).toHaveBeenCalledTimes(1);
  });

  it('keeps disabled comments for seven days', async () => {
    const store = createMemoryStore();
    const now = 30_000;
    store.docs.set(VIDEO_ID, {
      status: 'ready',
      videoId: VIDEO_ID,
      outcome: 'commentsDisabled',
      comments: [],
      fetchedAt: now,
      expiresAt: now + YOUTUBE_COMMENT_QUIET_MS,
    });
    const fetchComments = vi.fn(async () => ({ outcome: 'ok', comments: [] }));

    const during = await resolveCachedYouTubeComments({
      videoId: VIDEO_ID,
      store,
      isKnownVideo: async () => true,
      fetchComments,
      inflight: new Map(),
      now: () => now + 2 * 24 * 60 * 60 * 1000,
    });
    const after = await resolveCachedYouTubeComments({
      videoId: VIDEO_ID,
      store,
      isKnownVideo: async () => true,
      fetchComments,
      inflight: new Map(),
      now: () => now + YOUTUBE_COMMENT_QUIET_MS,
    });

    expect(during.body.status).toBe('commentsDisabled');
    expect(during.headers['x-youtube-comment-cache']).toBe('hit');
    expect(after.headers['x-youtube-comment-cache']).toBe('miss');
    expect(fetchComments).toHaveBeenCalledTimes(1);
  });

  it('remembers a quota failure for ten minutes and hides the upstream body', async () => {
    const store = createMemoryStore();
    const quotaBody = JSON.stringify({
      error: { errors: [{ reason: 'quotaExceeded', message: UPSTREAM_BODY }], message: UPSTREAM_BODY },
    });
    const fetchComments = vi
      .fn()
      .mockResolvedValueOnce(
        interpretYouTubeCommentResponse(quotaBody, { ok: false, status: 403, videoId: VIDEO_ID }),
      )
      .mockResolvedValueOnce(
        interpretYouTubeCommentResponse(successBody(), { ok: true, status: 200, videoId: VIDEO_ID }),
      );
    const now = 40_000;

    const failed = await resolveCachedYouTubeComments({
      videoId: VIDEO_ID,
      store,
      isKnownVideo: async () => true,
      fetchComments,
      inflight: new Map(),
      now: () => now,
    });
    const held = await resolveCachedYouTubeComments({
      videoId: VIDEO_ID,
      store,
      isKnownVideo: async () => true,
      fetchComments,
      inflight: new Map(),
      now: () => now + YOUTUBE_COMMENT_ERROR_MS - 1,
    });

    expect(failed.body.status).toBe('error');
    expect(failed.headers['Cache-Control']).toBe('no-store');
    expect(JSON.stringify(failed.body)).not.toContain(UPSTREAM_BODY);
    expect(failed.body.errorKind).toBeUndefined();
    expect(held.headers['x-youtube-comment-cache']).toBe('hit');
    expect(store.docs.get(VIDEO_ID).errorKind).toBe('quota');

    const retried = await resolveCachedYouTubeComments({
      videoId: VIDEO_ID,
      store,
      isKnownVideo: async () => true,
      fetchComments,
      inflight: new Map(),
      now: () => now + YOUTUBE_COMMENT_ERROR_MS,
    });

    expect(retried.body.status).toBe('ok');
    expect(fetchComments).toHaveBeenCalledTimes(2);
  });

  it('shares one YouTube call across concurrent requests', async () => {
    const store = createMemoryStore();
    let releaseFetch;
    const gate = new Promise((resolve) => {
      releaseFetch = resolve;
    });
    const fetchComments = vi.fn(async () => {
      await gate;
      return interpretYouTubeCommentResponse(successBody(), {
        ok: true,
        status: 200,
        videoId: VIDEO_ID,
      });
    });
    const inflight = new Map();
    const request = {
      videoId: VIDEO_ID,
      store,
      isKnownVideo: async () => true,
      fetchComments,
      inflight,
      now: () => 50_000,
    };

    const first = resolveCachedYouTubeComments(request);
    const second = resolveCachedYouTubeComments(request);
    releaseFetch();
    const [miss, same] = await Promise.all([first, second]);

    expect(fetchComments).toHaveBeenCalledTimes(1);
    expect(miss.body.comments[0].commentId).toBe('comment-1');
    expect(same.body.comments[0].commentId).toBe('comment-1');
  });

  it('returns the fetched preview when the lock was lost', async () => {
    const store = createMemoryStore();
    store.write = vi.fn(async () => false);
    const fetchComments = vi.fn(async () =>
      interpretYouTubeCommentResponse(successBody(), { ok: true, status: 200, videoId: VIDEO_ID }),
    );

    const response = await resolveCachedYouTubeComments({
      videoId: VIDEO_ID,
      store,
      isKnownVideo: async () => true,
      fetchComments,
      inflight: new Map(),
      now: () => 60_000,
    });

    expect(response.body.comments[0].textDisplay).toBe('Hello 1');
    expect(store.write).toHaveBeenCalledOnce();
  });

  it('releases the claim when the fetch fails', async () => {
    const store = createMemoryStore();
    const fetchComments = vi.fn(async () => {
      throw new Error(`boom key=${API_KEY}`);
    });

    const response = await prepareYouTubeCommentsResponse({
      videoId: VIDEO_ID,
      apiKey: API_KEY,
      resolve: () =>
        resolveCachedYouTubeComments({
          videoId: VIDEO_ID,
          store,
          isKnownVideo: async () => true,
          fetchComments,
          inflight: new Map(),
          now: () => 70_000,
        }),
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: 'error',
      error: 'Error fetching YouTube comments',
      comments: [],
    });
    expect(JSON.stringify(response.body)).not.toContain(API_KEY);
    expect(store.docs.has(VIDEO_ID)).toBe(false);
  });

  it('does not call YouTube while another claim is still pending', async () => {
    const store = createMemoryStore();
    store.claim = vi.fn(async () => ({ state: 'pending' }));
    store.waitForFresh = vi.fn(async () => null);
    const fetchComments = vi.fn();

    const response = await resolveCachedYouTubeComments({
      videoId: VIDEO_ID,
      store,
      isKnownVideo: async () => true,
      fetchComments,
      inflight: new Map(),
      now: () => 80_000,
    });

    expect(response.headers['x-youtube-comment-cache']).toBe('wait');
    expect(response.body.status).toBe('error');
    expect(fetchComments).not.toHaveBeenCalled();
  });

  it('stores at most ten comments', async () => {
    const interpreted = interpretYouTubeCommentResponse(successBody(11), {
      ok: true,
      status: 200,
      videoId: VIDEO_ID,
    });
    expect(interpreted.comments).toHaveLength(10);
    expect(interpreted.comments.some((comment) => comment.commentId === 'comment-11')).toBe(false);
  });

  it('classifies YouTube failures without keeping the response body', () => {
    const disabled = interpretYouTubeCommentResponse(
      JSON.stringify({ error: { errors: [{ reason: 'commentsDisabled', message: UPSTREAM_BODY }] } }),
      { ok: false, status: 403, videoId: VIDEO_ID },
    );
    const missing = interpretYouTubeCommentResponse(
      JSON.stringify({ error: { errors: [{ reason: 'videoNotFound', message: UPSTREAM_BODY }] } }),
      { ok: false, status: 404, videoId: VIDEO_ID },
    );
    const garbage = interpretYouTubeCommentResponse(UPSTREAM_BODY, {
      ok: false,
      status: 500,
      videoId: VIDEO_ID,
    });

    expect(disabled.outcome).toBe('commentsDisabled');
    expect(missing.outcome).toBe('empty');
    expect(garbage).toEqual({ outcome: 'error', errorKind: 'upstream', comments: [] });
    expect(JSON.stringify({ disabled, missing, garbage })).not.toContain(UPSTREAM_BODY);
  });

  it('asks YouTube for ten plain-text comments', () => {
    const url = buildYouTubeCommentThreadUrl({ apiKey: API_KEY, videoId: VIDEO_ID });
    expect(url.searchParams.get('part')).toBe('snippet');
    expect(url.searchParams.get('order')).toBe('relevance');
    expect(url.searchParams.get('maxResults')).toBe('10');
    expect(url.searchParams.get('textFormat')).toBe('plainText');
    expect(url.searchParams.get('key')).toBe(API_KEY);
  });

  it('stops a hung YouTube comment fetch before the claim lock expires', async () => {
    expect(YOUTUBE_COMMENT_FETCH_TIMEOUT_MS).toBeLessThan(YOUTUBE_COMMENT_CACHE_LOCK_TTL_MS);
    const fetchImpl = vi.fn(
      (_url, { signal } = {}) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );

    const result = await fetchYouTubeCommentThread({
      apiKey: API_KEY,
      videoId: VIDEO_ID,
      fetchImpl,
      timeoutMs: 20,
    });

    expect(result).toEqual({ outcome: 'error', errorKind: 'timeout', comments: [] });
  });

  it('grants a lookup for a published reaction video or a published YouTube original only', () => {
    expect(
      reactionGrantsCommentLookup({ reactionVideoId: VIDEO_ID, isPublished: true }, VIDEO_ID),
    ).toBe(true);
    expect(
      reactionGrantsCommentLookup(
        { originalVideoId: VIDEO_ID, originalVideoPlatform: 'youtube', isPublished: true },
        VIDEO_ID,
      ),
    ).toBe(true);
    expect(
      reactionGrantsCommentLookup({ originalVideoId: VIDEO_ID, isPublished: true }, VIDEO_ID),
    ).toBe(true);
    expect(reactionGrantsCommentLookup({ reactionVideoId: VIDEO_ID, isPublished: false }, VIDEO_ID)).toBe(
      false,
    );
    expect(reactionGrantsCommentLookup({ reactionVideoId: VIDEO_ID }, VIDEO_ID)).toBe(false);
    expect(
      reactionGrantsCommentLookup(
        {
          originalVideoId: TIKTOK_ID,
          originalVideoPlatform: 'tiktok',
          reactionVideoId: OTHER_VIDEO_ID,
          isPublished: true,
        },
        TIKTOK_ID,
      ),
    ).toBe(false);
  });

  it('returns 400 from the comments route for a bad id', async () => {
    const response = await GET({ params: { videoId: 'bad id' } });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: 'error', error: 'Invalid video ID', comments: [] });
  });

  it('returns placeholder comments from the comments route when no API key is configured', async () => {
    const response = await GET({ params: { videoId: VIDEO_ID } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.isPlaceholder).toBe(true);
    expect(body.comments[0].authorDisplayName).toBe('Sample Viewer');
    expect(response.headers.get('cache-control')).toBe(YOUTUBE_COMMENT_CACHE_CONTROL);
  });

  it('writes a Firestore snapshot once and reads it back', async () => {
    const adminDb = createFakeAdminDb();
    const store = createFirestoreYouTubeCommentCacheStore(adminDb, 'youtubeCommentCache_local', {
      sleep: async () => {},
      now: () => 90_000,
    });
    const fetchComments = vi.fn(async () =>
      interpretYouTubeCommentResponse(successBody(), { ok: true, status: 200, videoId: VIDEO_ID }),
    );

    const miss = await resolveCachedYouTubeComments({
      videoId: VIDEO_ID,
      store,
      isKnownVideo: async () => true,
      fetchComments,
      inflight: new Map(),
      now: () => 90_000,
    });
    const hit = await resolveCachedYouTubeComments({
      videoId: VIDEO_ID,
      store,
      isKnownVideo: async () => true,
      fetchComments,
      inflight: new Map(),
      now: () => 95_000,
    });

    expect(miss.headers['x-youtube-comment-cache']).toBe('miss');
    expect(hit.headers['x-youtube-comment-cache']).toBe('hit');
    expect(fetchComments).toHaveBeenCalledTimes(1);
    const stored = adminDb.docs.get(`youtubeCommentCache_local/${VIDEO_ID}`);
    expect(stored.comments[0].textDisplay).toBe('Hello 1');
    expect(stored.comments[0].viewerRating).toBeUndefined();
    expect(stored.comments[0].viewThreadUrl).toBeUndefined();
  });

  it('does not call YouTube when Firebase Admin is not configured', async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    adminState.adminDb = null;

    const response = await resolveStoredYouTubeComments({ videoId: VIDEO_ID, apiKey: API_KEY });

    expect(response.headers['x-youtube-comment-cache']).toBe('skip');
    expect(response.body.status).toBe('empty');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not call YouTube for a video id that is not on a reaction', async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    adminState.adminDb = createFakeAdminDb();
    seedReaction(adminState.adminDb, 'tiktok-reaction', {
      reactionVideoId: OTHER_VIDEO_ID,
      originalVideoId: TIKTOK_ID,
      originalVideoPlatform: 'tiktok',
      isPublished: true,
    });

    const unknown = await resolveStoredYouTubeComments({ videoId: VIDEO_ID, apiKey: API_KEY });
    const tiktok = await resolveStoredYouTubeComments({ videoId: TIKTOK_ID, apiKey: API_KEY });

    expect(unknown.headers['x-youtube-comment-cache']).toBe('skip');
    expect(tiktok.headers['x-youtube-comment-cache']).toBe('skip');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(
      [...adminState.adminDb.docs.keys()].some((path) => path.startsWith(`${COLLECTION_YOUTUBE_COMMENT_CACHE}/`)),
    ).toBe(false);
  });

  it('does not call YouTube for a video id that exists only on a draft', async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    adminState.adminDb = createFakeAdminDb();
    seedReaction(adminState.adminDb, 'draft-remix', {
      reactionVideoId: '',
      originalVideoId: VIDEO_ID,
      originalVideoPlatform: 'youtube',
      isPublished: false,
    });

    const response = await resolveStoredYouTubeComments({ videoId: VIDEO_ID, apiKey: API_KEY });

    expect(response.headers['x-youtube-comment-cache']).toBe('skip');
    expect(response.body.status).toBe('empty');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await reactionGrantsStoredComments(adminState.adminDb, VIDEO_ID)).toBe(false);
  });

  it('calls YouTube once for a video id stored on a published reaction', async () => {
    const fetchImpl = vi.fn(async (url) => {
      expect(String(url)).toContain(`videoId=${VIDEO_ID}`);
      expect(String(url)).toContain(`key=${API_KEY}`);
      return {
        ok: true,
        status: 200,
        async text() {
          return successBody();
        },
      };
    });
    vi.stubGlobal('fetch', fetchImpl);
    adminState.adminDb = createFakeAdminDb();
    seedReaction(adminState.adminDb, 'draft-reaction', {
      reactionVideoId: OTHER_VIDEO_ID,
      originalVideoId: VIDEO_ID,
      originalVideoPlatform: 'youtube',
      isPublished: false,
    });
    seedReaction(adminState.adminDb, 'known-reaction', {
      reactionVideoId: OTHER_VIDEO_ID,
      originalVideoId: VIDEO_ID,
      originalVideoPlatform: 'youtube',
      isPublished: true,
    });

    const miss = await resolveStoredYouTubeComments({ videoId: VIDEO_ID, apiKey: API_KEY });
    const hit = await resolveStoredYouTubeComments({ videoId: VIDEO_ID, apiKey: API_KEY });

    expect(miss.headers['x-youtube-comment-cache']).toBe('miss');
    expect(hit.headers['x-youtube-comment-cache']).toBe('hit');
    expect(hit.body.sectionActionUrl).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}&lc=comments`);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(hit.body)).not.toContain(API_KEY);
    expect(await reactionGrantsStoredComments(adminState.adminDb, VIDEO_ID)).toBe(true);
    expect(await reactionGrantsStoredComments(adminState.adminDb, TIKTOK_ID)).toBe(false);
  });
});
