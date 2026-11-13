import { json } from '@sveltejs/kit';
import { YOUTUBE_API_KEY } from '$app/env/private';
import { prepareYouTubeCommentsResponse } from '#lib/helpers/youtubeCommentsCache.js';
import { RATE_LIMITS, consumeRateLimit } from '#lib/server/rateLimit.js';
import { resolveStoredYouTubeComments } from '#lib/server/youtubeCommentsCache.js';

export const GET = async ({ params, request }) => {
  try {
    const prepared = await prepareYouTubeCommentsResponse({
      videoId: params.videoId,
      apiKey: YOUTUBE_API_KEY || '',
      resolve: (input) => resolveStoredYouTubeComments({
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
