import { describe, expect, it } from 'vitest';
import { pickOriginalVideoThumbnailFromReactions } from '../../src/lib/helpers/originalVideo';

describe('pickOriginalVideoThumbnailFromReactions', () => {
  it('uses the enriched YouTube thumbnail when originalVideoThumbnailUrl is empty', () => {
    const thumbnail = pickOriginalVideoThumbnailFromReactions([
      {
        originalVideoId: 'ioNng23DkIM',
        originalVideoPlatform: 'youtube',
        originalYoutube: {
          meta: {
            thumbnail: 'https://i.ytimg.com/vi/ioNng23DkIM/maxresdefault.jpg',
            thumbnailWidth: 1280,
            thumbnailHeight: 720,
          },
        },
      },
    ]);

    expect(thumbnail).toEqual({
      thumbnailUrl: 'https://i.ytimg.com/vi/ioNng23DkIM/maxresdefault.jpg',
      thumbnailWidth: 1280,
      thumbnailHeight: 720,
    });
  });

  it('keeps looking when the newest reaction has no stored thumbnail', () => {
    const thumbnail = pickOriginalVideoThumbnailFromReactions([
      { originalVideoId: 'newest', originalVideoPlatform: 'youtube' },
      {
        originalVideoThumbnailUrl: 'https://cdn.example/original.jpg',
        originalVideoThumbnailWidth: 640,
        originalVideoThumbnailHeight: 360,
      },
    ]);

    expect(thumbnail.thumbnailUrl).toBe('https://cdn.example/original.jpg');
    expect(thumbnail.thumbnailWidth).toBe(640);
    expect(thumbnail.thumbnailHeight).toBe(360);
  });

  it('builds a YouTube thumbnail from the video id when nothing is stored', () => {
    const thumbnail = pickOriginalVideoThumbnailFromReactions([
      { originalVideoId: 'ioNng23DkIM', originalVideoPlatform: 'youtube' },
    ]);

    expect(thumbnail.thumbnailUrl).toBe('https://i.ytimg.com/vi/ioNng23DkIM/hqdefault.jpg');
  });
});
