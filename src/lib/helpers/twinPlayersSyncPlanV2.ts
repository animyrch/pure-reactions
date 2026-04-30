export type SyncPlanEventKind =
  | 'state'
  | 'original-volume'
  | 'reaction-volume'
  | 'playback-rate'
  | 'overlay-visibility';

export type SyncPlanEvent = {
  id: string;
  kind: SyncPlanEventKind;
  tMs: number;
};

export type SyncPlanStateEvent = SyncPlanEvent & {
  kind: 'state';
  state: number;
  targetTimeMs: number;
};

export type SyncPlanNumberEvent = SyncPlanEvent & {
  kind: 'original-volume' | 'reaction-volume' | 'playback-rate';
  value: number;
};

export type SyncPlanOverlayEvent = SyncPlanEvent & {
  kind: 'overlay-visibility';
  visible: boolean;
};

export type SyncPlanSegment = {
  id: string;
  startMs: number;
  endMs: number | null;
  state: number;
  targetTimeMs: number;
};

export type SyncPlan = {
  offsetStartMs: number;
  reactionFinishMs: number | null;
  timeOffsetMs: number;
  globalGain: number;
  stateEvents: SyncPlanStateEvent[];
  stateSegments: SyncPlanSegment[];
  originalVolumeEvents: SyncPlanNumberEvent[];
  reactionVolumeEvents: SyncPlanNumberEvent[];
  playbackRateEvents: SyncPlanNumberEvent[];
  overlayVisibilityEvents: SyncPlanOverlayEvent[];
};

export type CompileSyncPlanInput = {
  offsetStartTime?: number;
  reactionFinishTime?: number;
  timeOffset?: number;
  globalGain?: number;
  playerConfigs?: Record<string, any> | any[];
  volumeConfigs?: Record<string, any> | any[];
  reactionVolumeConfigs?: Record<string, any> | any[];
  playbackRateConfigs?: Record<string, any> | any[];
  stateTimeline?: any[];
  volumeTimeline?: any[];
  reactionVolumeTimeline?: any[];
  playbackRateTimeline?: any[];
  overlayVisibilityTimeline?: any[];
};

export type DesiredTwinPlayersState = {
  experienceTimeMs: number;
  activeStateConfigId: string;
  originalState: number;
  originalTargetTimeMs: number;
  originalVolume: number;
  reactionVolume: number;
  playbackRate: number;
  fullscreenOverlayVisible: boolean;
  nextBoundaryMs: number | null;
};

const DEFAULT_STATE = -1;
const DEFAULT_VOLUME = 100;
const DEFAULT_PLAYBACK_RATE = 1;
const DEFAULT_OVERLAY_VISIBLE = true;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const secondsToMs = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.round(numeric * 1000);
};

const msToSeconds = (value: number): number => value / 1000;

const sortedByTime = <T extends { tMs: number }>(events: T[]): T[] =>
  [...events].sort((a, b) => a.tMs - b.tMs || a.id.localeCompare(b.id));

const lastAtOrBefore = <T extends { tMs: number }>(events: T[], timeMs: number): T | null => {
  let low = 0;
  let high = events.length - 1;
  let index = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (events[mid].tMs <= timeMs) {
      index = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return index >= 0 ? events[index] : null;
};

const firstAfter = <T extends { tMs: number }>(events: T[], timeMs: number): T | null => {
  let low = 0;
  let high = events.length;

  while (low < high) {
    const mid = (low + high) >> 1;
    if (events[mid].tMs <= timeMs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return events[low] ?? null;
};

const normalizeReactionTimeMs = (effectiveSeconds: unknown, timeOffsetMs: number): number =>
  secondsToMs(effectiveSeconds) + timeOffsetMs;

const entriesFromConfigMap = (configs: Record<string, any> | any[] | undefined): [string, any][] => {
  if (!configs || Array.isArray(configs) || typeof configs !== 'object') {
    return [];
  }
  return Object.entries(configs);
};

const compileStateEvents = ({
  timeline,
  configs,
  timeOffsetMs
}: {
  timeline?: any[];
  configs?: Record<string, any> | any[];
  timeOffsetMs: number;
}): SyncPlanStateEvent[] => {
  const rawTimeline = Array.isArray(timeline) && timeline.length
    ? timeline.map((event, index) => ({
        id: `state-array-${index}-${Number(event?.t ?? 0)}`,
        tMs: normalizeReactionTimeMs(event?.t, timeOffsetMs),
        state: Number.isFinite(Number(event?.state)) ? Number(event.state) : DEFAULT_STATE,
        targetTimeMs: secondsToMs(event?.targetTime ?? event?.time)
      }))
    : entriesFromConfigMap(configs).map(([key, value]) => ({
        id: `state-map-${key}`,
        tMs: normalizeReactionTimeMs(key, timeOffsetMs),
        state: Number.isFinite(Number(value?.state)) ? Number(value.state) : DEFAULT_STATE,
        targetTimeMs: secondsToMs(value?.time ?? value?.targetTime)
      }));

  return sortedByTime(
    rawTimeline.filter((event) => Number.isFinite(event.tMs) && event.tMs >= 0)
  ).map((event) => ({
    ...event,
    kind: 'state' as const
  }));
};

const compileNumberEvents = ({
  kind,
  timeline,
  configs,
  valueKey,
  defaultValue,
  timeOffsetMs
}: {
  kind: SyncPlanNumberEvent['kind'];
  timeline?: any[];
  configs?: Record<string, any> | any[];
  valueKey: 'volume' | 'rate';
  defaultValue: number;
  timeOffsetMs: number;
}): SyncPlanNumberEvent[] => {
  const rawTimeline = Array.isArray(timeline) && timeline.length
    ? timeline.map((event, index) => ({
        id: `${kind}-array-${index}-${Number(event?.t ?? 0)}`,
        tMs: normalizeReactionTimeMs(event?.t, timeOffsetMs),
        value: Number.isFinite(Number(event?.[valueKey])) ? Number(event[valueKey]) : defaultValue
      }))
    : entriesFromConfigMap(configs).map(([key, value]) => ({
        id: `${kind}-map-${key}`,
        tMs: normalizeReactionTimeMs(key, timeOffsetMs),
        value: Number.isFinite(Number(value?.[valueKey])) ? Number(value[valueKey]) : defaultValue
      }));

  return sortedByTime(
    rawTimeline.filter((event) => Number.isFinite(event.tMs) && event.tMs >= 0)
  ).map((event) => ({
    ...event,
    kind
  }));
};

const compileOverlayEvents = ({
  timeline,
  timeOffsetMs
}: {
  timeline?: any[];
  timeOffsetMs: number;
}): SyncPlanOverlayEvent[] =>
  sortedByTime(
    (Array.isArray(timeline) ? timeline : [])
      .map((event, index) => ({
        id: `overlay-array-${index}-${Number(event?.t ?? 0)}`,
        kind: 'overlay-visibility' as const,
        tMs: normalizeReactionTimeMs(event?.t, timeOffsetMs),
        visible: event?.visible !== false
      }))
      .filter((event) => Number.isFinite(event.tMs) && event.tMs >= 0)
  );

const buildStateSegments = (
  stateEvents: SyncPlanStateEvent[],
  reactionFinishMs: number | null
): SyncPlanSegment[] =>
  stateEvents.map((event, index) => ({
    id: event.id,
    startMs: event.tMs,
    endMs: stateEvents[index + 1]?.tMs ?? reactionFinishMs,
    state: event.state,
    targetTimeMs: event.targetTimeMs
  }));

export function compileSyncPlan(input: CompileSyncPlanInput): SyncPlan {
  const timeOffsetMs = secondsToMs(input.timeOffset ?? 0);
  const offsetStartMs = secondsToMs(input.offsetStartTime ?? 0);
  const rawReactionFinishMs = secondsToMs(input.reactionFinishTime);
  const reactionFinishMs = rawReactionFinishMs > 0 ? rawReactionFinishMs : null;
  const globalGain = Number.isFinite(Number(input.globalGain)) ? Number(input.globalGain) : 1;

  const stateEvents = compileStateEvents({
    timeline: input.stateTimeline,
    configs: input.playerConfigs,
    timeOffsetMs
  });

  return {
    offsetStartMs,
    reactionFinishMs,
    timeOffsetMs,
    globalGain,
    stateEvents,
    stateSegments: buildStateSegments(stateEvents, reactionFinishMs),
    originalVolumeEvents: compileNumberEvents({
      kind: 'original-volume',
      timeline: input.volumeTimeline,
      configs: input.volumeConfigs,
      valueKey: 'volume',
      defaultValue: DEFAULT_VOLUME,
      timeOffsetMs
    }),
    reactionVolumeEvents: compileNumberEvents({
      kind: 'reaction-volume',
      timeline: input.reactionVolumeTimeline,
      configs: input.reactionVolumeConfigs,
      valueKey: 'volume',
      defaultValue: DEFAULT_VOLUME,
      timeOffsetMs
    }),
    playbackRateEvents: compileNumberEvents({
      kind: 'playback-rate',
      timeline: input.playbackRateTimeline,
      configs: input.playbackRateConfigs,
      valueKey: 'rate',
      defaultValue: DEFAULT_PLAYBACK_RATE,
      timeOffsetMs
    }),
    overlayVisibilityEvents: compileOverlayEvents({
      timeline: input.overlayVisibilityTimeline,
      timeOffsetMs
    })
  };
}

export function getNextSyncPlanBoundaryMs(plan: SyncPlan, experienceTimeMs: number): number | null {
  const nextEvents = [
    firstAfter(plan.stateEvents, experienceTimeMs),
    firstAfter(plan.originalVolumeEvents, experienceTimeMs),
    firstAfter(plan.reactionVolumeEvents, experienceTimeMs),
    firstAfter(plan.playbackRateEvents, experienceTimeMs),
    firstAfter(plan.overlayVisibilityEvents, experienceTimeMs)
  ].filter((event): event is SyncPlanEvent => Boolean(event));

  if (!nextEvents.length) {
    return null;
  }

  const nextMs = Math.min(...nextEvents.map((event) => event.tMs));
  if (plan.reactionFinishMs !== null && nextMs > plan.reactionFinishMs) {
    return null;
  }
  return nextMs;
}

export function computeDesiredTwinPlayersState(
  plan: SyncPlan,
  experienceTimeMs: number
): DesiredTwinPlayersState {
  const stateEvent = lastAtOrBefore(plan.stateEvents, experienceTimeMs);
  const originalVolumeEvent = lastAtOrBefore(plan.originalVolumeEvents, experienceTimeMs);
  const reactionVolumeEvent = lastAtOrBefore(plan.reactionVolumeEvents, experienceTimeMs);
  const playbackRateEvent = lastAtOrBefore(plan.playbackRateEvents, experienceTimeMs);
  const overlayEvent = lastAtOrBefore(plan.overlayVisibilityEvents, experienceTimeMs);

  const originalState = stateEvent?.state ?? DEFAULT_STATE;
  const stateAnchorMs = stateEvent?.tMs ?? experienceTimeMs;
  const baseTargetMs = stateEvent?.targetTimeMs ?? 0;
  const originalTargetTimeMs = originalState === 1
    ? baseTargetMs + Math.max(experienceTimeMs - stateAnchorMs, 0)
    : baseTargetMs;

  return {
    experienceTimeMs,
    activeStateConfigId: stateEvent?.id ?? 'default-state',
    originalState,
    originalTargetTimeMs,
    originalVolume: clamp((originalVolumeEvent?.value ?? DEFAULT_VOLUME) * plan.globalGain, 0, 200),
    reactionVolume: clamp(reactionVolumeEvent?.value ?? DEFAULT_VOLUME, 0, 200),
    playbackRate: playbackRateEvent?.value ?? DEFAULT_PLAYBACK_RATE,
    fullscreenOverlayVisible: overlayEvent?.visible ?? DEFAULT_OVERLAY_VISIBLE,
    nextBoundaryMs: getNextSyncPlanBoundaryMs(plan, experienceTimeMs)
  };
}

export function syncPlanTimeMsToSeconds(value: number): number {
  return msToSeconds(value);
}
