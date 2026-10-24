import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import QueueCover from '../../src/lib/components/QueueCover.svelte';
import {
    attachQueueCovers,
    coverVideoIdsForItems,
    queueCoverPresentation,
} from '../../src/lib/helpers/queueCover.js';

const reactionItem = (id, reactionVideoId, originalVideoId = '') => ({
    type: 'reaction',
    reaction: { id, data: { reactionVideoId, originalVideoId } },
});

describe('queue cover selection', () => {
    it('uses the first thumbnail when the queue has fewer than four', () => {
        expect(queueCoverPresentation(['a'])).toEqual({ layout: 'single', videoIds: ['a'] });
        expect(queueCoverPresentation(['a', 'b', 'c'])).toEqual({ layout: 'single', videoIds: ['a'] });
        expect(coverVideoIdsForItems([
            reactionItem('1', 'video-1'),
            reactionItem('2', 'video-2'),
            reactionItem('3', '', 'original-3'),
        ])).toEqual(['video-1']);
    });

    it('uses the first four thumbnails in order once a quadrant cover is full', () => {
        expect(queueCoverPresentation(['a', 'b', 'c', 'd', 'e'])).toEqual({
            layout: 'quadrants',
            videoIds: ['a', 'b', 'c', 'd'],
        });
        expect(coverVideoIdsForItems([
            reactionItem('1', 'video-1'),
            reactionItem('2', '', 'original-2'),
            { type: 'playlist', playlist: { firstReaction: { data: { reactionVideoId: 'playlist-video' } } } },
            reactionItem('4', 'video-4'),
            reactionItem('5', 'video-5'),
        ])).toEqual(['video-1', 'original-2', 'playlist-video', 'video-4']);
    });

    it('stays empty when the first entries have no thumbnail', () => {
        expect(queueCoverPresentation([])).toEqual({ layout: 'empty', videoIds: [] });
        expect(coverVideoIdsForItems([
            reactionItem('1', '  '),
            { type: 'playlist', playlist: { firstReaction: null } },
        ])).toEqual([]);
    });
});

describe('queue cover loading', () => {
    it('loads only the first four entries and keeps a playlist on its first reaction', async () => {
        const requestedReactions = [];
        const requestedPlaylists = [];
        const queues = await attachQueueCovers([
            {
                id: 'evening',
                data: {
                    title: 'Evening',
                    items: [
                        { type: 'reaction', id: 'r1' },
                        { type: 'playlist', id: 'p1' },
                        { type: 'reaction', id: 'r2' },
                        { type: 'note', id: 'ignore' },
                        { type: 'reaction', id: 'r3' },
                        { type: 'reaction', id: 'r4' },
                    ],
                },
            },
            {
                id: 'short',
                data: {
                    title: 'Short',
                    items: [{ type: 'reaction', id: 'only' }],
                },
            },
        ], {
            getReactionsByIds: async (ids) => {
                requestedReactions.push(...ids);
                const videos = {
                    r1: 'vid-1',
                    r2: 'vid-2',
                    r3: 'vid-3',
                    only: 'only-vid',
                    'playlist-first': 'from-playlist',
                };
                return ids
                    .filter((id) => videos[id])
                    .map((id) => ({ id, data: { reactionVideoId: videos[id] } }));
            },
            getPlaylist: async (id) => {
                requestedPlaylists.push(id);
                return { reactionBinomeIds: ['playlist-first'] };
            },
        });

        expect(requestedPlaylists).toEqual(['p1']);
        expect(requestedReactions).not.toContain('r4');
        expect(queues[0].data.coverVideoIds).toEqual(['vid-1', 'from-playlist', 'vid-2', 'vid-3']);
        expect(queues[0].data.title).toBe('Evening');
        expect(queues[1].data.coverVideoIds).toEqual(['only-vid']);
    });

    it('keeps the first thumbnail when one of the first four entries is missing', async () => {
        const queues = await attachQueueCovers([
            {
                id: 'partial',
                data: {
                    items: [
                        { type: 'reaction', id: 'gone' },
                        { type: 'reaction', id: 'kept' },
                        { type: 'reaction', id: 'also' },
                    ],
                },
            },
        ], {
            getReactionsByIds: async () => [{ id: 'kept', data: { reactionVideoId: 'kept-vid' } }, { id: 'also', data: { originalVideoId: 'also-vid' } }],
            getPlaylist: async () => null,
        });

        expect(queues[0].data.coverVideoIds).toEqual(['kept-vid']);
    });
});

describe('queue cover markup', () => {
    it('draws one image for a short queue', () => {
        const { body } = render(QueueCover, { props: { videoIds: ['one', 'two'] } });

        expect(body).toContain('data-queue-cover="single"');
        expect(body).toContain('https://i.ytimg.com/vi/one/mqdefault.jpg');
        expect(body).not.toContain('/vi/two/');
    });

    it('draws the first four images in quadrants', () => {
        const { body } = render(QueueCover, {
            props: { videoIds: ['a', 'b', 'c', 'd', 'e'] },
        });

        expect(body).toContain('data-queue-cover="quadrants"');
        for (const id of ['a', 'b', 'c', 'd']) {
            expect(body).toContain(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`);
        }
        expect(body).not.toContain('/vi/e/');
    });

    it('keeps the placeholder when a queue has no cover yet', () => {
        const { body } = render(QueueCover, { props: { videoIds: [] } });

        expect(body).toContain('data-queue-cover="empty"');
        expect(body).toContain('Reaction Queue');
    });
});
