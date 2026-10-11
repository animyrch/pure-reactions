import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PlaylistNextActionHarness from './PlaylistNextActionHarness.svelte';

describe('playlist next action', () => {
  it('exposes loadNextReactionInPlaylist on twin player actions', () => {
    const { body } = render(PlaylistNextActionHarness);

    expect(body).toContain('>function<');
  });
});
