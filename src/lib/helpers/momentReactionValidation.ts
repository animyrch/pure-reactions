import {
  getCurrentStateFromStateConfigs,
  integratePlaybackRate
} from '$lib/helpers/reaction';
import { deriveTimelines } from '$lib/helpers/reactionPlayer';

/** Maximum allowed reaction subsection length for a moment reaction (seconds). */
export const MOMENT_REACTION_MAX_DURATION_SECONDS = 60;

/** Tolerance when checking whether original playback reached the moment anchor time. */
export const MOMENT_ORIGINAL_TIME_TOLERANCE_SECONDS = 0.75;

const YT_PLAYING_STATE = 1;

export type MomentReactionValidationInput = {
  momentOriginalTimeSeconds: number;
  offsetStartTime?: number;
  reactionFinishTime?: number;
  reactionDurationSeconds?: number;
  timeOffset?: number;
  playerConfigs?: unknown;
  stateTimeline?: unknown;
  playbackRateTimeline?: unknown;
  reactionData?: Record<string, unknown>;
};

export type MomentReactionValidationResult = {
  ok: boolean;
  errors: string[];
  subsectionDurationSeconds: number | null;
  originalTimeRange: { min: number; max: number } | null;
};

export function getOriginalTimeAtReactionTime(
  reactionTime: number,
  {
    stateTimeline,
    playerConfigs,
    timeOffset = 0,
    playbackRateTimeline = []
  }: {
    stateTimeline?: unknown;
    playerConfigs?: unknown;
    timeOffset?: number;
    playbackRateTimeline?: unknown;
  }
): number {
  const timeline = stateTimeline ?? playerConfigs ?? [];
  const config = getCurrentStateFromStateConfigs(reactionTime, timeline, timeOffset);
  const desiredState = Number(config.state);
  const baseTargetTime = Number(config.time ?? 0);
  const anchorTime = Number(config.closestSmallerTimeCode ?? reactionTime);

  let targetTime = Number.isFinite(baseTargetTime) ? baseTargetTime : 0;

  if (
    desiredState === YT_PLAYING_STATE &&
    Number.isFinite(anchorTime) &&
    Number.isFinite(reactionTime)
  ) {
    const timeOffsetAdjustedReactionTime = reactionTime - Number(timeOffset || 0);
    targetTime += integratePlaybackRate(
      anchorTime,
      timeOffsetAdjustedReactionTime,
      Array.isArray(playbackRateTimeline) ? playbackRateTimeline : []
    );
  }

  return targetTime;
}

const collectSubsectionSampleTimes = (
  start: number,
  end: number,
  stateTimeline: unknown
): number[] => {
  const samples = new Set<number>([start, end]);

  if (Array.isArray(stateTimeline)) {
    for (const entry of stateTimeline) {
      const t = Number(entry?.t);
      if (Number.isFinite(t) && t >= start && t <= end) {
        samples.add(t);
      }
    }
  } else if (stateTimeline && typeof stateTimeline === 'object') {
    for (const key of Object.keys(stateTimeline)) {
      const t = Number(key);
      if (Number.isFinite(t) && t >= start && t <= end) {
        samples.add(t);
      }
    }
  }

  const sorted = [...samples].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    samples.add((sorted[i] + sorted[i + 1]) / 2);
  }

  return [...samples];
};

const resolveSubsectionBounds = (input: MomentReactionValidationInput): {
  start: number;
  end: number;
} | null => {
  const start = Number(input.offsetStartTime ?? 0);
  if (!Number.isFinite(start) || start < 0) {
    return null;
  }

  const finish = Number(input.reactionFinishTime);
  const duration = Number(input.reactionDurationSeconds);
  let end = Number.isFinite(finish) && finish > start ? finish : NaN;

  if (!Number.isFinite(end) && Number.isFinite(duration) && duration > start) {
    end = duration;
  }

  if (!Number.isFinite(end) || end <= start) {
    return null;
  }

  return { start, end };
};

export function validateMomentReaction(
  input: MomentReactionValidationInput
): MomentReactionValidationResult {
  const errors: string[] = [];
  const momentTime = Number(input.momentOriginalTimeSeconds);

  if (!Number.isFinite(momentTime) || momentTime < 0) {
    return {
      ok: false,
      errors: ['Moment timing is missing or invalid.'],
      subsectionDurationSeconds: null,
      originalTimeRange: null
    };
  }

  const bounds = resolveSubsectionBounds(input);
  if (!bounds) {
    return {
      ok: false,
      errors: [
        'Set both a start and end time for this moment reaction subsection before publishing.'
      ],
      subsectionDurationSeconds: null,
      originalTimeRange: null
    };
  }

  const { start, end } = bounds;
  const subsectionDurationSeconds = end - start;

  if (subsectionDurationSeconds > MOMENT_REACTION_MAX_DURATION_SECONDS) {
    errors.push(
      `Moment reactions must be ${MOMENT_REACTION_MAX_DURATION_SECONDS} seconds or shorter (currently ${subsectionDurationSeconds.toFixed(1)}s).`
    );
  }

  let stateTimeline = input.stateTimeline;
  let playbackRateTimeline = input.playbackRateTimeline;
  const timeOffset = Number(input.timeOffset ?? 0);

  if (input.reactionData) {
    const derived = deriveTimelines(input.reactionData);
    stateTimeline = stateTimeline ?? derived.stateTimeline;
    playbackRateTimeline = playbackRateTimeline ?? derived.playbackRateTimeline;
  }

  const sampleTimes = collectSubsectionSampleTimes(start, end, stateTimeline);
  const originalTimes = sampleTimes.map((reactionTime) =>
    getOriginalTimeAtReactionTime(reactionTime, {
      stateTimeline,
      playerConfigs: input.playerConfigs,
      timeOffset,
      playbackRateTimeline
    })
  );

  const min = Math.min(...originalTimes);
  const max = Math.max(...originalTimes);
  const originalTimeRange = { min, max };

  const reachedMoment =
    momentTime >= min - MOMENT_ORIGINAL_TIME_TOLERANCE_SECONDS &&
    momentTime <= max + MOMENT_ORIGINAL_TIME_TOLERANCE_SECONDS;

  if (!reachedMoment) {
    errors.push(
      'Synchronization must reach the moment timing at least once during the selected subsection. Adjust start/end times or sync points, then try again.'
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    subsectionDurationSeconds,
    originalTimeRange
  };
}

export function validateMomentReactionFromReactionData(
  reactionData: Record<string, unknown> | null | undefined,
  momentOriginalTimeSeconds: number
): MomentReactionValidationResult {
  if (!reactionData || typeof reactionData !== 'object') {
    return {
      ok: false,
      errors: ['Reaction data is unavailable.'],
      subsectionDurationSeconds: null,
      originalTimeRange: null
    };
  }

  const { stateTimeline, playbackRateTimeline } = deriveTimelines(reactionData);

  return validateMomentReaction({
    momentOriginalTimeSeconds,
    offsetStartTime: Number(reactionData.offsetStartTime ?? 0),
    reactionFinishTime: Number(reactionData.reactionFinishTime),
    reactionDurationSeconds: Number(
      reactionData.duration ??
        reactionData.youtube?.meta?.durationSeconds ??
        reactionData.reactionDuration
    ),
    timeOffset: Number(reactionData.timeOffset ?? 0),
    stateTimeline,
    playbackRateTimeline,
    reactionData
  });
}
