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
  playbackOrigin?: number | null;
  lastAppliedAnchor: number | null;
  isUserPaused: boolean;
};

// Remix playback uses the original video as the clock. A play cue jumps once
// when the playhead is past that cue and the cue is still ahead of the last
// intentional position (play start, or the last seek). A later cue that an
// earlier jump or scrub already landed beyond must not fire. Integrating the
// target every tick would run away, because seeking the original also moves
// the clock.
export function planRemixTransport({
  state,
  anchorTime,
  targetTime,
  currentTime,
  previousTime,
  playbackOrigin,
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
    const origin = Number.isFinite(playbackOrigin)
      ? Number(playbackOrigin)
      : (previous ?? 0);
    const alreadyApplied =
      lastAppliedAnchor !== null && Math.abs(lastAppliedAnchor - anchor) <= 0.001;
    const reached = now !== null && now + 0.05 >= anchor;
    // Cues behind the last seek or scrub were skipped on purpose.
    const stillAheadOfPlacement = anchor + 0.001 >= origin;
    const needsJump = Math.abs(target - anchor) > JUMP_EPSILON_SECONDS;
    const seekTo =
      reached && stillAheadOfPlacement && !alreadyApplied && needsJump
        ? target
        : null;
    const cueResolved = reached && (seekTo !== null || alreadyApplied || !stillAheadOfPlacement || !needsJump);
    return {
      transport: 'play',
      seekTo,
      nextAppliedAnchor: cueResolved ? anchor : lastAppliedAnchor,
    };
  }

  return {
    transport: 'play',
    seekTo: null,
    nextAppliedAnchor: null,
  };
}
