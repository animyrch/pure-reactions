import { describe, expect, it } from 'vitest';
import { planRemixTransport } from '../../src/lib/helpers/remixPlayback.ts';
import { getCurrentStateFromStateConfigs } from '../../src/lib/helpers/reaction.js';

describe('planRemixTransport', () => {
  it('plays through when no play or pause cue applies', () => {
    expect(planRemixTransport({
      state: -1,
      anchorTime: 0,
      targetTime: 0,
      lastAppliedAnchor: null,
      isUserPaused: false,
    })).toEqual({
      transport: 'play',
      seekTo: null,
      nextAppliedAnchor: null,
    });
  });

  it('pauses at a pause cue without seeking', () => {
    expect(planRemixTransport({
      state: 2,
      anchorTime: 12,
      targetTime: 12,
      lastAppliedAnchor: null,
      isUserPaused: false,
    })).toEqual({
      transport: 'pause',
      seekTo: null,
      nextAppliedAnchor: 12,
    });
  });

  it('jumps once when a play cue targets a different original time', () => {
    const first = planRemixTransport({
      state: 1,
      anchorTime: 10,
      targetTime: 40,
      currentTime: 10.2,
      previousTime: 9.6,
      lastAppliedAnchor: null,
      isUserPaused: false,
    });
    expect(first).toEqual({
      transport: 'play',
      seekTo: 40,
      nextAppliedAnchor: 10,
    });

    expect(planRemixTransport({
      state: 1,
      anchorTime: 10,
      targetTime: 40,
      currentTime: 40.2,
      previousTime: first.seekTo,
      lastAppliedAnchor: first.nextAppliedAnchor,
      isUserPaused: false,
    })).toEqual({
      transport: 'play',
      seekTo: null,
      nextAppliedAnchor: 10,
    });
  });

  it('jumps when the first sample is already past the play cue', () => {
    const first = planRemixTransport({
      state: 1,
      anchorTime: 0.4,
      targetTime: 40,
      currentTime: 2,
      previousTime: null,
      playbackOrigin: 0,
      lastAppliedAnchor: null,
      isUserPaused: false,
    });
    expect(first).toEqual({
      transport: 'play',
      seekTo: 40,
      nextAppliedAnchor: 0.4,
    });

    expect(planRemixTransport({
      state: 1,
      anchorTime: 0.4,
      targetTime: 40,
      currentTime: 40.3,
      previousTime: first.seekTo,
      playbackOrigin: first.seekTo,
      lastAppliedAnchor: first.nextAppliedAnchor,
      isUserPaused: false,
    })).toEqual({
      transport: 'play',
      seekTo: null,
      nextAppliedAnchor: 0.4,
    });
  });

  it('does not fire a cue that sits behind the last intentional position', () => {
    expect(planRemixTransport({
      state: 1,
      anchorTime: 8,
      targetTime: 50,
      currentTime: 25.2,
      previousTime: 25,
      playbackOrigin: 20,
      lastAppliedAnchor: 1,
      isUserPaused: false,
    })).toEqual({
      transport: 'play',
      seekTo: null,
      nextAppliedAnchor: 8,
    });
  });

  it('does not fire a later play cue when the clock is already past it', () => {
    expect(planRemixTransport({
      state: 1,
      anchorTime: 8,
      targetTime: 50,
      currentTime: 25,
      previousTime: 25,
      lastAppliedAnchor: 1,
      isUserPaused: false,
    })).toEqual({
      transport: 'play',
      seekTo: null,
      nextAppliedAnchor: 8,
    });
  });

  it('jumps when playback moves across a play cue', () => {
    expect(planRemixTransport({
      state: 1,
      anchorTime: 5,
      targetTime: 40,
      currentTime: 5.2,
      previousTime: 4.6,
      lastAppliedAnchor: null,
      isUserPaused: false,
    })).toEqual({
      transport: 'play',
      seekTo: 40,
      nextAppliedAnchor: 5,
    });
  });

  it('does not seek the second play cue again after that jump lands before it', () => {
    const timeline = [
      { t: 0, state: 1, targetTime: 0 },
      { t: 40, state: 1, targetTime: 12 },
    ];
    const consumed = [];
    let appliedAnchor = 0;
    let origin = 0;

    const step = (currentTime) => {
      const config = getCurrentStateFromStateConfigs(currentTime, timeline, 0);
      const plan = planRemixTransport({
        state: Number(config.state),
        anchorTime: Number(config.closestSmallerTimeCode),
        targetTime: Number(config.time),
        currentTime,
        playbackOrigin: origin,
        lastAppliedAnchor: appliedAnchor,
        appliedAnchors: consumed,
        isUserPaused: false,
      });
      appliedAnchor = plan.nextAppliedAnchor;
      if (plan.seekTo !== null) {
        const anchor = Number(config.closestSmallerTimeCode);
        if (!consumed.some((entry) => Math.abs(entry - anchor) <= 0.001)) {
          consumed.push(anchor);
        }
        origin = plan.seekTo;
      }
      return plan;
    };

    expect(step(0.2).seekTo).toBe(null);
    expect(step(40.1).seekTo).toBe(12);

    const landed = step(12.2);
    expect(landed.seekTo).toBe(null);

    const again = step(40.2);
    expect(again.seekTo).toBe(null);
    expect(again.transport).toBe('play');
  });

  it('keeps a play cue consumed across a gap where no config applies', () => {
    const jumped = planRemixTransport({
      state: 1,
      anchorTime: 40,
      targetTime: 8,
      currentTime: 40,
      playbackOrigin: 0,
      lastAppliedAnchor: null,
      appliedAnchors: [],
      isUserPaused: false,
    });
    expect(jumped.seekTo).toBe(8);

    const gap = planRemixTransport({
      state: -1,
      anchorTime: 0,
      targetTime: 0,
      currentTime: 8.2,
      playbackOrigin: 8,
      lastAppliedAnchor: null,
      appliedAnchors: [40],
      isUserPaused: false,
    });
    expect(gap.seekTo).toBe(null);
    expect(gap.nextAppliedAnchor).toBe(null);

    expect(planRemixTransport({
      state: 1,
      anchorTime: 40,
      targetTime: 8,
      currentTime: 40.2,
      playbackOrigin: 8,
      lastAppliedAnchor: gap.nextAppliedAnchor,
      appliedAnchors: [40],
      isUserPaused: false,
    })).toMatchObject({
      transport: 'play',
      seekTo: null,
    });
  });

  it('still jumps a later play cue once when its target is ahead of the cue', () => {
    const timeline = [
      { t: 1, state: 1, targetTime: 20 },
      { t: 30, state: 1, targetTime: 50 },
    ];
    const consumed = [];
    let appliedAnchor = null;
    let origin = 0;
    const seeks = [];

    const step = (currentTime) => {
      const config = getCurrentStateFromStateConfigs(currentTime, timeline, 0);
      const plan = planRemixTransport({
        state: Number(config.state),
        anchorTime: Number(config.closestSmallerTimeCode),
        targetTime: Number(config.time),
        currentTime,
        playbackOrigin: origin,
        lastAppliedAnchor: appliedAnchor,
        appliedAnchors: consumed,
        isUserPaused: false,
      });
      appliedAnchor = plan.nextAppliedAnchor;
      if (plan.seekTo !== null) {
        const anchor = Number(config.closestSmallerTimeCode);
        if (!consumed.some((entry) => Math.abs(entry - anchor) <= 0.001)) {
          consumed.push(anchor);
        }
        origin = plan.seekTo;
        seeks.push(plan.seekTo);
      }
      return plan;
    };

    expect(step(1.1).seekTo).toBe(20);
    expect(step(20.4).seekTo).toBe(null);
    expect(step(30.1).seekTo).toBe(50);
    expect(step(50.3).seekTo).toBe(null);
    expect(step(51).seekTo).toBe(null);
    expect(seeks).toEqual([20, 50]);
  });

  it('holds position while the viewer has paused', () => {
    expect(planRemixTransport({
      state: 1,
      anchorTime: 10,
      targetTime: 40,
      lastAppliedAnchor: null,
      isUserPaused: true,
    })).toEqual({
      transport: 'hold',
      seekTo: null,
      nextAppliedAnchor: null,
    });
  });
});
