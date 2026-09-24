import { describe, expect, it } from 'vitest';
import {
    buildReactionCardHref,
    isMomentReactionData,
    resolveReactionListItemType
} from '../../src/lib/helpers/reactionListItem.js';

describe('reaction list item presentation', () => {
    it('keeps a published reaction on the reaction page', () => {
        const reaction = {
            id: 'reaction-1',
            type: 'reaction',
            data: {
                isPublished: true,
                reactionVideoTitle: 'A normal reaction'
            }
        };

        expect(resolveReactionListItemType(reaction)).toBe('reaction');
        expect(buildReactionCardHref({
            itemType: 'reaction',
            reactionPageId: reaction.id
        })).toBe('/reaction/reaction-1');
    });

    it('keeps playlist cards on the playlist page', () => {
        const reaction = {
            id: 'reaction-2',
            data: { playlistId: 'playlist-9', originalVideoId: 'orig-1' }
        };

        expect(resolveReactionListItemType(reaction)).toBe('playlist');
        expect(buildReactionCardHref({
            itemType: 'playlist',
            reactionPageId: reaction.id,
            playlistId: 'playlist-9',
            originalVideoId: 'orig-1'
        })).toBe('/playlist/playlist-9?item=orig-1');
    });

    it('routes a published moment reaction to the moment reaction page', () => {
        const reaction = {
            id: 'moment-reaction-1',
            type: 'reaction',
            data: {
                isPublished: true,
                isMomentReaction: true,
                momentId: 'moment-anchor-1',
                playlistId: ''
            }
        };

        expect(isMomentReactionData(reaction.data)).toBe(true);
        expect(resolveReactionListItemType(reaction)).toBe('moment');
        expect(buildReactionCardHref({
            itemType: 'moment',
            reactionPageId: reaction.id,
            momentId: 'moment-anchor-1'
        })).toBe('/moments/moment-anchor-1/reaction/moment-reaction-1');
    });

    it('prefers the moment page when a moment reaction also carries a playlist id', () => {
        const reaction = {
            id: 'moment-reaction-2',
            data: {
                isMomentReaction: true,
                momentId: ' moment-anchor-2 ',
                playlistId: 'playlist-should-not-win'
            }
        };

        expect(resolveReactionListItemType(reaction)).toBe('moment');
        expect(buildReactionCardHref({
            itemType: 'moment',
            reactionPageId: reaction.id,
            momentId: reaction.data.momentId,
            playlistId: reaction.data.playlistId
        })).toBe('/moments/moment-anchor-2/reaction/moment-reaction-2');
    });

    it('does not mark a reaction as a moment without a moment id', () => {
        const reaction = {
            id: 'broken-moment',
            data: { isMomentReaction: true, momentId: '   ' }
        };

        expect(isMomentReactionData(reaction.data)).toBe(false);
        expect(resolveReactionListItemType(reaction)).toBe('reaction');
    });
});
