/**
 * Pure logic functions for soft-sync
 * These are stateless, deterministic functions suitable for unit testing
 */

/**
 * @typedef {'no-op' | 'soft-sync' | 'hard-sync'} SyncMode
 * 
 * @typedef {Object} SoftSyncConfig
 * @property {number} noOpThreshold - Default: 0.10s
 * @property {number} softSyncMax - Default: 2.0s
 * @property {number} minPlaybackRate - Default: 0.90
 * @property {number} maxPlaybackRate - Default: 1.10
 * @property {number} cooldownMs - Default: 750ms
 * 
 * @typedef {Object} SoftSyncDecision
 * @property {SyncMode} mode
 * @property {number} drift
 * @property {number} [playbackRate]
 * @property {number} [durationMs]
 */

/**
 * Default configuration for soft-sync
 * @type {SoftSyncConfig}
 */
export const DEFAULT_SOFT_SYNC_CONFIG = {
  noOpThreshold: 0.10,
  softSyncMax: 2.0,
  minPlaybackRate: 0.90,
  maxPlaybackRate: 1.10,
  cooldownMs: 750
};

/**
 * Calculate drift between original and expected position
 * Drift = originalCurrentTime - expectedOriginalTime
 * 
 * Positive drift: original is ahead
 * Negative drift: original is behind
 * 
 * @param {number} originalCurrentTime
 * @param {number} reactionCurrentTime
 * @param {number} timeOffset
 * @returns {number}
 */
export function calculateDrift(
  originalCurrentTime,
  reactionCurrentTime,
  timeOffset
) {
  const expectedOriginalTime = reactionCurrentTime + timeOffset;
  return originalCurrentTime - expectedOriginalTime;
}

/**
 * Decide sync mode based on absolute drift
 * @param {number} drift
 * @param {SoftSyncConfig} [config]
 * @returns {SyncMode}
 */
export function decideSyncMode(drift, config = DEFAULT_SOFT_SYNC_CONFIG) {
  const absDrift = Math.abs(drift);
  
  if (absDrift < config.noOpThreshold) {
    return 'no-op';
  }
  
  if (absDrift <= config.softSyncMax) {
    return 'soft-sync';
  }
  
  return 'hard-sync';
}

/**
 * Compute playback rate adjustment for soft-sync
 * 
 * Strategy:
 * - Original behind (drift < 0): speed up original (rate > 1.0)
 * - Original ahead (drift > 0): slow down original (rate < 1.0)
 * 
 * The rate scales with drift magnitude, clamped to min/max bounds
 * 
 * @param {number} drift
 * @param {SoftSyncConfig} [config]
 * @returns {number}
 */
export function computePlaybackRate(drift, config = DEFAULT_SOFT_SYNC_CONFIG) {
  // Map drift to a rate adjustment
  // For drift of 2.0s (max), we want max adjustment
  // For drift of 0.1s (min), we want minimal adjustment
  const absDrift = Math.abs(drift);
  
  // Linear scaling: at softSyncMax, use max rate; at noOpThreshold, use minimal rate
  const range = config.softSyncMax - config.noOpThreshold;
  const normalizedDrift = (absDrift - config.noOpThreshold) / range;
  const adjustmentMagnitude = Math.max(0, Math.min(1, normalizedDrift));
  
  let rate;
  if (drift < 0) {
    // Behind: speed up (rate > 1.0)
    const maxAdjustment = config.maxPlaybackRate - 1.0;
    rate = 1.0 + adjustmentMagnitude * maxAdjustment;
  } else {
    // Ahead: slow down (rate < 1.0)
    const maxAdjustment = 1.0 - config.minPlaybackRate;
    rate = 1.0 - adjustmentMagnitude * maxAdjustment;
  }
  
  // Clamp to bounds
  return Math.max(config.minPlaybackRate, Math.min(config.maxPlaybackRate, rate));
}

/**
 * Compute soft-sync duration based on drift magnitude
 * Larger drift requires longer correction time
 * 
 * @param {number} drift
 * @param {SoftSyncConfig} [config]
 * @returns {number}
 */
export function computeSoftSyncDuration(drift, config = DEFAULT_SOFT_SYNC_CONFIG) {
  const absDrift = Math.abs(drift);
  const minDuration = 1200;
  const maxDuration = 2500;
  
  // Scale duration with drift
  const range = config.softSyncMax - config.noOpThreshold;
  const normalizedDrift = (absDrift - config.noOpThreshold) / range;
  const t = Math.max(0, Math.min(1, normalizedDrift));
  
  return Math.round(minDuration + t * (maxDuration - minDuration));
}

/**
 * Create a soft-sync decision with all necessary parameters
 * 
 * @param {number} originalCurrentTime
 * @param {number} reactionCurrentTime
 * @param {number} timeOffset
 * @param {SoftSyncConfig} [config]
 * @returns {SoftSyncDecision}
 */
export function createSoftSyncDecision(
  originalCurrentTime,
  reactionCurrentTime,
  timeOffset,
  config = DEFAULT_SOFT_SYNC_CONFIG
) {
  const drift = calculateDrift(originalCurrentTime, reactionCurrentTime, timeOffset);
  const mode = decideSyncMode(drift, config);
  
  if (mode === 'soft-sync') {
    return {
      mode,
      drift,
      playbackRate: computePlaybackRate(drift, config),
      durationMs: computeSoftSyncDuration(drift, config)
    };
  }
  
  return { mode, drift };
}

/**
 * Check if soft-sync is allowed based on cooldown
 * 
 * @param {number} lastSoftSyncAt
 * @param {number} now
 * @param {SoftSyncConfig} [config]
 * @returns {boolean}
 */
export function isSoftSyncAllowed(
  lastSoftSyncAt,
  now,
  config = DEFAULT_SOFT_SYNC_CONFIG
) {
  return now - lastSoftSyncAt >= config.cooldownMs;
}
