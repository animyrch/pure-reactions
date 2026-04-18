/**
 * Client-side helpers for fetching and normalizing YouTube discussion data.
 *
 * These functions call the internal `/api/youtube/comments/[videoId]` server
 * route so the YouTube API key is never exposed to the browser.
 */

/**
 * Possible status values returned by the comments API.
 * @typedef {'ok' | 'empty' | 'commentsDisabled' | 'error'} CommentStatus
 */

/**
 * @typedef {Object} YouTubeComment
 * @property {string} threadId
 * @property {string} commentId
 * @property {string} authorDisplayName
 * @property {string|null} authorProfileUrl
 * @property {string|null} authorAvatarUrl
 * @property {string} textDisplay
 * @property {string|null} publishedAt
 * @property {string|null} updatedAt
 * @property {number} likeCount
 * @property {number} replyCount
 * @property {string} viewThreadUrl
 * @property {string} replyOnYoutubeUrl
 */

/**
 * @typedef {Object} DiscussionPayload
 * @property {CommentStatus} status
 * @property {string} videoId
 * @property {string} [canonicalVideoUrl]
 * @property {string} [sectionActionUrl]
 * @property {YouTubeComment[]} comments
 */

/**
 * Fetch YouTube discussion data for a single video via the internal API route.
 *
 * @param {string} videoId — YouTube video ID
 * @returns {Promise<DiscussionPayload>}
 */
export async function fetchYouTubeComments(videoId) {
  if (!videoId) {
    return { status: 'error', videoId: '', comments: [] };
  }

  try {
    const res = await fetch(`/api/youtube/comments/${encodeURIComponent(videoId)}`);

    if (!res.ok) {
      // Try to parse structured error from our own API
      try {
        const body = await res.json();
        return {
          status: body?.status || 'error',
          videoId,
          comments: [],
        };
      } catch {
        return { status: 'error', videoId, comments: [] };
      }
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { status: 'error', videoId, comments: [] };
    }

    return await res.json();
  } catch {
    return { status: 'error', videoId, comments: [] };
  }
}

/**
 * Determine which discussion sections to show for a reaction page.
 *
 * Rules:
 * - If both videos are YouTube and have different IDs → two sections.
 * - If both videos are YouTube with the same ID → one deduplicated section.
 * - If only one side is YouTube → one section.
 * - If neither is YouTube → no sections.
 *
 * @param {Object} opts
 * @param {string} [opts.reactionVideoId]
 * @param {string} [opts.originalVideoId]
 * @param {string} [opts.originalVideoPlatform] - 'youtube' | 'tiktok' | etc.
 * @returns {{ sections: Array<{ videoId: string, sourceType: 'reaction' | 'original', sourceLabel: string }> }}
 */
export function resolveDiscussionSections({
  reactionVideoId,
  originalVideoId,
  originalVideoPlatform = 'youtube',
} = {}) {
  const sections = [];

  const isOriginalYouTube =
    originalVideoId &&
    (!originalVideoPlatform || originalVideoPlatform === 'youtube');

  const isReactionYouTube = Boolean(reactionVideoId);

  // Deduplicate: if both point to the same video, show only once
  if (
    isOriginalYouTube &&
    isReactionYouTube &&
    originalVideoId === reactionVideoId
  ) {
    sections.push({
      videoId: originalVideoId,
      sourceType: 'reaction',
      sourceLabel: 'Reaction Video',
    });
    return { sections };
  }

  if (isOriginalYouTube) {
    sections.push({
      videoId: originalVideoId,
      sourceType: 'original',
      sourceLabel: 'Original Video',
    });
  }

  if (isReactionYouTube) {
    sections.push({
      videoId: reactionVideoId,
      sourceType: 'reaction',
      sourceLabel: 'Reaction Video',
    });
  }

  return { sections };
}

/**
 * Format a relative-time string for a comment's publishedAt ISO timestamp.
 * Returns a compact label like "3 days ago" or "just now".
 *
 * @param {string|null} isoDate
 * @returns {string}
 */
export function formatCommentAge(isoDate) {
  if (!isoDate) return '';

  const then = new Date(isoDate);
  if (Number.isNaN(then.getTime())) return '';

  const now = Date.now();
  const diffMs = now - then.getTime();
  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Format a like count with compact notation.
 *
 * @param {number} count
 * @returns {string}
 */
export function formatLikeCount(count) {
  if (!count || count <= 0) return '';
  if (count < 1000) return String(count);
  // Show one decimal place for low thousands (e.g. "1.5K") but round to whole
  // for 10K+ where the decimal digit adds little value (e.g. "15K" not "15.0K").
  if (count < 1_000_000) return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}K`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}
