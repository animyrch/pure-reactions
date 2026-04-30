// src/routes/api/youtube/playlist/[id]/+server.js
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Deterministic sample playlist items returned when no YOUTUBE_API_KEY is configured.
 * Uses well-known public video IDs so thumbnails resolve without an API call, allowing
 * developers to verify playlist UI rendering paths end-to-end without third-party access.
 */
const PLACEHOLDER_PLAYLIST_ITEMS = [
  {
    id: 'placeholder-item-1',
    snippet: {
      title: '[Sample] Never Gonna Give You Up',
      channelTitle: 'Rick Astley',
      resourceId: { videoId: 'dQw4w9WgXcQ' },
      thumbnails: {
        default:  { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',     width: 120, height: 90  },
        medium:   { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',   width: 320, height: 180 },
        high:     { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',   width: 480, height: 360 },
        standard: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/sddefault.jpg',   width: 640, height: 480 },
        maxres:   { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg', width: 1280, height: 720 },
      },
    },
  },
  {
    id: 'placeholder-item-2',
    snippet: {
      title: '[Sample] Me at the zoo',
      channelTitle: 'jawed',
      resourceId: { videoId: 'jNQXAC9IVRw' },
      thumbnails: {
        default:  { url: 'https://i.ytimg.com/vi/jNQXAC9IVRw/default.jpg',     width: 120, height: 90  },
        medium:   { url: 'https://i.ytimg.com/vi/jNQXAC9IVRw/mqdefault.jpg',   width: 320, height: 180 },
        high:     { url: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg',   width: 480, height: 360 },
        standard: { url: 'https://i.ytimg.com/vi/jNQXAC9IVRw/sddefault.jpg',   width: 640, height: 480 },
        maxres:   { url: 'https://i.ytimg.com/vi/jNQXAC9IVRw/maxresdefault.jpg', width: 1280, height: 720 },
      },
    },
  },
  {
    id: 'placeholder-item-3',
    snippet: {
      title: '[Sample] PSY — Gangnam Style',
      channelTitle: 'officialpsy',
      resourceId: { videoId: '9bZkp7q19f0' },
      thumbnails: {
        default:  { url: 'https://i.ytimg.com/vi/9bZkp7q19f0/default.jpg',     width: 120, height: 90  },
        medium:   { url: 'https://i.ytimg.com/vi/9bZkp7q19f0/mqdefault.jpg',   width: 320, height: 180 },
        high:     { url: 'https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg',   width: 480, height: 360 },
        standard: { url: 'https://i.ytimg.com/vi/9bZkp7q19f0/sddefault.jpg',   width: 640, height: 480 },
        maxres:   { url: 'https://i.ytimg.com/vi/9bZkp7q19f0/maxresdefault.jpg', width: 1280, height: 720 },
      },
    },
  },
];

export const GET = async ({ params, url }) => {
  const YOUTUBE_API_KEY = env.YOUTUBE_API_KEY || '';
  const playlistId = params.id;
  const pageToken = url.searchParams.get('pageToken') || '';
  const includePlaylistTitle = url.searchParams.get('includePlaylistTitle') === '1';
  const maxResults = Math.min(
    Math.max(Number(url.searchParams.get('maxResults')) || 50, 1),
    50,
  );

  // Local / contributor mode: return placeholder playlist when no API key is configured.
  // Placeholder items use the same snippet shape as real YouTube playlistItems resources,
  // so every UI rendering path can be verified without third-party access.
  if (!YOUTUBE_API_KEY) {
    const payload = includePlaylistTitle
      ? { items: PLACEHOLDER_PLAYLIST_ITEMS, playlistTitle: '[Sample Playlist]', isPlaceholder: true }
      : PLACEHOLDER_PLAYLIST_ITEMS;
    return json(payload);
  }

  const requestUrl =
    `https://www.googleapis.com/youtube/v3/playlistItems` +
    `?part=snippet&playlistId=${encodeURIComponent(playlistId)}` +
    (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '') +
    `&maxResults=${encodeURIComponent(String(maxResults))}&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;

  const playlistMetadataUrl =
    `https://www.googleapis.com/youtube/v3/playlists` +
    `?part=snippet&id=${encodeURIComponent(playlistId)}` +
    `&maxResults=1&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;

  try {
    const res = await fetch(requestUrl);
    const bodyText = await res.text(); // read once, then parse if possible

    if (!res.ok) {
      // Return JSON error (and include upstream body for debugging)
      return json(
        {
          error: 'Failed to fetch data from YouTube',
          youtubeStatus: res.status,
          youtubeStatusText: res.statusText,
          youtubeBody: bodyText.slice(0, 2000),
        },
        { status: res.status }
      );
    }

    if (!bodyText) {
      return json({ error: 'No data received from YouTube' }, { status: 502 });
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch {
      return json(
        { error: 'YouTube returned non-JSON response', youtubeBody: bodyText.slice(0, 2000) },
        { status: 502 }
      );
    }

    if (!Array.isArray(data.items)) {
      return json(
        { error: 'Unexpected YouTube response structure', youtubeBody: data },
        { status: 502 }
      );
    }

    let playlistTitle = '';
    if (includePlaylistTitle) {
      try {
        const metadataResponse = await fetch(playlistMetadataUrl);
        const metadataBody = await metadataResponse.text();
        if (metadataResponse.ok && metadataBody) {
          const metadata = JSON.parse(metadataBody);
          playlistTitle = metadata?.items?.[0]?.snippet?.title || '';
        }
      } catch (error) {
        console.error('Failed to fetch playlist metadata', error);
      }
    }

    const responsePayload = includePlaylistTitle
      ? {
          items: data.items,
          playlistTitle,
        }
      : data.items;

    return json(responsePayload, {
      headers: data.nextPageToken
        ? {
            'x-next-page-token': data.nextPageToken,
          }
        : undefined,
    });
  } catch (err) {
    return json(
      { error: 'Error fetching playlist videos', details: String(err) },
      { status: 500 }
    );
  }
};
