// The zoomed timeline keeps a fixed window and slides it across the full
// seek range. A deep zoom can be thinner than a grabbable thumb, so the
// visual thumb has a minimum width while both ends of the range stay reachable.

const MIN_SPAN_SECONDS = 0.001;

export function panZoomWindow({
  rangeMin,
  rangeMax,
  span,
  nextStart,
}: {
  rangeMin: number;
  rangeMax: number;
  span: number;
  nextStart: number;
}): { start: number; end: number } {
  const safeSpan = Math.max(
    MIN_SPAN_SECONDS,
    Number.isFinite(span) ? span : MIN_SPAN_SECONDS,
  );
  const min = Number.isFinite(rangeMin) ? rangeMin : 0;
  const max = Number.isFinite(rangeMax) ? rangeMax : min;
  const orderedMin = Math.min(min, max);
  const orderedMax = Math.max(min, max);
  const maxStart = Math.max(orderedMin, orderedMax - safeSpan);
  const requested = Number.isFinite(nextStart) ? nextStart : orderedMin;
  const start = Math.min(Math.max(requested, orderedMin), maxStart);
  return { start, end: start + safeSpan };
}

export function scrollThumbGeometry({
  rangeMin,
  rangeMax,
  viewportStart,
  viewportEnd,
  minThumbRatio = 0.08,
}: {
  rangeMin: number;
  rangeMax: number;
  viewportStart: number;
  viewportEnd: number;
  minThumbRatio?: number;
}): { left: number; width: number } {
  const range = Math.max(0, rangeMax - rangeMin);
  if (range <= MIN_SPAN_SECONDS) {
    return { left: 0, width: 1 };
  }
  const span = Math.max(MIN_SPAN_SECONDS, viewportEnd - viewportStart);
  const logicalWidth = Math.min(1, span / range);
  const width = Math.min(1, Math.max(minThumbRatio, logicalWidth));
  const maxStart = Math.max(MIN_SPAN_SECONDS, range - span);
  const startOffset = Math.min(
    Math.max(viewportStart - rangeMin, 0),
    range - span > 0 ? range - span : 0,
  );
  const progress = span >= range - 0.0005 ? 0 : startOffset / maxStart;
  const travel = Math.max(0, 1 - width);
  return { left: travel * progress, width };
}

export function scrollProgressFromPointer({
  pointerRatio,
  thumbWidth,
  grabRatio,
}: {
  pointerRatio: number;
  thumbWidth: number;
  grabRatio: number;
}): number {
  const width = Math.min(Math.max(thumbWidth, 0), 1);
  const travel = 1 - width;
  if (travel <= 0.000001) return 0;
  const grab = Math.min(Math.max(grabRatio, 0), 1);
  const pointer = Math.min(Math.max(pointerRatio, 0), 1);
  const left = Math.min(Math.max(pointer - grab * width, 0), travel);
  return left / travel;
}
