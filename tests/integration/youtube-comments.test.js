import { describe, it, expect } from 'vitest';
import {
  resolveDiscussionSections,
  formatCommentAge,
  formatLikeCount,
} from '$lib/helpers/youtubeComments';

describe('resolveDiscussionSections', () => {
  it('returns two sections when both videos are YouTube with different IDs', () => {
    const { sections } = resolveDiscussionSections({
      reactionVideoId: 'abc123',
      originalVideoId: 'xyz789',
      originalVideoPlatform: 'youtube',
    });
    expect(sections).toHaveLength(2);
    expect(sections[0]).toEqual({
      videoId: 'xyz789',
      sourceType: 'original',
      sourceLabel: 'Original Video',
    });
    expect(sections[1]).toEqual({
      videoId: 'abc123',
      sourceType: 'reaction',
      sourceLabel: 'Reaction Video',
    });
  });

  it('returns one deduplicated section when both IDs are the same', () => {
    const { sections } = resolveDiscussionSections({
      reactionVideoId: 'same123',
      originalVideoId: 'same123',
      originalVideoPlatform: 'youtube',
    });
    expect(sections).toHaveLength(1);
    expect(sections[0].videoId).toBe('same123');
    expect(sections[0].sourceType).toBe('reaction');
  });

  it('returns only reaction section when original is TikTok', () => {
    const { sections } = resolveDiscussionSections({
      reactionVideoId: 'abc123',
      originalVideoId: 'tiktok_vid',
      originalVideoPlatform: 'tiktok',
    });
    expect(sections).toHaveLength(1);
    expect(sections[0].sourceType).toBe('reaction');
    expect(sections[0].videoId).toBe('abc123');
  });

  it('returns only original section when reaction video ID is missing', () => {
    const { sections } = resolveDiscussionSections({
      reactionVideoId: '',
      originalVideoId: 'orig123',
      originalVideoPlatform: 'youtube',
    });
    expect(sections).toHaveLength(1);
    expect(sections[0].sourceType).toBe('original');
  });

  it('returns empty when neither video is YouTube', () => {
    const { sections } = resolveDiscussionSections({
      reactionVideoId: '',
      originalVideoId: '',
      originalVideoPlatform: 'tiktok',
    });
    expect(sections).toHaveLength(0);
  });

  it('returns empty when called with no arguments', () => {
    const { sections } = resolveDiscussionSections();
    expect(sections).toHaveLength(0);
  });

  it('treats missing originalVideoPlatform as youtube', () => {
    const { sections } = resolveDiscussionSections({
      reactionVideoId: 'r1',
      originalVideoId: 'o1',
    });
    expect(sections).toHaveLength(2);
  });
});

describe('formatCommentAge', () => {
  it('returns empty string for null or empty input', () => {
    expect(formatCommentAge(null)).toBe('');
    expect(formatCommentAge('')).toBe('');
  });

  it('returns "just now" for very recent timestamps', () => {
    const recent = new Date(Date.now() - 15_000).toISOString(); // 15s ago
    expect(formatCommentAge(recent)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(formatCommentAge(tenMinAgo)).toBe('10m ago');
  });

  it('returns hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatCommentAge(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatCommentAge(fiveDaysAgo)).toBe('5d ago');
  });

  it('returns months ago', () => {
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatCommentAge(threeMonthsAgo)).toBe('3mo ago');
  });

  it('returns years ago', () => {
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatCommentAge(twoYearsAgo)).toBe('2y ago');
  });

  it('returns empty string for invalid date', () => {
    expect(formatCommentAge('not-a-date')).toBe('');
  });
});

describe('formatLikeCount', () => {
  it('returns empty string for 0 or negative', () => {
    expect(formatLikeCount(0)).toBe('');
    expect(formatLikeCount(-5)).toBe('');
  });

  it('returns plain number under 1000', () => {
    expect(formatLikeCount(42)).toBe('42');
    expect(formatLikeCount(999)).toBe('999');
  });

  it('returns K notation for thousands', () => {
    expect(formatLikeCount(1500)).toBe('1.5K');
    expect(formatLikeCount(15000)).toBe('15K');
  });

  it('returns M notation for millions', () => {
    expect(formatLikeCount(2_500_000)).toBe('2.5M');
  });
});
