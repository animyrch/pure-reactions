import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { prepareYouTubeCommentsResponse } from '$lib/helpers/youtubeCommentsCache';
import { resolveStoredYouTubeComments } from '$lib/server/youtubeCommentsCache';

export const GET = async ({ params }) => {
  const prepared = await prepareYouTubeCommentsResponse({
    videoId: params.videoId,
    apiKey: env.YOUTUBE_API_KEY || '',
    resolve: resolveStoredYouTubeComments,
  });

  return json(prepared.body, {
    status: prepared.status,
    headers: prepared.headers,
  });
};
