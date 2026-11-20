export const initialMomentPlaybackSession = Object.freeze({
  momentSlug: '',
  sawClosedGate: false,
  started: false
});

/**
 * The first reaction in a moment still needs both clicks. Once that gate has
 * opened, later reactions in the same moment may start on their own.
 * Switching to another moment closes the session again, even if the previous
 * players are still marked as started.
 */
export function reduceMomentPlaybackSession(session, { momentSlug = '', bothVideosStarted = false } = {}) {
  const current = session || initialMomentPlaybackSession;
  const slug = typeof momentSlug === 'string' ? momentSlug : '';
  const gateOpen = Boolean(bothVideosStarted);

  let next = current;
  if (slug !== current.momentSlug) {
    next = {
      momentSlug: slug,
      sawClosedGate: !gateOpen,
      started: false
    };
  }

  if (!gateOpen) {
    if (next.sawClosedGate) return next;
    return { ...next, sawClosedGate: true };
  }

  if (next.sawClosedGate && !next.started) {
    return { ...next, started: true };
  }

  return next;
}
