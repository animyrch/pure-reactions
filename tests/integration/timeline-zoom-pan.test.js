import { describe, expect, it } from 'vitest';
import {
  panZoomWindow,
  scrollProgressFromPointer,
  scrollThumbGeometry,
} from '../../src/lib/helpers/timelineZoomPan.ts';

describe('timeline zoom pan', () => {
  it('slides the window and keeps the zoom span', () => {
    expect(panZoomWindow({
      rangeMin: 0,
      rangeMax: 400,
      span: 120,
      nextStart: 80,
    })).toEqual({ start: 80, end: 200 });
  });

  it('stops the window at both ends of the full timeline', () => {
    expect(panZoomWindow({
      rangeMin: 30,
      rangeMax: 180,
      span: 40,
      nextStart: 0,
    })).toEqual({ start: 30, end: 70 });
    expect(panZoomWindow({
      rangeMin: 30,
      rangeMax: 180,
      span: 40,
      nextStart: 500,
    })).toEqual({ start: 140, end: 180 });
  });

  it('maps the thumb across the track, including a deep zoom', () => {
    expect(scrollThumbGeometry({
      rangeMin: 0,
      rangeMax: 100,
      viewportStart: 0,
      viewportEnd: 25,
    })).toEqual({ left: 0, width: 0.25 });

    const mid = scrollThumbGeometry({
      rangeMin: 0,
      rangeMax: 100,
      viewportStart: 25,
      viewportEnd: 50,
    });
    expect(mid.width).toBeCloseTo(0.25);
    expect(mid.left).toBeCloseTo(0.25);

    const deepStart = scrollThumbGeometry({
      rangeMin: 0,
      rangeMax: 400,
      viewportStart: 0,
      viewportEnd: 4,
    });
    expect(deepStart.width).toBeCloseTo(0.08);
    expect(deepStart.left).toBeCloseTo(0);

    const deepEnd = scrollThumbGeometry({
      rangeMin: 0,
      rangeMax: 400,
      viewportStart: 396,
      viewportEnd: 400,
    });
    expect(deepEnd.width).toBeCloseTo(0.08);
    expect(deepEnd.left).toBeCloseTo(0.92);
  });

  it('turns a thumb drag into a position along the remaining track', () => {
    expect(scrollProgressFromPointer({
      pointerRatio: 0.2,
      thumbWidth: 0.2,
      grabRatio: 0.5,
    })).toBeCloseTo(0.125);

    expect(scrollProgressFromPointer({
      pointerRatio: 1,
      thumbWidth: 0.2,
      grabRatio: 0,
    })).toBeCloseTo(1);

    expect(scrollProgressFromPointer({
      pointerRatio: 0,
      thumbWidth: 0.2,
      grabRatio: 1,
    })).toBeCloseTo(0);
  });
});
