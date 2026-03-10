import { describe, expect, it } from 'vitest';

import {
    buildRecorderStateConfigs,
    RECORDER_PLAYER_STATES,
} from '../../src/lib/helpers/recorderState.js';

describe('recorder state persistence', () => {
    it('normalizes buffering events to paused in persisted configs', () => {
        const result = buildRecorderStateConfigs({
            existingConfigs: new Map(),
            reactionVideoTime: '2.50',
            originalVideoTime: '8.00',
            stateCode: RECORDER_PLAYER_STATES.BUFFERING,
        });

        expect(result.entries).toEqual([
            ['2.50', { time: '8.00', state: RECORDER_PLAYER_STATES.PAUSED }],
        ]);
        expect(result.object).toEqual({
            '2.50': { time: '8.00', state: RECORDER_PLAYER_STATES.PAUSED },
        });
    });

    it('persists explicit play and pause commands for TikTok-style originals', () => {
        const afterPlay = buildRecorderStateConfigs({
            existingConfigs: new Map(),
            reactionVideoTime: '0.00',
            originalVideoTime: '0.00',
            stateCode: RECORDER_PLAYER_STATES.PLAYING,
        });

        const afterPause = buildRecorderStateConfigs({
            existingConfigs: afterPlay.map,
            reactionVideoTime: '4.25',
            originalVideoTime: '0.00',
            stateCode: RECORDER_PLAYER_STATES.PAUSED,
        });

        expect(afterPause.entries).toEqual([
            ['0.00', { time: '0.00', state: RECORDER_PLAYER_STATES.PLAYING }],
            ['4.25', { time: '0.00', state: RECORDER_PLAYER_STATES.PAUSED }],
        ]);
    });
});