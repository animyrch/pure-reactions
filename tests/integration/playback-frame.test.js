import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ReactionStage from '../../src/lib/components/reaction/ReactionStage.svelte';
import {
    PLAYBACK_FRAME_COLORS,
    playbackDockBorderColor,
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

    it('colors a remix on the canonical reaction url', () => {
        expect(resolvePlaybackFrameKind({ remixMode: true })).toBe('remix');
        expect(PLAYBACK_FRAME_COLORS.remix).toBe('rgba(45, 212, 191, 0.95)');
        expect(playbackDockBorderColor(PLAYBACK_FRAME_COLORS.remix)).toBe('rgba(45, 212, 191, 0.45)');
    });

    it('draws a thinner accent on the control dock instead of the player', () => {
        const playing = render(ReactionStage, {
            props: {
                playerOriginal: {},
                playerReaction: {},
                bothVideosStarted: true,
                itemType: 'playlist'
            }
        }).body;
        const dock = playing.match(/<div[^>]*data-dock-type-accent="[^"]*"[^>]*>/)?.[0] ?? '';

        expect(playing).not.toContain('data-reaction-type-frame');
        expect(playing).not.toContain('reaction-type-frame');
        expect(dock).toContain('data-dock-type-accent="rgba(244, 114, 182, 0.45)"');
        expect(dock).toContain('border-color: rgba(244, 114, 182, 0.45)');
        expect(dock).toContain('aria-label="Reaction playback controls"');

        const waiting = render(ReactionStage, {
            props: {
                playerOriginal: {},
                playerReaction: {},
                bothVideosStarted: false,
                itemType: 'moment',
                remixMode: true
            }
        }).body;
        const prompt = waiting.match(/<div[^>]*data-testid="click-gate-prompt"[^>]*>/)?.[0] ?? '';

        expect(waiting).not.toContain('data-reaction-type-frame');
        expect(prompt).toContain('data-dock-type-accent="rgba(251, 191, 36, 0.45)"');
        expect(prompt).toContain('border-color: rgba(251, 191, 36, 0.45)');

        const plain = render(ReactionStage, {
            props: {
                playerOriginal: {},
                playerReaction: {},
                bothVideosStarted: true,
                itemType: 'reaction'
            }
        }).body;

        expect(plain).not.toContain('data-dock-type-accent');
        expect(plain).not.toContain('data-reaction-type-frame');
    });

    it('keeps remix ahead of a saved queue and behind moment and playlist context', () => {
        expect(resolvePlaybackFrameKind({
            remixMode: true,
            queueSlug: 'evening-set'
        })).toBe('remix');
        expect(resolvePlaybackFrameKind({
            remixMode: true,
            playlistId: 'playlist-9'
        })).toBe('playlist');
        expect(resolvePlaybackFrameKind({
            remixMode: true,
            isMomentReaction: true,
            momentId: 'moment-1'
        })).toBe('moment');
        expect(resolvePlaybackFrameKind({
            routeKind: 'playlist',
            remixMode: true
        })).toBe('playlist');
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
