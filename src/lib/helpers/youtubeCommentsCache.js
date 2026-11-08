import { normalizeOriginalVideoPlatform, ORIGINAL_VIDEO_PLATFORMS } from '$lib/helpers/platform';

/**
 * Pure YouTube comment snapshot rules.
 * The server module owns Firestore, the catalog lookup, and the YouTube HTTP call.
 * A snapshot is reused until expiresAt. This module does not talk to Firestore.
 */

export const YOUTUBE_COMMENT_PAGE_SIZE = 10;
export const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
export const YOUTUBE_COMMENT_FRESH_MS = 24 * 60 * 60 * 1000;
export const YOUTUBE_COMMENT_QUIET_MS = 7 * 24 * 60 * 60 * 1000;
export const YOUTUBE_COMMENT_ERROR_MS = 10 * 60 * 1000;
export const YOUTUBE_COMMENT_CACHE_LOCK_TTL_MS = 15_000;
export const YOUTUBE_COMMENT_FETCH_TIMEOUT_MS = 8_000;
export const YOUTUBE_COMMENT_CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=2592000';

const COMMENT_OUTCOMES = new Set(['ok', 'empty', 'commentsDisabled', 'error']);
const QUOTA_REASONS = new Set([
  'quotaExceeded',
  'dailyLimitExceeded',
  'rateLimitExceeded',
  'userRateLimitExceeded',
]);

export function isValidYouTubeVideoId(videoId) {
  return typeof videoId === 'string' && YOUTUBE_VIDEO_ID_PATTERN.test(videoId);
}

export function commentSnapshotTtlMs(outcome) {
  if (outcome === 'ok') return YOUTUBE_COMMENT_FRESH_MS;
  if (outcome === 'empty' || outcome === 'commentsDisabled') return YOUTUBE_COMMENT_QUIET_MS;
  return YOUTUBE_COMMENT_ERROR_MS;
}

/**
 * A published reaction grants one comment lookup for its YouTube reaction video.
 * An original id grants a lookup only when that original is YouTube.
 * A missing platform stays YouTube, matching the reaction schema.
 * Drafts do not grant a lookup.
 *
 * @param {Record<string, unknown> | null | undefined} reaction
 * @param {string} videoId
 */
export function reactionGrantsCommentLookup(reaction, videoId) {
  if (!reaction || typeof reaction !== 'object' || reaction.isPublished !== true) return false;
  if (reaction.reactionVideoId === videoId) return true;
  if (reaction.originalVideoId !== videoId) return false;
  return normalizeOriginalVideoPlatform(reaction.originalVideoPlatform) === ORIGINAL_VIDEO_PLATFORMS.YOUTUBE;
}

export function buildOutboundCommentUrls(videoId, commentId) {
  const canonicalVideoUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const sectionActionUrl = `${canonicalVideoUrl}&lc=comments`;
  const viewThreadUrl = commentId
    ? `${canonicalVideoUrl}&lc=${encodeURIComponent(commentId)}`
    : sectionActionUrl;
  return { canonicalVideoUrl, sectionActionUrl, viewThreadUrl };
}

export function buildYouTubeCommentThreadUrl({ apiKey, videoId }) {
  const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('videoId', videoId);
  url.searchParams.set('order', 'relevance');
  url.searchParams.set('maxResults', String(YOUTUBE_COMMENT_PAGE_SIZE));
  url.searchParams.set('textFormat', 'plainText');
  url.searchParams.set('key', apiKey);
  return url;
}

function buildPlaceholderComments(videoId) {
  const { viewThreadUrl } = buildOutboundCommentUrls(videoId);
  return [
    {
      threadId: 'placeholder-thread-1',
      commentId: 'placeholder-comment-1',
      authorDisplayName: 'Sample Viewer',
      authorProfileUrl: null,
      authorAvatarUrl: null,
      textDisplay:
        'This is a placeholder comment — add a YOUTUBE_API_KEY to load real comments from YouTube.',
      publishedAt: '2024-06-01T12:00:00Z',
      updatedAt: '2024-06-01T12:00:00Z',
      likeCount: 42,
      replyCount: 3,
      viewThreadUrl,
    },
    {
      threadId: 'placeholder-thread-2',
      commentId: 'placeholder-comment-2',
      authorDisplayName: 'Another Viewer',
      authorProfileUrl: null,
      authorAvatarUrl: null,
      textDisplay: 'Wow, what a reaction! The moment at 1:23 had me in tears. Instant subscribe.',
      publishedAt: '2024-06-02T09:15:00Z',
      updatedAt: '2024-06-02T09:15:00Z',
      likeCount: 18,
      replyCount: 1,
      viewThreadUrl,
    },
    {
      threadId: 'placeholder-thread-3',
      commentId: 'placeholder-comment-3',
      authorDisplayName: 'Longtime Fan',
      authorProfileUrl: null,
      authorAvatarUrl: null,
      textDisplay: 'Been watching this channel for years — every reaction feels genuine. Loved this one.',
      publishedAt: '2024-06-03T17:45:00Z',
      updatedAt: '2024-06-03T17:45:00Z',
      likeCount: 7,
      replyCount: 0,
      viewThreadUrl,
    },
  ];
}

/**
 * Keep the preview fields the discussion UI reads. Drop YouTube-only metadata.
 *
 * @param {Record<string, unknown> | null | undefined} comment
 * @param {string} videoId
 */
export function presentYouTubeComment(comment, videoId) {
  const commentId = typeof comment?.commentId === 'string' ? comment.commentId : '';
  if (!commentId) return null;
  const { viewThreadUrl } = buildOutboundCommentUrls(videoId, commentId);
  return {
    threadId: typeof comment.threadId === 'string' && comment.threadId ? comment.threadId : commentId,
    commentId,
    authorDisplayName:
      typeof comment.authorDisplayName === 'string' && comment.authorDisplayName
        ? comment.authorDisplayName
        : 'YouTube user',
    authorProfileUrl: typeof comment.authorProfileUrl === 'string' ? comment.authorProfileUrl : null,
    authorAvatarUrl: typeof comment.authorAvatarUrl === 'string' ? comment.authorAvatarUrl : null,
    textDisplay: typeof comment.textDisplay === 'string' ? comment.textDisplay : '',
    publishedAt: typeof comment.publishedAt === 'string' ? comment.publishedAt : null,
    updatedAt: typeof comment.updatedAt === 'string' ? comment.updatedAt : null,
    likeCount: typeof comment.likeCount === 'number' ? comment.likeCount : 0,
    replyCount: typeof comment.replyCount === 'number' ? comment.replyCount : 0,
    viewThreadUrl,
  };
}

export function normalizeYouTubeComment(item, videoId) {
  const snippet = item?.snippet?.topLevelComment?.snippet;
  if (!snippet) return null;
  const commentId = item.snippet?.topLevelComment?.id || item.id;
  if (typeof commentId !== 'string' || !commentId) return null;
  return presentYouTubeComment(
    {
      threadId: typeof item.id === 'string' ? item.id : commentId,
      commentId,
      authorDisplayName: snippet.authorDisplayName,
      authorProfileUrl: snippet.authorChannelUrl || null,
      authorAvatarUrl: snippet.authorProfileImageUrl || null,
      textDisplay: snippet.textDisplay || '',
      publishedAt: snippet.publishedAt || null,
      updatedAt: snippet.updatedAt || null,
      likeCount: snippet.likeCount,
      replyCount: item.snippet?.totalReplyCount,
    },
    videoId,
  );
}

function storedComments(comments, videoId) {
  if (!Array.isArray(comments)) return [];
  return comments
    .map((comment) => presentYouTubeComment(comment, videoId))
    .filter(Boolean)
    .slice(0, YOUTUBE_COMMENT_PAGE_SIZE)
    .map(({ viewThreadUrl: _viewThreadUrl, ...stored }) => stored);
}

function youtubeErrorReasons(body) {
  const errors = body?.error?.errors;
  if (!Array.isArray(errors)) return [];
  return errors.map((entry) => entry?.reason).filter((reason) => typeof reason === 'string');
}

function messageSaysCommentsDisabled(body) {
  const message = body?.error?.message;
  return typeof message === 'string' && /disabled comments/i.test(message);
}

/**
 * Turn a YouTube commentThreads response into a snapshot outcome.
 * The returned object never includes the upstream body or the API key.
 *
 * @param {string} bodyText
 * @param {{ ok?: boolean, status?: number, videoId: string }} options
 */
export function interpretYouTubeCommentResponse(bodyText, { ok, status, videoId } = {}) {
  let data = null;
  if (bodyText) {
    try {
      data = JSON.parse(bodyText);
    } catch {
      data = null;
    }
  }

  if (!ok) {
    const reasons = youtubeErrorReasons(data);
    if (reasons.includes('commentsDisabled') || messageSaysCommentsDisabled(data)) {
      return { outcome: 'commentsDisabled', comments: [] };
    }
    if (reasons.some((reason) => QUOTA_REASONS.has(reason))) {
      return { outcome: 'error', errorKind: 'quota', comments: [] };
    }
    if (Number(status) === 404 || reasons.includes('videoNotFound') || reasons.includes('notFound')) {
      return { outcome: 'empty', comments: [] };
    }
    return { outcome: 'error', errorKind: 'upstream', comments: [] };
  }

  if (!data || !Array.isArray(data.items)) {
    return { outcome: 'error', errorKind: 'upstream', comments: [] };
  }

  const comments = data.items
    .map((item) => normalizeYouTubeComment(item, videoId))
    .filter(Boolean)
    .slice(0, YOUTUBE_COMMENT_PAGE_SIZE);
  return { outcome: comments.length > 0 ? 'ok' : 'empty', comments };
}

export function isFreshCommentSnapshot(snapshot, now) {
  if (!snapshot || snapshot.status !== 'ready') return false;
  if (!COMMENT_OUTCOMES.has(snapshot.outcome)) return false;
  if (typeof snapshot.expiresAt !== 'number' || snapshot.expiresAt <= now) return false;
  return Array.isArray(snapshot.comments);
}

export function buildCommentSnapshot({ videoId, fetched, now }) {
  const outcome = COMMENT_OUTCOMES.has(fetched?.outcome) ? fetched.outcome : 'error';
  const urls = buildOutboundCommentUrls(videoId);
  const snapshot = {
    status: 'ready',
    videoId,
    outcome,
    comments: storedComments(fetched?.comments, videoId),
    canonicalVideoUrl: urls.canonicalVideoUrl,
    sectionActionUrl: urls.sectionActionUrl,
    fetchedAt: now,
    expiresAt: now + commentSnapshotTtlMs(outcome),
    lockedAt: 0,
    lockId: '',
  };
  if (outcome === 'error' && typeof fetched?.errorKind === 'string' && fetched.errorKind) {
    snapshot.errorKind = fetched.errorKind;
  }
  return snapshot;
}

function responseHeaders(cache, outcome) {
  const shared = cache === 'hit' || cache === 'miss';
  const cacheable = shared && outcome !== 'error';
  return {
    'Cache-Control': cacheable ? YOUTUBE_COMMENT_CACHE_CONTROL : 'no-store',
    'x-youtube-comment-cache': cache,
  };
}

export function buildCommentApiResponse({ videoId, outcome, comments = [], cache, error }) {
  const urls = buildOutboundCommentUrls(videoId);
  const visibleComments = storedComments(comments, videoId).map((comment) =>
    presentYouTubeComment(comment, videoId),
  );
  const body = {
    status: outcome,
    videoId,
    comments: visibleComments,
  };
  if (outcome === 'ok' || outcome === 'empty') {
    body.canonicalVideoUrl = urls.canonicalVideoUrl;
    body.sectionActionUrl = urls.sectionActionUrl;
  }
  if (outcome === 'error') {
    body.error = error || 'Discussion is temporarily unavailable from YouTube.';
  }
  return {
    status: 200,
    body,
    headers: responseHeaders(cache, outcome),
  };
}

function responseFromSnapshot(snapshot, cache) {
  return buildCommentApiResponse({
    videoId: snapshot.videoId,
    outcome: snapshot.outcome,
    comments: snapshot.comments,
    cache,
    error: snapshot.outcome === 'error' ? 'Discussion is temporarily unavailable from YouTube.' : undefined,
  });
}

export function buildPlaceholderCommentResponse(videoId) {
  const urls = buildOutboundCommentUrls(videoId);
  return {
    status: 200,
    body: {
      status: 'ok',
      videoId,
      canonicalVideoUrl: urls.canonicalVideoUrl,
      sectionActionUrl: urls.sectionActionUrl,
      comments: buildPlaceholderComments(videoId),
      isPlaceholder: true,
    },
    headers: {
      'Cache-Control': YOUTUBE_COMMENT_CACHE_CONTROL,
    },
  };
}

async function loadFreshOrFetch({ store, videoId, isKnownVideo, fetchComments, now }) {
  const existing = await store.readFresh(videoId, now());
  if (existing) return responseFromSnapshot(existing, 'hit');

  const known = await isKnownVideo(videoId);
  if (!known) {
    return buildCommentApiResponse({ videoId, outcome: 'empty', comments: [], cache: 'skip' });
  }

  let claim = null;
  try {
    claim = await store.claim(videoId, now());
    if (claim.state === 'ready' && isFreshCommentSnapshot(claim.snapshot, now())) {
      return responseFromSnapshot(claim.snapshot, 'hit');
    }
    if (claim.state === 'pending') {
      const waited = await store.waitForFresh(videoId);
      if (isFreshCommentSnapshot(waited, now())) return responseFromSnapshot(waited, 'hit');
      claim = await store.claim(videoId, now());
      if (claim.state === 'ready' && isFreshCommentSnapshot(claim.snapshot, now())) {
        return responseFromSnapshot(claim.snapshot, 'hit');
      }
    }
    if (claim.state !== 'claimed' || !claim.lockId) {
      return buildCommentApiResponse({
        videoId,
        outcome: 'error',
        comments: [],
        cache: 'wait',
      });
    }

    const fetched = await fetchComments(videoId);
    const snapshot = buildCommentSnapshot({ videoId, fetched, now: now() });
    await store.write(videoId, snapshot, claim.lockId);
    return responseFromSnapshot(snapshot, 'miss');
  } catch (error) {
    if (claim?.state === 'claimed' && claim.lockId) {
      await store.release(videoId, claim.lockId).catch(() => {});
    }
    throw error;
  }
}

export async function resolveCachedYouTubeComments({
  videoId,
  store,
  isKnownVideo,
  fetchComments,
  inflight,
  now = () => Date.now(),
}) {
  const current = inflight.get(videoId);
  if (current) return current;

  const promise = loadFreshOrFetch({
    store,
    videoId,
    isKnownVideo,
    fetchComments,
    now,
  }).finally(() => {
    if (inflight.get(videoId) === promise) inflight.delete(videoId);
  });

  inflight.set(videoId, promise);
  return promise;
}

export async function prepareYouTubeCommentsResponse({ videoId, apiKey, resolve }) {
  if (!isValidYouTubeVideoId(videoId)) {
    return {
      status: 400,
      body: { status: 'error', error: 'Invalid video ID', comments: [] },
      headers: { 'Cache-Control': 'no-store' },
    };
  }

  if (!apiKey) return buildPlaceholderCommentResponse(videoId);

  try {
    return await resolve({ videoId, apiKey });
  } catch (error) {
    if (error?.rateLimitResponse) throw error;
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      'Error fetching YouTube comments',
      message.replace(/key=[^&\s]+/gi, 'key=redacted'),
    );
    return {
      status: 500,
      body: { status: 'error', error: 'Error fetching YouTube comments', comments: [] },
      headers: { 'Cache-Control': 'no-store' },
    };
  }
}
