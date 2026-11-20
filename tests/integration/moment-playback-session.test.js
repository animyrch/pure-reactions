import { describe, expect, it } from 'vitest';
import {
  initialMomentPlaybackSession,
  reduceMomentPlaybackSession
} from '#lib/helpers/momentPlaybackSession.js';

describe('moment playback session', () => {
  it('keeps later reactions paused until both videos have started once', () => {
    const closed = reduceMomentPlaybackSession(initialMomentPlaybackSession, {
      momentSlug: 'moment-a',
      bothVideosStarted: false
    });

    expect(closed.started).toBe(false);

    const stillClosed = reduceMomentPlaybackSession(closed, {
      momentSlug: 'moment-a',
      bothVideosStarted: false
    });

    expect(stillClosed).toBe(closed);
  });

  it('arms autoplay after the click gate opens and keeps it if the gate closes mid-switch', () => {
    const closed = reduceMomentPlaybackSession(initialMomentPlaybackSession, {
      momentSlug: 'moment-a',
      bothVideosStarted: false
    });
    const started = reduceMomentPlaybackSession(closed, {
      momentSlug: 'moment-a',
      bothVideosStarted: true
    });

    expect(started.started).toBe(true);

    const duringSwitch = reduceMomentPlaybackSession(started, {
      momentSlug: 'moment-a',
      bothVideosStarted: false
    });

    expect(duringSwitch.started).toBe(true);

    const stillStarted = reduceMomentPlaybackSession(duringSwitch, {
      momentSlug: 'moment-a',
      bothVideosStarted: true
    });

    expect(stillStarted.started).toBe(true);
  });

  it('requires a fresh pair of clicks after moving to another moment', () => {
    const started = reduceMomentPlaybackSession(
      reduceMomentPlaybackSession(initialMomentPlaybackSession, {
        momentSlug: 'moment-a',
        bothVideosStarted: false
      }),
      {
        momentSlug: 'moment-a',
        bothVideosStarted: true
      }
    );

    const nextMomentWhilePreviousGateStillOpen = reduceMomentPlaybackSession(started, {
      momentSlug: 'moment-b',
      bothVideosStarted: true
    });

    expect(nextMomentWhilePreviousGateStillOpen.started).toBe(false);

    const gateClosed = reduceMomentPlaybackSession(nextMomentWhilePreviousGateStillOpen, {
      momentSlug: 'moment-b',
      bothVideosStarted: false
    });
    const gateOpened = reduceMomentPlaybackSession(gateClosed, {
      momentSlug: 'moment-b',
      bothVideosStarted: true
    });

    expect(gateOpened.started).toBe(true);
  });
});
