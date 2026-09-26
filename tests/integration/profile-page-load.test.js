import { describe, expect, it } from 'vitest';
import { load as loadCreatorPage } from '../../src/routes/creator/[slug]/+page.js';
import { load as loadReactorPage } from '../../src/routes/reactor/[slug]/+page.js';

describe('profile page loads', () => {
  it('keeps the creator reactions fetched by the server load', () => {
    const creatorPureReactions = [{ id: 'reaction-1', data: { originalVideoAuthor: 'BLACKPINK' } }];

    const result = loadCreatorPage({
      params: { slug: 'BLACKPINK' },
      data: { creatorPureReactions },
    });

    expect(result.slug).toBe('BLACKPINK');
    expect(result.creatorPureReactions).toBe(creatorPureReactions);
  });

  it('keeps the reactor reactions fetched by the server load', () => {
    const reactorPureReactions = [{ id: 'reaction-1', data: { reactionVideoAuthor: 'Someone' } }];

    const result = loadReactorPage({
      params: { slug: 'Someone' },
      data: { reactorPureReactions },
    });

    expect(result.slug).toBe('Someone');
    expect(result.reactorPureReactions).toBe(reactorPureReactions);
  });
});
