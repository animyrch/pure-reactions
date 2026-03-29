export const RECORDER_PLAYER_STATES = Object.freeze({
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5,
});

export const buildRecorderStateConfigs = ({
    existingConfigs,
    reactionVideoTime,
    originalVideoTime,
    stateCode,
}) => {
    const nextConfigs = new Map(existingConfigs instanceof Map ? existingConfigs : []);
    const normalizedStateCode =
        stateCode === RECORDER_PLAYER_STATES.BUFFERING
            ? RECORDER_PLAYER_STATES.PAUSED
            : stateCode;

    nextConfigs.set(reactionVideoTime, {
        time: String(originalVideoTime),
        state: normalizedStateCode,
    });

    return {
        map: nextConfigs,
        entries: Array.from(nextConfigs.entries()),
        object: Object.fromEntries(nextConfigs),
    };
};

/**
 * Builds the reaction transport track configs map.
 * Tracks the play/pause state of the reaction video itself (not the original).
 * Entries are { state } only — no target time needed.
 */
export const buildReactionTransportConfigs = ({
    existingConfigs,
    reactionVideoTime,
    stateCode,
}) => {
    const nextConfigs = new Map(existingConfigs instanceof Map ? existingConfigs : []);
    const normalizedStateCode =
        stateCode === RECORDER_PLAYER_STATES.BUFFERING
            ? RECORDER_PLAYER_STATES.PAUSED
            : stateCode;

    nextConfigs.set(reactionVideoTime, {
        state: normalizedStateCode,
    });

    return {
        map: nextConfigs,
        entries: Array.from(nextConfigs.entries()),
        object: Object.fromEntries(nextConfigs),
    };
};