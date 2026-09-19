import { snapVolumeForTikTok } from './platform';
import { RECORDER_PLAYER_STATES } from './recorderState';

export const AUDIO_LEAD = Object.freeze({
    REACTION: 'reaction',
    ORIGINAL: 'original',
});

export const REACTION_LEAD_VOLUMES = Object.freeze({
    originalVolume: 20,
    reactionVolume: 100,
});

export const ORIGINAL_LEAD_VOLUMES = Object.freeze({
    originalVolume: 100,
    reactionVolume: 20,
});

export const REACTION_END_PAUSE_OFFSET_SECONDS = 0.5;
export const REACTION_END_PAUSE_WINDOW_SECONDS = 1;

const roundToTenth = (value) => Math.round(Number(value) * 10) / 10;

const toFiniteNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

/**
 * Complementary volumes so mobile arbitration always has a single audio lead.
 * TikTok originals only support mute/full, so a ducked original snaps to 0.
 *
 * @param {{ lead?: 'reaction' | 'original', isTikTokOriginal?: boolean }} [options]
 * @returns {{ originalVolume: number, reactionVolume: number }}
 */
export const getAudioLeadVolumes = ({
    lead = AUDIO_LEAD.REACTION,
    isTikTokOriginal = false,
} = {}) => {
    const pair =
        lead === AUDIO_LEAD.ORIGINAL
            ? { ...ORIGINAL_LEAD_VOLUMES }
            : { ...REACTION_LEAD_VOLUMES };

    if (isTikTokOriginal) {
        pair.originalVolume = snapVolumeForTikTok(pair.originalVolume);
    }

    return pair;
};

const normalizeStateEvents = (existingStateEvents) => {
    if (!Array.isArray(existingStateEvents)) {
        return [];
    }

    return existingStateEvents
        .map((event) => {
            const t = toFiniteNumber(event?.t);
            const state = toFiniteNumber(event?.state);
            if (t === null || state === null) {
                return null;
            }
            return { t, state };
        })
        .filter(Boolean);
};

export const hasPauseInLastSecond = (
    reactionDurationSeconds,
    existingStateEvents = [],
) => {
    const duration = toFiniteNumber(reactionDurationSeconds);
    if (duration === null || duration < 0) {
        return false;
    }

    const windowStart = Math.max(0, duration - REACTION_END_PAUSE_WINDOW_SECONDS);
    return normalizeStateEvents(existingStateEvents).some(
        (event) =>
            event.state === RECORDER_PLAYER_STATES.PAUSED &&
            event.t >= windowStart &&
            event.t <= duration + 0.1,
    );
};

export const resolveReactionEndCueTime = (
    reactionDurationSeconds,
    existingStateEvents = [],
) => {
    const duration = toFiniteNumber(reactionDurationSeconds);
    if (duration === null || duration < 0) {
        return null;
    }

    const preferred = Math.max(
        0,
        roundToTenth(duration - REACTION_END_PAUSE_OFFSET_SECONDS),
    );
    const lastT = normalizeStateEvents(existingStateEvents).reduce(
        (maxT, event) => (event.t > maxT ? event.t : maxT),
        Number.NEGATIVE_INFINITY,
    );

    if (Number.isFinite(lastT) && lastT >= preferred) {
        return roundToTenth(lastT + 0.1);
    }

    return preferred;
};

/**
 * Pause-original + reaction-lead volumes near the end of the take.
 * Returns null when a pause already exists in the last second.
 *
 * @param {{
 *   reactionDurationSeconds: number,
 *   originalTime?: number | string,
 *   existingStateEvents?: Array<{ t: number, state: number }>,
 *   isTikTokOriginal?: boolean
 * }} options
 */
export const buildReactionEndPauseCue = ({
    reactionDurationSeconds,
    originalTime = 0,
    existingStateEvents = [],
    isTikTokOriginal = false,
} = {}) => {
    const duration = toFiniteNumber(reactionDurationSeconds);
    if (duration === null || duration < 0) {
        return null;
    }

    if (hasPauseInLastSecond(duration, existingStateEvents)) {
        return null;
    }

    const cueTime = resolveReactionEndCueTime(
        duration,
        existingStateEvents,
    );
    if (cueTime === null) {
        return null;
    }

    const volumes = getAudioLeadVolumes({
        lead: AUDIO_LEAD.REACTION,
        isTikTokOriginal,
    });
    const targetTime = toFiniteNumber(originalTime) ?? 0;

    return {
        t: cueTime,
        state: RECORDER_PLAYER_STATES.PAUSED,
        targetTime,
        originalVolume: volumes.originalVolume,
        reactionVolume: volumes.reactionVolume,
    };
};
