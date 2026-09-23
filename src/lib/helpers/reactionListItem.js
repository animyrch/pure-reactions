const trimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

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
