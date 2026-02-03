/**
 * Compensation Storage Helpers
 * 
 * Manages per-device compensation offsets in localStorage.
 * Isolated side effects for storage operations.
 */

/**
 * Storage key prefix for all compensation data
 */
const STORAGE_KEY_PREFIX = 'pr_sync_compensation';

/**
 * Compensation bounds (±2s as per spec)
 */
export const COMPENSATION_BOUNDS = {
  MIN: -2.0,
  MAX: 2.0
};

/**
 * Moving average weight for bounded learning
 * Higher alpha = more weight to new samples (faster learning)
 * Lower alpha = more weight to history (more stable)
 */
const MOVING_AVERAGE_ALPHA = 0.3;

/**
 * Minimum drift to learn from (ignore noise)
 */
const LEARNING_NOISE_THRESHOLD = 0.05;

/**
 * Build deterministic storage key for device profile
 * 
 * @param {import('./types.js').DeviceProfile} profile - Device profile
 * @returns {string} Storage key string
 */
export function buildStorageKey(profile) {
  const parts = [
    STORAGE_KEY_PREFIX,
    profile.playerType,
    profile.deviceClass
  ];
  
  if (profile.browser) {
    parts.push(profile.browser);
  }
  
  return parts.join('_');
}

/**
 * Clamp compensation value to safe bounds
 * 
 * @param {number} value - Raw compensation value
 * @returns {number} Clamped value within bounds
 */
export function clampCompensation(value) {
  return Math.max(
    COMPENSATION_BOUNDS.MIN,
    Math.min(COMPENSATION_BOUNDS.MAX, value)
  );
}

/**
 * Load compensation data from localStorage
 * 
 * @param {import('./types.js').DeviceProfile} profile - Device profile
 * @returns {import('./types.js').CompensationData} Compensation data or default if not found
 */
export function loadCompensation(profile) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      offset: 0,
      sampleCount: 0,
      lastUpdated: Date.now()
    };
  }
  
  try {
    const key = buildStorageKey(profile);
    const stored = window.localStorage.getItem(key);
    
    if (!stored) {
      return {
        offset: 0,
        sampleCount: 0,
        lastUpdated: Date.now()
      };
    }
    
    const parsed = JSON.parse(stored);
    
    // Validate and clamp stored value
    return {
      offset: clampCompensation(parsed.offset || 0),
      sampleCount: parsed.sampleCount || 0,
      lastUpdated: parsed.lastUpdated || Date.now()
    };
  } catch (error) {
    console.warn('[Sync] Failed to load compensation:', error);
    return {
      offset: 0,
      sampleCount: 0,
      lastUpdated: Date.now()
    };
  }
}

/**
 * Save compensation data to localStorage
 * 
 * @param {import('./types.js').DeviceProfile} profile - Device profile
 * @param {import('./types.js').CompensationData} data - Compensation data to save
 */
export function saveCompensation(
  profile,
  data
) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  
  try {
    const key = buildStorageKey(profile);
    const toStore = {
      offset: clampCompensation(data.offset),
      sampleCount: data.sampleCount,
      lastUpdated: Date.now()
    };
    
    window.localStorage.setItem(key, JSON.stringify(toStore));
  } catch (error) {
    console.warn('[Sync] Failed to save compensation:', error);
  }
}

/**
 * Update compensation using bounded moving average
 * 
 * Only learns from actual measured drift after seek.
 * Ignores noise-level corrections.
 * 
 * @param {import('./types.js').CompensationData} current - Current compensation data
 * @param {number} observedDrift - Drift observed after sync attempt
 * @returns {import('./types.js').CompensationData} Updated compensation data
 */
export function updateCompensationWithBoundedAverage(
  current,
  observedDrift
) {
  // Ignore noise-level drift
  if (Math.abs(observedDrift) < LEARNING_NOISE_THRESHOLD) {
    return current;
  }
  
  // Moving average: new = alpha * sample + (1 - alpha) * old
  const newOffset = clampCompensation(
    MOVING_AVERAGE_ALPHA * observedDrift + (1 - MOVING_AVERAGE_ALPHA) * current.offset
  );
  
  return {
    offset: newOffset,
    sampleCount: current.sampleCount + 1,
    lastUpdated: Date.now()
  };
}

/**
 * Reset compensation for a device profile
 * 
 * Use when context changes significantly (player reinit, quality change, etc.)
 * 
 * @param {import('./types.js').DeviceProfile} profile - Device profile
 */
export function resetCompensation(profile) {
  saveCompensation(profile, {
    offset: 0,
    sampleCount: 0,
    lastUpdated: Date.now()
  });
}
