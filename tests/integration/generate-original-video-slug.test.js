import { describe, it, expect } from 'vitest';
import { generateOriginalVideoSlug } from '../../src/lib/helpers/originalVideo';

describe('generateOriginalVideoSlug', () => {
  it('should generate slug from title and author', () => {
    const slug = generateOriginalVideoSlug('Hello World', 'Test Author');
    expect(slug).toBe('hello-world-test-author');
  });

  it('should strip M/V suffix from title', () => {
    const slug = generateOriginalVideoSlug('Song Title (M/V)', 'Artist');
    expect(slug).toBe('song-title-artist');
  });

  it('should strip official video suffix from title', () => {
    const slug = generateOriginalVideoSlug('Song Title [Official Video]', 'Artist');
    expect(slug).toBe('song-title-artist');
  });

  it('should strip official music video suffix from title', () => {
    const slug = generateOriginalVideoSlug('Song Title (Official Music Video)', 'Artist');
    expect(slug).toBe('song-title-artist');
  });

  it('should convert to lowercase', () => {
    const slug = generateOriginalVideoSlug('UPPERCASE TITLE', 'UPPERCASE AUTHOR');
    expect(slug).toBe('uppercase-title-uppercase-author');
  });

  it('should remove special characters', () => {
    const slug = generateOriginalVideoSlug('Title@#$%Test', 'Author!&*()');
    expect(slug).toBe('title-test-author');
  });

  it('should handle empty title', () => {
    const slug = generateOriginalVideoSlug('', 'Author');
    expect(slug).toBe('author');
  });

  it('should handle empty author', () => {
    const slug = generateOriginalVideoSlug('Title', '');
    expect(slug).toBe('title');
  });

  it('should return fallback slug when both are empty', () => {
    const slug = generateOriginalVideoSlug('', '');
    expect(slug).toBe('original-content');
  });

  it('should handle author with @ symbol', () => {
    const slug = generateOriginalVideoSlug('Song', '@artist_name');
    expect(slug).toBe('song-artist-name');
  });

  it('should handle real-world BLACKPINK example', () => {
    const slug = generateOriginalVideoSlug('BLACKPINK - How You Like That (M/V)', 'BLACKPINK');
    expect(slug).toBe('blackpink-how-you-like-that-blackpink');
  });

  it('should handle real-world example with hyphens', () => {
    const slug = generateOriginalVideoSlug('Title - M/V', 'Creator');
    expect(slug).toBe('title-creator');
  });

  it('should strip official lyric video suffix', () => {
    const slug = generateOriginalVideoSlug('Song [Official Lyric Video]', 'Artist');
    expect(slug).toBe('song-artist');
  });

  it('should handle multiple spaces between words', () => {
    const slug = generateOriginalVideoSlug('Title   With    Spaces', 'Author');
    expect(slug).toBe('title-with-spaces-author');
  });
});
