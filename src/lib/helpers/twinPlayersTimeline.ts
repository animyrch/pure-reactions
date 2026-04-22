export const roundReactionTime = (value: number) => Math.round(value * 10) / 10;
export const roundTargetTime = (value: number) => Math.round(value * 100) / 100;

export const roundVolume = (value: number) => Math.round(Math.min(Math.max(value, 0), 100));
export const roundPlaybackRate = (value: number) => Math.round(value * 100) / 100;

export const buildPlayerEventTimeline = (timeline: any[] = []) =>
  timeline
    .map((event: any, index: number) => ({
      id: `player-array-${index}-${Number(event?.t ?? index)}`,
      type: 'player',
      timeInReaction: Number(event?.t) || 0,
      state: Number(event?.state) || 0,
      targetTime: Number(event?.targetTime ?? 0)
    }))
    .sort(
      (
        a: { timeInReaction: number },
        b: { timeInReaction: number }
      ) => a.timeInReaction - b.timeInReaction
    );

export const timelineArrayToMap = (timeline: any[] = []) => {
  const map = new Map<string, { t: number; state: number; targetTime: number }>();
  for (const entry of timeline) {
    if (!entry) continue;
    const rawReactionTime = Number(entry?.t);
    if (!Number.isFinite(rawReactionTime)) continue;
    const roundedReactionTime = roundReactionTime(Math.max(0, rawReactionTime));
    const rawStateValue = Number(entry?.state);
    const sanitizedState = Number.isFinite(rawStateValue) ? rawStateValue : 2;
    const rawTarget = Number(entry?.targetTime ?? entry?.time);
    const sanitizedTarget = Number.isFinite(rawTarget) ? Math.max(0, rawTarget) : 0;
    const roundedTarget = roundTargetTime(sanitizedTarget);
    map.set(roundedReactionTime.toFixed(3), {
      t: roundedReactionTime,
      state: sanitizedState,
      targetTime: roundedTarget
    });
  }
  return map;
};

export const volumeTimelineArrayToMap = (timeline: any[] = []) => {
  const map = new Map<string, { t: number; volume: number }>();
  for (const entry of timeline) {
    if (!entry) continue;
    const rawReactionTime = Number(entry?.t);
    if (!Number.isFinite(rawReactionTime)) continue;
    const roundedReactionTime = roundReactionTime(Math.max(0, rawReactionTime));
    const rawVolumeValue = Number(entry?.volume ?? entry?.value);
    const sanitizedVolume = Number.isFinite(rawVolumeValue) ? roundVolume(rawVolumeValue) : 100;
    map.set(roundedReactionTime.toFixed(3), {
      t: roundedReactionTime,
      volume: sanitizedVolume
    });
  }
  return map;
};

export const playbackTimelineArrayToMap = (timeline: any[] = []) => {
  const map = new Map<string, { t: number; rate: number }>();
  for (const entry of timeline) {
    if (!entry) continue;
    const rawReactionTime = Number(entry?.t);
    if (!Number.isFinite(rawReactionTime)) continue;
    const roundedReactionTime = roundReactionTime(Math.max(0, rawReactionTime));
    const rawRateValue = Number(entry?.rate ?? entry?.value);
    const sanitizedRate =
      Number.isFinite(rawRateValue) && rawRateValue > 0 ? roundPlaybackRate(rawRateValue) : 1;
    map.set(roundedReactionTime.toFixed(3), {
      t: roundedReactionTime,
      rate: sanitizedRate
    });
  }
  return map;
};

export type OverlayPrimaryVideo = 'original' | 'reaction';

const normalizeOverlayPrimary = (
  value: unknown,
  fallback: OverlayPrimaryVideo = 'original'
): OverlayPrimaryVideo => (value === 'reaction' ? 'reaction' : fallback);

export const overlayVisibilityTimelineArrayToMap = (
  timeline: any[] = [],
  defaultPrimary: OverlayPrimaryVideo = 'original'
) => {
  const map = new Map<string, { t: number; visible: boolean; primary: OverlayPrimaryVideo }>();
  const sortedTimeline = [...timeline]
    .filter((entry) => entry && Number.isFinite(Number(entry?.t)))
    .sort((a, b) => Number(a.t) - Number(b.t));

  let lastPrimary: OverlayPrimaryVideo = normalizeOverlayPrimary(defaultPrimary, 'original');
  for (const entry of sortedTimeline) {
    const roundedReactionTime = roundReactionTime(Math.max(0, Number(entry.t)));
    const visible = entry?.visible !== false;
    const primary = normalizeOverlayPrimary(entry?.primary, lastPrimary);
    lastPrimary = primary;
    map.set(roundedReactionTime.toFixed(3), {
      t: roundedReactionTime,
      visible,
      primary
    });
  }
  return map;
};
