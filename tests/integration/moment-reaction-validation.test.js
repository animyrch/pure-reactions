import { describe, expect, it } from 'vitest';
import {
  MOMENT_REACTION_MAX_DURATION_SECONDS,
  validateMomentReaction,
  getOriginalTimeAtReactionTime
} from '../../src/lib/helpers/momentReactionValidation.ts';

describe('momentReactionValidation', () => {
  it('rejects subsections longer than 60 seconds', () => {
    const result = validateMomentReaction({
      momentOriginalTimeSeconds: 120,
      offsetStartTime: 0,
      reactionFinishTime: 70,
      timeOffset: 0,
      stateTimeline: [{ t: 0, state: 1, targetTime: 100 }]
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes(String(MOMENT_REACTION_MAX_DURATION_SECONDS)))).toBe(
      true
    );
  });

  it('accepts when original playback range covers the moment time', () => {
    const result = validateMomentReaction({
      momentOriginalTimeSeconds: 50,
      offsetStartTime: 10,
      reactionFinishTime: 40,
      timeOffset: 0,
      stateTimeline: [
        { t: 0, state: 1, targetTime: 40 },
        { t: 10, state: 1, targetTime: 40 }
      ],
      playbackRateTimeline: [{ t: 0, rate: 1 }]
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects when original playback never reaches the moment time', () => {
    const result = validateMomentReaction({
      momentOriginalTimeSeconds: 200,
      offsetStartTime: 0,
      reactionFinishTime: 30,
      timeOffset: 0,
      stateTimeline: [{ t: 0, state: 1, targetTime: 10 }]
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('reach the moment timing'))).toBe(true);
  });

  it('maps reaction time to original time using sync configs', () => {
    const originalAt20 = getOriginalTimeAtReactionTime(20, {
      timeOffset: 5,
      stateTimeline: [{ t: 0, state: 1, targetTime: 100 }],
      playbackRateTimeline: [{ t: 0, rate: 1 }]
    });

    expect(originalAt20).toBeCloseTo(115, 1);
  });
});
