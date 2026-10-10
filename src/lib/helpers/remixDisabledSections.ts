// Remix fine-tune only. A pause cue finishes the remix, so the timeline after
// it is closed. A play cue skips, so the open span between its time and its
// target is closed. The cue that creates a span stays on the boundary and can
// still be edited.

const EDGE_EPSILON_SECONDS = 0.001;
const MIN_SKIP_SPAN_SECONDS = 0.05;

export type RemixDisabledReason = "pause" | "skip";

export type RemixDisabledCue = {
  time: number;
  state: number;
  targetTime?: number | null;
};

export type RemixDisabledSection = {
  start: number;
  end: number;
  reason: RemixDisabledReason;
};

export type MergedRemixDisabledSection = {
  start: number;
  end: number;
  reasons: RemixDisabledReason[];
};

const finite = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const containsTime = (section: RemixDisabledSection, time: number) => {
  if (section.reason === "pause") {
    return time > section.start + EDGE_EPSILON_SECONDS && time <= section.end + EDGE_EPSILON_SECONDS;
  }
  return (
    time > section.start + EDGE_EPSILON_SECONDS &&
    time < section.end - EDGE_EPSILON_SECONDS
  );
};

export function buildRemixDisabledSections(
  cues: RemixDisabledCue[],
  duration: number,
): RemixDisabledSection[] {
  const timelineEnd = finite(duration);
  if (timelineEnd === null || timelineEnd <= 0 || !Array.isArray(cues)) {
    return [];
  }

  const sections: RemixDisabledSection[] = [];
  for (const cue of cues) {
    const time = finite(cue?.time);
    const state = finite(cue?.state);
    if (time === null || state === null) continue;
    const boundedTime = Math.min(Math.max(time, 0), timelineEnd);

    if (state === 2) {
      if (timelineEnd - boundedTime > EDGE_EPSILON_SECONDS) {
        sections.push({
          start: boundedTime,
          end: timelineEnd,
          reason: "pause",
        });
      }
      continue;
    }

    if (state !== 1) continue;
    const target = finite(cue?.targetTime) ?? boundedTime;
    const start = Math.min(Math.max(Math.min(boundedTime, target), 0), timelineEnd);
    const end = Math.min(Math.max(Math.max(boundedTime, target), 0), timelineEnd);
    if (end - start > MIN_SKIP_SPAN_SECONDS) {
      sections.push({ start, end, reason: "skip" });
    }
  }

  return sections;
}

export function isTimeInRemixDisabledSection(
  time: number,
  sections: RemixDisabledSection[],
): boolean {
  const numericTime = finite(time);
  if (numericTime === null || !Array.isArray(sections)) return false;
  return sections.some((section) => containsTime(section, numericTime));
}

// A new cue is refused inside a disabled span. An existing cue may keep its
// time (so its volume or target can still be edited) and may move out.
export function canPlaceRemixCue(
  time: number,
  sections: RemixDisabledSection[],
  previousTime?: number | null,
): boolean {
  if (!isTimeInRemixDisabledSection(time, sections)) return true;
  const previous = finite(previousTime);
  return previous !== null && Math.abs(time - previous) <= EDGE_EPSILON_SECONDS;
}

export function mergeRemixDisabledSections(
  sections: RemixDisabledSection[],
): MergedRemixDisabledSection[] {
  if (!Array.isArray(sections) || sections.length === 0) return [];
  const sorted = [...sections].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MergedRemixDisabledSection[] = [];
  for (const section of sorted) {
    const last = merged[merged.length - 1];
    // Touching spans stay separate so a skip and the remix-ended tail keep
    // their own labels. Only a real overlap becomes one band.
    if (!last || section.start >= last.end - EDGE_EPSILON_SECONDS) {
      merged.push({
        start: section.start,
        end: section.end,
        reasons: [section.reason],
      });
      continue;
    }
    last.end = Math.max(last.end, section.end);
    if (!last.reasons.includes(section.reason)) {
      last.reasons.push(section.reason);
    }
  }
  return merged;
}

export function remixDisabledSectionLabel(reasons: RemixDisabledReason[]): string {
  const hasPause = reasons.includes("pause");
  const hasSkip = reasons.includes("skip");
  if (hasPause && hasSkip) return "Unavailable";
  if (hasPause) return "Remix ended";
  return "Skipped";
}

export function remixDisabledLabelAt(
  time: number,
  sections: RemixDisabledSection[],
): string | null {
  if (!Array.isArray(sections)) return null;
  const numericTime = finite(time);
  if (numericTime === null) return null;
  const reasons: RemixDisabledReason[] = [];
  for (const section of sections) {
    if (!containsTime(section, numericTime)) continue;
    if (!reasons.includes(section.reason)) reasons.push(section.reason);
  }
  if (!reasons.length) return null;
  return remixDisabledSectionLabel(reasons);
}
