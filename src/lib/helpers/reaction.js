import { getSortedFiniteTimelineByT } from './twinPlayersTimeline';

const getClosestSmallerKey = (timedConfigs, searchKey) => {
    if (!timedConfigs) {
        return -Infinity;
    }
    const keys = Object.keys(timedConfigs).map(Number);
    // Include exact matches so configs at t=0.0 apply immediately on refresh.
    const smallerKeys = keys.filter(currentKey => currentKey <= searchKey);
    return smallerKeys.reduce((prev, curr) => (curr > prev ? curr : prev), -Infinity);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Binary search utility over an array of events sorted by t
const findLastEventAtOrBefore = (timelineArray, t) => {
    if (!Array.isArray(timelineArray) || timelineArray.length === 0) {
        return null;
    }
    let low = 0;
    let high = timelineArray.length - 1;
    let ansIndex = -1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const midTime = Number(timelineArray[mid].t);
        if (midTime <= t) {
            ansIndex = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return ansIndex >= 0 ? timelineArray[ansIndex] : null;
};

// Backward-compatible: accepts either an object map (old) or an array of { t, volume } (new)
export const getCurrentVolumeFromVolumeConfigs = (currentTime, volumeConfigsOrTimeline, globalGain = 1.0, timeOffset = 0) => {
    const DEFAULT_VOLUME_LEVEL = 100;
    const effectiveTime = Number(currentTime) - Number(timeOffset || 0);
    const normalizedGain = Number.isFinite(Number(globalGain)) ? Number(globalGain) : 1.0;

    // New format: array of { t: number, volume: number }
    if (Array.isArray(volumeConfigsOrTimeline)) {
        const ev = findLastEventAtOrBefore(volumeConfigsOrTimeline, effectiveTime);
        const base = ev && typeof ev.volume === 'number' ? ev.volume : DEFAULT_VOLUME_LEVEL;
        return clamp(base * normalizedGain, 0, 200);
    }

    // Old format: object map keyed by time string
    const closestSmallerTimeCode = getClosestSmallerKey(volumeConfigsOrTimeline, effectiveTime);
    const base = closestSmallerTimeCode !== -Infinity
        ? volumeConfigsOrTimeline[closestSmallerTimeCode.toFixed(1)]?.volume ?? DEFAULT_VOLUME_LEVEL
        : DEFAULT_VOLUME_LEVEL;
    return clamp(base * normalizedGain, 0, 200);
};

// Backward-compatible: accepts either an object map (old) or an array of { t, state, targetTime } (new)
export const getCurrentStateFromStateConfigs = (currentTime, stateConfigsOrTimeline, timeOffset = 0) => {
    const DEFAULT_STATE_CONFIG = {
        state: -1,
        time: "0.00",
        closestSmallerTimeCode: 0.00
    };
    const effectiveTime = Number(currentTime) - Number(timeOffset || 0);

    // New format: array of { t, state, targetTime }
    if (Array.isArray(stateConfigsOrTimeline)) {
        const ev = findLastEventAtOrBefore(stateConfigsOrTimeline, effectiveTime);
        if (!ev) return DEFAULT_STATE_CONFIG;
        const closestSmallerTimeCode = Number(ev.t) || 0;
        return {
            state: typeof ev.state === 'number' ? ev.state : -1,
            time: (typeof ev.targetTime !== 'undefined' ? Number(ev.targetTime) : 0).toFixed(2),
            closestSmallerTimeCode
        };
    }

    // Old format: object map keyed by time string
    const closestSmallerTimeCode = getClosestSmallerKey(stateConfigsOrTimeline, effectiveTime);
    return closestSmallerTimeCode !== -Infinity ? {
        ...stateConfigsOrTimeline[closestSmallerTimeCode.toFixed(1)],
        closestSmallerTimeCode: closestSmallerTimeCode
     } : DEFAULT_STATE_CONFIG;
};

// Backward-compatible: accepts either an object map (old) or an array of { t, rate } (new)
export const getCurrentPlaybackRateFromConfigs = (currentTime, playbackConfigsOrTimeline, timeOffset = 0) => {
    const DEFAULT_PLAYBACK_RATE = 1;
    const effectiveTime = Number(currentTime) - Number(timeOffset || 0);

    if (Array.isArray(playbackConfigsOrTimeline)) {
        const ev = findLastEventAtOrBefore(playbackConfigsOrTimeline, effectiveTime);
        return ev && typeof ev.rate === 'number' ? ev.rate : DEFAULT_PLAYBACK_RATE;
    }

    const closestSmallerTimeCode = getClosestSmallerKey(playbackConfigsOrTimeline, effectiveTime);
    return closestSmallerTimeCode !== -Infinity
        ? playbackConfigsOrTimeline[closestSmallerTimeCode.toFixed(1)]?.rate ?? DEFAULT_PLAYBACK_RATE
        : DEFAULT_PLAYBACK_RATE;
};

const normalizeOverlayPrimary = (value, fallback = 'original') =>
    value === 'reaction' ? 'reaction' : fallback;

export const getCurrentOverlaySnapshotFromConfigs = (
    currentTime,
    overlayVisibilityTimeline,
    timeOffset = 0,
    defaultPrimary = 'original'
) => {
    const effectiveTime = Number(currentTime) - Number(timeOffset || 0);
    const fallback = {
        visible: true,
        primary: normalizeOverlayPrimary(defaultPrimary)
    };

    if (!Array.isArray(overlayVisibilityTimeline) || overlayVisibilityTimeline.length === 0) {
        return fallback;
    }

    const sortedTimeline = getSortedFiniteTimelineByT(overlayVisibilityTimeline);

    let active = { ...fallback };
    for (const entry of sortedTimeline) {
        const entryTime = Number(entry.t);
        if (entryTime > effectiveTime) {
            break;
        }
        active = {
            visible: typeof entry?.visible === 'boolean' ? entry.visible : active.visible,
            primary: normalizeOverlayPrimary(entry?.primary, active.primary)
        };
    }

    return active;
};

export const getCurrentOverlayVisibilityFromConfigs = (currentTime, overlayVisibilityTimeline, timeOffset = 0) => {
    return getCurrentOverlaySnapshotFromConfigs(currentTime, overlayVisibilityTimeline, timeOffset).visible;
};

export const getCurrentOverlayPrimaryFromConfigs = (
    currentTime,
    overlayVisibilityTimeline,
    defaultPrimary = 'original',
    timeOffset = 0
) => getCurrentOverlaySnapshotFromConfigs(
    currentTime,
    overlayVisibilityTimeline,
    timeOffset,
    defaultPrimary
).primary;

/**
 * Integrate the original video's playback rate over a reaction-time interval.
 *
 * Returns the total original-video seconds that elapse while the reaction plays
 * from `fromEffectiveTime` to `toEffectiveTime`, accounting for all rate-change
 * events in `playbackRateTimeline`.
 *
 * Both time parameters and the timeline `t` values must be in normalized reaction
 * time after removing timeOffset (i.e., reaction time minus timeOffset, which
 * equals reaction time when timeOffset = 0).
 *
 * @param {number} fromEffectiveTime
 * @param {number} toEffectiveTime
 * @param {Array<{t: number, rate: number}>} playbackRateTimeline - sorted ascending by t
 * @returns {number}
 */
export const integratePlaybackRate = (fromEffectiveTime, toEffectiveTime, playbackRateTimeline) => {
    const DEFAULT_RATE = 1;

    if (!Number.isFinite(fromEffectiveTime) || !Number.isFinite(toEffectiveTime) || fromEffectiveTime >= toEffectiveTime) {
        return 0;
    }

    if (!Array.isArray(playbackRateTimeline) || playbackRateTimeline.length === 0) {
        return (toEffectiveTime - fromEffectiveTime) * DEFAULT_RATE;
    }

    // Find the rate that is active at fromEffectiveTime
    let currentRate = DEFAULT_RATE;
    for (const event of playbackRateTimeline) {
        if (Number.isFinite(event?.t) && event.t <= fromEffectiveTime) {
            currentRate = typeof event.rate === 'number' ? event.rate : DEFAULT_RATE;
        }
    }

    // Walk rate-change boundaries that fall strictly between fromEffectiveTime and toEffectiveTime
    let result = 0;
    let cursor = fromEffectiveTime;

    for (const event of playbackRateTimeline) {
        const et = Number(event?.t);
        if (!Number.isFinite(et)) continue;
        if (et <= fromEffectiveTime) continue; // already covered by initial rate scan
        if (et >= toEffectiveTime) break;      // past the end of the interval

        result += currentRate * (et - cursor);
        cursor = et;
        currentRate = typeof event.rate === 'number' ? event.rate : DEFAULT_RATE;
    }

    // Final segment from cursor to toEffectiveTime
    result += currentRate * (toEffectiveTime - cursor);

    return result;
};

export const getCompensatedReactionTime = (startTime, playlistBufferTime = 0) => {
    const currentTime = new Date().getTime();
    const reactionSeconds = (currentTime - startTime) / 1000; // Convert to seconds
    const reactionSecondsInCasePlaylist = reactionSeconds + +playlistBufferTime;
    const compensatedTime = reactionSecondsInCasePlaylist - 1;
    const truncatedTime = compensatedTime.toFixed(1);
    const timeAdjustedForDatabaseKey = truncatedTime.toString();
    return timeAdjustedForDatabaseKey < 0 ? 0 : timeAdjustedForDatabaseKey;
};

export const timeInVideoToSecondsConverter = (timeInVideo) => {
    // if input doesnt have :, then it is already in seconds
    if (!timeInVideo.includes(":")) {
        return parseFloat(timeInVideo);
    }
    // we split the input with :
    const timeArray = timeInVideo.split(":");
    // if two elements, then we have minutes and seconds, if three, we have hours, minutes and seconds. We convert to seconds accordingly
    return timeArray.length === 2 ?
        parseInt(
            timeArray[0]) * 60 + parseInt(timeArray[1]
        ) :
        parseInt(
            timeArray[0]) * 3600 + parseInt(timeArray[1]) * 60 + parseInt(timeArray[2]
        );
};
