import { COLLECTION_YOUTUBE_PLAYLIST_CACHE } from '$lib/constants/firebase';
import {
  YOUTUBE_PLAYLIST_CACHE_LOCK_TTL_MS,
  buildYouTubePlaylistItemsUrl,
  buildYouTubePlaylistTitleUrl,
  isReadyPlaylistPage,
  mergePlaylistManifest,
  readYouTubePlaylistItemsPayload,
  readYouTubePlaylistTitle,
  resolveCachedYouTubePlaylist,
  YouTubePlaylistRequestError,
  youtubePlaylistPageDocId,
} from '$lib/helpers/youtubePlaylistCache';
import { initializeFirebaseAdmin } from '$lib/server/firebaseAdmin';

const inflight = new Map();
const WAIT_SLICE_MS = 200;
export const YOUTUBE_PLAYLIST_FETCH_TIMEOUT_MS = 8000;
let loggedCacheBypass = false;

function withoutNulls(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null),
  );
}

function createNullYouTubePlaylistCacheStore({ warn = false } = {}) {
  if (warn && !loggedCacheBypass) {
    loggedCacheBypass = true;
    console.warn(
      'YouTube playlist cache is disabled because Firebase Admin is not configured. Playlist requests will call YouTube on every load.',
    );
  }

  return {
    async readPage() {
      return null;
    },
    async claimPage(_playlistId, _pageToken, now) {
      return { state: 'claimed', lockId: `bypass-${now}` };
    },
    async writePage() {
      return true;
    },
    async releaseClaim() {},
    async waitForPage() {
      return null;
    },
    async readManifest() {
      return null;
    },
    async updateManifest(_playlistId, patch) {
      return { ...patch };
    },
  };
}

export function createFirestoreYouTubePlaylistCacheStore(
  adminDb,
  collectionName = COLLECTION_YOUTUBE_PLAYLIST_CACHE,
  {
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    lockTtlMs = YOUTUBE_PLAYLIST_CACHE_LOCK_TTL_MS,
    now = () => Date.now(),
  } = {},
) {
  const manifestRef = (playlistId) => adminDb.collection(collectionName).doc(playlistId);
  const pageRef = (playlistId, pageToken) =>
    manifestRef(playlistId).collection('pages').doc(youtubePlaylistPageDocId(pageToken));

  async function readManifest(playlistId) {
    const snap = await manifestRef(playlistId).get();
    return snap.exists ? snap.data() : null;
  }

  async function readRawPage(playlistId, pageToken) {
    const snap = await pageRef(playlistId, pageToken).get();
    return snap.exists ? snap.data() : null;
  }

  return {
    async readPage(playlistId, pageToken) {
      const page = await readRawPage(playlistId, pageToken);
      return isReadyPlaylistPage(page) ? page : null;
    },
    async claimPage(playlistId, pageToken, claimedAt) {
      const ref = pageRef(playlistId, pageToken);
      const lockId = `${claimedAt}-${Math.random().toString(36).slice(2, 10)}`;
      return adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const data = snap.exists ? snap.data() : null;
        if (isReadyPlaylistPage(data)) {
          return { state: 'ready', page: data };
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
          lockedAt: claimedAt,
          lockId,
          pageToken: pageToken || '',
        });
        return { state: 'claimed', lockId };
      });
    },
    async writePage(playlistId, pageToken, page, lockId) {
      const ref = pageRef(playlistId, pageToken);
      return adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const data = snap.exists ? snap.data() : null;
        if (data?.status !== 'pending' || data.lockId !== lockId) {
          return false;
        }
        transaction.set(
          ref,
          withoutNulls({
            status: 'ready',
            pageToken: page.pageToken || '',
            nextPageToken: page.nextPageToken || '',
            items: page.items || [],
            fetchedAt: page.fetchedAt,
            lockId: '',
            lockedAt: 0,
          }),
        );
        return true;
      });
    },
    async releaseClaim(playlistId, pageToken, lockId) {
      const ref = pageRef(playlistId, pageToken);
      await adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) return;
        const data = snap.data();
        if (data?.status === 'pending' && data.lockId === lockId) {
          transaction.delete(ref);
        }
      });
    },
    async waitForPage(playlistId, pageToken) {
      const deadline = now() + lockTtlMs;
      const maxSpins = Math.ceil(lockTtlMs / WAIT_SLICE_MS) + 1;
      for (let spin = 0; spin < maxSpins && now() < deadline; spin += 1) {
        await sleep(WAIT_SLICE_MS);
        const page = await readRawPage(playlistId, pageToken);
        if (isReadyPlaylistPage(page)) return page;
        if (!page || page.status !== 'pending') return null;
      }
      return null;
    },
    readManifest,
    async updateManifest(playlistId, patch) {
      const ref = manifestRef(playlistId);
      return adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const merged = mergePlaylistManifest(snap.exists ? snap.data() : {}, patch);
        transaction.set(ref, withoutNulls(merged));
        return merged;
      });
    },
  };
}

function logYouTubeFailure(label, playlistId, error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(label, {
    playlistId,
    message: message.replace(/key=[^&\s]+/gi, 'key=redacted'),
  });
}

async function fetchText(fetchImpl, url, timeoutMs = YOUTUBE_PLAYLIST_FETCH_TIMEOUT_MS) {
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

export async function fetchYouTubePlaylistPage({
  apiKey,
  playlistId,
  pageToken = '',
  fetchImpl = fetch,
  timeoutMs = YOUTUBE_PLAYLIST_FETCH_TIMEOUT_MS,
}) {
  const url = buildYouTubePlaylistItemsUrl({ apiKey, playlistId, pageToken });
  try {
    const { ok, status, bodyText } = await fetchText(fetchImpl, url, timeoutMs);
    if (!ok) {
      console.error('YouTube playlistItems request failed', {
        status,
        playlistId,
        body: bodyText.slice(0, 500),
      });
    }
    return readYouTubePlaylistItemsPayload(bodyText, { ok, status });
  } catch (error) {
    if (error instanceof YouTubePlaylistRequestError) throw error;
    logYouTubeFailure('YouTube playlistItems request failed', playlistId, error);
    throw new YouTubePlaylistRequestError(502, 'Failed to fetch data from YouTube');
  }
}

export async function fetchYouTubePlaylistTitle({
  apiKey,
  playlistId,
  fetchImpl = fetch,
  timeoutMs = YOUTUBE_PLAYLIST_FETCH_TIMEOUT_MS,
}) {
  const url = buildYouTubePlaylistTitleUrl({ apiKey, playlistId });
  try {
    const { ok, status, bodyText } = await fetchText(fetchImpl, url, timeoutMs);
    if (!ok) {
      console.error('YouTube playlists request failed', {
        status,
        playlistId,
        body: bodyText.slice(0, 500),
      });
    }
    return readYouTubePlaylistTitle(bodyText, { ok, status });
  } catch (error) {
    if (error instanceof YouTubePlaylistRequestError) throw error;
    logYouTubeFailure('YouTube playlists request failed', playlistId, error);
    throw new YouTubePlaylistRequestError(502, 'Failed to fetch playlist title');
  }
}

export async function resolveStoredYouTubePlaylist({
  playlistId,
  pageToken = '',
  includePlaylistTitle = false,
  maxResults,
  apiKey,
}) {
  const { adminDb } = await initializeFirebaseAdmin();
  const request = {
    playlistId,
    pageToken,
    includePlaylistTitle,
    maxResults,
    inflight,
    fetchPlaylistPage: ({ playlistId: id, pageToken: token }) =>
      fetchYouTubePlaylistPage({ apiKey, playlistId: id, pageToken: token }),
    fetchPlaylistTitle: (id) => fetchYouTubePlaylistTitle({ apiKey, playlistId: id }),
  };

  if (!adminDb) {
    return resolveCachedYouTubePlaylist({
      ...request,
      store: createNullYouTubePlaylistCacheStore({ warn: true }),
    });
  }

  try {
    return await resolveCachedYouTubePlaylist({
      ...request,
      store: createFirestoreYouTubePlaylistCacheStore(adminDb),
    });
  } catch (error) {
    if (error instanceof YouTubePlaylistRequestError) throw error;
    console.error('YouTube playlist cache failed. Loading the page from YouTube.', error);
    return resolveCachedYouTubePlaylist({
      ...request,
      inflight: new Map(),
      store: createNullYouTubePlaylistCacheStore(),
    });
  }
}
