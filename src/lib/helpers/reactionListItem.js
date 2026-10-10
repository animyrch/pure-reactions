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
    return reaction?.type || 'reaction';
};

/**
 * Frame around the reaction video on a watching page.
 * Moment and playlist routes keep their own color. On `/reaction`, a moment
 * reaction stays a moment, a playlist query stays a playlist, and a saved
 * queue playthrough marks a plain reaction as a queue. Ad-hoc queues do not.
 * Colors match the thumbnail card borders in ReactionThumbnail.svelte.
 */
export const PLAYBACK_FRAME_COLORS = {
    queue: 'rgba(99, 102, 241, 0.95)',
    playlist: 'rgba(244, 114, 182, 0.95)',
    moment: 'rgba(251, 191, 36, 0.95)'
};

export const resolvePlaybackFrameKind = ({
    routeKind = 'reaction',
    queueSlug = '',
    playlistId = '',
    isMomentReaction = false,
    momentId = ''
} = {}) => {
    if (routeKind === 'moment') return 'moment';
    if (routeKind === 'playlist') return 'playlist';
    if (isMomentReactionData({ isMomentReaction, momentId })) return 'moment';
    if (trimmedString(playlistId)) return 'playlist';
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
