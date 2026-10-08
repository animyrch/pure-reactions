const YT_PLAYING = 1;
const YT_PAUSED = 2;
const JUMP_EPSILON_SECONDS = 0.3;

export type RemixTransportPlan = {
  transport: 'play' | 'pause' | 'hold';
  seekTo: number | null;
  nextAppliedAnchor: number | null;
};

type PlanRemixTransportParams = {
  state: number;
  anchorTime: number;
  targetTime: number;
  currentTime?: number;
  previousTime?: number | null;
  lastAppliedAnchor: number | null;
  isUserPaused: boolean;
};

// Remix playback uses the original video as the clock. A play cue jumps only
// when playback moves across that cue. A clock that is already past the cue,
// including after an earlier jump, must not fire it. Integrating the target
// every tick would run away, because seeking the original also moves the clock.
export function planRemixTransport({
  state,
  anchorTime,
  targetTime,
  currentTime,
  previousTime,
  lastAppliedAnchor,
  isUserPaused,
}: PlanRemixTransportParams): RemixTransportPlan {
  if (isUserPaused) {
    return {
      transport: 'hold',
      seekTo: null,
      nextAppliedAnchor: lastAppliedAnchor,
    };
  }

  if (state === YT_PAUSED) {
    const anchor = Number.isFinite(anchorTime) ? anchorTime : lastAppliedAnchor;
    return {
      transport: 'pause',
      seekTo: null,
      nextAppliedAnchor: anchor,
    };
  }

  if (state === YT_PLAYING) {
    const anchor = Number.isFinite(anchorTime) ? anchorTime : 0;
    const target = Number.isFinite(targetTime) ? targetTime : anchor;
    const now = Number.isFinite(currentTime) ? Number(currentTime) : null;
    const previous = Number.isFinite(previousTime) ? Number(previousTime) : null;
    const playedAcrossCue =
      previous !== null
      && now !== null
      && previous < anchor - 0.001
      && now + 0.05 >= anchor
      && now - anchor <= (now - previous) + 0.35;
    const seekTo =
      playedAcrossCue && Math.abs(target - anchor) > JUMP_EPSILON_SECONDS ? target : null;
    return {
      transport: 'play',
      seekTo,
      nextAppliedAnchor: anchor,
    };
  }

  return {
    transport: 'play',
    seekTo: null,
    nextAppliedAnchor: null,
  };
}
