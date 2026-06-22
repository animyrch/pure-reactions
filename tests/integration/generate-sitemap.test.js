import { describe, expect, it } from 'vitest';
import {
  buildOriginalVideoSitemapEntries,
  buildReactionSitemapEntries
} from '../../scripts/generate-sitemap.js';

function makeReaction(id, originalVideoId, originalVideoSlug, overrides = {}) {
  return {
    id,
    data: {
      originalVideoId,
      originalVideoSlug,
      originalVideoTitle: overrides.originalVideoTitle ?? `Original ${originalVideoId}`,
      originalVideoDescription: overrides.originalVideoDescription ?? `Description for ${originalVideoId}`,
      originalVideoThumbnailUrl: overrides.originalVideoThumbnailUrl ?? `https://cdn.example/${originalVideoId}.jpg`,
      originalVideoUrl: overrides.originalVideoUrl ?? `https://www.youtube.com/watch?v=${originalVideoId}`,
      createdAt: overrides.createdAt ?? '2025-01-01T00:00:00.000Z',
      updatedAt: overrides.updatedAt ?? '2025-01-02T00:00:00.000Z',
      isPublished: true,
      ...overrides
    }
  };
}

describe('buildOriginalVideoSitemapEntries', () => {
  it('emits one canonical /reactions/[slug] entry per original video with at least two published reactions', () => {
    const reactions = [
      makeReaction('reaction-a1', 'original-a', 'alpha-video-creator-a'),
      makeReaction('reaction-a2', 'original-a', 'alpha-video-creator-a', {
        updatedAt: '2025-01-03T00:00:00.000Z'
      }),
      makeReaction('reaction-b1', 'original-b', 'bravo-video-creator-b'),
      makeReaction('reaction-b2', 'original-b', 'bravo-video-creator-b'),
      makeReaction('reaction-b3', 'original-b', 'bravo-video-creator-b', {
        updatedAt: '2025-01-04T00:00:00.000Z'
      }),
      makeReaction('reaction-c1', 'original-c', 'charlie-video-creator-c')
    ];

    const entries = buildOriginalVideoSitemapEntries(reactions, 'https://purereactions.com');

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.originalVideoId)).toEqual(['original-a', 'original-b']);
    expect(entries.map((entry) => entry.slug)).toEqual([
      'alpha-video-creator-a',
      'bravo-video-creator-b'
    ]);
    expect(entries.map((entry) => entry.loc)).toEqual([
      'https://purereactions.com/reactions/alpha-video-creator-a',
      'https://purereactions.com/reactions/bravo-video-creator-b'
    ]);
    expect(entries[0].lines).toContain(
      '<loc>https://purereactions.com/reactions/alpha-video-creator-a</loc>'
    );
    expect(entries[1].lines).toContain(
      '<loc>https://purereactions.com/reactions/bravo-video-creator-b</loc>'
    );
    expect(entries[0].lines).not.toContain('charlie-video-creator-c');
  });

  it('keeps the existing per-reaction sitemap entries', () => {
    const reactions = [
      makeReaction('reaction-a1', 'original-a', 'alpha-video-creator-a'),
      makeReaction('reaction-b1', 'original-b', 'bravo-video-creator-b')
    ];

    const entries = buildReactionSitemapEntries(reactions, 'https://purereactions.com');

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.loc)).toEqual([
      'https://purereactions.com/reaction/reaction-a1',
      'https://purereactions.com/reaction/reaction-b1'
    ]);
  });
});