import { describe, expect, it } from 'vitest';
import { canPublishReactionMedia } from '../../src/lib/helpers/reactionPublish.ts';

describe('canPublishReactionMedia', () => {
  it('blocks a normal reaction that has no reaction video', () => {
    expect(canPublishReactionMedia({ isReactionMissing: true, remixMode: false })).toBe(false);
    expect(canPublishReactionMedia({ reactionVideoId: '', remixMode: false })).toBe(false);
    expect(canPublishReactionMedia({ reactionVideoId: '   ' })).toBe(false);
  });

  it('allows a normal reaction that has a reaction video', () => {
    expect(canPublishReactionMedia({ isReactionMissing: false, remixMode: false })).toBe(true);
    expect(canPublishReactionMedia({ reactionVideoId: 'abc123def45' })).toBe(true);
  });

  it('allows a remix with no reaction video', () => {
    expect(
      canPublishReactionMedia({
        remixMode: true,
        isReactionMissing: true,
        reactionVideoId: ''
      })
    ).toBe(true);
  });
});
