import { describe, expect, it } from 'vitest';
import {
  assertMomentReady,
  mergeUnindexedMomentHits,
  momentMatchesQuery,
  shouldListMomentsFromFirestore
} from '$lib/helpers/moments';

describe('moment readiness', () => {
  it('accepts an original URL, title, and time with zero reactions', () => {
    const result = assertMomentReady({
      title: '  Snorting scream  ',
      originalVideoUrl: ' https://www.youtube.com/watch?v=abcdefghijk ',
      momentTimeSeconds: '42.5'
    });

    expect(result).toEqual({
      ok: true,
      value: {
        title: 'Snorting scream',
        originalVideoUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
        momentTimeSeconds: 42.5,
        reactionCount: 0
      }
    });
  });

  it('rejects a moment that is missing one of the three requirements', () => {
    expect(assertMomentReady({ title: 'Title', originalVideoUrl: '', momentTimeSeconds: 1 }).ok).toBe(false);
    expect(assertMomentReady({ title: '  ', originalVideoUrl: 'https://youtu.be/abcdefghijk', momentTimeSeconds: 1 }).ok).toBe(false);
    expect(assertMomentReady({ title: 'Title', originalVideoUrl: 'https://youtu.be/abcdefghijk', momentTimeSeconds: -1 }).ok).toBe(false);
  });

  it('lists the catalogue from Firestore even when Algolia is configured', () => {
    expect(shouldListMomentsFromFirestore({ query: '', hasAlgolia: true })).toBe(true);
    expect(shouldListMomentsFromFirestore({ query: '', tag: 'metal', hasAlgolia: true })).toBe(false);
    expect(shouldListMomentsFromFirestore({ query: 'scream', hasAlgolia: true })).toBe(false);
    expect(shouldListMomentsFromFirestore({ query: 'scream', hasAlgolia: false })).toBe(true);
  });

  it('keeps a brand-new zero-reaction moment ahead of indexed search hits', () => {
    const fresh = {
      id: 'new-moment',
      objectID: 'new-moment',
      title: 'Snorting scream',
      originalVideoUrl: 'https://youtu.be/abcdefghijk',
      reactionCount: 0
    };

    expect(momentMatchesQuery(fresh, 'snorting')).toBe(true);
    expect(
      mergeUnindexedMomentHits(
        [fresh, { objectID: 'already-indexed', title: 'Snorting scream' }],
        [{ objectID: 'already-indexed', title: 'Snorting scream', reactionCount: 3 }]
      ).map((moment) => moment.objectID)
    ).toEqual(['new-moment', 'already-indexed']);
  });
});
