import { describe, expect, it } from 'vitest';
import {
    PLAYBACK_FRAME_COLORS,
    resolvePlaybackFrameKind
} from '../../src/lib/helpers/reactionListItem.js';

describe('playback frame kind', () => {
    it('leaves a standalone reaction unmarked', () => {
        expect(resolvePlaybackFrameKind()).toBe('reaction');
        expect(PLAYBACK_FRAME_COLORS.reaction).toBeUndefined();
    });

    it('uses the moment route color even before reaction data loads', () => {
        expect(resolvePlaybackFrameKind({ routeKind: 'moment' })).toBe('moment');
    });

    it('keeps a playlist page on the playlist color', () => {
        expect(resolvePlaybackFrameKind({
            routeKind: 'playlist',
            isMomentReaction: true,
            momentId: 'moment-1',
            queueSlug: 'my-queue'
        })).toBe('playlist');
    });

    it('keeps a moment reaction amber on the canonical reaction url', () => {
        expect(resolvePlaybackFrameKind({
            isMomentReaction: true,
            momentId: ' moment-1 ',
            playlistId: 'playlist-1',
            queueSlug: 'my-queue'
        })).toBe('moment');
    });

    it('colors a playlist query on the reaction page', () => {
        expect(resolvePlaybackFrameKind({
            playlistId: 'playlist-9',
            queueSlug: 'my-queue'
        })).toBe('playlist');
    });

    it('colors a plain reaction opened from a saved queue', () => {
        expect(resolvePlaybackFrameKind({ queueSlug: ' evening-set ' })).toBe('queue');
    });

    it('does not treat an ad-hoc queue as a saved queue', () => {
        expect(resolvePlaybackFrameKind({ queueSlug: '   ' })).toBe('reaction');
    });

    it('does not mark a moment flag without a moment id', () => {
        expect(resolvePlaybackFrameKind({
            isMomentReaction: true,
            momentId: ' '
        })).toBe('reaction');
    });
});
