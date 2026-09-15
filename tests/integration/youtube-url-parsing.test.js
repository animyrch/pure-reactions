import { describe, it, expect } from 'vitest';
import { parseYouTubeUrl, extractYouTubeVideoId } from '$lib/helpers/youtube';

const VALID_ID = 'LEv2fMoVvXE';

describe('parseYouTubeUrl', () => {
  describe('standard watch URLs', () => {
    it('extracts ID from basic watch URL', () => {
      const result = parseYouTubeUrl(`https://www.youtube.com/watch?v=${VALID_ID}`);
      expect(result).toEqual({ videoId: VALID_ID, error: null });
    });

    it('extracts ID from watch URL with extra query params', () => {
      const result = parseYouTubeUrl(
        `https://www.youtube.com/watch?v=${VALID_ID}&ab_channel=SomeChannel&t=42`
      );
      expect(result).toEqual({ videoId: VALID_ID, error: null });
    });

    it('extracts ID from watch URL with list param', () => {
      const result = parseYouTubeUrl(
        `https://www.youtube.com/watch?v=${VALID_ID}&list=PLxxxxxx`
      );
      expect(result).toEqual({ videoId: VALID_ID, error: null });
    });

    it('extracts ID from watch URL with si param', () => {
      const result = parseYouTubeUrl(
        `https://www.youtube.com/watch?v=${VALID_ID}&si=SNxsWCJfigFYILvg`
      );
      expect(result).toEqual({ videoId: VALID_ID, error: null });
    });

    it('extracts ID from mobile youtube.com URL', () => {
      const result = parseYouTubeUrl(`https://m.youtube.com/watch?v=${VALID_ID}`);
      expect(result).toEqual({ videoId: VALID_ID, error: null });
    });
  });

  describe('short URLs (youtu.be)', () => {
    it('extracts ID from youtu.be URL', () => {
      const result = parseYouTubeUrl(`https://youtu.be/${VALID_ID}`);
      expect(result).toEqual({ videoId: VALID_ID, error: null });
    });

    it('extracts ID from youtu.be URL with si param', () => {
      const result = parseYouTubeUrl(`https://youtu.be/${VALID_ID}?si=SNxsWCJfigFYILvg`);
      expect(result).toEqual({ videoId: VALID_ID, error: null });
    });

    it('extracts ID from youtu.be URL with t param', () => {
      const result = parseYouTubeUrl(`https://youtu.be/${VALID_ID}?t=30`);
      expect(result).toEqual({ videoId: VALID_ID, error: null });
    });
  });

  describe('embed URLs', () => {
    it('extracts ID from embed URL', () => {
      const result = parseYouTubeUrl(`https://www.youtube.com/embed/${VALID_ID}`);
      expect(result).toEqual({ videoId: VALID_ID, error: null });
    });

    it('extracts ID from embed URL with query params', () => {
      const result = parseYouTubeUrl(
        `https://www.youtube.com/embed/${VALID_ID}?autoplay=1`
      );
      expect(result).toEqual({ videoId: VALID_ID, error: null });
    });
  });

  describe('shorts URLs', () => {
    it('extracts ID from shorts URL', () => {
      const result = parseYouTubeUrl(`https://www.youtube.com/shorts/3JnmAl_8W5k`);
      expect(result).toEqual({ videoId: '3JnmAl_8W5k', error: null });
    });

    it('extracts ID from shorts URL with query params', () => {
      const result = parseYouTubeUrl(
        `https://www.youtube.com/shorts/3JnmAl_8W5k?feature=share`
      );
      expect(result).toEqual({ videoId: '3JnmAl_8W5k', error: null });
    });
  });

  describe('bare video ID', () => {
    it('accepts a bare 11-character video ID', () => {
      const result = parseYouTubeUrl(VALID_ID);
      expect(result).toEqual({ videoId: VALID_ID, error: null });
    });

    it('accepts a bare ID with underscores and hyphens', () => {
      const result = parseYouTubeUrl('8-3PahRtgF4');
      expect(result).toEqual({ videoId: '8-3PahRtgF4', error: null });
    });
  });

  describe('malformed URLs', () => {
    it('returns error for empty string', () => {
      const result = parseYouTubeUrl('');
      expect(result.videoId).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('returns error for null input', () => {
      const result = parseYouTubeUrl(null);
      expect(result.videoId).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('returns error for undefined input', () => {
      const result = parseYouTubeUrl(undefined);
      expect(result.videoId).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('returns error for invalid URL syntax', () => {
      const result = parseYouTubeUrl('not a url at all !!!');
      expect(result.videoId).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('returns error for a URL missing the video ID', () => {
      const result = parseYouTubeUrl('https://www.youtube.com/watch?v=');
      expect(result.videoId).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('returns error for watch URL with short (invalid) video ID', () => {
      const result = parseYouTubeUrl('https://www.youtube.com/watch?v=abc');
      expect(result.videoId).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  describe('unsupported YouTube URL types', () => {
    it('returns error for channel URL', () => {
      const result = parseYouTubeUrl('https://www.youtube.com/channel/UCxxxxxx');
      expect(result.videoId).toBeNull();
      expect(result.error).toMatch(/channel|page/i);
    });

    it('returns error for user URL', () => {
      const result = parseYouTubeUrl('https://www.youtube.com/user/SomeName');
      expect(result.videoId).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('returns error for custom handle URL', () => {
      const result = parseYouTubeUrl('https://www.youtube.com/c/ChannelName');
      expect(result.videoId).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('returns error for search results URL', () => {
      const result = parseYouTubeUrl(
        'https://www.youtube.com/results?search_query=cats'
      );
      expect(result.videoId).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('returns error for playlist-only URL without video', () => {
      const result = parseYouTubeUrl(
        'https://www.youtube.com/playlist?list=PLxxxxxx'
      );
      expect(result.videoId).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('returns error for non-YouTube URL', () => {
      const result = parseYouTubeUrl('https://vimeo.com/123456789');
      expect(result.videoId).toBeNull();
      expect(result.error).toMatch(/YouTube/i);
    });
  });

  describe('missing or invalid video IDs', () => {
    it('returns error for youtu.be with no path', () => {
      const result = parseYouTubeUrl('https://youtu.be/');
      expect(result.videoId).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('returns error for embed path with no ID', () => {
      const result = parseYouTubeUrl('https://www.youtube.com/embed/');
      expect(result.videoId).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('returns error for shorts path with no ID', () => {
      const result = parseYouTubeUrl('https://www.youtube.com/shorts/');
      expect(result.videoId).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  describe('error message shape', () => {
    it('always returns { videoId, error } shape on failure', () => {
      const result = parseYouTubeUrl('https://example.com');
      expect(result).toHaveProperty('videoId', null);
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });

    it('always returns { videoId, error } shape on success', () => {
      const result = parseYouTubeUrl(VALID_ID);
      expect(result).toHaveProperty('videoId', VALID_ID);
      expect(result).toHaveProperty('error', null);
    });
  });
});

describe('extractYouTubeVideoId (backward-compatible wrapper)', () => {
  it('returns video ID for valid watch URL', () => {
    expect(extractYouTubeVideoId(`https://www.youtube.com/watch?v=${VALID_ID}`)).toBe(VALID_ID);
  });

  it('returns video ID for youtu.be URL', () => {
    expect(extractYouTubeVideoId(`https://youtu.be/${VALID_ID}`)).toBe(VALID_ID);
  });

  it('returns null for invalid input', () => {
    expect(extractYouTubeVideoId('not-valid')).toBeNull();
  });

  it('returns null for channel URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/channel/UCxxxxxx')).toBeNull();
  });
});
