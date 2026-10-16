const EARLIER_EPSILON_SECONDS = 0.0005;

// Original-clock cue form: Skip to is the same moment or later than Original at.
// An earlier Skip to is replaced by Original at.
export function floorSkipToOriginalAt(originalAt: number, skipTo: number): number {
  if (!Number.isFinite(originalAt) || !Number.isFinite(skipTo)) {
    return skipTo;
  }
  if (skipTo + EARLIER_EPSILON_SECONDS < originalAt) {
    return originalAt;
  }
  return skipTo;
}

// Raising Reaction start slides the cue that sat on the previous start.
// In remix that cue is on the original clock, so a leftover skip target
// from the old start (usually 0) cannot stay earlier than the new time.
export function nextPlayTargetAfterStartMove({
  remixMode,
  state,
  cueTime,
  targetTime,
}: {
  remixMode: boolean;
  state: number;
  cueTime: number;
  targetTime: number;
}): number {
  if (!remixMode || Number(state) !== 1) {
    return targetTime;
  }
  return floorSkipToOriginalAt(cueTime, targetTime);
}
