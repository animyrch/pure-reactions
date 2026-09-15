import {
  basicVideoDetailsUrl,
  videoIdPlaceholder,
  YOUTUBE_URL
} from '$lib/constants/youtube';

const getBasicVideoDetailsWithEmbedApi = async (videoId) => {
    try {
        const response = await fetch(basicVideoDetailsUrl.replace(videoIdPlaceholder, videoId));
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching data:', error.message);
      }
};

export const downloadBasicVideoDetails = async (videoId) => {
  const videoDetails = await getBasicVideoDetailsWithEmbedApi(videoId);
  return {
    videoAuthor: getAuthorFromAuthorUrl(videoDetails?.author_url),
    videoTitle: videoDetails?.title
  };
};

export const getAuthorFromAuthorUrl = (authorUrl) => {
  if (!authorUrl) return authorUrl;

  // oEmbed returns percent-encoded handles for non-ASCII names (e.g. Japanese);
  // decode them so we store the readable channel handle instead of raw escapes.
  try {
    return decodeURIComponent(authorUrl).replace(YOUTUBE_URL, '');
  } catch (error) {
    console.error('Failed to decode author URL', error);
    return authorUrl.replace(YOUTUBE_URL, '');
  }
};

const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

// Paths under youtube.com that refer to non-video pages
const UNSUPPORTED_YOUTUBE_PATHS = /^\/(channel|c|user|playlist|feed|results|gaming|live|hashtag|post|clip)(\/|$|\?)/i;

/**
 * Parses a YouTube URL (or bare video ID) and returns the canonical video ID
 * together with a user-friendly error when extraction fails.
 *
 * Supported formats:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://www.youtube.com/embed/VIDEO_ID
 *   https://www.youtube.com/shorts/VIDEO_ID
 *   https://www.youtube.com/v/VIDEO_ID
 *   VIDEO_ID (bare 11-character ID)
 *
 * @param {string} input
 * @returns {{ videoId: string, error: null } | { videoId: null, error: string }}
 */
export const parseYouTubeUrl = (input) => {
  if (!input || typeof input !== 'string') {
    return { videoId: null, error: 'Please enter a YouTube URL or video ID.' };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { videoId: null, error: 'Please enter a YouTube URL or video ID.' };
  }

  // Bare 11-character video ID
  if (YOUTUBE_VIDEO_ID_REGEX.test(trimmed)) {
    return { videoId: trimmed, error: null };
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return { videoId: null, error: 'That doesn\'t look like a valid URL. Please check and try again.' };
  }

  const { hostname, pathname, searchParams } = url;
  const isYouTube = hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'm.youtube.com';
  const isYouTuBe = hostname === 'youtu.be';

  if (!isYouTube && !isYouTuBe) {
    return { videoId: null, error: 'Only YouTube URLs are supported.' };
  }

  if (isYouTuBe) {
    // https://youtu.be/VIDEO_ID
    const id = pathname.slice(1).split('/')[0];
    if (YOUTUBE_VIDEO_ID_REGEX.test(id)) {
      return { videoId: id, error: null };
    }
    return { videoId: null, error: 'Could not find a valid video ID in that YouTube URL.' };
  }

  // youtube.com — check for unsupported path patterns first
  if (UNSUPPORTED_YOUTUBE_PATHS.test(pathname)) {
    return { videoId: null, error: 'That YouTube URL points to a channel or page, not a specific video. Please use a video URL.' };
  }

  // /watch?v=VIDEO_ID
  if (pathname === '/watch') {
    const id = searchParams.get('v');
    if (id && YOUTUBE_VIDEO_ID_REGEX.test(id)) {
      return { videoId: id, error: null };
    }
    return { videoId: null, error: 'Could not find a valid video ID in that YouTube URL.' };
  }

  // /embed/VIDEO_ID, /shorts/VIDEO_ID, /v/VIDEO_ID
  const pathMatch = pathname.match(/^\/(embed|shorts|v)\/([^/?]+)/);
  if (pathMatch) {
    const id = pathMatch[2];
    if (YOUTUBE_VIDEO_ID_REGEX.test(id)) {
      return { videoId: id, error: null };
    }
    return { videoId: null, error: 'Could not find a valid video ID in that YouTube URL.' };
  }

  return { videoId: null, error: 'Unsupported YouTube URL format. Please use a standard video link.' };
};

/**
 * Extracts the YouTube video ID from a URL or bare ID string.
 * Returns the video ID string on success, or null when extraction fails.
 *
 * Prefer `parseYouTubeUrl` when you need a user-facing error message.
 *
 * Supported formats:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://www.youtube.com/embed/VIDEO_ID
 *   https://www.youtube.com/shorts/VIDEO_ID
 *   VIDEO_ID (bare 11-character ID)
 */
export const extractYouTubeVideoId = (originalUrl) => {
  const { videoId } = parseYouTubeUrl(originalUrl);
  return videoId;
};

export const extractYoutubePlaylistId = (originalUrl) => {
    let playlistId = null;
    if (originalUrl.includes('youtube.com') || originalUrl.includes('youtu.be')) {
        const urlParams = new URLSearchParams(new URL(originalUrl).search);
        playlistId = urlParams.get('list');
    }
    return playlistId;
}

export async function fetchFirstPlaylistVideos(playlistId) {
  const res = await fetch(`/api/youtube/playlist/${playlistId}`);

  if (!res.ok) {
    const text = await res.text(); // works even if server returns text/html
    throw new Error(text || `Failed to load playlist (HTTP ${res.status})`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Expected JSON, got ${contentType}: ${text}`);
  }

  return await res.json();
}

export async function fetchPlaylistPreviewMetadata(playlistId) {
  const params = new URLSearchParams({
    includePlaylistTitle: '1',
    maxResults: '1',
  });
  const res = await fetch(`/api/youtube/playlist/${playlistId}?${params.toString()}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to load playlist preview (HTTP ${res.status})`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Expected JSON, got ${contentType}: ${text}`);
  }

  const payload = await res.json();
  if (Array.isArray(payload)) {
    return {
      items: payload,
      playlistTitle: '',
    };
  }

  if (!Array.isArray(payload?.items)) {
    throw new Error('Unexpected playlist preview response.');
  }

  return {
    items: payload.items,
    playlistTitle: payload?.playlistTitle || '',
  };
}

export async function fetchAllPlaylistVideos(playlistId) {
  const items = [];
  let nextPageToken = '';

  do {
    const params = new URLSearchParams();
    if (nextPageToken) {
      params.set('pageToken', nextPageToken);
    }

    const querySuffix = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/youtube/playlist/${playlistId}${querySuffix}`);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed to load playlist (HTTP ${res.status})`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw new Error(`Expected JSON, got ${contentType}: ${text}`);
    }

    const pageItems = await res.json();
    if (Array.isArray(pageItems)) {
      items.push(...pageItems);
    }
    nextPageToken = res.headers.get('x-next-page-token') || '';
  } while (nextPageToken);

  return items;
}