import {
    buildWatchDurationPatch,
    hasStoredWatchDuration,
    isPlaylistCardData,
    playlistReactionIds,
    reactionWindowSeconds,
    sumPlaylistReactionWindows,
    trimmed,
} from '$lib/helpers/watchDuration';

const roundContribution = (data) => {
    const windowSeconds = reactionWindowSeconds(data);
    if (windowSeconds === null) return null;
    return Math.max(0, Math.round(windowSeconds));
};

export const watchDurationPatchChanged = (current, patch) =>
    Object.entries(patch).some(([key, value]) => {
        if (!current || !Object.prototype.hasOwnProperty.call(current, key)) return true;
        return current[key] !== value;
    });

const writeIfChanged = async (write, id, patch, current) => {
    if (!watchDurationPatchChanged(current, patch)) return false;
    await write(id, patch, current);
    return true;
};

/**
 * Recompute one playlist total and copy it onto every member card that
 * shows that playlist. Moment cards keep their own subsection.
 */
export const syncPlaylistWatchDuration = async (playlistId, io) => {
    const playlist = await io.getPlaylist(playlistId);
    if (!playlist?.data) return null;

    const ids = playlistReactionIds(playlist.data);
    const uniqueIds = [...new Set(ids)];
    const members = uniqueIds.length ? await io.getReactions(uniqueIds) : [];
    const byId = new Map(
        members.filter((member) => member?.id && member.data).map((member) => [member.id, member.data])
    );
    const playlistTotal = sumPlaylistReactionWindows(byId, ids);

    await writeIfChanged(
        io.updatePlaylist,
        playlistId,
        { watchDurationSeconds: playlistTotal },
        playlist.data
    );

    for (const id of uniqueIds) {
        const data = byId.get(id);
        if (!data) continue;
        if (trimmed(data.playlistId) === playlistId) {
            await writeIfChanged(
                io.updateReaction,
                id,
                buildWatchDurationPatch(data, playlistTotal),
                data
            );
            continue;
        }
        await writeIfChanged(
            io.updateReaction,
            id,
            { reactionWatchDurationSeconds: roundContribution(data) },
            data
        );
    }

    return playlistTotal;
};

export const syncReactionWatchDuration = async ({
    reactionId,
    previousPlaylistId = '',
    io,
}) => {
    const reaction = await io.getReaction(reactionId);
    if (!reaction?.data) return;

    const playlistId = trimmed(reaction.data.playlistId);
    if (playlistId) {
        await syncPlaylistWatchDuration(playlistId, io);
    } else {
        await writeIfChanged(
            io.updateReaction,
            reactionId,
            buildWatchDurationPatch(reaction.data),
            reaction.data
        );
    }

    const previous = trimmed(previousPlaylistId);
    if (previous && previous !== playlistId) {
        await syncPlaylistWatchDuration(previous, io);
    }
};

/**
 * Fill a missing stored duration once. Later reads use the stored number.
 */
export const ensureReactionWatchDuration = async (io, reactionId, data) => {
    if (hasStoredWatchDuration(data)) return data;

    const playlistId = trimmed(data?.playlistId);
    if (playlistId) {
        const playlistTotal = await syncPlaylistWatchDuration(playlistId, io);
        const fresh = await io.getReaction(reactionId);
        if (fresh?.data && hasStoredWatchDuration(fresh.data)) {
            return fresh.data;
        }
        const patch = isPlaylistCardData(data)
            ? buildWatchDurationPatch(data, playlistTotal)
            : buildWatchDurationPatch(data);
        await writeIfChanged(io.updateReaction, reactionId, patch, data);
        return { ...data, ...patch };
    }

    const patch = buildWatchDurationPatch(data);
    await writeIfChanged(io.updateReaction, reactionId, patch, data);
    return { ...data, ...patch };
};
