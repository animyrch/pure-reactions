/**
 * Adaptive Sync Mechanism Module
 * 
 * Player-agnostic drift-aware synchronization system.
 * 
 * Main exports:
 * - executeAdaptiveSync: Main orchestrator function
 * - YouTubePlayerAdapter: YouTube player wrapper
 * - Pure functions for drift calculation and decision making
 */

// Main orchestrator
export { executeAdaptiveSync } from './orchestrator.js';

// Player adapters
export { YouTubePlayerAdapter } from './adapters/youtube.js';

// Pure functions (for testing and custom usage)
export {
  computeExpectedOriginalTime,
  computeDrift,
  createDriftMeasurement,
  getAbsoluteDrift
} from './drift.js';

export {
  decideSyncStrategy,
  detectCatastrophicWorsening,
  didSyncImprove,
  shouldIgnoreSync,
  THRESHOLDS
} from './decision.js';

export {
  loadCompensation,
  saveCompensation,
  updateCompensationWithBoundedAverage,
  resetCompensation,
  buildStorageKey,
  clampCompensation,
  COMPENSATION_BOUNDS
} from './compensationStore.js';

export {
  waitForPlayerSettle,
  samplePlayerTimeMedian,
  DEFAULT_SETTLE_MS
} from './settle.js';
