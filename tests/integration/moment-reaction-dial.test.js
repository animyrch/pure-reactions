import { describe, expect, it, vi } from 'vitest';
import {
  buildMomentReactionEditHref,
  syncMomentReactionDial
} from '$lib/helpers/momentReactionDial';

describe('moment reaction edit dial', () => {
  it('builds an edit-reaction link that keeps the moment id', () => {
    expect(buildMomentReactionEditHref('reaction-1', 'moment-9')).toBe(
      '/edit-reaction/reaction-1?momentId=moment-9'
    );
  });

  it('omits an empty moment id', () => {
    expect(buildMomentReactionEditHref('reaction-1', '  ')).toBe('/edit-reaction/reaction-1');
  });

  it('does not activate the dial before the reaction is ready', () => {
    const reactionDial = { updateContext: vi.fn() };
    expect(syncMomentReactionDial(reactionDial, { isReady: false })).toBe(false);
    expect(reactionDial.updateContext).not.toHaveBeenCalled();
  });

  it('offers edit mode to the reaction owner', () => {
    const enterEditMode = vi.fn();
    const reactionDial = { updateContext: vi.fn() };

    expect(syncMomentReactionDial(reactionDial, {
      isReady: true,
      isUsersOwnVideo: true,
      canShowEditModeButton: true,
      isPublished: true,
      handlers: { enterEditMode }
    })).toBe(true);

    expect(reactionDial.updateContext).toHaveBeenCalledWith(expect.objectContaining({
      isUsersOwnVideo: true,
      canShowEditModeButton: true,
      canShowEditPlaylistButton: false,
      handlers: expect.objectContaining({ enterEditMode })
    }));
  });
});
