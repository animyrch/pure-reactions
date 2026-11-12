import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLECTION_PLAYLISTS, COLLECTION_REACTION_BINOMES } from '#lib/constants/firebase.js';

const initializeFirebaseAdmin = vi.hoisted(() => vi.fn());

vi.mock('#lib/server/firebaseAdmin.js', () => ({
  initializeFirebaseAdmin,
}));

import { POST } from '../../src/routes/api/reactions/enrich/+server.js';

const freshMeta = (videoId, durationSeconds) => ({
  videoId,
  title: 'Stored title',
  thumbnail: 'https://example.com/thumb.jpg',
  publishedAt: '2020-01-01T00:00:00Z',
  durationSeconds,
  description: 'Stored description',
});

function createMemoryAdmin() {
  const docs = new Map();

  const snapshotFor = (path, id) => {
    if (!docs.has(path)) {
      return { exists: false, id, data: () => undefined, get: () => undefined };
    }
    const data = docs.get(path);
    return {
      exists: true,
      id,
      data: () => structuredClone(data),
      get: (field) => data[field],
    };
  };

  const refFor = (collectionName, id) => {
    const path = `${collectionName}/${id}`;
    return {
      id,
      path,
      async get() {
        return snapshotFor(path, id);
      },
      async set(patch, options) {
        const previous = options?.merge && docs.has(path) ? docs.get(path) : {};
        docs.set(path, { ...previous, ...structuredClone(patch) });
      },
      async update(patch) {
        if (!docs.has(path)) {
          throw new Error(`No document to update: ${path}`);
        }
        docs.set(path, { ...docs.get(path), ...structuredClone(patch) });
      },
    };
  };

  return {
    adminDb: {
      collection(name) {
        return { doc: (id) => refFor(name, id) };
      },
      async getAll(...refs) {
        return Promise.all(refs.map((ref) => ref.get()));
      },
    },
    adminFieldValue: {
      serverTimestamp: () => ({ __serverTimestamp: true }),
    },
    seed(collectionName, id, data) {
      docs.set(`${collectionName}/${id}`, structuredClone(data));
    },
    read(collectionName, id) {
      const data = docs.get(`${collectionName}/${id}`);
      return data ? structuredClone(data) : undefined;
    },
  };
}

function postEnrich(body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return POST({
    request: new Request('http://localhost/api/reactions/enrich', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  });
}

function isYoutubeDataApiRequest(input) {
  try {
    return new URL(input).hostname === 'www.googleapis.com';
  } catch {
    return false;
  }
}

describe('POST /api/reactions/enrich', () => {
  let admin;
  let fetchMock;

  beforeEach(() => {
    admin = createMemoryAdmin();
    initializeFirebaseAdmin.mockResolvedValue({
      adminAuth: {
        verifyIdToken: async (token) => {
          if (token === 'owner-token') return { uid: 'owner' };
          if (token === 'stranger-token') return { uid: 'stranger' };
          throw new Error('invalid token');
        },
      },
      adminDb: admin.adminDb,
      adminFieldValue: admin.adminFieldValue,
    });
    fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        items: [
          {
            snippet: {
              title: 'Synced title',
              description: 'Synced description',
              publishedAt: '2024-05-01T00:00:00Z',
              thumbnails: {
                medium: { url: 'https://example.com/synced.jpg', width: 320, height: 180 },
              },
            },
            contentDetails: { duration: 'PT2M' },
          },
        ],
      }),
      text: async () => '',
    }));
    vi.stubGlobal('fetch', fetchMock);
    process.env.YOUTUBE_API_KEY = 'test-youtube-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.YOUTUBE_API_KEY;
    initializeFirebaseAdmin.mockReset();
  });

  it('rejects a request with no token before touching admin or host APIs', async () => {
    admin.seed(COLLECTION_REACTION_BINOMES, 'rx', {
      reactorId: 'owner',
      youtubeId: 'yt-owner',
      originalVideoPlatform: 'tiktok',
      originalVideoId: 'tiktok-1',
      originalVideoUrl: 'https://www.tiktok.com/@creator/video/tiktok-1',
    });

    const response = await postEnrich({ reactionId: 'rx', force: true });

    expect(response.status).toBe(401);
    expect(initializeFirebaseAdmin).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(admin.read(COLLECTION_REACTION_BINOMES, 'rx').youtube).toBeUndefined();
  });

  it('rejects an invalid token before host lookups', async () => {
    admin.seed(COLLECTION_REACTION_BINOMES, 'rx', {
      reactorId: 'owner',
      youtubeId: 'yt-owner',
    });

    const response = await postEnrich({ reactionId: 'rx', force: true }, 'not-a-token');

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(admin.read(COLLECTION_REACTION_BINOMES, 'rx')).toEqual({
      reactorId: 'owner',
      youtubeId: 'yt-owner',
    });
  });

  it('rejects a signed-in user who does not own the reaction', async () => {
    admin.seed(COLLECTION_REACTION_BINOMES, 'rx', {
      reactorId: 'owner',
      youtubeId: 'yt-owner',
      originalVideoPlatform: 'tiktok',
      originalVideoId: 'tiktok-1',
      originalVideoUrl: 'https://www.tiktok.com/@creator/video/tiktok-1',
    });
    admin.seed(COLLECTION_PLAYLISTS, 'playlist-victim', {
      userId: 'victim',
      reactionBinomeIds: ['rx'],
      watchDurationSeconds: 10,
    });

    const response = await postEnrich({ reactionId: 'rx', force: true }, 'stranger-token');

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(admin.read(COLLECTION_REACTION_BINOMES, 'rx').youtube).toBeUndefined();
    expect(admin.read(COLLECTION_PLAYLISTS, 'playlist-victim')).toEqual({
      userId: 'victim',
      reactionBinomeIds: ['rx'],
      watchDurationSeconds: 10,
    });
  });

  it('lets the owner merge YouTube metadata for their reaction', async () => {
    admin.seed(COLLECTION_REACTION_BINOMES, 'rx', {
      reactorId: 'owner',
      youtubeId: 'yt-owner',
    });

    const response = await postEnrich({ reactionId: 'rx' }, 'owner-token');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ found: true, updated: true, reason: 'enriched' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toContain('id=yt-owner');
    expect(requestedUrl).toContain('key=test-youtube-key');
    expect(admin.read(COLLECTION_REACTION_BINOMES, 'rx').youtube.meta).toMatchObject({
      videoId: 'yt-owner',
      title: 'Synced title',
      durationSeconds: 120,
    });
  });

  it('writes a TikTok snapshot when the YouTube refresh fails', async () => {
    const tiktokId = '7056208472144235823';
    admin.seed(COLLECTION_REACTION_BINOMES, 'rx', {
      reactorId: 'owner',
      reactionVideoId: 'yt-owner',
      originalVideoPlatform: 'tiktok',
      originalVideoId: tiktokId,
      originalVideoUrl: `https://www.tiktok.com/@creator/video/${tiktokId}`,
    });
    fetchMock.mockImplementation(async (input) => {
      if (isYoutubeDataApiRequest(input)) {
        throw new Error('YouTube unavailable');
      }
      return {
        ok: true,
        json: async () => ({
          title: 'Live caption',
          author_name: 'Creator',
          author_unique_id: 'creator',
          author_url: 'https://www.tiktok.com/@creator',
          thumbnail_url: 'https://example.com/tiktok.jpg',
        }),
        text: async () => '',
      };
    });

    const response = await postEnrich({ reactionId: 'rx', force: true }, 'owner-token');
    const stored = admin.read(COLLECTION_REACTION_BINOMES, 'rx');

    expect(response.status).toBe(200);
    expect(stored.youtube).toBeUndefined();
    expect(stored.originalTikTok.meta.title).toBe('Live caption');
  });

  it('reuses a fresh YouTube snapshot when only the TikTok side is refreshed', async () => {
    const tiktokId = '7056208472144235823';
    admin.seed(COLLECTION_REACTION_BINOMES, 'rx', {
      reactorId: 'owner',
      reactionVideoId: 'yt-owner',
      youtube: { meta: freshMeta('yt-owner', 90) },
      lastEnrichedAt: new Date().toISOString(),
      originalVideoPlatform: 'tiktok',
      originalVideoId: tiktokId,
      originalVideoUrl: `https://www.tiktok.com/@creator/video/${tiktokId}`,
    });
    fetchMock.mockImplementation(async (input) => {
      if (isYoutubeDataApiRequest(input)) {
        throw new Error('YouTube should stay cached');
      }
      return {
        ok: true,
        json: async () => ({
          title: 'Live caption',
          author_name: 'Creator',
          author_unique_id: 'creator',
          author_url: 'https://www.tiktok.com/@creator',
          thumbnail_url: 'https://example.com/tiktok.jpg',
        }),
        text: async () => '',
      };
    });

    const response = await postEnrich(
      { reactionId: 'rx', forceOriginal: true, forceReaction: false },
      'owner-token',
    );
    const stored = admin.read(COLLECTION_REACTION_BINOMES, 'rx');

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.some(([input]) => isYoutubeDataApiRequest(input))).toBe(false);
    expect(stored.youtube.meta.title).toBe('Stored title');
    expect(stored.originalTikTok.meta.title).toBe('Live caption');
  });

  it('does not admin-write another user playlist or its reactions', async () => {
    const reaction = {
      reactorId: 'owner',
      youtubeId: 'yt-owner',
      lastEnrichedAt: new Date(),
      youtube: { meta: freshMeta('yt-owner', 90) },
      playlistId: 'playlist-victim',
    };
    const victimReaction = {
      reactorId: 'victim',
      youtubeId: 'yt-victim',
      playlistId: 'playlist-victim',
      youtube: { meta: freshMeta('yt-victim', 30) },
    };
    admin.seed(COLLECTION_REACTION_BINOMES, 'rx', reaction);
    admin.seed(COLLECTION_REACTION_BINOMES, 'other', victimReaction);
    admin.seed(COLLECTION_PLAYLISTS, 'playlist-victim', {
      userId: 'victim',
      reactionBinomeIds: ['rx', 'other'],
      watchDurationSeconds: 10,
    });

    const response = await postEnrich({ reactionId: 'rx' }, 'owner-token');

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(admin.read(COLLECTION_PLAYLISTS, 'playlist-victim').watchDurationSeconds).toBe(10);
    expect(admin.read(COLLECTION_REACTION_BINOMES, 'other')).toEqual(victimReaction);
    expect(admin.read(COLLECTION_REACTION_BINOMES, 'rx').watchDurationSeconds).toBe(90);
    expect(admin.read(COLLECTION_REACTION_BINOMES, 'rx').youtube.meta.title).toBe('Stored title');
  });

  it('updates the owner playlist total without writing another member reaction', async () => {
    const reaction = {
      reactorId: 'owner',
      youtubeId: 'yt-owner',
      lastEnrichedAt: new Date(),
      youtube: { meta: freshMeta('yt-owner', 90) },
      playlistId: 'playlist-owner',
    };
    const otherReaction = {
      reactorId: 'victim',
      youtubeId: 'yt-victim',
      playlistId: 'playlist-owner',
      youtube: { meta: freshMeta('yt-victim', 30) },
    };
    admin.seed(COLLECTION_REACTION_BINOMES, 'rx', reaction);
    admin.seed(COLLECTION_REACTION_BINOMES, 'other', otherReaction);
    admin.seed(COLLECTION_PLAYLISTS, 'playlist-owner', {
      userId: 'owner',
      reactionBinomeIds: ['rx', 'other'],
    });

    const response = await postEnrich({ reactionId: 'rx' }, 'owner-token');

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(admin.read(COLLECTION_PLAYLISTS, 'playlist-owner').watchDurationSeconds).toBe(120);
    expect(admin.read(COLLECTION_REACTION_BINOMES, 'rx').watchDurationSeconds).toBe(120);
    expect(admin.read(COLLECTION_REACTION_BINOMES, 'other')).toEqual(otherReaction);
  });
});
