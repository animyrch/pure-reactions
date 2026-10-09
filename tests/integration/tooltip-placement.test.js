import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import HelpfulTip from '../../src/lib/components/design-system/HelpfulTip.svelte';
import { placeTooltip } from '../../src/lib/helpers/tooltipPlacement.js';

describe('HelpfulTip markup', () => {
  it('renders the tooltip button without a bubble until it opens', () => {
    const { body } = render(HelpfulTip, {
      props: { variant: 'tooltip', label: 'About remix mode' },
    });

    expect(body).toContain('About remix mode');
    expect(body).not.toContain('role="tooltip"');
  });

  it('still renders the callout', () => {
    const { body } = render(HelpfulTip, {
      props: { title: 'Recording tips' },
    });

    expect(body).toContain('Recording tips');
    expect(body).toContain('role="note"');
  });
});


const tip = { width: 208, height: 130 };
const viewport = { width: 900, height: 700 };

const fullyInside = (box) => {
  expect(box.left).toBeGreaterThanOrEqual(8);
  expect(box.top).toBeGreaterThanOrEqual(8);
  expect(box.left + tip.width).toBeLessThanOrEqual(viewport.width - 8);
  expect(box.top + tip.height).toBeLessThanOrEqual(viewport.height - 8);
};

describe('placeTooltip', () => {
  it('shifts a top tooltip onto the screen when the trigger is at the left edge', () => {
    const placed = placeTooltip({
      trigger: { top: 200, right: 32, bottom: 216, left: 16, width: 16, height: 16 },
      tip,
      placement: 'top',
      viewport,
    });

    expect(placed.placement).toBe('top');
    expect(placed.left).toBe(8);
    expect(placed.top).toBe(200 - 8 - tip.height);
    fullyInside(placed);
  });

  it('keeps a bottom tooltip beside a trigger on the right', () => {
    const placed = placeTooltip({
      trigger: { top: 40, right: 876, bottom: 56, left: 860, width: 16, height: 16 },
      tip,
      placement: 'bottom',
      viewport,
    });

    expect(placed.placement).toBe('bottom');
    expect(placed.left).toBe(876 - tip.width);
    expect(placed.top).toBe(64);
    fullyInside(placed);
  });

  it('flips above the trigger when the bottom side does not fit', () => {
    const placed = placeTooltip({
      trigger: { top: 640, right: 500, bottom: 656, left: 484, width: 16, height: 16 },
      tip,
      placement: 'bottom',
      viewport,
    });

    expect(placed.placement).toBe('top');
    expect(placed.top).toBe(640 - 8 - tip.height);
    fullyInside(placed);
  });

  it('flips below the trigger when the top side does not fit', () => {
    const placed = placeTooltip({
      trigger: { top: 12, right: 500, bottom: 28, left: 484, width: 16, height: 16 },
      tip,
      placement: 'top',
      viewport,
    });

    expect(placed.placement).toBe('bottom');
    expect(placed.top).toBe(36);
    fullyInside(placed);
  });

  it('pins a wide tooltip to the viewport margin', () => {
    const wide = { width: 390, height: 80 };
    const narrow = { width: 400, height: 500 };
    const placed = placeTooltip({
      trigger: { top: 80, right: 40, bottom: 96, left: 24, width: 16, height: 16 },
      tip: wide,
      placement: 'top',
      viewport: narrow,
    });

    expect(placed.left).toBe(8);
    expect(placed.left + wide.width).toBeGreaterThan(narrow.width - 8);
    expect(placed.top).toBeGreaterThanOrEqual(8);
  });
});
