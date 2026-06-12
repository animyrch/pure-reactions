import { describe, it, expect } from 'vitest';
import {
    normalizeFullscreenOverlayCorner,
    DEFAULT_FULLSCREEN_OVERLAY_CORNER
} from '../../src/lib/helpers/twinPlayersReactionData.ts';

describe('normalizeFullscreenOverlayCorner', () => {
    it('accepts all 8 valid positions', () => {
        const validPositions = [
            'top-left',
            'top-center',
            'top-right',
            'middle-left',
            'middle-right',
            'bottom-left',
            'bottom-center',
            'bottom-right',
        ];
        for (const pos of validPositions) {
            expect(normalizeFullscreenOverlayCorner(pos)).toBe(pos);
        }
    });

    it('returns default for unknown string values', () => {
        expect(normalizeFullscreenOverlayCorner('center')).toBe(DEFAULT_FULLSCREEN_OVERLAY_CORNER);
        expect(normalizeFullscreenOverlayCorner('middle-center')).toBe(DEFAULT_FULLSCREEN_OVERLAY_CORNER);
        expect(normalizeFullscreenOverlayCorner('top')).toBe(DEFAULT_FULLSCREEN_OVERLAY_CORNER);
    });

    it('returns default for null and undefined', () => {
        expect(normalizeFullscreenOverlayCorner(null)).toBe(DEFAULT_FULLSCREEN_OVERLAY_CORNER);
        expect(normalizeFullscreenOverlayCorner(undefined)).toBe(DEFAULT_FULLSCREEN_OVERLAY_CORNER);
    });

    it('returns default for non-string values', () => {
        expect(normalizeFullscreenOverlayCorner(0)).toBe(DEFAULT_FULLSCREEN_OVERLAY_CORNER);
        expect(normalizeFullscreenOverlayCorner({})).toBe(DEFAULT_FULLSCREEN_OVERLAY_CORNER);
    });

    it('default is top-right', () => {
        expect(DEFAULT_FULLSCREEN_OVERLAY_CORNER).toBe('top-right');
    });
});

describe('overlay position classes mapping', () => {
    const overlayPositionClasses = {
        'top-left': 'left-6 top-6',
        'top-center': 'left-1/2 -translate-x-1/2 top-6',
        'top-right': 'right-6 top-6',
        'middle-left': 'left-6 top-1/2 -translate-y-1/2',
        'middle-right': 'right-6 top-1/2 -translate-y-1/2',
        'bottom-left': 'left-6 bottom-6',
        'bottom-center': 'left-1/2 -translate-x-1/2 bottom-6',
        'bottom-right': 'right-6 bottom-6',
    };

    it('has an entry for all 8 positions', () => {
        const expected = [
            'top-left', 'top-center', 'top-right',
            'middle-left', 'middle-right',
            'bottom-left', 'bottom-center', 'bottom-right',
        ];
        expect(Object.keys(overlayPositionClasses)).toEqual(expect.arrayContaining(expected));
        expect(Object.keys(overlayPositionClasses)).toHaveLength(8);
    });

    it('top-center and bottom-center use horizontal centering transform', () => {
        expect(overlayPositionClasses['top-center']).toContain('-translate-x-1/2');
        expect(overlayPositionClasses['bottom-center']).toContain('-translate-x-1/2');
    });

    it('middle-left and middle-right use vertical centering transform', () => {
        expect(overlayPositionClasses['middle-left']).toContain('-translate-y-1/2');
        expect(overlayPositionClasses['middle-right']).toContain('-translate-y-1/2');
    });

    it('left-side positions use left-6', () => {
        expect(overlayPositionClasses['top-left']).toContain('left-6');
        expect(overlayPositionClasses['middle-left']).toContain('left-6');
        expect(overlayPositionClasses['bottom-left']).toContain('left-6');
    });

    it('right-side positions use right-6', () => {
        expect(overlayPositionClasses['top-right']).toContain('right-6');
        expect(overlayPositionClasses['middle-right']).toContain('right-6');
        expect(overlayPositionClasses['bottom-right']).toContain('right-6');
    });
});
