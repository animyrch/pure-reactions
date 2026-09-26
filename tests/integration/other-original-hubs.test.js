import { describe, expect, it } from 'vitest';
import { buildOtherOriginalHubs } from '../../src/lib/helpers/originalVideo';

const reaction = (slug, title, extra = {}) => ({
  id: slug,
  data: {
    originalVideoSlug: slug,
    originalVideoTitle: title,
    originalVideoPlatform: 'youtube',
    originalVideoId: extra.originalVideoId || 'vid',
    originalYoutube: extra.thumbnail
      ? { meta: { thumbnail: extra.thumbnail, thumbnailWidth: 1280, thumbnailHeight: 720 } }
      : undefined,
    ...extra,
  },
});

describe('buildOtherOriginalHubs', () => {
  it('keeps one card per other original and drops the current hub', () => {
    const hubs = buildOtherOriginalHubs([
      reaction('current-blackpink', 'Current'),
      reaction('current-blackpink', 'Current again'),
      reaction('other-a-blackpink', 'Other A', { thumbnail: 'https://img.example/a.jpg', originalVideoId: 'aaa' }),
      reaction('other-a-blackpink', 'Other A duplicate', { originalVideoId: 'aaa' }),
      reaction('other-b-blackpink', 'Other B', { thumbnail: 'https://img.example/b.jpg', originalVideoId: 'bbb' }),
    ], 'current-blackpink');

    expect(hubs.map((hub) => hub.slug)).toEqual(['other-a-blackpink', 'other-b-blackpink']);
    expect(hubs[0]).toMatchObject({
      title: 'Other A',
      thumbnailUrl: 'https://img.example/a.jpg',
      reactionCount: 2,
    });
    expect(hubs[1].reactionCount).toBe(1);
  });

  it('returns nothing when every reaction is for the current original', () => {
    expect(buildOtherOriginalHubs([
      reaction('only-blackpink', 'Only'),
    ], 'only-blackpink')).toEqual([]);
  });
});
