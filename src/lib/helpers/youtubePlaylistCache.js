import { createHash } from 'node:crypto';

/**
 * Pure YouTube playlist cache rules.
 * The server module owns Firestore and the YouTube HTTP calls.
 * A stored page is reused at any age. A reactor-controlled refresh can replace
 * those documents later. Nothing here expires them.
 */

export const YOUTUBE_PLAYLIST_PAGE_SIZE = 50;
export const YOUTUBE_PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{12,80}$/;
export const YOUTUBE_PLAYLIST_CACHE_LOCK_TTL_MS = 15000;

export class YouTubePlaylistRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'YouTubePlaylistRequestError';
    this.status = status;
  }
}

export function isValidYouTubePlaylistId(playlistId) {
  return typeof playlistId === 'string' && YOUTUBE_PLAYLIST_ID_PATTERN.test(playlistId);
}

export function clampYouTubePlaylistMaxResults(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) return YOUTUBE_PLAYLIST_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(parsed), 1), YOUTUBE_PLAYLIST_PAGE_SIZE);
}

export function clampYouTubePlaylistOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.trunc(parsed);
}

export function youtubePlaylistPageDocId(pageToken = '') {
  const token = typeof pageToken === 'string' ? pageToken : '';
  if (!token) return 'page-first';
  const hash = createHash('sha256').update(token).digest('hex').slice(0, 32);
  return `page-${hash}`;
}

export function buildYouTubePlaylistItemsUrl({ apiKey, playlistId, pageToken = '' }) {
  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('playlistId', playlistId);
  url.searchParams.set('maxResults', String(YOUTUBE_PLAYLIST_PAGE_SIZE));
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  url.searchParams.set('key', apiKey);
  return url;
}

export function buildYouTubePlaylistTitleUrl({ apiKey, playlistId }) {
  const url = new URL('https://www.googleapis.com/youtube/v3/playlists');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('id', playlistId);
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('key', apiKey);
  return url;
}

function upstreamStatus(status) {
  const code = Number(status);
  if (Number.isInteger(code) && code >= 400 && code <= 599) return code;
  return 502;
}

export function readYouTubePlaylistItemsPayload(bodyText, { ok, status } = {}) {
  if (!ok) {
    throw new YouTubePlaylistRequestError(upstreamStatus(status), 'Failed to fetch data from YouTube');
  }
  if (!bodyText) {
    throw new YouTubePlaylistRequestError(502, 'No data received from YouTube');
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new YouTubePlaylistRequestError(502, 'YouTube returned non-JSON response');
  }

  if (!Array.isArray(data.items)) {
    throw new YouTubePlaylistRequestError(502, 'Unexpected YouTube response structure');
  }

  return {
    items: data.items,
    nextPageToken: typeof data.nextPageToken === 'string' ? data.nextPageToken : '',
  };
}

export function readYouTubePlaylistTitle(bodyText, { ok, status } = {}) {
  if (!ok) {
    throw new YouTubePlaylistRequestError(upstreamStatus(status), 'Failed to fetch playlist title');
  }
  if (!bodyText) {
    throw new YouTubePlaylistRequestError(502, 'No data received from YouTube');
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new YouTubePlaylistRequestError(502, 'YouTube returned non-JSON response');
  }

  const title = data?.items?.[0]?.snippet?.title;
  return typeof title === 'string' ? title : '';
}

function pickThumbnailUrl(thumbnails) {
  if (!thumbnails || typeof thumbnails !== 'object') return '';
  return (
    thumbnails.maxres?.url ||
    thumbnails.standard?.url ||
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url ||
    ''
  );
}

export function trimYouTubePlaylistItem(item) {
  const videoId = item?.snippet?.resourceId?.videoId || item?.videoId || '';
  if (typeof videoId !== 'string' || !videoId.trim()) return null;
  const thumbnailUrl = item?.thumbnailUrl || pickThumbnailUrl(item?.snippet?.thumbnails);
  return {
    videoId: videoId.trim(),
    title: typeof item?.snippet?.title === 'string' ? item.snippet.title : item?.title || '',
    channelTitle:
      typeof item?.snippet?.channelTitle === 'string' ? item.snippet.channelTitle : item?.channelTitle || '',
    thumbnailUrl: typeof thumbnailUrl === 'string' ? thumbnailUrl : '',
    itemId: typeof item?.id === 'string' ? item.id : typeof item?.itemId === 'string' ? item.itemId : '',
  };
}

export function toYouTubePlaylistApiItem(stored) {
  const thumbnailUrl = stored?.thumbnailUrl || '';
  const thumb = thumbnailUrl ? { url: thumbnailUrl } : null;
  return {
    id: stored?.itemId || stored?.videoId,
    snippet: {
      title: stored?.title || '',
      channelTitle: stored?.channelTitle || '',
      resourceId: { videoId: stored?.videoId || '' },
      ...(thumb
        ? {
            thumbnails: {
              default: thumb,
              medium: thumb,
              high: thumb,
              standard: thumb,
              maxres: thumb,
            },
          }
        : {}),
    },
  };
}

export function mergePlaylistManifest(previous = {}, patch = {}) {
  const next = { ...previous };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) next[key] = value;
  }
  if (previous?.complete === true) next.complete = true;
  return next;
}

export function isReadyPlaylistPage(page) {
  return Boolean(page && page.status === 'ready' && Array.isArray(page.items));
}

function sliceStoredItems(items, maxResults, offset) {
  const limit = clampYouTubePlaylistMaxResults(maxResults);
  const start = Math.min(clampYouTubePlaylistOffset(offset), items.length);
  return {
    items: items.slice(start, start + limit),
    nextOffset: start + limit < items.length ? start + limit : null,
  };
}

export function buildPlaylistApiResponse({
  items,
  nextPageToken = '',
  playlistTitle = '',
  includePlaylistTitle = false,
  maxResults = YOUTUBE_PLAYLIST_PAGE_SIZE,
  offset = 0,
  cache = 'miss',
}) {
  const storedItems = Array.isArray(items) ? items : [];
  // A short maxResults stays inside this stored page. x-next-offset resumes there.
  // The YouTube page token is sent only after this page is exhausted.
  const sliced = sliceStoredItems(storedItems, maxResults, offset);
  const visibleItems = sliced.items.map(toYouTubePlaylistApiItem);
  const headers = {
    'Cache-Control': 'no-store',
    'x-youtube-playlist-cache': cache === 'hit' ? 'hit' : 'miss',
  };
  if (sliced.nextOffset != null) {
    headers['x-next-offset'] = String(sliced.nextOffset);
  } else if (nextPageToken) {
    headers['x-next-page-token'] = nextPageToken;
  }

  const payload = includePlaylistTitle
    ? { items: visibleItems, playlistTitle: playlistTitle || '' }
    : visibleItems;

  return { payload, headers };
}

async function rememberPage({ store, playlistId, pageToken, fetchPlaylistPage, now, lockId }) {
  const fetched = await fetchPlaylistPage({ playlistId, pageToken });
  const page = {
    status: 'ready',
    pageToken,
    nextPageToken: fetched.nextPageToken || '',
    items: (fetched.items || []).map(trimYouTubePlaylistItem).filter(Boolean),
    fetchedAt: now(),
  };
  const wrote = await store.writePage(playlistId, pageToken, page, lockId);
  if (wrote) {
    await store.updateManifest(playlistId, {
      playlistId,
      fetchedAt: page.fetchedAt,
      updatedAt: page.fetchedAt,
      complete: !page.nextPageToken,
    });
  }
  return page;
}

async function loadStoredOrFreshPage({
  store,
  playlistId,
  pageToken,
  fetchPlaylistPage,
  now,
}) {
  const existing = await store.readPage(playlistId, pageToken);
  if (isReadyPlaylistPage(existing)) {
    return { page: existing, cache: 'hit' };
  }

  let claim = await store.claimPage(playlistId, pageToken, now());
  try {
    if (claim.state === 'ready' && isReadyPlaylistPage(claim.page)) {
      return { page: claim.page, cache: 'hit' };
    }
    if (claim.state === 'pending') {
      const waited = await store.waitForPage(playlistId, pageToken);
      if (isReadyPlaylistPage(waited)) {
        return { page: waited, cache: 'hit' };
      }
      claim = await store.claimPage(playlistId, pageToken, now());
      if (claim.state === 'ready' && isReadyPlaylistPage(claim.page)) {
        return { page: claim.page, cache: 'hit' };
      }
    }

    const page = await rememberPage({
      store,
      playlistId,
      pageToken,
      fetchPlaylistPage,
      now,
      lockId: claim.lockId,
    });
    return { page, cache: 'miss' };
  } catch (error) {
    if (claim?.lockId) {
      await store.releaseClaim(playlistId, pageToken, claim.lockId).catch(() => {});
    }
    throw error;
  }
}

async function loadPlaylistTitle({
  store,
  playlistId,
  fetchPlaylistTitle,
  inflight,
  now,
}) {
  const key = `title\0${playlistId}`;
  const current = inflight.get(key);
  if (current) return current;

  const promise = (async () => {
    const manifest = await store.readManifest(playlistId);
    if (manifest?.titleFetchedAt) return manifest.playlistTitle || '';
    try {
      const playlistTitle = (await fetchPlaylistTitle(playlistId)) || '';
      const updated = await store.updateManifest(playlistId, {
        playlistId,
        playlistTitle,
        titleFetchedAt: now(),
        updatedAt: now(),
      });
      return updated?.playlistTitle || '';
    } catch (error) {
      if (error?.rateLimitResponse) throw error;
      console.error('Failed to fetch playlist metadata', error);
      return '';
    }
  })().finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

export async function resolveCachedYouTubePlaylist({
  playlistId,
  pageToken = '',
  includePlaylistTitle = false,
  maxResults = YOUTUBE_PLAYLIST_PAGE_SIZE,
  offset = 0,
  store,
  fetchPlaylistPage,
  fetchPlaylistTitle,
  inflight,
  now = () => Date.now(),
}) {
  const normalizedToken = typeof pageToken === 'string' ? pageToken : '';
  const key = `${playlistId}\0${normalizedToken}`;
  const current = inflight.get(key);
  if (current) return current;

  const promise = (async () => {
    const loaded = await loadStoredOrFreshPage({
      store,
      playlistId,
      pageToken: normalizedToken,
      fetchPlaylistPage,
      now,
    });
    const playlistTitle = includePlaylistTitle
      ? await loadPlaylistTitle({
          store,
          playlistId,
          fetchPlaylistTitle,
          inflight,
          now,
        })
      : '';
    return buildPlaylistApiResponse({
      items: loaded.page.items,
      nextPageToken: loaded.page.nextPageToken,
      playlistTitle,
      includePlaylistTitle,
      maxResults,
      offset,
      cache: loaded.cache,
    });
  })().finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

export async function prepareYouTubePlaylistResponse({
  playlistId,
  pageToken = '',
  includePlaylistTitle = false,
  maxResults,
  offset = 0,
  apiKey,
  placeholderItems,
  placeholderTitle = '[Sample Playlist]',
  resolve,
}) {
  if (!isValidYouTubePlaylistId(playlistId)) {
    return {
      status: 400,
      body: { error: 'Invalid playlist ID' },
      headers: { 'Cache-Control': 'no-store' },
    };
  }

  if (!apiKey) {
    const body = includePlaylistTitle
      ? { items: placeholderItems, playlistTitle: placeholderTitle, isPlaceholder: true }
      : placeholderItems;
    return {
      status: 200,
      body,
      headers: { 'Cache-Control': 'no-store' },
    };
  }

  try {
    const result = await resolve({
      playlistId,
      pageToken,
      includePlaylistTitle,
      maxResults: clampYouTubePlaylistMaxResults(maxResults),
      offset: clampYouTubePlaylistOffset(offset),
      apiKey,
    });
    return {
      status: 200,
      body: result.payload,
      headers: result.headers,
    };
  } catch (error) {
    if (error?.rateLimitResponse) throw error;
    console.error('Error fetching playlist videos', error);
    const status =
      error instanceof YouTubePlaylistRequestError && error.status >= 400 && error.status <= 599
        ? error.status
        : 500;
    return {
      status,
      body: { error: 'Error fetching playlist videos' },
      headers: { 'Cache-Control': 'no-store' },
    };
  }
}

