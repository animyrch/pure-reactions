import { describe, expect, it } from 'vitest';
import { MOMENT_SORT_LABELS, MOMENT_SORT_OPTIONS } from '$lib/constants/moments';
import {
  compareMoments,
  normalizeMomentSort,
  pageRankedMoments,
  rankMoments
} from '$lib/helpers/moments';

const moment = (id, reactionCount, createdAt) => ({
  id,
  objectID: id,
  reactionCount,
  createdAt
});

describe('moment catalogue sort', () => {
  it('offers newest and most reactions', () => {
    expect(Object.keys(MOMENT_SORT_LABELS)).toEqual([
      MOMENT_SORT_OPTIONS.NEWEST,
      MOMENT_SORT_OPTIONS.MOST_REACTIONS
    ]);
    expect(Object.values(MOMENT_SORT_LABELS)).toEqual(['Newest', 'Most reactions']);
  });

  it('drops unknown sorts, including trending, back to newest', () => {
    expect(normalizeMomentSort('trending')).toBe(MOMENT_SORT_OPTIONS.NEWEST);
    expect(normalizeMomentSort('')).toBe(MOMENT_SORT_OPTIONS.NEWEST);
    expect(normalizeMomentSort('most-reactions')).toBe(MOMENT_SORT_OPTIONS.MOST_REACTIONS);
  });

  it('ranks a higher reaction count first and breaks ties by newest', () => {
    const moments = [
      moment('older-tie', 4, 1_000),
      moment('low', 1, 5_000),
      moment('newer-tie', 4, 2_000),
      moment('high', 12, 500),
      moment('missing', undefined, 9_000)
    ];

    expect(rankMoments(moments, MOMENT_SORT_OPTIONS.MOST_REACTIONS).map((entry) => entry.id)).toEqual([
      'high',
      'newer-tie',
      'older-tie',
      'low',
      'missing'
    ]);

    const ranked = rankMoments(moments, MOMENT_SORT_OPTIONS.MOST_REACTIONS);
    const firstPage = pageRankedMoments(ranked, '', 2);
    const secondPage = pageRankedMoments(ranked, firstPage[firstPage.length - 1].id, 2);
    expect(firstPage.map((entry) => entry.id)).toEqual(['high', 'newer-tie']);
    expect(secondPage.map((entry) => entry.id)).toEqual(['older-tie', 'low']);
    expect(pageRankedMoments(ranked, 'missing-cursor', 2)).toEqual([]);
  });

  it('ranks newest by creation time', () => {
    const moments = [
      moment('older', 12, 1_000),
      moment('newer', 1, 2_000)
    ];

    expect(
      [...moments]
        .sort((left, right) => compareMoments(left, right, MOMENT_SORT_OPTIONS.NEWEST))
        .map((entry) => entry.id)
    ).toEqual(['newer', 'older']);
  });
});
