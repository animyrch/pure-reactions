import { json } from '@sveltejs/kit';
import { fetchOriginalVideoMetadataForPlatform } from '$lib/server/originalVideoMetadata';

export const GET = async ({ url }) => {
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
    });

    return json({
      metadata: result.metadata,
      rawMeta: result.meta,
    });
  } catch (error) {
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