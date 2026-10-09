const OPPOSITE = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const rawPosition = (placement, trigger, tip, gap) => {
  if (placement === 'bottom') {
    return {
      top: trigger.bottom + gap,
      left: trigger.right - tip.width,
    };
  }

  if (placement === 'left') {
    return {
      top: trigger.top + (trigger.height - tip.height) / 2,
      left: trigger.left - gap - tip.width,
    };
  }

  if (placement === 'right') {
    return {
      top: trigger.top + (trigger.height - tip.height) / 2,
      left: trigger.right + gap,
    };
  }

  return {
    top: trigger.top - gap - tip.height,
    left: trigger.right - tip.width,
  };
};

const primaryOverflow = (placement, pos, tip, viewport, margin) => {
  if (placement === 'bottom') {
    return Math.max(0, pos.top + tip.height - (viewport.height - margin));
  }

  if (placement === 'left') {
    return Math.max(0, margin - pos.left);
  }

  if (placement === 'right') {
    return Math.max(0, pos.left + tip.width - (viewport.width - margin));
  }

  return Math.max(0, margin - pos.top);
};

/**
 * Place a tooltip beside its trigger and keep the box inside the viewport.
 * Top and bottom hang from the trigger's right edge, then shift inward when
 * that edge is near the left of the screen. The preferred side flips when it
 * does not fit.
 */
export const placeTooltip = ({
  trigger,
  tip,
  placement = 'top',
  viewport,
  gap = 8,
  margin = 8,
}) => {
  const resolvedPreferred = ['top', 'bottom', 'left', 'right'].includes(placement)
    ? placement
    : 'top';
  const preferredPos = rawPosition(resolvedPreferred, trigger, tip, gap);
  const opposite = OPPOSITE[resolvedPreferred];
  const oppositePos = rawPosition(opposite, trigger, tip, gap);
  const preferredOverflow = primaryOverflow(
    resolvedPreferred,
    preferredPos,
    tip,
    viewport,
    margin,
  );
  const oppositeOverflow = primaryOverflow(opposite, oppositePos, tip, viewport, margin);
  const useOpposite = preferredOverflow > 0 && oppositeOverflow < preferredOverflow;
  const chosen = useOpposite ? oppositePos : preferredPos;
  const maxLeft = Math.max(margin, viewport.width - margin - tip.width);
  const maxTop = Math.max(margin, viewport.height - margin - tip.height);

  return {
    placement: useOpposite ? opposite : resolvedPreferred,
    top: Math.round(clamp(chosen.top, margin, maxTop)),
    left: Math.round(clamp(chosen.left, margin, maxLeft)),
  };
};
