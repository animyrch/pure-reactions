import {
    buildTikTokVideoUrl,
    buildYouTubeThumbnailUrl,
    buildYouTubeVideoUrl,
} from '$lib/helpers/originalVideo';
import {
    ORIGINAL_VIDEO_PLATFORMS,
    extractTikTokVideoId,
    normalizeOriginalVideoPlatform,
} from '$lib/helpers/platform';
import { extractYouTubeVideoId, extractYoutubePlaylistId } from '$lib/helpers/youtube';

export const REACTION_SOURCE_TYPES = /** @type {const} */ ({
    YOUTUBE_VIDEO: 'youtube-video',
    YOUTUBE_PLAYLIST: 'youtube-playlist',
    TIKTOK_VIDEO: 'tiktok-video',
});

const trimString = (value) =>
    typeof value === 'string' && value.trim() ? value.trim() : '';

const toFiniteNumber = (value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
};

const buildSequenceItemId = ({
    sourceIndex = 0,
    playlistItemIndex,
    originalVideoPlatform,
    originalVideoId,
}) =>
    [
        sourceIndex,
        playlistItemIndex ?? 'single',
        normalizeOriginalVideoPlatform(originalVideoPlatform),
        trimString(originalVideoId) || 'unknown',
    ].join(':');

const getSequenceItemTitle = (item = {}) => {
    if (trimString(item.title)) {
        return trimString(item.title);
    }

    const platform = normalizeOriginalVideoPlatform(item.originalVideoPlatform);
    const videoId = trimString(item.originalVideoId);
    if (platform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK) {
        return videoId ? `TikTok ${videoId}` : 'TikTok video';
    }
    return videoId ? `YouTube ${videoId}` : 'YouTube video';
};

const getSequenceItemChannelTitle = (item = {}) =>
    trimString(item.channelTitle) || trimString(item.originalVideoAuthor);

const getSequenceThumbnailUrl = (item = {}) => {
    const explicitThumbnail =
        trimString(item.thumbnailUrl) || trimString(item.originalVideoThumbnailUrl);
    if (explicitThumbnail) {
        return explicitThumbnail;
    }

    const platform = normalizeOriginalVideoPlatform(item.originalVideoPlatform);
    if (platform === ORIGINAL_VIDEO_PLATFORMS.YOUTUBE) {
        return buildYouTubeThumbnailUrl(item.originalVideoId) || '';
    }

    return '';
};

export const parseReactionSourceInput = (rawValue) => {
    const value = trimString(rawValue);
    if (!value) {
        return {
            ok: false,
            error: 'Paste a YouTube playlist, YouTube video, or TikTok video link.',
        };
    }

    const youtubePlaylistId = extractYoutubePlaylistId(value);
    if (youtubePlaylistId) {
        return {
            ok: true,
            sourceItem: {
                type: REACTION_SOURCE_TYPES.YOUTUBE_PLAYLIST,
                label: 'YouTube playlist',
                rawValue: value,
                youtubePlaylistId,
                originalVideoPlatform: ORIGINAL_VIDEO_PLATFORMS.YOUTUBE,
            },
        };
    }

    const youtubeVideoId = extractYouTubeVideoId(value);
    if (youtubeVideoId) {
        return {
            ok: true,
            sourceItem: {
                type: REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
                label: 'YouTube video',
                rawValue: value,
                originalVideoId: youtubeVideoId,
                originalVideoPlatform: ORIGINAL_VIDEO_PLATFORMS.YOUTUBE,
                originalVideoUrl: buildYouTubeVideoUrl(youtubeVideoId),
            },
        };
    }

    const tiktokVideoId = extractTikTokVideoId(value);
    if (tiktokVideoId) {
        return {
            ok: true,
            sourceItem: {
                type: REACTION_SOURCE_TYPES.TIKTOK_VIDEO,
                label: 'TikTok video',
                rawValue: value,
                originalVideoId: tiktokVideoId,
                originalVideoPlatform: ORIGINAL_VIDEO_PLATFORMS.TIKTOK,
                originalVideoUrl: value,
            },
        };
    }

    return {
        ok: false,
        error: 'We could not read that link. Use a YouTube video, YouTube playlist, or TikTok video URL.',
    };
};

export const createSequenceItem = ({
    sourceType,
    sourceIndex = 0,
    playlistItemIndex,
    originalVideoId,
    originalVideoPlatform,
    originalVideoUrl,
    youtubePlaylistId,
    title,
    channelTitle,
    thumbnailUrl,
}) => {
    const platform = normalizeOriginalVideoPlatform(originalVideoPlatform);
    const normalizedVideoId = trimString(originalVideoId);
    const normalizedUrl =
        trimString(originalVideoUrl) ||
        (platform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK
            ? buildTikTokVideoUrl({ videoId: normalizedVideoId })
            : buildYouTubeVideoUrl(normalizedVideoId)) ||
        '';

    return {
        id: buildSequenceItemId({
            sourceIndex,
            playlistItemIndex,
            originalVideoPlatform: platform,
            originalVideoId: normalizedVideoId,
        }),
        sourceType,
        sourceIndex,
        playlistItemIndex:
            playlistItemIndex === undefined || playlistItemIndex === null
                ? null
                : Number(playlistItemIndex),
        originalVideoId: normalizedVideoId,
        originalVideoPlatform: platform,
        originalVideoUrl: normalizedUrl,
        youtubePlaylistId: trimString(youtubePlaylistId),
        title: trimString(title),
        channelTitle: trimString(channelTitle),
        thumbnailUrl: trimString(thumbnailUrl),
    };
};

export const normalizeSequenceItem = (item = {}, fallbackIndex = 0) =>
    createSequenceItem({
        sourceType: trimString(item.sourceType) || REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
        sourceIndex: toFiniteNumber(item.sourceIndex) ?? fallbackIndex,
        playlistItemIndex: toFiniteNumber(item.playlistItemIndex),
        originalVideoId: item.originalVideoId,
        originalVideoPlatform: item.originalVideoPlatform,
        originalVideoUrl: item.originalVideoUrl,
        youtubePlaylistId: item.youtubePlaylistId,
        title: item.title,
        channelTitle: item.channelTitle,
        thumbnailUrl: item.thumbnailUrl,
    });

export const sequenceItemsToLegacyOriginalVideoIds = (sequenceItems = []) =>
    sequenceItems
        .map((item, index) => normalizeSequenceItem(item, index).originalVideoId)
        .filter(Boolean);

export const getPlaylistSequenceItems = (playlistDocument = {}) => {
    if (Array.isArray(playlistDocument?.sequenceItems) && playlistDocument.sequenceItems.length) {
        return playlistDocument.sequenceItems.map((item, index) =>
            normalizeSequenceItem(item, index),
        );
    }

    if (Array.isArray(playlistDocument?.originalVideoIds) && playlistDocument.originalVideoIds.length) {
        return playlistDocument.originalVideoIds
            .map((originalVideoId, index) =>
                createSequenceItem({
                    sourceType: REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
                    sourceIndex: index,
                    originalVideoId,
                    originalVideoPlatform: ORIGINAL_VIDEO_PLATFORMS.YOUTUBE,
                    originalVideoUrl: buildYouTubeVideoUrl(originalVideoId),
                }),
            )
            .filter((item) => item.originalVideoId);
    }

    return [];
};

export const getSequenceItemAtIndex = (playlistDocument = {}, sequenceIndex = 0) => {
    const sequenceItems = getPlaylistSequenceItems(playlistDocument);
    if (!sequenceItems.length) {
        return null;
    }

    const normalizedIndex = Math.max(0, Math.trunc(Number(sequenceIndex) || 0));
    return sequenceItems[normalizedIndex] || null;
};

export const findPlaylistCurrentIndex = ({
    playlistDocument = {},
    reactionDocumentId,
    originalVideoId,
} = {}) => {
    const normalizedReactionDocumentId = trimString(reactionDocumentId);
    if (
        normalizedReactionDocumentId &&
        Array.isArray(playlistDocument?.reactionBinomeIds)
    ) {
        const reactionIndex = playlistDocument.reactionBinomeIds.findIndex(
            (reactionId) => trimString(reactionId) === normalizedReactionDocumentId,
        );
        if (reactionIndex >= 0) {
            return reactionIndex;
        }
    }

    const normalizedOriginalVideoId = trimString(originalVideoId);
    if (!normalizedOriginalVideoId) {
        return -1;
    }

    const sequenceItems = getPlaylistSequenceItems(playlistDocument);
    if (sequenceItems.length) {
        const sequenceIndex = sequenceItems.findIndex(
            (item) => trimString(item?.originalVideoId) === normalizedOriginalVideoId,
        );
        if (sequenceIndex >= 0) {
            return sequenceIndex;
        }
    }

    if (Array.isArray(playlistDocument?.originalVideoIds)) {
        return playlistDocument.originalVideoIds.findIndex(
            (videoId) => trimString(videoId) === normalizedOriginalVideoId,
        );
    }

    return -1;
};

export const shouldCreatePlaylistDocumentForSequence = ({
    sourceItems = [],
    sequenceItems = [],
} = {}) => {
    const normalizedSourceItems = Array.isArray(sourceItems)
        ? sourceItems.filter(Boolean)
        : [];
    const normalizedSequenceItems = Array.isArray(sequenceItems)
        ? sequenceItems.filter((item, index) => normalizeSequenceItem(item, index).originalVideoId)
        : [];

    if (normalizedSequenceItems.length !== 1) {
        return normalizedSequenceItems.length > 1;
    }

    if (normalizedSourceItems.length !== 1) {
        return true;
    }

    return normalizedSourceItems[0]?.type === REACTION_SOURCE_TYPES.YOUTUBE_PLAYLIST;
};

export const createPlaylistDocumentPayload = ({
    userId,
    sequenceItems = [],
    playlistYoutubeId = '',
    reactionDocumentId,
    originalVideoId,
}) => {
    const normalizedSequenceItems = Array.isArray(sequenceItems)
        ? sequenceItems.map((item, index) => normalizeSequenceItem(item, index))
        : [];

    const fallbackSequenceItems =
        normalizedSequenceItems.length > 0
            ? normalizedSequenceItems
            : originalVideoId
              ? [
                    createSequenceItem({
                        sourceType: REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
                        sourceIndex: 0,
                        originalVideoId,
                        originalVideoPlatform: ORIGINAL_VIDEO_PLATFORMS.YOUTUBE,
                        originalVideoUrl: buildYouTubeVideoUrl(originalVideoId),
                    }),
                ]
              : [];

    const reactionBinomeIds = fallbackSequenceItems.map((_, index) =>
        index === 0 && reactionDocumentId ? reactionDocumentId : '',
    );

    return {
        userId,
        reactionBinomeIds,
        originalVideoIds: sequenceItemsToLegacyOriginalVideoIds(fallbackSequenceItems),
        sequenceItems: fallbackSequenceItems,
        youtubePlaylistId: trimString(playlistYoutubeId),
    };
};

export const assignReactionToSequenceIndex = ({
    playlistDocument = {},
    reactionDocumentId,
    sequenceIndex = 0,
    sequenceItem,
}) => {
    const nextSequenceItems = getPlaylistSequenceItems(
        sequenceItem
            ? {
                  ...playlistDocument,
                  sequenceItems: [
                      ...getPlaylistSequenceItems(playlistDocument),
                  ],
              }
            : playlistDocument,
    );
    const normalizedIndex = Math.max(0, Math.trunc(Number(sequenceIndex) || 0));

    while (nextSequenceItems.length <= normalizedIndex) {
        nextSequenceItems.push(
            createSequenceItem({
                sourceType: REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
                sourceIndex: nextSequenceItems.length,
                originalVideoId: '',
                originalVideoPlatform: ORIGINAL_VIDEO_PLATFORMS.YOUTUBE,
            }),
        );
    }

    if (sequenceItem) {
        nextSequenceItems[normalizedIndex] = normalizeSequenceItem(
            sequenceItem,
            normalizedIndex,
        );
    }

    const reactionBinomeIds = Array.isArray(playlistDocument?.reactionBinomeIds)
        ? [...playlistDocument.reactionBinomeIds]
        : [];
    while (reactionBinomeIds.length < nextSequenceItems.length) {
        reactionBinomeIds.push('');
    }
    reactionBinomeIds[normalizedIndex] = trimString(reactionDocumentId);

    return {
        ...playlistDocument,
        reactionBinomeIds,
        originalVideoIds: sequenceItemsToLegacyOriginalVideoIds(nextSequenceItems),
        sequenceItems: nextSequenceItems,
    };
};

export const buildSequenceItemsFromSources = async (
    sourceItems = [],
    { resolveYouTubePlaylist } = {},
) => {
    const nextSequenceItems = [];
    for (const [sourceIndex, sourceItem] of sourceItems.entries()) {
        if (sourceItem?.type === REACTION_SOURCE_TYPES.YOUTUBE_PLAYLIST) {
            if (typeof resolveYouTubePlaylist !== 'function') {
                throw new Error('Missing YouTube playlist resolver.');
            }
            const playlistEntries = await resolveYouTubePlaylist(sourceItem.youtubePlaylistId);
            playlistEntries.forEach((entry, playlistItemIndex) => {
                const videoId =
                    trimString(entry?.originalVideoId) ||
                    trimString(entry?.snippet?.resourceId?.videoId);
                if (!videoId) {
                    return;
                }
                nextSequenceItems.push(
                    createSequenceItem({
                        sourceType: REACTION_SOURCE_TYPES.YOUTUBE_PLAYLIST,
                        sourceIndex,
                        playlistItemIndex,
                        originalVideoId: videoId,
                        originalVideoPlatform: ORIGINAL_VIDEO_PLATFORMS.YOUTUBE,
                        originalVideoUrl: buildYouTubeVideoUrl(videoId),
                        youtubePlaylistId: sourceItem.youtubePlaylistId,
                        title: entry?.title ?? entry?.snippet?.title,
                        channelTitle: entry?.channelTitle ?? entry?.snippet?.channelTitle,
                        thumbnailUrl:
                            entry?.thumbnailUrl ??
                            entry?.snippet?.thumbnails?.maxres?.url ??
                            entry?.snippet?.thumbnails?.standard?.url ??
                            entry?.snippet?.thumbnails?.high?.url ??
                            entry?.snippet?.thumbnails?.medium?.url ??
                            entry?.snippet?.thumbnails?.default?.url,
                    }),
                );
            });
            continue;
        }

        if (sourceItem?.originalVideoId) {
            nextSequenceItems.push(
                createSequenceItem({
                    sourceType: sourceItem.type,
                    sourceIndex,
                    originalVideoId: sourceItem.originalVideoId,
                    originalVideoPlatform: sourceItem.originalVideoPlatform,
                    originalVideoUrl: sourceItem.originalVideoUrl || sourceItem.rawValue,
                    title: sourceItem.title,
                    channelTitle: sourceItem.channelTitle,
                    thumbnailUrl: sourceItem.thumbnailUrl,
                }),
            );
        }
    }

    return nextSequenceItems;
};

export const getSequenceItemLabel = (item = {}) => {
    const title = getSequenceItemTitle(item);
    const channelTitle = getSequenceItemChannelTitle(item);
    if (!channelTitle) {
        return title;
    }
    return `${title} · ${channelTitle}`;
};

export const toPlaylistQueueItem = (item = {}, index = 0) => {
    const sequenceItem = normalizeSequenceItem(item, index);
    return {
        id: sequenceItem.id,
        originalVideoId: sequenceItem.originalVideoId,
        originalVideoPlatform: sequenceItem.originalVideoPlatform,
        originalVideoUrl: sequenceItem.originalVideoUrl,
        title: getSequenceItemTitle(sequenceItem),
        channelTitle: getSequenceItemChannelTitle(sequenceItem),
        thumbnailUrl: getSequenceThumbnailUrl(sequenceItem),
        sourceType: sequenceItem.sourceType,
        playlistItemIndex: sequenceItem.playlistItemIndex,
        youtubePlaylistId: sequenceItem.youtubePlaylistId,
    };
};