import { isMomentReactionData } from '$lib/helpers/reactionListItem';

/**
 * Stored watch time for thumbnail badges.
 *
 * `watchDurationSeconds` is the number a card shows. It is written when a
 * reaction is published or edited, when enrichment learns a media duration,
 * and when a playlist's membership changes. Cards read that stored number.
 *
 * `reactionWatchDurationSeconds` is this reaction video's own window after
 * start and finish. Playlist totals add those windows up. A queue does not:
 * a queued reaction keeps the normal reaction window.
 *
 * A moment card shows that reaction window (the moment subsection).
 * A playlist card shows the playlist total, except a moment keeps its own
 * subsection because the moment badge wins over the playlist badge.
 * A remix card shows how much of the original video is actually played:
 * the original duration, minus jumps, the end cue, and start/finish.
 */

const EDGE_EPSILON_SECONDS = 0.001;
const MIN_SKIP_SPAN_SECONDS = 0.05;
const YT_PLAYING = 1;
const YT_PAUSED = 2;

export const WATCH_DURATION_INPUT_FIELDS = [
    'offsetStartTime',
    'reactionFinishTime',
    'stateTimeline',
    'reactionConfigs',
    'remixMode',
    'playlistId',
    'isMomentReaction',
    'momentId',
    'duration',
    'youtube',
    'originalYoutube',
    'originalTikTok',
    'reactionVideoId',
    'isPublished',
];

const finite = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

export const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

const firstPositive = (candidates) => {
    for (const candidate of candidates) {
        const numeric = finite(candidate);
        if (numeric !== null && numeric > 0) return numeric;
    }
    return null;
};

export const affectsWatchDuration = (patch) => {
    if (!patch || typeof patch !== 'object') return false;
    return WATCH_DURATION_INPUT_FIELDS.some((field) =>
        Object.prototype.hasOwnProperty.call(patch, field)
    );
};

export const hasStoredWatchDuration = (data) =>
    Boolean(data) && Object.prototype.hasOwnProperty.call(data, 'watchDurationSeconds');

export const reactionMediaDurationSeconds = (data) =>
    firstPositive([
        data?.youtube?.meta?.durationSeconds,
        data?.duration,
        data?.reactionDuration,
    ]);

export const originalMediaDurationSeconds = (data) =>
    firstPositive([
        data?.originalYoutube?.meta?.durationSeconds,
        data?.originalTikTok?.meta?.durationSeconds,
    ]);

/**
 * Reaction video length that the viewer actually watches.
 * Start and finish cut the ends when those configs are set.
 * A missing or non-positive finish keeps the full media duration.
 */
export const reactionWindowSeconds = (data) => {
    const duration = reactionMediaDurationSeconds(data);
    if (duration === null) return null;

    const startRaw = finite(data?.offsetStartTime);
    const start = startRaw !== null && startRaw > 0 ? startRaw : 0;
    const finishRaw = finite(data?.reactionFinishTime);
    const finish = finishRaw !== null && finishRaw > 0 ? finishRaw : duration;
    const begin = Math.min(Math.max(0, start), duration);
    const end = Math.min(Math.max(begin, finish), duration);
    return Math.max(0, end - begin);
};

const remixCues = (data) => {
    const timeline = data?.stateTimeline;
    if (Array.isArray(timeline) && timeline.length) {
        return timeline
            .map((entry) => ({
                time: finite(entry?.t),
                state: finite(entry?.state),
                targetTime: finite(entry?.targetTime),
            }))
            .filter((cue) => cue.time !== null && cue.state !== null);
    }

    const configs = data?.reactionConfigs;
    if (!configs || typeof configs !== 'object' || Array.isArray(configs)) {
        return [];
    }

    return Object.entries(configs)
        .map(([key, value]) => ({
            time: finite(key),
            state: finite(value?.state),
            targetTime: finite(value?.time),
        }))
        .filter((cue) => cue.time !== null && cue.state !== null);
};

// Same spans as buildRemixDisabledSections. A pause closes the tail.
// A play cue closes the open span between its time and its jump target.
const remixDisabledSections = (cues, duration) => {
    if (!Number.isFinite(duration) || duration <= 0 || !Array.isArray(cues)) {
        return [];
    }

    const sections = [];
    for (const cue of cues) {
        const boundedTime = Math.min(Math.max(cue.time, 0), duration);
        if (cue.state === YT_PAUSED) {
            if (duration - boundedTime > EDGE_EPSILON_SECONDS) {
                sections.push({ start: boundedTime, end: duration });
            }
            continue;
        }
        if (cue.state !== YT_PLAYING) continue;
        const target = cue.targetTime === null ? boundedTime : cue.targetTime;
        const start = Math.min(Math.max(Math.min(boundedTime, target), 0), duration);
        const end = Math.min(Math.max(Math.max(boundedTime, target), 0), duration);
        if (end - start > MIN_SKIP_SPAN_SECONDS) {
            sections.push({ start, end });
        }
    }
    return sections;
};

const mergeSections = (sections) => {
    if (!Array.isArray(sections) || sections.length === 0) return [];
    const sorted = [...sections].sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [];
    for (const section of sorted) {
        const last = merged[merged.length - 1];
        if (!last || section.start >= last.end - EDGE_EPSILON_SECONDS) {
            merged.push({ start: section.start, end: section.end });
            continue;
        }
        last.end = Math.max(last.end, section.end);
    }
    return merged;
};

/**
 * Original video time that remix playback shows.
 * Start and finish are applied on the original timeline, because that is the
 * video the viewer is watching. Jumps and the end cue remove the closed spans.
 */
export const remixShownSeconds = (data) => {
    const duration = originalMediaDurationSeconds(data);
    if (duration === null) return null;

    const startRaw = finite(data?.offsetStartTime);
    const finishRaw = finite(data?.reactionFinishTime);
    const windowStart = startRaw !== null && startRaw > 0 ? Math.min(startRaw, duration) : 0;
    let windowEnd = duration;
    if (finishRaw !== null && finishRaw > 0) {
        windowEnd = Math.min(finishRaw, duration);
    }
    if (windowEnd <= windowStart) return 0;

    const hiddenSections = mergeSections(remixDisabledSections(remixCues(data), duration));
    let hidden = 0;
    for (const section of hiddenSections) {
        const start = Math.max(section.start, windowStart);
        const end = Math.min(section.end, windowEnd);
        if (end > start) hidden += end - start;
    }
    return Math.max(0, windowEnd - windowStart - hidden);
};

export const playlistReactionIds = (playlist) => {
    const ids = Array.isArray(playlist?.reactionBinomeIds) ? playlist.reactionBinomeIds : [];
    return ids.map((id) => trimmed(id)).filter(Boolean);
};

export const isPlaylistCardData = (data) =>
    trimmed(data?.playlistId).length > 0 && !isMomentReactionData(data);

const roundSeconds = (value) => {
    const numeric = finite(value);
    if (numeric === null) return null;
    return Math.max(0, Math.round(numeric));
};

/**
 * Sum of each playlist slot's reaction window.
 * A slot with no reaction document, or no known reaction duration, makes the
 * total unknown so the badge is not a short count.
 * The same reaction in two slots counts twice.
 */
export const sumPlaylistReactionWindows = (membersById, ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return null;
    let total = 0;
    for (const id of ids) {
        const data = membersById.get(id);
        if (!data) return null;
        const windowSeconds = reactionWindowSeconds(data);
        if (windowSeconds === null) return null;
        total += Math.round(windowSeconds);
    }
    return total;
};

export const buildWatchDurationPatch = (data, playlistTotal = null) => {
    const contribution = roundSeconds(reactionWindowSeconds(data));
    let watchDurationSeconds = contribution;

    if (!isMomentReactionData(data) && isPlaylistCardData(data)) {
        watchDurationSeconds = roundSeconds(playlistTotal);
    } else if (!isMomentReactionData(data) && data?.remixMode === true) {
        watchDurationSeconds = roundSeconds(remixShownSeconds(data));
    }

    return {
        reactionWatchDurationSeconds: contribution,
        watchDurationSeconds,
    };
};

const positiveStoredSeconds = (value) => {
    const numeric = finite(value);
    if (numeric === null || numeric <= 0) return null;
    return Math.round(numeric);
};

/**
 * Number to paint on a card.
 * Stored `watchDurationSeconds` wins. Older documents that have not been
 * saved since this field existed fall back to a one-time calculation for a
 * single reaction, moment, or remix. A playlist total is never invented from
 * one member. Queue cards do not add up their items.
 */
export const displayedWatchDurationSeconds = (reaction) => {
    const data = reaction?.data;
    if (!data || typeof data !== 'object') return null;

    if (reaction?.type === 'queue') {
        return positiveStoredSeconds(data.watchDurationSeconds);
    }

    if (hasStoredWatchDuration(data)) {
        return positiveStoredSeconds(data.watchDurationSeconds);
    }

    if (isPlaylistCardData(data)) return null;

    return positiveStoredSeconds(buildWatchDurationPatch(data).watchDurationSeconds);
};

/** `24:36` under an hour, `1:24:36` at an hour or more. */
export const formatWatchDuration = (seconds) => {
    const total = positiveStoredSeconds(seconds);
    if (total === null) return '';
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainder = total % 60;
    const paddedSeconds = String(remainder).padStart(2, '0');
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
    }
    return `${minutes}:${paddedSeconds}`;
};
