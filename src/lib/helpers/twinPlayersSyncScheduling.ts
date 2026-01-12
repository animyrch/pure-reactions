export type TimelineEntry = { t?: number };

const upperBoundByTime = (timeline: TimelineEntry[], time: number): number => {
  let low = 0;
  let high = timeline.length;

  while (low < high) {
    const mid = (low + high) >> 1;
    const midTime = Number(timeline[mid]?.t);
    if (Number.isFinite(midTime) && midTime <= time) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
};

export function getNextTimelineEventReactionTime(
  timeline: TimelineEntry[] | undefined,
  {
    reactionCurrentTime,
    timeOffset,
    seekMin,
    seekMax
  }: {
    reactionCurrentTime: number;
    timeOffset: number;
    seekMin: number;
    seekMax: number;
  }
): number | null {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return null;
  }

  const effectiveNow = Number(reactionCurrentTime) - Number(timeOffset || 0);
  const idx = upperBoundByTime(timeline, effectiveNow);
  const next = timeline[idx];
  const nextEffective = Number(next?.t);
  if (!Number.isFinite(nextEffective)) {
    return null;
  }

  const nextReactionTime = nextEffective + Number(timeOffset || 0);
  if (!Number.isFinite(nextReactionTime)) {
    return null;
  }

  const min = Number.isFinite(seekMin) ? seekMin : 0;
  const max = Number.isFinite(seekMax) ? seekMax : Number.POSITIVE_INFINITY;
  if (nextReactionTime < min || nextReactionTime > max) {
    return null;
  }

  return nextReactionTime;
}

export function computeNextSyncDelayMs({
  reactionCurrentTime,
  reactionPlayerState,
  ytPlayingState,
  ytBufferingState,
  nextBoundaryReactionTime
}: {
  reactionCurrentTime: number;
  reactionPlayerState: number;
  ytPlayingState: number;
  ytBufferingState: number;
  nextBoundaryReactionTime: number | null;
}): number {
  const isPlaying = reactionPlayerState === ytPlayingState || reactionPlayerState === ytBufferingState;

  // Baseline cadence: far less frequent than the old 300ms interval,
  // but still frequent enough to keep drift under control.
  const baseCadenceMs = isPlaying ? 250 : 1250;

  if (!isPlaying || typeof nextBoundaryReactionTime !== 'number') {
    return baseCadenceMs;
  }

  const secondsUntilBoundary = nextBoundaryReactionTime - reactionCurrentTime;
  if (!Number.isFinite(secondsUntilBoundary) || secondsUntilBoundary <= 0) {
    return 100;
  }

  // Wake shortly before the boundary so the applied action lands on time.
  // Clamp to avoid too-tight loops and too-long gaps.
  const wakeMs = Math.max(80, Math.min(baseCadenceMs, Math.round(secondsUntilBoundary * 1000) - 60));
  return wakeMs;
}
