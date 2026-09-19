import { describe, expect, it } from 'vitest';

import {
    AUDIO_LEAD,
    ORIGINAL_LEAD_VOLUMES,
    REACTION_LEAD_VOLUMES,
    buildReactionEndPauseCue,
    getAudioLeadVolumes,
    hasPauseInLastSecond,
    resolveReactionEndCueTime,
} from '../../src/lib/helpers/audioLead.js';
import { RECORDER_PLAYER_STATES } from '../../src/lib/helpers/recorderState.js';

describe('audio lead volumes', () => {
    it('uses 20/100 when the reaction leads', () => {
        expect(getAudioLeadVolumes({ lead: AUDIO_LEAD.REACTION })).toEqual(
            REACTION_LEAD_VOLUMES,
        );
    });

    it('uses 100/20 when the original leads', () => {
        expect(getAudioLeadVolumes({ lead: AUDIO_LEAD.ORIGINAL })).toEqual(
            ORIGINAL_LEAD_VOLUMES,
        );
    });

    it('defaults to reaction lead', () => {
        expect(getAudioLeadVolumes()).toEqual(REACTION_LEAD_VOLUMES);
    });

    it('snaps TikTok original duck volume to 0 and leaves reaction at 100', () => {
        expect(
            getAudioLeadVolumes({
                lead: AUDIO_LEAD.REACTION,
                isTikTokOriginal: true,
            }),
        ).toEqual({
            originalVolume: 0,
            reactionVolume: 100,
        });
    });

    it('keeps TikTok original at 100 when the original leads', () => {
        expect(
            getAudioLeadVolumes({
                lead: AUDIO_LEAD.ORIGINAL,
                isTikTokOriginal: true,
            }),
        ).toEqual({
            originalVolume: 100,
            reactionVolume: 20,
        });
    });
});

describe('reaction end pause cue', () => {
    it('places the pause in the last second of the take', () => {
        const cue = buildReactionEndPauseCue({
            reactionDurationSeconds: 40,
            originalTime: 12.5,
            existingStateEvents: [
                { t: 3, state: RECORDER_PLAYER_STATES.PLAYING },
            ],
        });

        expect(cue).toEqual({
            t: 39.5,
            state: RECORDER_PLAYER_STATES.PAUSED,
            targetTime: 12.5,
            originalVolume: 20,
            reactionVolume: 100,
        });
        expect(cue.t).toBeGreaterThan(39);
        expect(cue.t).toBeLessThanOrEqual(40);
    });

    it('snaps TikTok original duck volume on the end cue', () => {
        const cue = buildReactionEndPauseCue({
            reactionDurationSeconds: 10,
            originalTime: 4,
            isTikTokOriginal: true,
        });

        expect(cue.originalVolume).toBe(0);
        expect(cue.reactionVolume).toBe(100);
        expect(cue.state).toBe(RECORDER_PLAYER_STATES.PAUSED);
    });

    it('skips when a pause already exists in the last second', () => {
        expect(
            hasPauseInLastSecond(20, [
                { t: 19.4, state: RECORDER_PLAYER_STATES.PAUSED },
            ]),
        ).toBe(true);

        const cue = buildReactionEndPauseCue({
            reactionDurationSeconds: 20,
            originalTime: 8,
            existingStateEvents: [
                { t: 5, state: RECORDER_PLAYER_STATES.PLAYING },
                { t: 19.4, state: RECORDER_PLAYER_STATES.PAUSED },
            ],
        });

        expect(cue).toBeNull();
    });

    it('does not skip when the last pause is outside the last second', () => {
        const cue = buildReactionEndPauseCue({
            reactionDurationSeconds: 30,
            originalTime: 1,
            existingStateEvents: [
                { t: 10, state: RECORDER_PLAYER_STATES.PAUSED },
                { t: 18, state: RECORDER_PLAYER_STATES.PLAYING },
            ],
        });

        expect(cue).not.toBeNull();
        expect(cue.t).toBe(29.5);
        expect(cue.state).toBe(RECORDER_PLAYER_STATES.PAUSED);
    });

    it('places the cue after a late play so it is not overwritten', () => {
        expect(
            resolveReactionEndCueTime(20, [
                { t: 19.7, state: RECORDER_PLAYER_STATES.PLAYING },
            ]),
        ).toBe(19.8);

        const cue = buildReactionEndPauseCue({
            reactionDurationSeconds: 20,
            originalTime: 9,
            existingStateEvents: [
                { t: 19.7, state: RECORDER_PLAYER_STATES.PLAYING },
            ],
        });

        expect(cue.t).toBe(19.8);
        expect(cue.state).toBe(RECORDER_PLAYER_STATES.PAUSED);
    });

    it('returns null for invalid duration', () => {
        expect(buildReactionEndPauseCue({ reactionDurationSeconds: NaN })).toBeNull();
        expect(buildReactionEndPauseCue({ reactionDurationSeconds: -1 })).toBeNull();
    });
});
