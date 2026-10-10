const trimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Card title source. A filled-in custom title wins. An empty custom title
 * leaves the YouTube reaction title untouched, including when it is missing.
 */
export const reactionThumbnailSourceTitle = ({
    customReactionTitle,
    reactionVideoTitle
} = {}) => trimmedString(customReactionTitle) || reactionVideoTitle;

export const momentIdFromReactionData = (data) => trimmedString(data?.momentId);

/**
 * A moment reaction card needs both the flag and a parent moment id.
 * The id is the `/moments/{id}` route key. Without it the moment page cannot load.
 */
export const isMomentReactionData = (data) =>
    data?.isMomentReaction === true && momentIdFromReactionData(data).length > 0;

/** A remix plays the original only. The flag is stored on the reaction document. */
export const isRemixReactionData = (data) => data?.remixMode === true;

export const resolveReactionListItemType = (reaction) => {
    if (reaction?.type === 'queue') {
        return 'queue';
    }
    if (isMomentReactionData(reaction?.data)) {
        return 'moment';
    }
    if (trimmedString(reaction?.data?.playlistId)) {
        return 'playlist';
    }
    if (isRemixReactionData(reaction?.data)) {
        return 'remix';
    }
    return reaction?.type || 'reaction';
};

/**
 * Frame around the watched video.
 * Moment and playlist routes keep their own color. On `/reaction`, a moment
 * reaction stays a moment, a playlist query stays a playlist, a remix stays
 * a remix, and a saved queue playthrough marks a plain reaction as a queue.
 * Ad-hoc queues do not. Remix playback draws the color on the original video,
 * because that is the only video on screen.
 * Colors match the thumbnail card borders in ReactionThumbnail.svelte.
 */
export const PLAYBACK_FRAME_COLORS = {
    queue: 'rgba(99, 102, 241, 0.95)',
    playlist: 'rgba(244, 114, 182, 0.95)',
    moment: 'rgba(251, 191, 36, 0.95)',
    remix: 'rgba(45, 212, 191, 0.95)'
};

export const resolvePlaybackFrameKind = ({
    routeKind = 'reaction',
    queueSlug = '',
    playlistId = '',
    isMomentReaction = false,
    momentId = '',
    remixMode = false
} = {}) => {
    if (routeKind === 'moment') return 'moment';
    if (routeKind === 'playlist') return 'playlist';
    if (isMomentReactionData({ isMomentReaction, momentId })) return 'moment';
    if (trimmedString(playlistId)) return 'playlist';
    if (remixMode === true) return 'remix';
    if (trimmedString(queueSlug)) return 'queue';
    return 'reaction';
};

export const buildReactionCardHref = ({
    itemType = 'reaction',
    reactionPageId = '',
    playlistId = '',
    momentId = '',
    originalVideoId = '',
    queueSlug = ''
} = {}) => {
    if (itemType === 'queue') {
        return `/queue/${queueSlug || reactionPageId}`;
    }

    const momentRouteId = trimmedString(momentId);
    if (itemType === 'moment' && momentRouteId && reactionPageId) {
        return `/moments/${momentRouteId}/reaction/${reactionPageId}`;
    }

    const playlistRouteId = trimmedString(playlistId);
    if (itemType === 'playlist' && playlistRouteId) {
        const playlistQuery = originalVideoId
            ? `?${new URLSearchParams({ item: originalVideoId }).toString()}`
            : '';
        return `/playlist/${playlistRouteId}${playlistQuery}`;
    }

    const playlistSuffix = playlistRouteId ? `?playlistId=${playlistRouteId}` : '';
    return `/reaction/${reactionPageId}${playlistSuffix}`;
};
