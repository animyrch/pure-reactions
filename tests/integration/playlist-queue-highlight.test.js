import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PlaylistQueue from '../../src/lib/components/Video/PlaylistQueue.svelte';

const sharedVideoId = 'AAAAAAAAAAA';

const playlistItems = [
    {
        id: 'slot-0',
        originalVideoId: sharedVideoId,
        title: 'First copy',
    },
    {
        id: 'slot-1',
        originalVideoId: 'BBBBBBBBBBB',
        title: 'Other video',
    },
    {
        id: 'slot-2',
        originalVideoId: sharedVideoId,
        title: 'Second copy',
    },
];

const activeTitles = (body) =>
    [...body.matchAll(/aria-current="true"[\s\S]*?<span class="text-sm[^"]*"[^>]*>\s*([^<]+)/g)]
        .map((match) => match[1].trim());

describe('playlist queue highlight', () => {
    it('highlights only the sequence slot being watched when the original video repeats', () => {
        const { body } = render(PlaylistQueue, {
            props: {
                playlistItems,
                currentlyViewed: sharedVideoId,
                currentIndex: 2,
                playlistDocumentId: 'playlist-1',
                isCreation: false,
            },
        });

        expect(activeTitles(body)).toEqual(['Second copy']);
        expect(body.match(/aria-current="true"/g)).toHaveLength(1);
    });

    it('does not highlight later copies of the current original in the upcoming queue', () => {
        const { body } = render(PlaylistQueue, {
            props: {
                playlistItems,
                currentlyViewed: sharedVideoId,
                currentIndex: 0,
                playlistDocumentId: 'playlist-1',
                hideCurrentItem: true,
                isCreation: true,
            },
        });

        expect(body).toContain('Second copy');
        expect(body).not.toContain('aria-current="true"');
    });
});
