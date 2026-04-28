// src/routes/api/youtube/playlist/[id]/+server.js
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const GET = async ({ params, url }) => {
  const YOUTUBE_API_KEY = env.YOUTUBE_API_KEY || '';
  const playlistId = params.id;
  const pageToken = url.searchParams.get('pageToken') || '';
  const includePlaylistTitle = url.searchParams.get('includePlaylistTitle') === '1';
  const maxResults = Math.min(
    Math.max(Number(url.searchParams.get('maxResults')) || 50, 1),
    50,
  );

  // Local / contributor mode: return empty playlist when no API key is configured.
  if (!YOUTUBE_API_KEY) {
    const payload = includePlaylistTitle
      ? { items: [], playlistTitle: '' }
      : [];
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
