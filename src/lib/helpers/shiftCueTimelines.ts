import {
  roundPlaybackRate,
  roundReactionTime,
  roundTargetTime,
  roundVolume,
  type OverlayPrimaryVideo
} from '$lib/helpers/twinPlayersTimeline';

type StateCue = { t: number; state: number; targetTime: number };
type VolumeCue = { t: number; volume: number };
type RateCue = { t: number; rate: number };
type OverlayCue = { t: number; visible: boolean; primary: OverlayPrimaryVideo };

export type CueTimelines = {
  stateTimeline: StateCue[];
  volumeTimeline: VolumeCue[];
  reactionVolumeTimeline: VolumeCue[];
  playbackRateTimeline: RateCue[];
  overlayVisibilityTimeline: OverlayCue[];
};

const asArray = (timeline: unknown): any[] => (Array.isArray(timeline) ? timeline : []);

const shiftTimes = <T extends { t: number }>(
  timeline: unknown,
  delta: number,
  project: (entry: any, nextTime: number) => T | null
): T[] => {
  const ordered = asArray(timeline)
    .map((entry, index) => ({ entry, index, time: Number(entry?.t) }))
    .filter((row) => Number.isFinite(row.time))
    .sort((a, b) => a.time - b.time || a.index - b.index);

  const byTime = new Map<string, T>();
  for (const row of ordered) {
    const nextTime = roundReactionTime(row.time + delta);
    const next = project(row.entry, nextTime);
    if (!next) continue;
    byTime.set(nextTime.toFixed(3), next);
  }

  return Array.from(byTime.values()).sort((a, b) => a.t - b.t);
};

const shiftState = (timeline: unknown, delta: number): StateCue[] =>
  shiftTimes(timeline, delta, (entry, nextTime) => {
    const state = Number(entry?.state);
    const target = Number(entry?.targetTime ?? entry?.time);
    return {
      t: nextTime,
      state: Number.isFinite(state) ? state : 2,
      targetTime: roundTargetTime(Number.isFinite(target) ? Math.max(0, target) : 0)
    };
  });

const shiftVolume = (timeline: unknown, delta: number): VolumeCue[] =>
  shiftTimes(timeline, delta, (entry, nextTime) => {
    const volume = Number(entry?.volume ?? entry?.value);
    return {
      t: nextTime,
      volume: roundVolume(Number.isFinite(volume) ? volume : 100)
    };
  });

const shiftRate = (timeline: unknown, delta: number): RateCue[] =>
  shiftTimes(timeline, delta, (entry, nextTime) => {
    const rate = Number(entry?.rate ?? entry?.value);
    return {
      t: nextTime,
      rate: Number.isFinite(rate) && rate > 0 ? roundPlaybackRate(rate) : 1
    };
  });

const shiftOverlay = (timeline: unknown, delta: number): OverlayCue[] => {
  let lastPrimary: OverlayPrimaryVideo = 'original';
  return shiftTimes(timeline, delta, (entry, nextTime) => {
    const primary: OverlayPrimaryVideo = entry?.primary === 'reaction'
      ? 'reaction'
      : entry?.primary === 'original'
        ? 'original'
        : lastPrimary;
    lastPrimary = primary;
    return {
      t: nextTime,
      visible: entry?.visible !== false,
      primary
    };
  });
};

/**
 * Move every cue along the reaction clock by `delta` seconds.
 * Cues that land before 0 stay stored at that negative time so a later
 * positive lead-in can bring them back. Playback ignores those times.
 * When two cues round onto the same tenth of a second, the later one wins.
 * A delta of 0 returns the timelines unchanged.
 */
export const shiftCueTimelinesByLeadIn = (
  timelines: Partial<CueTimelines> | null | undefined,
  delta: number
): CueTimelines => {
  const source = timelines ?? {};
  if (!Number.isFinite(delta) || delta === 0) {
    return {
      stateTimeline: asArray(source.stateTimeline),
      volumeTimeline: asArray(source.volumeTimeline),
      reactionVolumeTimeline: asArray(source.reactionVolumeTimeline),
      playbackRateTimeline: asArray(source.playbackRateTimeline),
      overlayVisibilityTimeline: asArray(source.overlayVisibilityTimeline)
    };
  }

  return {
    stateTimeline: shiftState(source.stateTimeline, delta),
    volumeTimeline: shiftVolume(source.volumeTimeline, delta),
    reactionVolumeTimeline: shiftVolume(source.reactionVolumeTimeline, delta),
    playbackRateTimeline: shiftRate(source.playbackRateTimeline, delta),
    overlayVisibilityTimeline: shiftOverlay(source.overlayVisibilityTimeline, delta)
  };
};
