// src/routes/api/youtube/comments/[videoId]/+server.js
import { json } from '@sveltejs/kit';
import { YOUTUBE_API_KEY } from '$env/static/private';

/** Maximum top-level comments the endpoint will ever return. */
const MAX_RESULTS_LIMIT = 10;

/** Only allow relevance ordering to keep API usage predictable. */
const ALLOWED_ORDER = 'relevance';

/**
 * Build outbound YouTube URLs for a given video and comment thread.
 */
function buildOutboundUrls(videoId, commentId) {
  const canonicalVideoUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const sectionActionUrl = `${canonicalVideoUrl}&lc=comments`;
  const viewThreadUrl = commentId
    ? `${canonicalVideoUrl}&lc=${encodeURIComponent(commentId)}`
    : sectionActionUrl;
  const replyOnYoutubeUrl = viewThreadUrl;

  return { canonicalVideoUrl, sectionActionUrl, viewThreadUrl, replyOnYoutubeUrl };
}

/**
 * Normalize a YouTube commentThread resource into the shape expected by the UI.
 */
function normalizeComment(item, videoId) {
  const snippet = item?.snippet?.topLevelComment?.snippet;
  if (!snippet) return null;

  const commentId = item.snippet?.topLevelComment?.id || item.id;
  const { viewThreadUrl, replyOnYoutubeUrl } = buildOutboundUrls(videoId, commentId);

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
    replyOnYoutubeUrl,
  };
}

export const GET = async ({ params }) => {
  const videoId = params.videoId;

  if (!videoId || !/^[a-zA-Z0-9_-]{1,64}$/.test(videoId)) {
    return json(
      { status: 'error', error: 'Invalid video ID', comments: [] },
      { status: 400 },
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
 * ~5 min fresh + ~30 min stale-while-revalidate.
 */
function cacheHeaders() {
  return {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800',
  };
}
