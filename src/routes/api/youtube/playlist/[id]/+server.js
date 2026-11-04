// src/routes/api/youtube/playlist/[id]/+server.js
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { prepareYouTubePlaylistResponse } from '$lib/helpers/youtubePlaylistCache';
import { resolveStoredYouTubePlaylist } from '$lib/server/youtubePlaylistCache';

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
  const prepared = await prepareYouTubePlaylistResponse({
    playlistId: params.id,
    pageToken: url.searchParams.get('pageToken') || '',
    includePlaylistTitle: url.searchParams.get('includePlaylistTitle') === '1',
    maxResults: url.searchParams.get('maxResults'),
    offset: url.searchParams.get('offset'),
    apiKey: env.YOUTUBE_API_KEY || '',
    placeholderItems: PLACEHOLDER_PLAYLIST_ITEMS,
    resolve: resolveStoredYouTubePlaylist,
  });

  return json(prepared.body, {
    status: prepared.status,
    headers: prepared.headers,
  });
};
