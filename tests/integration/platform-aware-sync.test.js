import { describe, it, expect } from 'vitest';
import {
    normalizeOriginalVideoPlatform,
    isTikTokPlatform,
    snapVolumeForTikTok,
    extractTikTokVideoId,
    getTikTokEmbedUrl,
    ORIGINAL_VIDEO_PLATFORMS
} from '../../src/lib/helpers/platform.js';
import { applyTwinPlayersSyncActions } from '../../src/lib/helpers/twinPlayersSyncApply.ts';

describe('Platform helpers', () => {
    describe('normalizeOriginalVideoPlatform', () => {
        it('returns youtube for unknown or missing values', () => {
            expect(normalizeOriginalVideoPlatform(undefined)).toBe('youtube');
            expect(normalizeOriginalVideoPlatform(null)).toBe('youtube');
            expect(normalizeOriginalVideoPlatform('')).toBe('youtube');
            expect(normalizeOriginalVideoPlatform('unknown')).toBe('youtube');
        });

        it('returns tiktok when given tiktok', () => {
            expect(normalizeOriginalVideoPlatform('tiktok')).toBe('tiktok');
            expect(normalizeOriginalVideoPlatform(ORIGINAL_VIDEO_PLATFORMS.TIKTOK)).toBe('tiktok');
        });

        it('returns youtube when given youtube', () => {
            expect(normalizeOriginalVideoPlatform('youtube')).toBe('youtube');
            expect(normalizeOriginalVideoPlatform(ORIGINAL_VIDEO_PLATFORMS.YOUTUBE)).toBe('youtube');
        });
    });

    describe('isTikTokPlatform', () => {
        it('returns true for tiktok', () => {
            expect(isTikTokPlatform('tiktok')).toBe(true);
        });

        it('returns false for youtube', () => {
            expect(isTikTokPlatform('youtube')).toBe(false);
        });

        it('returns false for undefined or null', () => {
            expect(isTikTokPlatform(undefined)).toBe(false);
            expect(isTikTokPlatform(null)).toBe(false);
        });
    });

    describe('snapVolumeForTikTok', () => {
        it('returns 100 for volume at or above 100', () => {
            expect(snapVolumeForTikTok(100)).toBe(100);
            expect(snapVolumeForTikTok(150)).toBe(100);
            expect(snapVolumeForTikTok(200)).toBe(100);
        });

        it('returns 0 for volume below 100', () => {
            expect(snapVolumeForTikTok(99)).toBe(0);
            expect(snapVolumeForTikTok(50)).toBe(0);
            expect(snapVolumeForTikTok(20)).toBe(0);
            expect(snapVolumeForTikTok(0)).toBe(0);
        });
    });

    describe('extractTikTokVideoId', () => {
        it('extracts ID from a standard TikTok URL', () => {
            expect(extractTikTokVideoId(
                'https://www.tiktok.com/@jamiestreck518/video/7056208472144235823'
            )).toBe('7056208472144235823');
        });

        it('extracts ID from a TikTok URL with query params', () => {
            expect(extractTikTokVideoId(
                'https://www.tiktok.com/@jamiestreck518/video/7056208472144235823?_r=1&_t=ZP-91mlPkPpRRn'
            )).toBe('7056208472144235823');
        });

        it('accepts a bare numeric TikTok video ID (15-20 digits)', () => {
            expect(extractTikTokVideoId('7056208472144235823')).toBe('7056208472144235823');
        });

        it('returns null for vm.tiktok.com short links (not supported client-side)', () => {
            expect(extractTikTokVideoId('https://vm.tiktok.com/ZMhFGnbeh/')).toBeNull();
        });

        it('returns null for a YouTube URL', () => {
            expect(extractTikTokVideoId('https://www.youtube.com/watch?v=abc123')).toBeNull();
        });

        it('returns null for an empty string', () => {
            expect(extractTikTokVideoId('')).toBeNull();
        });

        it('returns null for null/undefined', () => {
            expect(extractTikTokVideoId(null)).toBeNull();
            expect(extractTikTokVideoId(undefined)).toBeNull();
        });
    });

    describe('getTikTokEmbedUrl', () => {
        it('returns the correct embed URL', () => {
            expect(getTikTokEmbedUrl('7056208472144235823')).toBe(
                'https://www.tiktok.com/embed/v2/7056208472144235823'
            );
        });
    });
});

describe('applyTwinPlayersSyncActions — TikTok platform constraints', () => {
    const makeSnapshot = (overrides = {}) => ({
        currentVolumeOriginalVideo: 100,
        currentVolumeReactionVideo: 100,
        currentPlaybackRate: 1,
        playerOriginal: null,
        playerReaction: null,
        ...overrides
    });

    const makeGuards = () => ({
        changingVolume: false,
        changingReactionVolume: false,
        changingSpeed: false
    });

    const makeDeps = (overrides = {}) => {
        const calls = { volume: [], rate: [], reactionVolume: [], state: [] };
        return {
            setVolumeForOriginalVideo: (v) => calls.volume.push(v),
            setVolumeForReactionVideo: (v) => calls.reactionVolume.push(v),
            setPlaybackRateForOriginalVideo: (r) => calls.rate.push(r),
            pauseOriginalVideo: () => {},
            handleStateChangeInOriginalVideo: () => {},
            muteReactionAudio: () => true,
            unmuteReactionAudio: () => true,
            updateState: (s) => calls.state.push(s),
            _calls: calls,
            ...overrides
        };
    };

    it('skips playback-rate action for TikTok originals', () => {
        const deps = makeDeps();
        applyTwinPlayersSyncActions(
            [{ type: 'setOriginalPlaybackRate', rate: 1.5 }],
            {
                snapshot: makeSnapshot({ currentPlaybackRate: 1 }),
                guards: makeGuards(),
                workingState: -1,
                ytEndedState: 0,
                deps,
                options: { isTikTokOriginal: true }
            }
        );
        expect(deps._calls.rate).toHaveLength(0);
    });

    it('applies playback-rate action for YouTube originals', () => {
        const deps = makeDeps();
        applyTwinPlayersSyncActions(
            [{ type: 'setOriginalPlaybackRate', rate: 1.5 }],
            {
                snapshot: makeSnapshot({ currentPlaybackRate: 1 }),
                guards: makeGuards(),
                workingState: -1,
                ytEndedState: 0,
                deps,
                options: { isTikTokOriginal: false }
            }
        );
        expect(deps._calls.rate).toEqual([1.5]);
    });

    it('snaps original volume to 0 when below 100 for TikTok', () => {
        const deps = makeDeps();
        applyTwinPlayersSyncActions(
            [{ type: 'setOriginalVolume', volume: 50 }],
            {
                snapshot: makeSnapshot({ currentVolumeOriginalVideo: 100 }),
                guards: makeGuards(),
                workingState: -1,
                ytEndedState: 0,
                deps,
                options: { isTikTokOriginal: true }
            }
        );
        expect(deps._calls.volume).toEqual([0]);
        const stateUpdate = deps._calls.state.find(s => 'currentVolumeOriginalVideo' in s);
        expect(stateUpdate?.currentVolumeOriginalVideo).toBe(0);
    });

    it('snaps original volume to 100 when at 100 for TikTok', () => {
        const deps = makeDeps();
        applyTwinPlayersSyncActions(
            [{ type: 'setOriginalVolume', volume: 100 }],
            {
                snapshot: makeSnapshot({ currentVolumeOriginalVideo: 50 }),
                guards: makeGuards(),
                workingState: -1,
                ytEndedState: 0,
                deps,
                options: { isTikTokOriginal: true }
            }
        );
        expect(deps._calls.volume).toEqual([100]);
    });

    it('passes intermediate volume through unchanged for YouTube', () => {
        const deps = makeDeps();
        applyTwinPlayersSyncActions(
            [{ type: 'setOriginalVolume', volume: 50 }],
            {
                snapshot: makeSnapshot({ currentVolumeOriginalVideo: 100 }),
                guards: makeGuards(),
                workingState: -1,
                ytEndedState: 0,
                deps,
                options: { isTikTokOriginal: false }
            }
        );
        expect(deps._calls.volume).toEqual([50]);
    });

    it('skips volume update when TikTok snapped value equals current volume', () => {
        // If current volume is already 0 and we try to set 20 (snaps to 0), no change
        const deps = makeDeps();
        applyTwinPlayersSyncActions(
            [{ type: 'setOriginalVolume', volume: 20 }],
            {
                snapshot: makeSnapshot({ currentVolumeOriginalVideo: 0 }),
                guards: makeGuards(),
                workingState: -1,
                ytEndedState: 0,
                deps,
                options: { isTikTokOriginal: true }
            }
        );
        // No change because 20 snaps to 0 and current is already 0
        expect(deps._calls.volume).toHaveLength(0);
    });
});
