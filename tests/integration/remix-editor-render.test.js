import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import EditorPanelsV2 from '../../src/lib/components/reaction/EditorPanelsV2.svelte';
import InteractiveSynchronizer from '../../src/lib/components/Video/InteractiveSynchronizer.svelte';

const baseEditorProps = {
  isEditModeOn: true,
  isReactionMissing: false,
  reactionVideoId: 'abc123',
  onSetRemixMode: async () => {},
  onSetReactionVideoId: () => {},
  onSaveGeneralSettings: async () => {},
};

describe('remix editor settings', () => {
  it('shows the remix toggle and hides the reaction input and player layout', () => {
    const { body } = render(EditorPanelsV2, {
      props: {
        ...baseEditorProps,
        remixMode: true,
      },
    });

    expect(body).toContain('Remix mode');
    expect(body).toContain('About remix mode');
    expect(body.indexOf('Reaction video URL or ID')).toBeLessThan(body.indexOf('Remix mode'));
    expect(body).toContain('aria-checked="true"');
    const onSwitch = body.match(/<button[^>]*role="switch"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(onSwitch).toContain('bg-accent-primary');
    expect(onSwitch).toContain('translate-x-5');
    expect(onSwitch).not.toContain('bg-border-strong');
    const input = body.match(/<input[^>]*aria-label="Reaction video URL or ID"[^>]*>/)?.[0] ?? '';
    expect(input).toMatch(/(?:^|\s)disabled(?:[=/\s>]|$)/);
    expect(body).not.toContain('4. Player layout');
    expect(body).not.toContain('Reaction mute mode');
    expect(body).toContain('The original plays on its own');
  });

  it('keeps the reaction input and player layout when remix mode is off', () => {
    const { body } = render(EditorPanelsV2, {
      props: {
        ...baseEditorProps,
        remixMode: false,
      },
    });

    expect(body).toContain('aria-checked="false"');
    const offSwitch = body.match(/<button[^>]*role="switch"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(offSwitch).toContain('bg-border-strong');
    expect(offSwitch).toContain('bg-text-primary');
    expect(offSwitch).not.toContain('bg-accent-primary');
    expect(body).toContain('4. Player layout');
    expect(body).toContain('Update video');
    expect(body.indexOf('Reaction video URL or ID')).toBeLessThan(body.indexOf('Remix mode'));
    expect(body).toContain('aria-label="Reaction title"');
    expect(body).toContain('Leave blank to keep the YouTube title.');
    const input = body.match(/<input[^>]*aria-label="Reaction video URL or ID"[^>]*>/)?.[0] ?? '';
    expect(input).not.toMatch(/(?:^|\s)disabled(?:[=/\s>]|$)/);
  });
});

describe('remix fine-tune timeline', () => {
  it('uses the original clock and drops the reaction volume and overlay tracks', () => {
    const { body } = render(InteractiveSynchronizer, {
      props: {
        timeAxis: 'original',
        showReactionVolumeTrack: false,
        showOverlayTrack: false,
        currentTime: 65,
        duration: 120,
        seekMin: 0,
        seekMax: 120,
        playerEvents: [{ timeInReaction: 90, state: 1, targetTime: 40 }],
      },
    });

    expect(body).toContain('Original video timeline');
    expect(body).toContain('Original playback timeline');
    expect(body).toContain('>1:05<');
    expect(body).toContain('data-track-id="originalVideo"');
    expect(body).toContain('data-track-id="volume"');
    expect(body).not.toContain('data-track-id="reactionVolume"');
    expect(body).not.toContain('data-track-id="overlayVisibility"');
    expect(body).toContain('at 1:30');
  });

  it('keeps the reaction clock and both tracks in normal mode', () => {
    const { body } = render(InteractiveSynchronizer, {
      props: {
        timeAxis: 'reaction',
        showReactionVolumeTrack: true,
        showOverlayTrack: true,
        currentTime: 10,
        duration: 30,
        seekMin: 0,
        seekMax: 30,
        playerEvents: [{ timeInReaction: 12, state: 2, targetTime: 4 }],
      },
    });

    expect(body).toContain('Live reaction timeline');
    expect(body).toContain('>0:10<');
    expect(body).toContain('data-track-id="reactionVolume"');
    expect(body).toContain('data-track-id="overlayVisibility"');
    expect(body).toContain('at 0:12');
    expect(body).not.toContain('data-disabled-section');
  });

  it('disables the skipped span and the tail after a pause on the original clock', () => {
    const { body } = render(InteractiveSynchronizer, {
      props: {
        timeAxis: 'original',
        showReactionVolumeTrack: false,
        showOverlayTrack: false,
        currentTime: 5,
        duration: 120,
        seekMin: 0,
        seekMax: 120,
        playerEvents: [
          { timeInReaction: 20, state: 1, targetTime: 50 },
          { timeInReaction: 80, state: 2, targetTime: 80 },
        ],
        volumeEvents: [{ timeInReaction: 10, volume: 40 }],
      },
    });

    const sections = [
      ...body.matchAll(
        /data-disabled-section="(skip|pause|mixed)" data-disabled-start="([^"]+)" data-disabled-end="([^"]+)"/g,
      ),
    ];
    expect(sections.map((match) => match.slice(1))).toEqual([
      ['skip', '20.000', '50.000'],
      ['pause', '80.000', '120.000'],
    ]);
    expect(body).toContain('left: 16.667%');
    expect(body).toContain('width: 25.000%');
    expect(body).toContain('left: 66.667%');
    expect(body).toContain('width: 33.333%');
    expect(body).toContain('Skipped');
    expect(body).toContain('Remix ended');
    expect(body).toContain('data-track-id="volume"');
    expect(body).toContain('data-track-id="speed"');
  });

  it('moves the disabled span when the play cue target changes and clears it when the cue is removed', () => {
    const adjusted = render(InteractiveSynchronizer, {
      props: {
        timeAxis: 'original',
        showReactionVolumeTrack: false,
        showOverlayTrack: false,
        allowPlaybackRate: false,
        currentTime: 0,
        duration: 120,
        seekMin: 0,
        seekMax: 120,
        playerEvents: [{ timeInReaction: 20, state: 1, targetTime: 70 }],
      },
    }).body;
    expect(adjusted).toContain('data-disabled-start="20.000"');
    expect(adjusted).toContain('data-disabled-end="70.000"');
    expect(adjusted).toContain('width: 41.667%');

    const cleared = render(InteractiveSynchronizer, {
      props: {
        timeAxis: 'original',
        showReactionVolumeTrack: false,
        showOverlayTrack: false,
        allowPlaybackRate: false,
        currentTime: 0,
        duration: 120,
        seekMin: 0,
        seekMax: 120,
        playerEvents: [],
      },
    }).body;
    expect(cleared).not.toContain('data-disabled-section');
  });

  it('clips a disabled span to the zoomed timeline', () => {
    const { body } = render(InteractiveSynchronizer, {
      props: {
        timeAxis: 'original',
        showReactionVolumeTrack: false,
        showOverlayTrack: false,
        allowPlaybackRate: false,
        currentTime: 40,
        duration: 120,
        seekMin: 30,
        seekMax: 90,
        playerEvents: [
          { timeInReaction: 20, state: 1, targetTime: 50 },
          { timeInReaction: 80, state: 2, targetTime: 80 },
        ],
      },
    });

    expect(body).toContain('data-disabled-start="20.000"');
    expect(body).toContain('data-disabled-end="50.000"');
    expect(body).toContain('left: 0.000%');
    expect(body).toContain('width: 33.333%');
    expect(body).toContain('left: 83.333%');
    expect(body).toContain('width: 16.667%');
  });
});
