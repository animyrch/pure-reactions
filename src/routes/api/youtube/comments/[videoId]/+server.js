// src/routes/api/youtube/comments/[videoId]/+server.js
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/** Maximum top-level comments the endpoint will ever return. */
const MAX_RESULTS_LIMIT = 10;

/** Cache policy for shared/CDN caches. 1 minimum cache, 30 day forced-update */
const CACHE_CONTROL_HEADER = 'public, s-maxage=86400, stale-while-revalidate=2592000';

/** Only allow relevance ordering to keep API usage predictable. */
const ALLOWED_ORDER = 'relevance';

/**
 * Build deterministic placeholder comments for use when no API key is configured.
 * Returns the same normalized shape produced by normalizeComment() so all UI paths
 * render correctly during local development.
 *
 * @param {string} videoId
 * @param {string} sectionActionUrl
 * @returns {import('./types').YouTubeComment[]}
 */
function buildPlaceholderComments(videoId, sectionActionUrl) {
  const viewThreadUrl = sectionActionUrl;
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
 * Build outbound YouTube URLs for a given video and comment thread.
 */
function buildOutboundUrls(videoId, commentId) {
  const canonicalVideoUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const sectionActionUrl = `${canonicalVideoUrl}&lc=comments`;
  const viewThreadUrl = commentId
    ? `${canonicalVideoUrl}&lc=${encodeURIComponent(commentId)}`
    : sectionActionUrl;

  return { canonicalVideoUrl, sectionActionUrl, viewThreadUrl };
}

/**
 * Normalize a YouTube commentThread resource into the shape expected by the UI.
 */
function normalizeComment(item, videoId) {
  const snippet = item?.snippet?.topLevelComment?.snippet;
  if (!snippet) return null;

  const commentId = item.snippet?.topLevelComment?.id || item.id;
  const { viewThreadUrl } = buildOutboundUrls(videoId, commentId);

  return {
    threadId: item.id,
    commentId,
    authorDisplayName: snippet.authorDisplayName || 'YouTube user',
    authorProfileUrl: snippet.authorChannelUrl || null,
    authorAvatarUrl: snippet.authorProfileImageUrl || null,
    textDisplay: snippet.textDisplay || '',
    publishedAt: snippet.publishedAt || null,
    updatedAt: snippet.updatedAt || null,
    likeCount: typeof snippet.likeCount === 'number' ? snippet.likeCount : 0,
    replyCount: typeof item.snippet?.totalReplyCount === 'number' ? item.snippet.totalReplyCount : 0,
    viewThreadUrl,
  };
}

export const GET = async ({ params }) => {
  const YOUTUBE_API_KEY = env.YOUTUBE_API_KEY || '';
  const videoId = params.videoId;

  if (!videoId || !/^[a-zA-Z0-9_-]{1,64}$/.test(videoId)) {
    return json(
      { status: 'error', error: 'Invalid video ID', comments: [] },
      { status: 400 },
    );
  }

  // Local / contributor mode: return placeholder comments when no API key is configured.
  // Uses the same normalized shape produced by normalizeComment() so every UI rendering
  // path (comment list, avatars, like counts, outbound links) can be verified locally.
  if (!YOUTUBE_API_KEY) {
    const { canonicalVideoUrl, sectionActionUrl } = buildOutboundUrls(videoId);
    return json(
      {
        status: 'ok',
        videoId,
        canonicalVideoUrl,
        sectionActionUrl,
        comments: buildPlaceholderComments(videoId, sectionActionUrl),
        isPlaceholder: true,
      },
      { status: 200, headers: cacheHeaders() },
    );
  }

  const requestUrl =
    `https://www.googleapis.com/youtube/v3/commentThreads` +
    `?part=snippet` +
    `&videoId=${encodeURIComponent(videoId)}` +
    `&order=${ALLOWED_ORDER}` +
    `&maxResults=${MAX_RESULTS_LIMIT}` +
    `&textFormat=plainText` +
    `&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;

  try {
    const res = await fetch(requestUrl);
    const bodyText = await res.text();

    if (!res.ok) {
      // YouTube returns 403 when comments are disabled for a video
      let youtubeError;
      try {
        youtubeError = JSON.parse(bodyText);
      } catch {
        // non-JSON error from YouTube
      }

      const isCommentsDisabled =
        res.status === 403 &&
        youtubeError?.error?.errors?.some(
          (e) => e.reason === 'commentsDisabled' || e.reason === 'forbidden',
        );

      if (isCommentsDisabled) {
        return json(
          { status: 'commentsDisabled', videoId, comments: [] },
          {
            status: 200,
            headers: cacheHeaders(),
          },
        );
      }

      return json(
        {
          status: 'error',
          error: 'Failed to fetch comments from YouTube',
          youtubeStatus: res.status,
          comments: [],
        },
        { status: res.status >= 500 ? 502 : res.status },
      );
    }

    if (!bodyText) {
      return json(
        { status: 'error', error: 'No data received from YouTube', comments: [] },
        { status: 502 },
      );
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch {
      return json(
        { status: 'error', error: 'YouTube returned non-JSON response', comments: [] },
        { status: 502 },
      );
    }

    const { canonicalVideoUrl, sectionActionUrl } = buildOutboundUrls(videoId);
    const comments = (data.items || [])
      .map((item) => normalizeComment(item, videoId))
      .filter(Boolean);

    const payload = {
      status: comments.length > 0 ? 'ok' : 'empty',
      videoId,
      canonicalVideoUrl,
      sectionActionUrl,
      comments,
    };

    return json(payload, {
      status: 200,
      headers: cacheHeaders(),
    });
  } catch (err) {
    return json(
      { status: 'error', error: 'Error fetching YouTube comments', details: String(err), comments: [] },
      { status: 500 },
    );
  }
};

/**
 * Return cache-control headers.
 */
function cacheHeaders() {
  return {
    'Cache-Control': CACHE_CONTROL_HEADER,
  };
}
