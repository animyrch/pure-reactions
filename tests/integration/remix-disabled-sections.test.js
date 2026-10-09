import { describe, expect, it } from 'vitest';
import {
  buildRemixDisabledSections,
  canPlaceRemixCue,
  isTimeInRemixDisabledSection,
  mergeRemixDisabledSections,
  remixDisabledLabelAt,
  remixDisabledSectionLabel,
} from '../../src/lib/helpers/remixDisabledSections.ts';

describe('remix disabled sections', () => {
  it('disables the tail after a pause and restores it when the pause is gone', () => {
    const withPause = buildRemixDisabledSections(
      [{ time: 80, state: 2, targetTime: 80 }],
      120,
    );
    expect(withPause).toEqual([{ start: 80, end: 120, reason: 'pause' }]);
    expect(isTimeInRemixDisabledSection(80, withPause)).toBe(false);
    expect(isTimeInRemixDisabledSection(80.05, withPause)).toBe(true);
    expect(isTimeInRemixDisabledSection(120, withPause)).toBe(true);
    expect(isTimeInRemixDisabledSection(79, withPause)).toBe(false);

    const withoutPause = buildRemixDisabledSections([], 120);
    expect(withoutPause).toEqual([]);
    expect(isTimeInRemixDisabledSection(100, withoutPause)).toBe(false);
  });

  it('disables the open span between a play cue and its skip target', () => {
    const forward = buildRemixDisabledSections(
      [{ time: 20, state: 1, targetTime: 50 }],
      120,
    );
    expect(forward).toEqual([{ start: 20, end: 50, reason: 'skip' }]);
    expect(isTimeInRemixDisabledSection(20, forward)).toBe(false);
    expect(isTimeInRemixDisabledSection(50, forward)).toBe(false);
    expect(isTimeInRemixDisabledSection(35, forward)).toBe(true);
    expect(remixDisabledLabelAt(35, forward)).toBe('Skipped');

    const backward = buildRemixDisabledSections(
      [{ time: 50, state: 1, targetTime: 20 }],
      120,
    );
    expect(backward).toEqual([{ start: 20, end: 50, reason: 'skip' }]);
  });

  it('follows an adjusted play cue and ignores a play cue that does not skip', () => {
    const adjusted = buildRemixDisabledSections(
      [{ time: 25, state: 1, targetTime: 70 }],
      120,
    );
    expect(adjusted).toEqual([{ start: 25, end: 70, reason: 'skip' }]);
    expect(isTimeInRemixDisabledSection(30, adjusted)).toBe(true);
    expect(isTimeInRemixDisabledSection(22, adjusted)).toBe(false);

    expect(
      buildRemixDisabledSections([{ time: 25, state: 1, targetTime: 25.04 }], 120),
    ).toEqual([]);
  });

  it('lets an existing cue stay put and refuses a move into a disabled span', () => {
    const sections = buildRemixDisabledSections(
      [
        { time: 20, state: 1, targetTime: 50 },
        { time: 80, state: 2, targetTime: 80 },
      ],
      120,
    );

    expect(canPlaceRemixCue(10, sections)).toBe(true);
    expect(canPlaceRemixCue(35, sections)).toBe(false);
    expect(canPlaceRemixCue(90, sections)).toBe(false);
    expect(canPlaceRemixCue(35, sections, 35)).toBe(true);
    expect(canPlaceRemixCue(36, sections, 35)).toBe(false);
    expect(canPlaceRemixCue(10, sections, 35)).toBe(true);
    expect(canPlaceRemixCue(20, sections)).toBe(true);
    expect(canPlaceRemixCue(50, sections)).toBe(true);
    expect(canPlaceRemixCue(80, sections)).toBe(true);
  });

  it('merges overlapping pause and skip spans into one unavailable band', () => {
    const sections = buildRemixDisabledSections(
      [
        { time: 10, state: 1, targetTime: 40 },
        { time: 30, state: 2, targetTime: 30 },
      ],
      100,
    );
    expect(mergeRemixDisabledSections(sections)).toEqual([
      { start: 10, end: 100, reasons: ['skip', 'pause'] },
    ]);
    expect(remixDisabledSectionLabel(['skip', 'pause'])).toBe('Unavailable');
    expect(remixDisabledLabelAt(35, sections)).toBe('Unavailable');
    expect(remixDisabledLabelAt(90, sections)).toBe('Remix ended');
    expect(isTimeInRemixDisabledSection(10, sections)).toBe(false);
    expect(isTimeInRemixDisabledSection(30, sections)).toBe(true);

    const touching = buildRemixDisabledSections(
      [
        { time: 20, state: 1, targetTime: 50 },
        { time: 50, state: 2, targetTime: 50 },
      ],
      120,
    );
    expect(mergeRemixDisabledSections(touching)).toEqual([
      { start: 20, end: 50, reasons: ['skip'] },
      { start: 50, end: 120, reasons: ['pause'] },
    ]);
  });

  it('ignores cues when the timeline has no duration', () => {
    expect(
      buildRemixDisabledSections([{ time: 10, state: 2, targetTime: 10 }], 0),
    ).toEqual([]);
  });
});
