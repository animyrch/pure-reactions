import { describe, expect, it } from 'vitest';
import { isHandheldDeviceFromSignals } from '../../src/lib/helpers/system.js';

describe('isHandheldDeviceFromSignals', () => {
    it('treats a coarse pointer as a phone even in landscape', () => {
        expect(isHandheldDeviceFromSignals({
            coarsePointer: true,
            viewportWidth: 844,
        })).toBe(true);
    });

    it('keeps the narrow-window gate for a mouse', () => {
        expect(isHandheldDeviceFromSignals({
            coarsePointer: false,
            viewportWidth: 390,
        })).toBe(true);
        expect(isHandheldDeviceFromSignals({
            coarsePointer: false,
            viewportWidth: 639,
        })).toBe(true);
    });

    it('allows a desktop window', () => {
        expect(isHandheldDeviceFromSignals({
            coarsePointer: false,
            viewportWidth: 1280,
        })).toBe(false);
        expect(isHandheldDeviceFromSignals({
            coarsePointer: false,
            viewportWidth: 640,
        })).toBe(false);
    });

    it('ignores a missing viewport', () => {
        expect(isHandheldDeviceFromSignals({
            coarsePointer: false,
            viewportWidth: null,
        })).toBe(false);
        expect(isHandheldDeviceFromSignals({
            coarsePointer: false,
            viewportWidth: 0,
        })).toBe(false);
    });
});
