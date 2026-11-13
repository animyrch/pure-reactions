import { json } from '@sveltejs/kit';
import { fetchOriginalVideoMetadataForPlatform } from '#lib/server/originalVideoMetadata.js';
import { RATE_LIMITS, consumeRateLimit } from '#lib/server/rateLimit.js';

export const GET = async ({ url, request }) => {
  try {
    const platform = url.searchParams.get('platform') || 'youtube';
    const videoId = url.searchParams.get('videoId') || '';
    const videoUrl = url.searchParams.get('videoUrl') || '';

    if (!videoId.trim()) {
      return json({ error: 'videoId is required' }, { status: 400 });
    }

    const result = await fetchOriginalVideoMetadataForPlatform({
      platform,
      videoId: videoId.trim(),
      videoUrl: videoUrl.trim(),
      beforeUpstream: () =>
        consumeRateLimit({
          headers: request.headers,
          ...RATE_LIMITS.originalVideoMetadata,
        }),
    });

    const headers = result.cache ? { 'x-tiktok-metadata-cache': result.cache } : undefined;

    return json(
      {
        metadata: result.metadata,
        rawMeta: result.meta,
      },
      headers ? { headers } : undefined,
    );
  } catch (error) {
    if (error?.rateLimitResponse) return error.rateLimitResponse;
    console.error('Failed to fetch original video metadata', error);
    return json(
      {
        error: 'Failed to fetch original video metadata',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
};
