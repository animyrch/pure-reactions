import { describe, expect, it } from 'vitest';

import {
    REACTION_SOURCE_TYPES,
    assignReactionToSequenceIndex,
    buildSequenceItemsFromSources,
    createPlaylistDocumentPayload,
    findPlaylistCurrentIndex,
    getPlaylistSequenceItems,
    parseReactionSourceInput,
    shouldCreatePlaylistDocumentForSequence,
} from '$lib/helpers/reactionSequence';

describe('reaction sequence helpers', () => {
    it('parses playlist, youtube video, and tiktok video inputs', () => {
        expect(
            parseReactionSourceInput('https://www.youtube.com/watch?v=abcdefghijk&list=PL1234567890').sourceItem,
        ).toMatchObject({
            type: REACTION_SOURCE_TYPES.YOUTUBE_PLAYLIST,
            youtubePlaylistId: 'PL1234567890',
        });

        expect(
            parseReactionSourceInput('https://youtu.be/abcdefghijk').sourceItem,
        ).toMatchObject({
            type: REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
            originalVideoId: 'abcdefghijk',
        });

        expect(
            parseReactionSourceInput('https://www.tiktok.com/@creator/video/7056208472144235823').sourceItem,
        ).toMatchObject({
            type: REACTION_SOURCE_TYPES.TIKTOK_VIDEO,
            originalVideoId: '7056208472144235823',
            originalVideoPlatform: 'tiktok',
        });
    });

    it('flattens mixed sources into an ordered sequence while preserving duplicates', async () => {
        const sourceItems = [
            parseReactionSourceInput('https://youtu.be/AAAAAAAAAAA').sourceItem,
            parseReactionSourceInput('https://www.youtube.com/watch?v=BBBBBBBBBBB&list=PL999').sourceItem,
            parseReactionSourceInput('https://www.tiktok.com/@creator/video/7056208472144235823').sourceItem,
            parseReactionSourceInput('https://youtu.be/AAAAAAAAAAA').sourceItem,
        ];

        const sequenceItems = await buildSequenceItemsFromSources(sourceItems, {
            resolveYouTubePlaylist: async (playlistId) => {
                expect(playlistId).toBe('PL999');
                return [
                    {
                        snippet: {
                            resourceId: { videoId: 'BBBBBBBBBBB' },
                            title: 'B video',
                            channelTitle: 'Channel B',
                        },
                    },
                    {
                        snippet: {
                            resourceId: { videoId: 'CCCCCCCCCCC' },
                            title: 'C video',
                            channelTitle: 'Channel C',
                        },
                    },
                ];
            },
        });

        expect(sequenceItems.map((item) => item.originalVideoId)).toEqual([
            'AAAAAAAAAAA',
            'BBBBBBBBBBB',
            'CCCCCCCCCCC',
            '7056208472144235823',
            'AAAAAAAAAAA',
        ]);
        expect(sequenceItems[3].originalVideoPlatform).toBe('tiktok');
    });

    it('builds playlist payloads with aligned sequence slots', () => {
        const payload = createPlaylistDocumentPayload({
            userId: 'user-1',
            sequenceItems: [
                {
                    sourceType: REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
                    sourceIndex: 0,
                    originalVideoId: 'AAAAAAAAAAA',
                    originalVideoPlatform: 'youtube',
                },
                {
                    sourceType: REACTION_SOURCE_TYPES.TIKTOK_VIDEO,
                    sourceIndex: 1,
                    originalVideoId: '7056208472144235823',
                    originalVideoPlatform: 'tiktok',
                },
            ],
        });

        expect(payload.userId).toBe('user-1');
        expect(payload.reactionBinomeIds).toEqual(['', '']);
        expect(payload.originalVideoIds).toEqual([
            'AAAAAAAAAAA',
            '7056208472144235823',
        ]);
        expect(payload.sequenceItems).toHaveLength(2);
    });

    it('assigns reactions by sequence index without deduplicating repeated originals', () => {
        const playlistDocument = {
            reactionBinomeIds: ['', '', ''],
            originalVideoIds: ['AAAAAAAAAAA', 'BBBBBBBBBBB', 'AAAAAAAAAAA'],
            sequenceItems: [
                {
                    sourceType: REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
                    sourceIndex: 0,
                    originalVideoId: 'AAAAAAAAAAA',
                    originalVideoPlatform: 'youtube',
                },
                {
                    sourceType: REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
                    sourceIndex: 1,
                    originalVideoId: 'BBBBBBBBBBB',
                    originalVideoPlatform: 'youtube',
                },
                {
                    sourceType: REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
                    sourceIndex: 2,
                    originalVideoId: 'AAAAAAAAAAA',
                    originalVideoPlatform: 'youtube',
                },
            ],
        };

        const updated = assignReactionToSequenceIndex({
            playlistDocument,
            reactionDocumentId: 'reaction-3',
            sequenceIndex: 2,
            sequenceItem: playlistDocument.sequenceItems[2],
        });

        expect(updated.reactionBinomeIds).toEqual(['', '', 'reaction-3']);
        expect(updated.originalVideoIds).toEqual([
            'AAAAAAAAAAA',
            'BBBBBBBBBBB',
            'AAAAAAAAAAA',
        ]);
    });

    it('falls back to legacy originalVideoIds for existing playlists', () => {
        const sequenceItems = getPlaylistSequenceItems({
            originalVideoIds: ['AAAAAAAAAAA', 'BBBBBBBBBBB'],
        });

        expect(sequenceItems.map((item) => item.originalVideoId)).toEqual([
            'AAAAAAAAAAA',
            'BBBBBBBBBBB',
        ]);
        expect(sequenceItems.every((item) => item.originalVideoPlatform === 'youtube')).toBe(true);
    });

    it('finds the current playlist index from the incoming reaction before route state catches up', () => {
        const playlistDocument = {
            reactionBinomeIds: ['reaction-1', 'reaction-2', 'reaction-3'],
            sequenceItems: [
                {
                    sourceType: REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
                    sourceIndex: 0,
                    originalVideoId: 'AAAAAAAAAAA',
                    originalVideoPlatform: 'youtube',
                },
                {
                    sourceType: REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
                    sourceIndex: 1,
                    originalVideoId: 'BBBBBBBBBBB',
                    originalVideoPlatform: 'youtube',
                },
                {
                    sourceType: REACTION_SOURCE_TYPES.YOUTUBE_VIDEO,
                    sourceIndex: 2,
                    originalVideoId: 'CCCCCCCCCCC',
                    originalVideoPlatform: 'youtube',
                },
            ],
        };

        expect(
            findPlaylistCurrentIndex({
                playlistDocument,
                reactionDocumentId: 'reaction-2',
                originalVideoId: 'AAAAAAAAAAA',
            }),
        ).toBe(1);
    });

    it('falls back to original video ids when reaction ids are unavailable', () => {
        const playlistDocument = {
            reactionBinomeIds: ['', '', ''],
            originalVideoIds: ['AAAAAAAAAAA', 'BBBBBBBBBBB', 'CCCCCCCCCCC'],
        };

        expect(
            findPlaylistCurrentIndex({
                playlistDocument,
                originalVideoId: 'BBBBBBBBBBB',
            }),
        ).toBe(1);
    });

    it('skips playlist mode for a single direct video source', async () => {
        const sourceItems = [
            parseReactionSourceInput('https://youtu.be/AAAAAAAAAAA').sourceItem,
        ];

        const sequenceItems = await buildSequenceItemsFromSources(sourceItems, {
            resolveYouTubePlaylist: async () => [],
        });

        expect(
            shouldCreatePlaylistDocumentForSequence({
                sourceItems,
                sequenceItems,
            }),
        ).toBe(false);
    });

    it('keeps playlist mode for a single playlist source even if it resolves to one item', async () => {
        const sourceItems = [
            parseReactionSourceInput('https://www.youtube.com/watch?v=BBBBBBBBBBB&list=PL999').sourceItem,
        ];

        const sequenceItems = await buildSequenceItemsFromSources(sourceItems, {
            resolveYouTubePlaylist: async () => [
                {
                    snippet: {
                        resourceId: { videoId: 'BBBBBBBBBBB' },
                        title: 'B video',
                        channelTitle: 'Channel B',
                    },
                },
            ],
        });

        expect(
            shouldCreatePlaylistDocumentForSequence({
                sourceItems,
                sequenceItems,
            }),
        ).toBe(true);
    });
});