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

/**
 *  // Examples
 * 'https://youtu.be/LEv2fMoVvXE?si=SNxsWCJfigFYILvg';
 * 'https://www.youtube.com/watch?v=LEv2fMoVvXE&ab_channel=AsmongoldTV';
 * 'https://www.youtube.com/watch?v=LEv2fMoVvXE';
 * 'https://www.youtube.com/shorts/3JnmAl_8W5k'
 * 'LEv2fMoVvXE';
 */
export const extractYouTubeVideoId = (originalUrl) => {
  const regex = /^([a-zA-Z0-9_-]{11})$|(youtu\.be\/|youtube\.com\/(watch\?(.*&)?v=|(embed|v|shorts)\/))([^?&"'>]+)/;
  const matches = originalUrl.match(regex);
  return matches ? (matches[1] || matches[6]) : null;
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