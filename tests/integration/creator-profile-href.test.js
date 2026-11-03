import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import CreatorDetails from '../../src/lib/components/Video/CreatorDetails.svelte';
import { safeCreatorProfileHref } from '../../src/lib/helpers/originalVideo.js';

const YOUTUBE_CHANNEL_ID = 'UCX6OQ3DkcsbYNE6H8uQQuVA';

describe('safeCreatorProfileHref', () => {
  it('keeps https YouTube and TikTok profile URLs and drops tracking queries', () => {
    expect(safeCreatorProfileHref('https://www.youtube.com/@MrBeast')).toBe(
      'https://www.youtube.com/@MrBeast',
    );
    expect(safeCreatorProfileHref('https://www.youtube.com/@Foo?si=abc')).toBe(
      'https://www.youtube.com/@Foo',
    );
    expect(safeCreatorProfileHref(`https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}`)).toBe(
      `https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}`,
    );
    expect(safeCreatorProfileHref('https://www.youtube.com/c/SomeChannel')).toBe(
      'https://www.youtube.com/c/SomeChannel',
    );
    expect(safeCreatorProfileHref('https://www.youtube.com/user/SomeUser/')).toBe(
      'https://www.youtube.com/user/SomeUser',
    );
    expect(safeCreatorProfileHref('https://m.youtube.com/@foo/')).toBe('https://m.youtube.com/@foo');
    expect(safeCreatorProfileHref('https://www.tiktok.com/@charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio',
    );
    expect(safeCreatorProfileHref(' https://www.youtube.com/Some Name ')).toBe(
      'https://www.youtube.com/Some%20Name',
    );
  });

  it('rejects other schemes, hosts, and non-profile paths', () => {
    expect(safeCreatorProfileHref('javascript:rejected')).toBeUndefined();
    expect(safeCreatorProfileHref('data:text/plain,no')).toBeUndefined();
    expect(safeCreatorProfileHref('http://www.youtube.com/@foo')).toBeUndefined();
    expect(safeCreatorProfileHref('https://example.com/@creator')).toBeUndefined();
    expect(safeCreatorProfileHref('https://www.youtube.com.example/@foo')).toBeUndefined();
    expect(safeCreatorProfileHref('https://vm.tiktok.com/@foo')).toBeUndefined();
    expect(safeCreatorProfileHref('https://youtu.be/@foo')).toBeUndefined();
    expect(safeCreatorProfileHref('https://example.com@www.youtube.com/@foo')).toBeUndefined();
    expect(safeCreatorProfileHref('https://www.youtube.com:8443/@foo')).toBeUndefined();
    expect(safeCreatorProfileHref('https://www.youtube.com/redirect?q=https://example.com')).toBeUndefined();
    expect(safeCreatorProfileHref('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeUndefined();
    expect(safeCreatorProfileHref('https://www.tiktok.com/@user/video/123')).toBeUndefined();
    expect(safeCreatorProfileHref('https://www.youtube.com/@foo%2fbar')).toBeUndefined();
    expect(safeCreatorProfileHref('https://www.youtube.com\\@example.com')).toBeUndefined();
    expect(safeCreatorProfileHref('https://www.youtube.com/@fo\u0000o')).toBeUndefined();
    expect(safeCreatorProfileHref('https://www.youtube.com/@fo\u0001o')).toBeUndefined();
    expect(safeCreatorProfileHref('https://www.youtube.com/@fo\u007fo')).toBeUndefined();
    expect(safeCreatorProfileHref('')).toBeUndefined();
    expect(safeCreatorProfileHref(null)).toBeUndefined();
  });
});

describe('CreatorDetails author link', () => {
  const details = {
    originalVideoTitle: 'Original',
    originalVideoAuthor: '@remix-owner',
    originalVideoId: 'origRemixPlay01',
    reactionVideoTitle: 'Reaction',
    reactionVideoAuthor: '@remix-owner',
    reactionVideoId: 'reactRemixWatch01',
    pageSlug: 'remixWatchReaction01',
  };

  it('uses a stored YouTube profile and removes the tracking query', () => {
    const { body } = render(CreatorDetails, {
      props: {
        ...details,
        originalVideoAuthorUrl: 'https://www.youtube.com/@remix-owner?si=tracking',
      },
    });

    expect(body).toContain('href="https://www.youtube.com/@remix-owner"');
    expect(body).not.toContain('si=tracking');
  });

  it('does not put a non-profile author URL on the creator link', () => {
    const { body } = render(CreatorDetails, {
      props: {
        ...details,
        originalVideoPlatform: 'tiktok',
        originalVideoAuthor: 'Creator Name',
        originalVideoAuthorUrl: 'javascript:rejected',
      },
    });

    expect(body).toContain('Creator Name');
    expect(body).not.toContain('javascript:');
    expect(body).not.toContain('href="https://www.youtube.com/Creator');
  });

  it('keeps the name-based YouTube link when a YouTube reaction has no safe author URL', () => {
    const { body } = render(CreatorDetails, {
      props: {
        ...details,
        originalVideoPlatform: 'youtube',
        originalVideoAuthorUrl: 'https://example.com/@remix-owner',
      },
    });

    expect(body).toContain('href="https://www.youtube.com/@remix-owner"');
    expect(body).not.toContain('example.com');
  });

  it('keeps an ordinary YouTube name and drops a reserved path', () => {
    const named = render(CreatorDetails, {
      props: {
        ...details,
        originalVideoPlatform: 'youtube',
        originalVideoAuthor: 'Some Name',
        originalVideoAuthorUrl: '',
      },
    });
    expect(named.body).toContain('href="https://www.youtube.com/Some%20Name"');

    const reserved = render(CreatorDetails, {
      props: {
        ...details,
        originalVideoPlatform: 'youtube',
        originalVideoAuthor: 'watch',
        originalVideoAuthorUrl: '',
      },
    });
    expect(reserved.body).toContain('>watch</span>');
    expect(reserved.body).not.toContain('youtube.com/watch');
  });
});
