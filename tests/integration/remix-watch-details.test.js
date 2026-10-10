import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import CreatorDetails from '../../src/lib/components/Video/CreatorDetails.svelte';
import ReactionStage from '../../src/lib/components/reaction/ReactionStage.svelte';

const details = {
  originalVideoTitle: 'Remix playthrough original',
  originalVideoAuthor: '@remix-owner',
  originalVideoId: 'origRemixPlay01',
  reactionVideoTitle: 'Remix watch reaction',
  reactionVideoAuthor: '@remix-owner',
  reactionVideoId: 'reactRemixWatch01',
  pageSlug: 'remixWatchReaction01',
};

describe('remix watch details', () => {
  it('drops the reaction video column and its placeholder', () => {
    const { body } = render(CreatorDetails, {
      props: { ...details, remixMode: true },
    });

    expect(body).toContain('Remix playthrough original');
    expect(body).toContain('data-details-layout="original"');
    expect(body).not.toContain('id="reaction-heading"');
    expect(body).not.toContain('Remix watch reaction');
    expect(body).not.toContain('>Reaction video<');
    expect(body).not.toContain('Unknown reactor');
    expect(body).not.toContain('alt="Reactor"');
  });

  it('keeps the reaction video column when remix mode is off', () => {
    const { body } = render(CreatorDetails, {
      props: { ...details, remixMode: false },
    });

    expect(body).toContain('id="reaction-heading"');
    expect(body).toContain('Remix watch reaction');
    expect(body).toContain('data-details-layout="both"');
  });

  it('does not render a reaction player when remix mode is on', () => {
    const { body } = render(ReactionStage, {
      props: {
        remixMode: true,
        isReactionMissing: false,
        playerOriginal: {},
        playerReaction: {},
      },
    });

    expect(body).not.toContain('data-stage="reaction"');
    expect(body).not.toContain('id="player-reaction"');
    expect(body).toContain('id="player-original"');
  });
});
