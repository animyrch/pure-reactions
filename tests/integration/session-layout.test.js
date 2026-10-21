import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ReactionStage from '../../src/lib/components/reaction/ReactionStage.svelte';
import {
    SESSION_LAYOUT_STORAGE_KEY,
    defaultSessionLayout,
    normalizeSessionLayout,
    readSessionLayout,
    writeSessionLayout,
} from '../../src/lib/helpers/sessionLayout.js';

const memoryStorage = (initial) => {
    const data = new Map(initial ? Object.entries(initial) : []);
    return {
        getItem: (key) => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => {
            data.set(key, String(value));
        },
    };
};

describe('session watch layout', () => {
    it('starts from the same overlay defaults as a reaction', () => {
        expect(defaultSessionLayout()).toEqual({
            fullscreenPrimaryVideo: 'original',
            fullscreenOverlayWidthPercent: 35,
            fullscreenOverlayCorner: 'top-right',
            fullscreenOverlayVisible: true,
            showCinematicBars: false,
        });
    });

    it('snaps viewer overlay settings into the reaction layout range', () => {
        expect(normalizeSessionLayout({
            fullscreenPrimaryVideo: 'reaction',
            fullscreenOverlayWidthPercent: 33,
            fullscreenOverlayCorner: 'bottom-left',
            fullscreenOverlayVisible: false,
            showCinematicBars: true,
        })).toEqual({
            fullscreenPrimaryVideo: 'reaction',
            fullscreenOverlayWidthPercent: 35,
            fullscreenOverlayCorner: 'bottom-left',
            fullscreenOverlayVisible: false,
            showCinematicBars: true,
        });
    });

    it('ignores a broken saved layout', () => {
        const storage = memoryStorage({
            [SESSION_LAYOUT_STORAGE_KEY]: '{',
        });
        expect(readSessionLayout(storage)).toEqual(defaultSessionLayout());
    });

    it('remembers a viewer layout on this browser', () => {
        const storage = memoryStorage();
        writeSessionLayout(storage, {
            fullscreenPrimaryVideo: 'reaction',
            fullscreenOverlayWidthPercent: 50,
            fullscreenOverlayCorner: 'top-left',
            fullscreenOverlayVisible: false,
            showCinematicBars: true,
        });

        expect(readSessionLayout(storage)).toEqual({
            fullscreenPrimaryVideo: 'reaction',
            fullscreenOverlayWidthPercent: 50,
            fullscreenOverlayCorner: 'top-left',
            fullscreenOverlayVisible: false,
            showCinematicBars: true,
        });
    });

    it('renders the reaction stage for a host-led watch', () => {
        const { body } = render(ReactionStage, {
            props: {
                playerOriginal: { pending: true },
                playerReaction: { pending: true },
                bothVideosStarted: true,
                hostControlled: true,
                customReactionPlayer: true,
                fullscreenPrimaryVideo: 'original',
                fullscreenOverlayWidthPercent: 50,
                fullscreenOverlayCorner: 'bottom-left',
                fullscreenOverlayVisible: true,
            },
        });

        expect(body).toContain('id="player-original"');
        expect(body).not.toContain('id="player-reaction"');
        expect(body).toContain('Watch layout controls');
        expect(body).toContain('Enter fullscreen');
        expect(body).not.toContain('Seek reaction video');
        expect(body).toContain('data-overlay-corner="bottom-left"');
        expect(body).toContain('--overlay-width: 50%');
    });
});
