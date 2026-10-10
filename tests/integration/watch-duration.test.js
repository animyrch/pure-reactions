import { describe, expect, it } from 'vitest';
import {
    buildWatchDurationPatch,
    displayedWatchDurationSeconds,
    formatWatchDuration,
    reactionWindowSeconds,
    remixShownSeconds,
    sumPlaylistReactionWindows,
} from '../../src/lib/helpers/watchDuration.js';
import {
    ensureReactionWatchDuration,
    syncReactionWatchDuration,
} from '../../src/lib/helpers/watchDurationSync.js';

const reaction = (overrides = {}) => ({
    youtube: { meta: { durationSeconds: 100 } },
    offsetStartTime: 0,
    ...overrides,
});

const memoryIo = ({ reactions = [], playlists = [] } = {}) => {
    const reactionMap = new Map(reactions.map((entry) => [entry.id, entry.data]));
    const playlistMap = new Map(playlists.map((entry) => [entry.id, entry.data]));
    const writes = [];
    return {
        writes,
        async getReaction(id) {
            const data = reactionMap.get(id);
            return data ? { id, data: { ...data } } : null;
        },
        async getReactions(ids) {
            return ids
                .filter((id) => reactionMap.has(id))
                .map((id) => ({ id, data: { ...reactionMap.get(id) } }));
        },
        async updateReaction(id, patch) {
            writes.push(['reaction', id, patch]);
            reactionMap.set(id, { ...reactionMap.get(id), ...patch });
        },
        async getPlaylist(id) {
            const data = playlistMap.get(id);
            return data ? { id, data: { ...data } } : null;
        },
        async updatePlaylist(id, patch) {
            writes.push(['playlist', id, patch]);
            playlistMap.set(id, { ...playlistMap.get(id), ...patch });
        },
    };
};

describe('watch duration formatting', () => {
    it('uses minutes and seconds under an hour, and hours after that', () => {
        expect(formatWatchDuration(45)).toBe('0:45');
        expect(formatWatchDuration(24 * 60 + 36)).toBe('24:36');
        expect(formatWatchDuration(60 * 60 + 24 * 60 + 36)).toBe('1:24:36');
        expect(formatWatchDuration(90 * 60)).toBe('1:30:00');
        expect(formatWatchDuration(0)).toBe('');
        expect(formatWatchDuration(null)).toBe('');
    });
});

describe('reaction and moment watch windows', () => {
    it('truncates the reaction duration with start and finish', () => {
        expect(reactionWindowSeconds(reaction({
            offsetStartTime: 10,
            reactionFinishTime: 40,
        }))).toBe(30);
        expect(reactionWindowSeconds(reaction())).toBe(100);
        expect(reactionWindowSeconds(reaction({ reactionFinishTime: 100000 }))).toBe(100);
        expect(reactionWindowSeconds({ offsetStartTime: 5 })).toBe(null);
    });

    it('stores the moment subsection even when the reaction also belongs to a playlist', () => {
        const data = reaction({
            isMomentReaction: true,
            momentId: 'moment-1',
            playlistId: 'playlist-1',
            offsetStartTime: 12,
            reactionFinishTime: 50,
        });
        expect(buildWatchDurationPatch(data, 400)).toEqual({
            reactionWatchDurationSeconds: 38,
            watchDurationSeconds: 38,
        });
    });
});

describe('remix watch time', () => {
    const remix = (overrides = {}) => reaction({
        remixMode: true,
        originalYoutube: { meta: { durationSeconds: 120 } },
        ...overrides,
    });

    it('removes jump spans, the end cue, and start or finish cuts', () => {
        expect(remixShownSeconds(remix({
            stateTimeline: [
                { t: 20, state: 1, targetTime: 50 },
                { t: 80, state: 2, targetTime: 80 },
            ],
        }))).toBe(50);

        expect(remixShownSeconds(remix({
            offsetStartTime: 10,
            reactionFinishTime: 100,
        }))).toBe(90);

        expect(remixShownSeconds(remix({
            offsetStartTime: 10,
            stateTimeline: [{ t: 80, state: 2, targetTime: 80 }],
        }))).toBe(70);
    });

    it('counts an overlapping skip and end cue once', () => {
        expect(remixShownSeconds(remix({
            stateTimeline: [
                { t: 20, state: 1, targetTime: 70 },
                { t: 60, state: 2, targetTime: 60 },
            ],
        }))).toBe(20);
    });

    it('reads legacy reaction config maps', () => {
        expect(remixShownSeconds(remix({
            reactionConfigs: {
                '20.0': { state: 1, time: '50.00' },
            },
        }))).toBe(90);
    });

    it('stores the shown original time on a remix that is not a playlist', () => {
        const patch = buildWatchDurationPatch(remix({
            stateTimeline: [{ t: 20, state: 1, targetTime: 50 }],
        }));
        expect(patch.watchDurationSeconds).toBe(90);
    });
});

describe('playlist and queue totals', () => {
    it('sums every filled slot and refuses a partial total', () => {
        const first = reaction({ youtube: { meta: { durationSeconds: 90 } }, offsetStartTime: 10 });
        const second = reaction({
            youtube: { meta: { durationSeconds: 50 } },
            offsetStartTime: 5,
            reactionFinishTime: 35,
        });
        const ids = ['a', 'b', 'a'];
        const byId = new Map([
            ['a', first],
            ['b', second],
        ]);
        expect(sumPlaylistReactionWindows(byId, ids)).toBe(80 + 30 + 80);
        expect(sumPlaylistReactionWindows(byId, ['a', 'missing'])).toBe(null);
        expect(sumPlaylistReactionWindows(new Map([['a', { offsetStartTime: 0 }]]), ['a'])).toBe(null);
    });

    it('stores the playlist total on a playlist card and keeps a queue on its own reaction', () => {
        const data = reaction({ playlistId: 'playlist-1' });
        expect(buildWatchDurationPatch(data, 240).watchDurationSeconds).toBe(240);

        expect(displayedWatchDurationSeconds({
            type: 'queue',
            data: {
                items: [{ type: 'reaction', id: 'a' }, { type: 'reaction', id: 'b' }],
                watchDurationSeconds: 40,
            },
        })).toBe(40);
        expect(displayedWatchDurationSeconds({
            type: 'queue',
            data: { items: [{ type: 'reaction', id: 'a' }] },
        })).toBe(null);
    });

    it('uses the stored card duration, and does not invent a playlist total', () => {
        expect(displayedWatchDurationSeconds({
            data: reaction({ watchDurationSeconds: 10 }),
        })).toBe(10);
        expect(displayedWatchDurationSeconds({
            data: reaction({ playlistId: 'playlist-1' }),
        })).toBe(null);
        expect(displayedWatchDurationSeconds({
            data: reaction({ offsetStartTime: 15, reactionFinishTime: 45 }),
        })).toBe(30);
    });
});

describe('stored watch duration sync', () => {
    it('writes the playlist total when a member changes and restores a reaction that leaves', async () => {
        const io = memoryIo({
            reactions: [
                {
                    id: 'a',
                    data: reaction({
                        playlistId: 'playlist-1',
                        offsetStartTime: 10,
                        reactionFinishTime: 40,
                    }),
                },
                {
                    id: 'b',
                    data: reaction({
                        playlistId: 'playlist-1',
                        youtube: { meta: { durationSeconds: 50 } },
                    }),
                },
            ],
            playlists: [
                { id: 'playlist-1', data: { reactionBinomeIds: ['a', 'b'] } },
            ],
        });

        await syncReactionWatchDuration({ reactionId: 'a', io });

        expect(io.writes).toEqual([
            ['playlist', 'playlist-1', { watchDurationSeconds: 80 }],
            ['reaction', 'a', { reactionWatchDurationSeconds: 30, watchDurationSeconds: 80 }],
            ['reaction', 'b', { reactionWatchDurationSeconds: 50, watchDurationSeconds: 80 }],
        ]);

        await io.updateReaction('a', { playlistId: '' });
        await io.updatePlaylist('playlist-1', { reactionBinomeIds: ['b'] });
        io.writes.length = 0;

        await syncReactionWatchDuration({
            reactionId: 'a',
            previousPlaylistId: 'playlist-1',
            io,
        });

        const restored = await io.getReaction('a');
        const remaining = await io.getReaction('b');
        const playlist = await io.getPlaylist('playlist-1');
        expect(restored.data.watchDurationSeconds).toBe(30);
        expect(remaining.data.watchDurationSeconds).toBe(50);
        expect(playlist.data.watchDurationSeconds).toBe(50);
    });

    it('keeps a moment card on its subsection while the playlist total includes it', async () => {
        const io = memoryIo({
            reactions: [
                {
                    id: 'moment',
                    data: reaction({
                        playlistId: 'playlist-1',
                        isMomentReaction: true,
                        momentId: 'moment-1',
                        offsetStartTime: 10,
                        reactionFinishTime: 40,
                    }),
                },
                {
                    id: 'sibling',
                    data: reaction({
                        playlistId: 'playlist-1',
                        youtube: { meta: { durationSeconds: 20 } },
                    }),
                },
            ],
            playlists: [
                { id: 'playlist-1', data: { reactionBinomeIds: ['moment', 'sibling'] } },
            ],
        });

        await syncReactionWatchDuration({ reactionId: 'moment', io });
        const moment = await io.getReaction('moment');
        const sibling = await io.getReaction('sibling');
        expect(moment.data.watchDurationSeconds).toBe(30);
        expect(sibling.data.watchDurationSeconds).toBe(50);
    });

    it('fills a missing duration once', async () => {
        const io = memoryIo({
            reactions: [{ id: 'solo', data: reaction({ offsetStartTime: 5 }) }],
        });
        const first = await ensureReactionWatchDuration(io, 'solo', reaction({ offsetStartTime: 5 }));
        expect(first.watchDurationSeconds).toBe(95);
        const writesAfterFirst = io.writes.length;
        const second = await ensureReactionWatchDuration(io, 'solo', first);
        expect(second.watchDurationSeconds).toBe(95);
        expect(io.writes.length).toBe(writesAfterFirst);
    });
});
