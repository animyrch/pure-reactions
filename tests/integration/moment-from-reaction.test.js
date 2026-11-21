import { describe, expect, it } from 'vitest';
import { buildReactionMenuOptions } from '#lib/helpers/appMenuOptions.js';
import {
  assessReactionSlice,
  assessSourceReaction,
  buildCreateMomentPath,
  buildMomentSliceDocument,
  canOfferCreateMoment,
  existingMomentOptionLabel,
  readSliceBounds,
  resolveMomentTarget,
  shouldShowFullReactionLink,
  sortMomentsByAnchor
} from '#lib/helpers/momentFromReaction.js';

const source = {
  id: 'full-reaction',
  data: {
    reactorId: 'owner-1',
    isPublished: true,
    originalVideoId: 'orig-1',
    originalVideoUrl: 'https://www.youtube.com/watch?v=orig-1',
    originalVideoTitle: 'Original title',
    originalVideoAuthor: 'Artist',
    reactionVideoId: 'react-1',
    reactionVideoTitle: 'Full reaction',
    playlistId: 'playlist-should-not-copy',
    timeOffset: 0,
    stateTimeline: [
      { t: 0, state: 1, targetTime: 40 },
      { t: 10, state: 1, targetTime: 40 }
    ],
    playbackTimeline: [{ t: 0, rate: 1 }]
  }
};

describe('creating a moment from a reaction', () => {
  it('accepts only a full reaction owned by the signed-in user', () => {
    expect(assessSourceReaction(source, 'owner-1').ok).toBe(true);
    expect(assessSourceReaction(source, 'someone-else').ok).toBe(false);
    expect(assessSourceReaction({
      id: 'slice',
      data: { ...source.data, isMomentReaction: true }
    }, 'owner-1').error).toMatch(/full reaction/i);
  });

  it('lists an existing moment by its anchor time and allows a different anchor', () => {
    const moments = sortMomentsByAnchor([
      { id: 'later', title: 'Second hit', momentTimeSeconds: 90 },
      { id: 'earlier', title: 'First hit', momentTimeSeconds: 12 }
    ]);

    expect(moments.map((moment) => moment.id)).toEqual(['earlier', 'later']);
    expect(existingMomentOptionLabel(moments[0])).toBe('First hit · anchor 0:12');

    expect(resolveMomentTarget({
      moments,
      selectedMomentId: 'earlier',
      originalVideoUrl: source.data.originalVideoUrl
    })).toMatchObject({ ok: true, mode: 'existing', momentId: 'earlier', momentTimeSeconds: 12 });

    expect(resolveMomentTarget({
      moments,
      selectedMomentId: 'new',
      title: 'New hit',
      anchorSeconds: '40',
      originalVideoUrl: source.data.originalVideoUrl
    })).toMatchObject({ ok: true, mode: 'new', momentTimeSeconds: 40, title: 'New hit' });
  });

  it('publishes a slice that points back at the full reaction', () => {
    const bounds = readSliceBounds('10', '40');
    const slice = assessReactionSlice(source, {
      momentTimeSeconds: 50,
      offsetStartTime: bounds.offsetStartTime,
      reactionFinishTime: bounds.reactionFinishTime
    });
    expect(slice.ok).toBe(true);

    const document = buildMomentSliceDocument(source, {
      momentId: 'moment-1',
      momentTimeSeconds: 50,
      offsetStartTime: bounds.offsetStartTime,
      reactionFinishTime: bounds.reactionFinishTime,
      userId: 'owner-1',
      reactorDisplayName: 'Owner'
    });

    expect(document).toMatchObject({
      isMomentReaction: true,
      isPublished: true,
      momentId: 'moment-1',
      momentOriginalTimeSeconds: 50,
      offsetStartTime: 10,
      reactionFinishTime: 40,
      sourceReactionId: 'full-reaction',
      reactorId: 'owner-1',
      reactionVideoId: 'react-1'
    });
    expect(document.playlistId).toBeUndefined();
    expect(document.stateTimeline).toEqual(source.data.stateTimeline);
  });

  it('rejects a slice that misses the anchor or runs past 60 seconds', () => {
    const missed = assessReactionSlice(source, {
      momentTimeSeconds: 200,
      offsetStartTime: 0,
      reactionFinishTime: 30
    });
    expect(missed.ok).toBe(false);

    const long = assessReactionSlice(source, {
      momentTimeSeconds: 50,
      offsetStartTime: 0,
      reactionFinishTime: 70
    });
    expect(long.ok).toBe(false);
  });

  it('offers create moment from the owner reaction page and links each slice to its full reaction', () => {
    expect(canOfferCreateMoment({
      isUsersOwnVideo: true,
      isMomentReaction: false,
      pageSlug: 'full-reaction'
    })).toBe(true);
    expect(canOfferCreateMoment({
      isUsersOwnVideo: true,
      isMomentReaction: true,
      pageSlug: 'slice'
    })).toBe(false);
    expect(buildCreateMomentPath('full-reaction')).toBe('/moments/new?reaction=full-reaction');

    const options = buildReactionMenuOptions({
      isUsersOwnVideo: true,
      canCreateMoment: true,
      handlers: { createMoment: () => {} }
    });
    expect(options.map((option) => option.name)).toContain('Create moment');

    expect(shouldShowFullReactionLink({ id: 'full-reaction', isPublished: true })).toBe(true);
    expect(shouldShowFullReactionLink({ id: 'full-reaction', isPublished: false })).toBe(false);
    expect(shouldShowFullReactionLink({
      id: 'slice',
      isPublished: true,
      isMomentReaction: true
    })).toBe(false);
  });
});
