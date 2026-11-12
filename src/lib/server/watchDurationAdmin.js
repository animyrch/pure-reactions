import { COLLECTION_PLAYLISTS, COLLECTION_REACTION_BINOMES } from '#lib/constants/firebase.js';
import { buildWatchDurationPatch } from '#lib/helpers/watchDuration.js';
import {
    ensureReactionWatchDuration,
    syncReactionWatchDuration,
    watchDurationPatchChanged,
} from '#lib/helpers/watchDurationSync.js';

const chunk = (values, size) => {
    const groups = [];
    for (let index = 0; index < values.length; index += size) {
        groups.push(values.slice(index, index + size));
    }
    return groups;
};

export const createAdminWatchDurationIo = (
    adminDb,
    {
        reactionCollection = COLLECTION_REACTION_BINOMES,
        playlistCollection = COLLECTION_PLAYLISTS,
    } = {}
) => {
    const reactionCache = new Map();
    const playlistCache = new Map();

    const rememberReaction = (id, data) => {
        const value = data ? { id, data } : null;
        reactionCache.set(id, value);
        return value;
    };

    return {
        peekReaction(id) {
            return reactionCache.get(id) || null;
        },

        async getReaction(id) {
            if (reactionCache.has(id)) return reactionCache.get(id);
            const snap = await adminDb.collection(reactionCollection).doc(id).get();
            return rememberReaction(id, snap.exists ? snap.data() : null);
        },

        async getReactions(ids) {
            const missing = ids.filter((id) => id && !reactionCache.has(id));
            for (const group of chunk(missing, 30)) {
                const refs = group.map((id) => adminDb.collection(reactionCollection).doc(id));
                const snaps = await adminDb.getAll(...refs);
                snaps.forEach((snap) => {
                    rememberReaction(snap.id, snap.exists ? snap.data() : null);
                });
            }
            return ids.map((id) => reactionCache.get(id)).filter(Boolean);
        },

        async updateReaction(id, patch, current) {
            if (!watchDurationPatchChanged(current, patch)) return;
            await adminDb.collection(reactionCollection).doc(id).update(patch);
            rememberReaction(id, { ...(current || {}), ...patch });
        },

        async getPlaylist(id) {
            if (playlistCache.has(id)) return playlistCache.get(id);
            const snap = await adminDb.collection(playlistCollection).doc(id).get();
            const value = snap.exists ? { id, data: snap.data() } : null;
            playlistCache.set(id, value);
            return value;
        },

        async updatePlaylist(id, patch, current) {
            if (!watchDurationPatchChanged(current, patch)) return;
            await adminDb.collection(playlistCollection).doc(id).update(patch);
            playlistCache.set(id, { id, data: { ...(current || {}), ...patch } });
        },
    };
};

const scopeWatchDurationWrites = (io, ownerId) => ({
    peekReaction: (id) => io.peekReaction(id),
    getReaction: (id) => io.getReaction(id),
    getReactions: (ids) => io.getReactions(ids),
    getPlaylist: (id) => io.getPlaylist(id),
    async updateReaction(id, patch, current) {
        if (current?.reactorId !== ownerId) return;
        await io.updateReaction(id, patch, current);
    },
    async updatePlaylist(id, patch, current) {
        if (current?.userId !== ownerId) return;
        await io.updatePlaylist(id, patch, current);
    },
});

export const persistReactionWatchDurationAdmin = async (
    adminDb,
    reactionId,
    { reactionCollection = COLLECTION_REACTION_BINOMES, ownerId } = {}
) => {
    const io = createAdminWatchDurationIo(adminDb, { reactionCollection });
    if (typeof ownerId !== 'string' || !ownerId) {
        await syncReactionWatchDuration({ reactionId, io });
        return;
    }

    const ownedIo = scopeWatchDurationWrites(io, ownerId);
    const reaction = await ownedIo.getReaction(reactionId);
    if (!reaction?.data || reaction.data.reactorId !== ownerId) return;

    const playlistId = typeof reaction.data.playlistId === 'string' ? reaction.data.playlistId.trim() : '';
    if (playlistId) {
        const playlist = await ownedIo.getPlaylist(playlistId);
        if (playlist?.data?.userId === ownerId) {
            await syncReactionWatchDuration({ reactionId, io: ownedIo });
            return;
        }
    }

    const patch = buildWatchDurationPatch({ ...reaction.data, playlistId: '' });
    await ownedIo.updateReaction(reactionId, patch, reaction.data);
};

export const ensureReactionWatchDurationAdmin = async (adminDb, reactionId, data, io) => {
    const store = io || createAdminWatchDurationIo(adminDb);
    return ensureReactionWatchDuration(store, reactionId, data);
};
