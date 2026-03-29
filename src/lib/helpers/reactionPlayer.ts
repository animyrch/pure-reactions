export const FULLSCREEN_BODY_CLASS = 'reaction-fullscreen';

type TimelineEvent = Record<string, number | string>;

type ReactionDocument = Record<string, unknown>;

export function readAutoPlayCookie(): boolean {
  if (typeof document === 'undefined') {
    return true;
  }
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('autoPlay='))
    ?.split('=')[1];
  if (match === undefined) {
    return true;
  }
  return match === 'true';
}

export function writeAutoPlayCookie(value: boolean, playlistId?: string | null): void {
  if (!playlistId || typeof document === 'undefined') {
    return;
  }
  const expiry = new Date();
  expiry.setTime(expiry.getTime() + 365 * 24 * 60 * 60 * 1000);
  document.cookie = `autoPlay=${value}; expires=${expiry.toUTCString()}; path=/`;
}

export function readCinematicBarsCookie(): boolean {
  if (typeof document === 'undefined') {
    return true;
  }
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('cinematicBars='))
    ?.split('=')[1];
  
  if (match === undefined) return true;
  return match === 'true';
}

export function writeCinematicBarsCookie(value: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }
  const expiry = new Date();
  expiry.setTime(expiry.getTime() + 365 * 24 * 60 * 60 * 1000);
  document.cookie = `cinematicBars=${value}; expires=${expiry.toUTCString()}; path=/`;
}

export function toggleFullscreenBodyClass(isFullscreen: boolean, className = FULLSCREEN_BODY_CLASS): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.body.classList.toggle(className, Boolean(isFullscreen));
}

function mapTimelineEntries(entries: [string, unknown][], mapper: (value: unknown) => TimelineEvent): TimelineEvent[] {
  return entries
    .map(([key, value]) => ({
      t: Number(key),
      ...mapper(value)
    }))
    .sort((a, b) => (Number(a.t) - Number(b.t)));
}

export function deriveTimelines(obtainedData: ReactionDocument) {
  const rawStateTimeline = obtainedData?.['stateTimeline'];
  const rawVolumeTimeline = obtainedData?.['volumeTimeline'];
  const rawReactionVolumeTimeline = obtainedData?.['reactionVolumeTimeline'];
  const rawPlaybackTimeline = obtainedData?.['playbackTimeline'];
  const rawOverlayVisibilityTimeline = obtainedData?.['overlayVisibilityTimeline'];
  const rawReactionTransportTrack = obtainedData?.['reactionTransportTrack'];

  const reactionConfigs = obtainedData?.['reactionConfigs'];
  const volumeConfigsRaw = obtainedData?.['volumeConfigs'];
  const reactionVolumeConfigsRaw = obtainedData?.['reactionVolumeConfigs'];
  const playbackRateConfigsRaw = obtainedData?.['playbackRateConfigs'];

  const playerConfigs = (!reactionConfigs && Array.isArray(rawStateTimeline))
    ? Object.fromEntries(
        (rawStateTimeline as TimelineEvent[]).map((event) => [
          Number(event?.['t']).toFixed(1),
          {
            time: Number(event?.['targetTime']).toFixed(2),
            state: event?.['state']
          }
        ])
      )
    : (reactionConfigs as Record<string, unknown> | undefined) ?? {};

  const volumeConfigs = (!volumeConfigsRaw && Array.isArray(rawVolumeTimeline))
    ? Object.fromEntries(
        (rawVolumeTimeline as TimelineEvent[]).map((event) => [
          Number(event?.['t']).toFixed(1),
          {
            volume: event?.['volume']
          }
        ])
      )
    : (volumeConfigsRaw as Record<string, unknown> | undefined) ?? {};

  const reactionVolumeConfigs = (!reactionVolumeConfigsRaw && Array.isArray(rawReactionVolumeTimeline))
    ? Object.fromEntries(
        (rawReactionVolumeTimeline as TimelineEvent[]).map((event) => [
          Number(event?.['t']).toFixed(1),
          {
            volume: event?.['volume']
          }
        ])
      )
    : (reactionVolumeConfigsRaw as Record<string, unknown> | undefined) ?? {};

  const playbackRateConfigs = (!playbackRateConfigsRaw && Array.isArray(rawPlaybackTimeline))
    ? Object.fromEntries(
        (rawPlaybackTimeline as TimelineEvent[]).map((event) => [
          Number(event?.['t']).toFixed(1),
          {
            rate: event?.['rate']
          }
        ])
      )
    : (playbackRateConfigsRaw as Record<string, unknown> | undefined) ?? {};

  const stateTimeline = Array.isArray(rawStateTimeline) && rawStateTimeline.length
    ? rawStateTimeline
    : mapTimelineEntries(
        Object.entries(playerConfigs),
        (value) => ({
          state: Number((value as Record<string, unknown>)?.['state'] ?? -1),
          targetTime: Number((value as Record<string, unknown>)?.['time'] ?? 0)
        })
      );

  const volumeTimeline = Array.isArray(rawVolumeTimeline) && rawVolumeTimeline.length
    ? rawVolumeTimeline
    : mapTimelineEntries(
        Object.entries(volumeConfigs),
        (value) => ({
          volume: Number((value as Record<string, unknown>)?.['volume'] ?? 100)
        })
      );

  const reactionVolumeTimeline = Array.isArray(rawReactionVolumeTimeline) && rawReactionVolumeTimeline.length
    ? rawReactionVolumeTimeline
    : mapTimelineEntries(
        Object.entries(reactionVolumeConfigs),
        (value) => ({
          volume: Number((value as Record<string, unknown>)?.['volume'] ?? 100)
        })
      );

  const playbackRateTimeline = Array.isArray(rawPlaybackTimeline) && rawPlaybackTimeline.length
    ? rawPlaybackTimeline
    : mapTimelineEntries(
        Object.entries(playbackRateConfigs),
        (value) => ({
          rate: Number((value as Record<string, unknown>)?.['rate'] ?? 1)
        })
      );

  const overlayVisibilityTimeline = Array.isArray(rawOverlayVisibilityTimeline) && rawOverlayVisibilityTimeline.length
    ? rawOverlayVisibilityTimeline
    : [];

  // Migration: if no reactionTransportTrack exists, default to playing from the start.
  const reactionTransportTrack = Array.isArray(rawReactionTransportTrack) && rawReactionTransportTrack.length
    ? rawReactionTransportTrack
    : [{ t: 0, state: 1 }];

  return {
    playerConfigs,
    volumeConfigs,
    reactionVolumeConfigs,
    playbackRateConfigs,
    stateTimeline,
    volumeTimeline,
    reactionVolumeTimeline,
    playbackRateTimeline,
    overlayVisibilityTimeline,
    reactionTransportTrack
  };
}

export type DerivedTimelines = ReturnType<typeof deriveTimelines>;
