/**
 * Drift Calculation Helpers (Pure Functions)
 * 
 * These functions handle the mathematical calculations for drift
 * without any side effects.
 */

/**
 * Compute expected original time based on reaction time and config
 * 
 * @param {number} reactionTime - Current playback time of reaction video
 * @param {number} timeOffset - Time offset from reaction config
 * @returns {number} Expected original video time
 */
export function computeExpectedOriginalTime(
  reactionTime,
  timeOffset
) {
  // Expected original time is reaction time minus the offset
  // E = R - offset
  return reactionTime - timeOffset;
}

/**
 * Compute drift between actual and expected original time
 * 
 * Drift = O - E
 * where O = actual original time, E = expected original time
 * 
 * Interpretation:
 * - drift ≈ 0 → in sync
 * - drift < 0 → original is behind
 * - drift > 0 → original is ahead
 * 
 * @param {number} actualOriginalTime - Current playback time of original video
 * @param {number} expectedOriginalTime - Expected original time based on reaction
 * @returns {number} Drift value (can be positive or negative)
 */
export function computeDrift(
  actualOriginalTime,
  expectedOriginalTime
) {
  return actualOriginalTime - expectedOriginalTime;
}

/**
 * Create a drift measurement snapshot
 * 
 * @param {number} actualTime - Actual original video time
 * @param {number} expectedTime - Expected original video time
 * @param {number} [timestamp] - When measurement was taken
 * @returns {import('./types.js').DriftMeasurement} DriftMeasurement object
 */
export function createDriftMeasurement(
  actualTime,
  expectedTime,
  timestamp = Date.now()
) {
  return {
    drift: computeDrift(actualTime, expectedTime),
    actualTime,
    expectedTime,
    timestamp
  };
}

/**
 * Calculate absolute drift (magnitude only)
 * 
 * @param {number} drift - Drift value
 * @returns {number} Absolute value of drift
 */
export function getAbsoluteDrift(drift) {
  return Math.abs(drift);
}
