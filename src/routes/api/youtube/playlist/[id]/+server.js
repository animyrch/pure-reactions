// src/routes/api/youtube/playlist/[id]/+server.js
import { json } from '@sveltejs/kit';
import { YOUTUBE_API_KEY } from '$env/static/private';

export const GET = async ({ params }) => {
  const playlistId = params.id;

  const url =
    `https://www.googleapis.com/youtube/v3/playlistItems` +
    `?part=snippet&playlistId=${encodeURIComponent(playlistId)}` +
    `&maxResults=50&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;

  try {
    const res = await fetch(url);
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

    // ✅ Proper JSON response + content-type
    return json(data.items);
  } catch (err) {
    return json(
      { error: 'Error fetching playlist videos', details: String(err) },
      { status: 500 }
    );
  }
};
