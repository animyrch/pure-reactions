/**
 * Decision Logic Helpers (Pure Functions)
 * 
 * These functions determine when and how to sync based on drift measurements
 * and thresholds, without side effects.
 */

import { getAbsoluteDrift } from './drift.js';

/**
 * Threshold constants for sync decisions
 */
export const THRESHOLDS = {
  /** Ignore sync if drift is below this (0.10s as per spec) */
  IGNORE: 0.10,
  
  /** Soft correction threshold (future: playback rate nudging) */
  SOFT: 0.30,
  
  /** Hard correction threshold (seek required) */
  HARD: 0.30,
  
  /** Catastrophic threshold - sync made things significantly worse */
  CATASTROPHIC: 0.50
};

/**
 * Determine if sync should be ignored due to low drift
 * 
 * @param {number} drift - Drift value (signed or absolute)
 * @returns {boolean} True if drift is below ignore threshold
 */
export function shouldIgnoreSync(drift) {
  return getAbsoluteDrift(drift) < THRESHOLDS.IGNORE;
}

/**
 * Decide sync strategy based on drift magnitude
 * 
 * @param {number} drift - Drift value (signed or absolute)
 * @returns {import('./types.js').SyncDecision} SyncDecision with strategy and reasoning
 */
export function decideSyncStrategy(drift) {
  const absDrift = getAbsoluteDrift(drift);
  
  if (absDrift < THRESHOLDS.IGNORE) {
    return {
      strategy: 'ignore',
      shouldSync: false,
      reason: `Drift ${absDrift.toFixed(3)}s below ignore threshold ${THRESHOLDS.IGNORE}s`
    };
  }
  
  // For now, soft and hard have same threshold since YouTube doesn't support
  // playback rate nudging reliably. Future players might use soft correction.
  if (absDrift < THRESHOLDS.SOFT) {
    return {
      strategy: 'soft',
      shouldSync: true,
      reason: `Drift ${absDrift.toFixed(3)}s warrants soft correction`
    };
  }
  
  return {
    strategy: 'hard',
    shouldSync: true,
    reason: `Drift ${absDrift.toFixed(3)}s requires hard seek`
  };
}

/**
 * Detect if post-sync drift worsened significantly (catastrophic failure)
 * 
 * A sync is considered catastrophic if:
 * - Post-sync drift is larger than pre-sync drift
 * - The increase is significant (> CATASTROPHIC threshold)
 * 
 * @param {import('./types.js').DriftMeasurement} initialMeasurement - Drift before sync
 * @param {import('./types.js').DriftMeasurement} finalMeasurement - Drift after sync
 * @returns {boolean} True if sync made things significantly worse
 */
export function detectCatastrophicWorsening(
  initialMeasurement,
  finalMeasurement
) {
  const initialAbs = getAbsoluteDrift(initialMeasurement.drift);
  const finalAbs = getAbsoluteDrift(finalMeasurement.drift);
  
  // Check if drift increased and by how much
  const increase = finalAbs - initialAbs;
  
  return increase > THRESHOLDS.CATASTROPHIC;
}

/**
 * Determine if sync outcome improved alignment
 * 
 * @param {import('./types.js').DriftMeasurement} initialMeasurement - Drift before sync
 * @param {import('./types.js').DriftMeasurement} finalMeasurement - Drift after sync
 * @returns {boolean} True if final drift is smaller than initial
 */
export function didSyncImprove(
  initialMeasurement,
  finalMeasurement
) {
  const initialAbs = getAbsoluteDrift(initialMeasurement.drift);
  const finalAbs = getAbsoluteDrift(finalMeasurement.drift);
  
  return finalAbs < initialAbs;
}
