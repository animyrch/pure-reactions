import { buildYouTubeThumbnailUrl } from '$lib/helpers/originalVideo';

/** A queue cover is one thumbnail, or the first four once they fill a 2×2. */
export const QUEUE_COVER_SIZE = 4;

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

/** Same source the reaction card uses: the reaction video, then the original. */
export const reactionCoverVideoId = (reaction) => {
    const data = reaction?.data && typeof reaction.data === 'object' ? reaction.data : reaction;
    return trimmed(data?.reactionVideoId) || trimmed(data?.originalVideoId);
};

/**
 * Thumbnail for one queue entry.
 * A playlist uses its first reaction, which is how that entry is drawn in the queue.
 */
export const coverVideoIdForQueueItem = (item) => {
    if (!item || typeof item !== 'object') return '';
    if (item.type === 'playlist') {
        return reactionCoverVideoId(item.playlist?.firstReaction);
    }
    if (item.type === 'reaction') {
        return reactionCoverVideoId(item.reaction);
    }
    return '';
};

/**
 * Fewer than four thumbnails stay a single cover of the first one.
 * Four thumbnails are the quadrant cover, in queue order.
 */
export const queueCoverPresentation = (videoIds) => {
    const ids = [];
    for (const value of Array.isArray(videoIds) ? videoIds : []) {
        const id = trimmed(value);
        if (!id) continue;
        ids.push(id);
        if (ids.length === QUEUE_COVER_SIZE) break;
    }

    if (ids.length >= QUEUE_COVER_SIZE) {
        return { layout: 'quadrants', videoIds: ids };
    }
    if (ids.length >= 1) {
        return { layout: 'single', videoIds: [ids[0]] };
    }
    return { layout: 'empty', videoIds: [] };
};

const isCoverEntry = (item) => {
    const type = item?.type;
    if (type !== 'reaction' && type !== 'playlist') return false;
    return Boolean(trimmed(item?.id) || coverVideoIdForQueueItem(item));
};

/** The first four reaction or playlist entries. Other entry types do not take a slot. */
export const firstCoverEntries = (items) => {
    const entries = [];
    for (const item of Array.isArray(items) ? items : []) {
        if (!isCoverEntry(item)) continue;
        entries.push(item);
        if (entries.length === QUEUE_COVER_SIZE) break;
    }
    return entries;
};

/** Cover ids from the first four queue entries. Later entries are not part of the cover. */
export const coverVideoIdsForItems = (items) => {
    const ids = firstCoverEntries(items)
        .map((item) => coverVideoIdForQueueItem(item))
        .filter(Boolean);
    return queueCoverPresentation(ids).videoIds;
};

const firstReactionIdFromPlaylist = (playlist) => {
    const ids = playlist?.reactionBinomeIds;
    if (!Array.isArray(ids)) return '';
    const match = ids.find((id) => trimmed(id));
    return match ? trimmed(match) : '';
};

const reactionMapFrom = (reactions) => {
    const map = new Map();
    for (const reaction of Array.isArray(reactions) ? reactions : []) {
        if (reaction?.id) map.set(reaction.id, reaction);
    }
    return map;
};

/**
 * Resolve cover thumbnails for queue cards.
 * Only the first four entries of each queue are read.
 */
export const attachQueueCovers = async (queues, { getReactionsByIds, getPlaylist } = {}) => {
    const list = Array.isArray(queues) ? queues : [];
    const loadReactions = typeof getReactionsByIds === 'function' ? getReactionsByIds : async () => [];
    const loadPlaylist = typeof getPlaylist === 'function' ? getPlaylist : async () => null;

    const candidates = list.map((queue) =>
        firstCoverEntries(queue?.data?.items)
            .map((item) => ({ type: item.type, id: trimmed(item.id) }))
            .filter((item) => item.id)
    );

    const reactionIds = new Set();
    const playlistIds = new Set();
    for (const queueCandidates of candidates) {
        for (const candidate of queueCandidates) {
            if (candidate.type === 'reaction') reactionIds.add(candidate.id);
            else playlistIds.add(candidate.id);
        }
    }

    const [reactionDocs, playlistDocs] = await Promise.all([
        reactionIds.size ? loadReactions([...reactionIds]) : [],
        Promise.all([...playlistIds].map(async (id) => {
            try {
                return { id, data: await loadPlaylist(id) };
            } catch (error) {
                console.error('Failed to load playlist for queue cover', error);
                return { id, data: null };
            }
        })),
    ]);

    const reactions = reactionMapFrom(reactionDocs);
    const playlistFirstReactionId = new Map();
    const missingReactionIds = new Set();
    for (const playlist of playlistDocs) {
        const firstId = firstReactionIdFromPlaylist(playlist?.data);
        if (!firstId) continue;
        playlistFirstReactionId.set(playlist.id, firstId);
        if (!reactions.has(firstId)) missingReactionIds.add(firstId);
    }

    if (missingReactionIds.size) {
        const extra = await loadReactions([...missingReactionIds]);
        for (const [id, reaction] of reactionMapFrom(extra)) {
            reactions.set(id, reaction);
        }
    }

    return list.map((queue, index) => {
        const resolved = candidates[index].map((candidate) => {
            if (candidate.type === 'playlist') {
                const firstId = playlistFirstReactionId.get(candidate.id);
                return {
                    type: 'playlist',
                    playlist: { firstReaction: firstId ? reactions.get(firstId) || null : null },
                };
            }
            return { type: 'reaction', reaction: reactions.get(candidate.id) || null };
        });

        return {
            ...queue,
            data: {
                ...(queue?.data || {}),
                coverVideoIds: coverVideoIdsForItems(resolved),
            },
        };
    });
};

export const queueCoverImageUrl = (videoId) =>
    buildYouTubeThumbnailUrl(videoId, { variant: 'mqdefault' }) || '';
