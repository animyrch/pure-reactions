/**
 * originalTransportTimeline — helpers for the unified Original-Video Transport Track.
 *
 * The Transport Track consolidates the existing play-cues (state 1) and pause-cues
 * (state 2) that previously lived inside `stateTimeline` entries — which also carried
 * an unrelated `targetTime` field — into a single, dedicated list for the *original*
 * video.
 *
 * Format:  `[{ t: number, state: number }, ...]`  sorted ascending by `t`.
 *          `state` follows the same numeric YT PlayerState codes used elsewhere:
 *           1 = playing, 2 = paused.
 *
 * Only state 1 and state 2 entries are kept; transient states such as BUFFERING (3),
 * ENDED (0), UNSTARTED (-1) and CUED (5) carry no play/pause intent and are dropped.
 *
 * Backward-compatibility: when a Firestore document does not yet have this field,
 * `buildOriginalTransportTimeline()` derives it from the existing `stateTimeline`.
 * The function is idempotent — re-running it on already-migrated data returns the same
 * result.
 */

export type OriginalTransportEvent = {
  t: number;
  state: number;
};

// ---------------------------------------------------------------------------
// Internal binary search (mirrors the one in reaction.js, kept private here
// to avoid a cross-file dependency on a non-exported symbol).
// ---------------------------------------------------------------------------
function findTransportEventAtOrBefore(
  timeline: OriginalTransportEvent[],
  t: number
): OriginalTransportEvent | null {
  if (!timeline.length) return null;
  let low = 0;
  let high = timeline.length - 1;
  let ansIndex = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (timeline[mid].t <= t) {
      ansIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return ansIndex >= 0 ? timeline[ansIndex] : null;
}

/**
 * Builds an `OriginalTransportEvent[]` from a raw `stateTimeline` (or from an
 * already-migrated transport timeline — idempotent).
 *
 * Rules:
 * - Only entries with numeric state 1 (playing) or 2 (paused) are included.
 * - The `targetTime` field present in `stateTimeline` entries is intentionally
 *   dropped; seeking is handled separately via `playerConfigs`.
 * - The result is sorted ascending by `t`.
 */
export function buildOriginalTransportTimeline(
  stateTimeline: Array<{ t: number; state: number; targetTime?: number } | null | undefined>
): OriginalTransportEvent[] {
  if (!Array.isArray(stateTimeline)) return [];

  const result: OriginalTransportEvent[] = [];

  for (const entry of stateTimeline) {
    if (!entry) continue;
    const t = Number(entry.t);
    if (!Number.isFinite(t)) continue;

    const numericState = Number(entry.state);
    if (numericState === 1 || numericState === 2) {
      result.push({ t, state: numericState });
    }
    // All other states (buffering=3, ended=0, unstarted=-1, cued=5) are dropped.
  }

  return result.sort((a, b) => a.t - b.t);
}

/**
 * Returns the transport state (1 = playing, 2 = paused) of the original video at
 * `reactionTime`, or `null` when no event has been reached yet.
 *
 * @param reactionTime  The current reaction video time (seconds).
 * @param timeline      The `originalTransportTimeline` array (sorted by `t`).
 * @param timeOffset    Optional reaction-time offset applied to all events.
 */
export function getOriginalTransportStateAt(
  reactionTime: number,
  timeline: OriginalTransportEvent[],
  timeOffset = 0
): number | null {
  if (!Array.isArray(timeline) || timeline.length === 0) return null;
  const effectiveTime = Number(reactionTime) - Number(timeOffset || 0);
  const event = findTransportEventAtOrBefore(timeline, effectiveTime);
  return event?.state ?? null;
}
