import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestReactionEnrichment = vi.hoisted(() => vi.fn(async () => true));
const downloadBasicVideoDetails = vi.hoisted(() => vi.fn(async (videoId) => {
  if (videoId === 'reactionvid1') {
    return { videoTitle: 'Reaction title', videoAuthor: 'Reactor' };
  }
  return { videoTitle: 'Stored title', videoAuthor: 'Stored author' };
}));

vi.mock('$lib/helpers/firebase', () => ({
  auth: { currentUser: { uid: 'owner' } },
  requestReactionEnrichment,
  updateFirebaseDocument: vi.fn(),
}));

vi.mock('$lib/helpers/youtube', () => ({
  downloadBasicVideoDetails,
}));

import { verifyAndSyncTwinPlayersMetadata } from '$lib/helpers/twinPlayersMetadata';

const storedOriginal = {
  originalVideoId: 'abcdefghijk',
  originalVideoPlatform: 'youtube',
  originalVideoUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
  currentOriginalTitle: 'Stored title',
  currentOriginalAuthor: 'Stored author',
  currentOriginalAuthorUrl: 'https://www.youtube.com/Stored%20author',
  currentOriginalDescription: undefined,
  currentOriginalProviderName: 'YouTube',
  currentOriginalProviderUrl: 'https://www.youtube.com',
  currentOriginalCanonicalUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
  reactionVideoId: 'reactionvid1',
  currentReactionTitle: 'Reaction title',
  currentReactionAuthor: 'Reactor',
  reactorId: 'owner',
};

describe('verifyAndSyncTwinPlayersMetadata', () => {
  beforeEach(() => {
    requestReactionEnrichment.mockClear();
    downloadBasicVideoDetails.mockClear();
    vi.stubGlobal('window', {});
  });

  it('does not refresh enrichment when the stored original fields already match', async () => {
    await verifyAndSyncTwinPlayersMetadata({
      documentId: 'reaction-1',
      ...storedOriginal,
    });

    expect(requestReactionEnrichment).not.toHaveBeenCalled();
  });

  it('refreshes only the original side when that stored title differs', async () => {
    await verifyAndSyncTwinPlayersMetadata({
      documentId: 'reaction-1',
      ...storedOriginal,
      currentOriginalTitle: 'Old title',
    });

    expect(requestReactionEnrichment).toHaveBeenCalledWith('reaction-1', {
      forceReaction: false,
      forceOriginal: true,
    });
  });
});
