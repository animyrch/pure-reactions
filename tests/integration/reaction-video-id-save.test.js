import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/helpers/firebase', () => ({
  firestoreDeleteField: vi.fn(),
  requestReactionEnrichment: vi.fn(),
  updateFirebaseDocument: vi.fn()
}));

vi.mock('$lib/helpers/youtube', async () => {
  const actual = await vi.importActual('$lib/helpers/youtube');
  return {
    ...actual,
    downloadBasicVideoDetails: vi.fn()
  };
});

import { updateFirebaseDocument } from '$lib/helpers/firebase';
import { createTwinPlayersEditorController } from '$lib/helpers/twinPlayersEditorController';
import { downloadBasicVideoDetails } from '$lib/helpers/youtube';

const VERITASIUM_URL = 'https://www.youtube.com/watch?v=KfODG5REyss';
const VERITASIUM_ID = 'KfODG5REyss';

const editor = (updateState = vi.fn()) =>
  createTwinPlayersEditorController({
    getSnapshot: () => ({}),
    updateState,
    seekReactionTo: () => {},
    enforceReactionMuteMode: () => {}
  });

/**
 * Firestore rejects a write that contains `undefined`, and updateFirebaseDocument
 * turns that rejection into `false`. A blocked oEmbed fetch produces exactly
 * those undefined title and author fields.
 */
const rejectUndefinedFields = (saved) => async (patch) => {
  if (Object.values(patch).some((value) => value === undefined)) {
    return false;
  }
  saved.push(patch);
  return true;
};

describe('setReactionVideoId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves the video id when YouTube returns no title or author', async () => {
    const saved = [];
    downloadBasicVideoDetails.mockResolvedValue({
      videoAuthor: undefined,
      videoTitle: undefined
    });
    updateFirebaseDocument.mockImplementation(rejectUndefinedFields(saved));
    const updateState = vi.fn();

    await editor(updateState).setReactionVideoId(VERITASIUM_URL);

    expect(downloadBasicVideoDetails).toHaveBeenCalledWith(VERITASIUM_ID);
    expect(saved).toEqual([{ reactionVideoId: VERITASIUM_ID }]);
    expect(updateState).toHaveBeenCalledWith({ reactionVideoId: VERITASIUM_ID });
  });

  it('saves the title and author when YouTube returns them', async () => {
    const saved = [];
    downloadBasicVideoDetails.mockResolvedValue({
      videoAuthor: '@veritasium',
      videoTitle: "I finally saw quantum mechanics with my own eyes... (It's spookier than I expected)"
    });
    updateFirebaseDocument.mockImplementation(rejectUndefinedFields(saved));

    await editor().setReactionVideoId(VERITASIUM_ID);

    expect(saved).toEqual([{
      reactionVideoId: VERITASIUM_ID,
      reactionVideoAuthor: '@veritasium',
      reactionVideoTitle: "I finally saw quantum mechanics with my own eyes... (It's spookier than I expected)"
    }]);
  });

  it('throws when the reaction document write fails', async () => {
    downloadBasicVideoDetails.mockResolvedValue({
      videoAuthor: '@veritasium',
      videoTitle: 'Quantum mechanics'
    });
    updateFirebaseDocument.mockResolvedValue(false);
    const updateState = vi.fn();

    await expect(editor(updateState).setReactionVideoId(VERITASIUM_ID)).rejects.toThrow(
      /failed to save the reaction video/i
    );
    expect(updateState).not.toHaveBeenCalled();
  });
});
