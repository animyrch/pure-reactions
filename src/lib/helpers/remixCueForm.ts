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
