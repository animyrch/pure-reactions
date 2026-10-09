export const FINE_SKIP_SECONDS = 5;
export const COARSE_SKIP_SECONDS = 15;

type SkipKeyEvent = {
  key: string;
  shiftKey?: boolean;
};

// J and L match the usual video-player skip keys. Shift+Arrow is the larger
// step beside the existing 5-second arrow nudge.
export function playbackSkipDelta(event: SkipKeyEvent): number | null {
  const key = event.key;
  if (key === "j" || key === "J") return -COARSE_SKIP_SECONDS;
  if (key === "l" || key === "L") return COARSE_SKIP_SECONDS;
  if (key === "ArrowLeft") {
    return event.shiftKey ? -COARSE_SKIP_SECONDS : -FINE_SKIP_SECONDS;
  }
  if (key === "ArrowRight") {
    return event.shiftKey ? COARSE_SKIP_SECONDS : FINE_SKIP_SECONDS;
  }
  return null;
}

export function clampPlaybackTime(time: number, min: number, max: number): number {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max >= safeMin ? max : safeMin;
  const normalized = Number(time);
  if (!Number.isFinite(normalized)) return safeMin;
  return Math.min(Math.max(normalized, safeMin), safeMax);
}
