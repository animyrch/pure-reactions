import { YOUTUBE_API_KEY } from '$env/static/private';

export const GET = async ({ params }) => {
  const playlistId = params.id;

  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${YOUTUBE_API_KEY}`;

  try {
    const res = await fetch(url);

    // Check if the response is OK (status 200)
    if (!res.ok) {
        console.error('Failed to fetch data', res.statusText);
        return new Response('Failed to fetch data from YouTube', { status: 500 });
    }
    // Check if the response body is empty
    const text = await res.text();
    if (!text) {
      console.error('No data received from YouTube');
      return new Response('No data received', { status: 500 });
    }
    // Try to parse the response as JSON
    const data = JSON.parse(text);

    // Ensure the data has the expected structure
    if (!data.items) {
      console.error('Unexpected response structure:', data);
      return new Response('Unexpected response structure', { status: 500 });
    }
   
    return new Response(JSON.stringify(data.items), { status: 200 });
  } catch (err) {
    console.error('Error fetching playlist videos:', err);
    return new Response('Failed to fetch data', { status: 500 });
  }
};
