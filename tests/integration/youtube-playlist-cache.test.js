import { describe, expect, it, vi } from 'vitest';
import { GET } from '../../src/routes/api/youtube/playlist/[id]/+server.js';
import {
  buildYouTubePlaylistItemsUrl,
  isReadyPlaylistPage,
  mergePlaylistManifest,
  prepareYouTubePlaylistResponse,
  readYouTubePlaylistItemsPayload,
  resolveCachedYouTubePlaylist,
  YouTubePlaylistRequestError,
} from '$lib/helpers/youtubePlaylistCache';
import { createFirestoreYouTubePlaylistCacheStore } from '$lib/server/youtubePlaylistCache';

const PLAYLIST_ID = 'PL1234567890ab';
const UPSTREAM_BODY = 'dailyLimitExceeded super-secret-upstream-body';

function youtubeItem(videoId, title) {
  return {
    id: `item-${videoId}`,
    snippet: {
      title,
      description: 'do-not-store-this-description',
      channelTitle: 'Channel',
      resourceId: { videoId },
      thumbnails: {
        high: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` },
      },
    },
  };
}

function createMemoryStore() {
  const pages = new Map();
  const manifests = new Map();
  const keyFor = (playlistId, pageToken) => `${playlistId}\0${pageToken || ''}`;

  return {
    async readPage(playlistId, pageToken) {
      const page = pages.get(keyFor(playlistId, pageToken));
      return isReadyPlaylistPage(page) ? page : null;
    },
    async claimPage(playlistId, pageToken, now) {
      const existing = pages.get(keyFor(playlistId, pageToken));
      if (isReadyPlaylistPage(existing)) return { state: 'ready', page: existing };
      if (existing?.status === 'pending' && now - existing.lockedAt < 15000) {
        return { state: 'pending' };
      }
      const lockId = `lock-${now}`;
      pages.set(keyFor(playlistId, pageToken), {
        status: 'pending',
        lockedAt: now,
        lockId,
        pageToken,
      });
      return { state: 'claimed', lockId };
    },
    async writePage(playlistId, pageToken, page) {
      pages.set(keyFor(playlistId, pageToken), { ...page });
    },
    async releaseClaim(playlistId, pageToken, lockId) {
      const existing = pages.get(keyFor(playlistId, pageToken));
      if (existing?.status === 'pending' && existing.lockId === lockId) {
        pages.delete(keyFor(playlistId, pageToken));
      }
    },
    async waitForPage(playlistId, pageToken) {
      const page = pages.get(keyFor(playlistId, pageToken));
      return isReadyPlaylistPage(page) ? page : null;
    },
    async readManifest(playlistId) {
      return manifests.get(playlistId) || null;
    },
    async updateManifest(playlistId, patch) {
      const next = mergePlaylistManifest(manifests.get(playlistId) || {}, patch);
      manifests.set(playlistId, next);
      return next;
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
      async set(data) {
        docs.set(path, structuredClone(data));
      },
    };
  }

  function collection(prefix) {
    return {
      doc(id) {
        const ref = makeRef(`${prefix}/${id}`);
        return {
          ...ref,
          collection(name) {
            return collection(`${ref.path}/${name}`);
          },
        };
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

describe('stored YouTube playlist pages', () => {
  it('rejects a playlist id before calling YouTube', async () => {
    const resolve = vi.fn();
    const response = await prepareYouTubePlaylistResponse({
      playlistId: 'bad id',
      apiKey: 'key',
      placeholderItems: [],
      resolve,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid playlist ID' });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('returns placeholder items when no API key is configured', async () => {
    const resolve = vi.fn();
    const placeholderItems = [{ id: 'placeholder' }];
    const response = await prepareYouTubePlaylistResponse({
      playlistId: PLAYLIST_ID,
      apiKey: '',
      includePlaylistTitle: true,
      placeholderItems,
      resolve,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: placeholderItems,
      playlistTitle: '[Sample Playlist]',
      isPlaceholder: true,
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('serves a stored page at any age without calling YouTube', async () => {
    const store = createMemoryStore();
    await store.writePage(PLAYLIST_ID, '', {
      status: 'ready',
      pageToken: '',
      nextPageToken: 'later',
      fetchedAt: 1,
      items: [
        {
          videoId: 'abcdefghijk',
          title: 'Stored',
          channelTitle: 'Channel',
          thumbnailUrl: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
          itemId: 'item-abcdefghijk',
        },
      ],
    });
    const fetchPlaylistPage = vi.fn();

    const response = await resolveCachedYouTubePlaylist({
      playlistId: PLAYLIST_ID,
      store,
      fetchPlaylistPage,
      fetchPlaylistTitle: vi.fn(),
      inflight: new Map(),
      now: () => Date.now() + 1000 * 60 * 60 * 24 * 365,
    });

    expect(fetchPlaylistPage).not.toHaveBeenCalled();
    expect(response.headers['x-youtube-playlist-cache']).toBe('hit');
    expect(response.headers['x-next-page-token']).toBe('later');
    expect(response.payload[0].snippet.resourceId.videoId).toBe('abcdefghijk');
    expect(response.payload[0].snippet.title).toBe('Stored');
  });

  it('stores the first missing page and reuses it', async () => {
    const store = createMemoryStore();
    const written = [];
    const originalWrite = store.writePage;
    store.writePage = async (...args) => {
      written.push(args[2]);
      return originalWrite(...args);
    };
    const fetchPlaylistPage = vi.fn(async () => ({
      items: [youtubeItem('abcdefghijk', 'First'), youtubeItem('bcdefghijkl', 'Second')],
      nextPageToken: 'next-page',
    }));

    const first = await resolveCachedYouTubePlaylist({
      playlistId: PLAYLIST_ID,
      maxResults: 1,
      store,
      fetchPlaylistPage,
      fetchPlaylistTitle: vi.fn(),
      inflight: new Map(),
    });
    const second = await resolveCachedYouTubePlaylist({
      playlistId: PLAYLIST_ID,
      store,
      fetchPlaylistPage,
      fetchPlaylistTitle: vi.fn(),
      inflight: new Map(),
    });

    expect(fetchPlaylistPage).toHaveBeenCalledTimes(1);
    expect(first.headers['x-youtube-playlist-cache']).toBe('miss');
    expect(first.headers['x-next-page-token']).toBeUndefined();
    expect(first.payload).toHaveLength(1);
    expect(second.headers['x-youtube-playlist-cache']).toBe('hit');
    expect(second.headers['x-next-page-token']).toBe('next-page');
    expect(second.payload).toHaveLength(2);
    expect(JSON.stringify(written[0].items)).not.toContain('do-not-store-this-description');
    expect(await store.readManifest(PLAYLIST_ID)).toMatchObject({ complete: false });
  });

  it('calls YouTube once when two loads miss the same page together', async () => {
    const store = createMemoryStore();
    let calls = 0;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const fetchPlaylistPage = vi.fn(async () => {
      calls += 1;
      await gate;
      return { items: [youtubeItem('abcdefghijk', 'First')], nextPageToken: '' };
    });
    const inflight = new Map();
    const request = {
      playlistId: PLAYLIST_ID,
      store,
      fetchPlaylistPage,
      fetchPlaylistTitle: vi.fn(),
      inflight,
    };

    const first = resolveCachedYouTubePlaylist(request);
    const second = resolveCachedYouTubePlaylist(request);
    release();
    const [left, right] = await Promise.all([first, second]);

    expect(calls).toBe(1);
    expect(left.payload).toEqual(right.payload);
    expect((await store.readManifest(PLAYLIST_ID)).complete).toBe(true);
  });

  it('reuses a stored playlist title', async () => {
    const store = createMemoryStore();
    await store.writePage(PLAYLIST_ID, '', {
      status: 'ready',
      pageToken: '',
      nextPageToken: '',
      fetchedAt: 10,
      items: [
        {
          videoId: 'abcdefghijk',
          title: 'Stored',
          channelTitle: 'Channel',
          thumbnailUrl: '',
          itemId: 'item-abcdefghijk',
        },
      ],
    });
    const fetchPlaylistTitle = vi.fn(async () => 'Live title');
    const request = {
      playlistId: PLAYLIST_ID,
      includePlaylistTitle: true,
      store,
      fetchPlaylistPage: vi.fn(),
      fetchPlaylistTitle,
      inflight: new Map(),
      now: () => 20,
    };

    const first = await resolveCachedYouTubePlaylist(request);
    const second = await resolveCachedYouTubePlaylist({ ...request, inflight: new Map() });

    expect(fetchPlaylistTitle).toHaveBeenCalledTimes(1);
    expect(first.payload.playlistTitle).toBe('Live title');
    expect(second.payload.playlistTitle).toBe('Live title');
    expect(first.payload.items[0].snippet.resourceId.videoId).toBe('abcdefghijk');
  });

  it('tries the playlist title again after a failed lookup', async () => {
    const store = createMemoryStore();
    await store.writePage(PLAYLIST_ID, '', {
      status: 'ready',
      pageToken: '',
      nextPageToken: '',
      fetchedAt: 10,
      items: [],
    });
    const fetchPlaylistTitle = vi
      .fn()
      .mockRejectedValueOnce(new YouTubePlaylistRequestError(503, 'Failed to fetch playlist title'))
      .mockResolvedValueOnce('Recovered');
    const request = {
      playlistId: PLAYLIST_ID,
      includePlaylistTitle: true,
      store,
      fetchPlaylistPage: vi.fn(),
      fetchPlaylistTitle,
      now: () => 30,
    };

    const first = await resolveCachedYouTubePlaylist({ ...request, inflight: new Map() });
    const second = await resolveCachedYouTubePlaylist({ ...request, inflight: new Map() });

    expect(first.payload.playlistTitle).toBe('');
    expect(second.payload.playlistTitle).toBe('Recovered');
    expect(fetchPlaylistTitle).toHaveBeenCalledTimes(2);
  });

  it('hides the YouTube error body from the caller', async () => {
    const thrown = new YouTubePlaylistRequestError(403, 'Failed to fetch data from YouTube');
    const response = await prepareYouTubePlaylistResponse({
      playlistId: PLAYLIST_ID,
      apiKey: 'key',
      placeholderItems: [],
      resolve: async () => {
        throw thrown;
      },
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Error fetching playlist videos' });
    expect(JSON.stringify(response.body)).not.toContain(UPSTREAM_BODY);
  });

  it('keeps a finished playlist marked complete', () => {
    const finished = mergePlaylistManifest({}, { playlistId: PLAYLIST_ID, complete: true });
    const next = mergePlaylistManifest(finished, { complete: false, playlistTitle: 'Still done' });
    expect(next.complete).toBe(true);
    expect(next.playlistTitle).toBe('Still done');
  });

  it('asks YouTube for a full page of 50 and omits the upstream body from errors', () => {
    const url = buildYouTubePlaylistItemsUrl({
      apiKey: 'secret-key',
      playlistId: PLAYLIST_ID,
      pageToken: 'page-2',
    });
    expect(url.searchParams.get('maxResults')).toBe('50');
    expect(url.searchParams.get('pageToken')).toBe('page-2');

    expect(() =>
      readYouTubePlaylistItemsPayload(UPSTREAM_BODY, { ok: false, status: 403 }),
    ).toThrowError(YouTubePlaylistRequestError);
    try {
      readYouTubePlaylistItemsPayload(UPSTREAM_BODY, { ok: false, status: 403 });
    } catch (error) {
      expect(error.message).toBe('Failed to fetch data from YouTube');
      expect(error.message).not.toContain(UPSTREAM_BODY);
      expect(error.status).toBe(403);
    }
  });

  it('returns 400 from the playlist route for a bad id', async () => {
    const response = await GET({
      params: { id: 'bad id' },
      url: new URL('http://localhost/api/youtube/playlist/bad%20id'),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid playlist ID' });
  });

  it('returns placeholder items from the playlist route when no API key is configured', async () => {
    const response = await GET({
      params: { id: PLAYLIST_ID },
      url: new URL(`http://localhost/api/youtube/playlist/${PLAYLIST_ID}`),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].snippet.resourceId.videoId).toBe('dQw4w9WgXcQ');
  });

  it('writes a Firestore page once and reads it back', async () => {
    const adminDb = createFakeAdminDb();
    const store = createFirestoreYouTubePlaylistCacheStore(adminDb, 'youtubePlaylistCache_local', {
      sleep: async () => {},
      now: () => 1000,
    });
    const fetchPlaylistPage = vi.fn(async () => ({
      items: [youtubeItem('abcdefghijk', 'Cached')],
      nextPageToken: '',
    }));

    const miss = await resolveCachedYouTubePlaylist({
      playlistId: PLAYLIST_ID,
      store,
      fetchPlaylistPage,
      fetchPlaylistTitle: vi.fn(),
      inflight: new Map(),
      now: () => 1000,
    });
    const hit = await resolveCachedYouTubePlaylist({
      playlistId: PLAYLIST_ID,
      store,
      fetchPlaylistPage,
      fetchPlaylistTitle: vi.fn(),
      inflight: new Map(),
      now: () => 5000,
    });

    expect(miss.headers['x-youtube-playlist-cache']).toBe('miss');
    expect(hit.headers['x-youtube-playlist-cache']).toBe('hit');
    expect(fetchPlaylistPage).toHaveBeenCalledTimes(1);
    expect(hit.payload[0].snippet.title).toBe('Cached');
    const stored = adminDb.docs.get(`youtubePlaylistCache_local/${PLAYLIST_ID}/pages/page-first`);
    expect(stored.items[0].description).toBeUndefined();
    expect(stored.items[0].videoId).toBe('abcdefghijk');
  });
});
