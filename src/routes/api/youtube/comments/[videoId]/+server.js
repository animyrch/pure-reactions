import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { prepareYouTubeCommentsResponse } from '$lib/helpers/youtubeCommentsCache';
import { RATE_LIMITS, consumeRateLimit } from '$lib/server/rateLimit';
import { resolveStoredYouTubeComments } from '$lib/server/youtubeCommentsCache';

export const GET = async ({ params, request }) => {
  try {
    const prepared = await prepareYouTubeCommentsResponse({
      videoId: params.videoId,
      apiKey: env.YOUTUBE_API_KEY || '',
      resolve: (input) =>
        resolveStoredYouTubeComments({
          ...input,
          beforeUpstream: () =>
            consumeRateLimit({
              headers: request.headers,
              ...RATE_LIMITS.youtubeComments,
            }),
        }),
    });

    return json(prepared.body, {
      status: prepared.status,
      headers: prepared.headers,
    });
  } catch (error) {
    if (error?.rateLimitResponse) return error.rateLimitResponse;
    throw error;
  }
};
