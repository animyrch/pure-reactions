/**
 * Soft-sync orchestrator
 * Handles side effects and coordinates soft-sync application
 */

import {
  createSoftSyncDecision,
  isSoftSyncAllowed,
  DEFAULT_SOFT_SYNC_CONFIG
} from './logic.js';

/**
 * @typedef {Object} SoftSyncState
 * @property {number} lastSoftSyncAt
 * @property {boolean} isActive
 * @property {number} [resetTimeoutId]
 * 
 * @typedef {Object} SoftSyncDependencies
 * @property {(rate: number) => void} setPlaybackRate
 * @property {() => void} resetPlaybackRate
 * @property {(drift: number) => void} performHardSync
 * @property {(callback: () => void, delay: number) => number} setTimeout
 * @property {(id: number) => void} clearTimeout
 * @property {() => number} getNow
 * 
 * @typedef {Object} SoftSyncOrchestratorOptions
 * @property {Partial<import('./logic.js').SoftSyncConfig>} [config]
 * @property {boolean} [isPlaying]
 * @property {boolean} [isBuffering]
 * @property {boolean} [isScrubbing]
 * @property {boolean} [allowPlaybackRateChange]
 */

/**
 * Main orchestrator function for soft-sync
 * 
 * @param {SoftSyncState} state - Current soft-sync state
 * @param {number} originalCurrentTime - Current time of original video
 * @param {number} reactionCurrentTime - Current time of reaction video
 * @param {number} timeOffset - Time offset between videos
 * @param {SoftSyncDependencies} deps - External dependencies (for testability)
 * @param {SoftSyncOrchestratorOptions} [options] - Additional options and guards
 * @returns {SoftSyncState} Updated state
 */
export function applySoftSync(
  state,
  originalCurrentTime,
  reactionCurrentTime,
  timeOffset,
  deps,
  options = {}
) {
  const config = {
    ...DEFAULT_SOFT_SYNC_CONFIG,
    ...options.config
  };
  
  const now = deps.getNow();
  
  // Guard conditions: don't apply soft-sync if...
  if (
    options.isPlaying === false ||       // Not playing
    options.isBuffering === true ||      // Buffering
    options.isScrubbing === true ||      // User is scrubbing
    options.allowPlaybackRateChange === false  // Playback rate changes disabled
  ) {
    // If soft-sync is currently active, reset immediately
    if (state.isActive) {
      deps.resetPlaybackRate();
      if (state.resetTimeoutId !== undefined) {
        deps.clearTimeout(state.resetTimeoutId);
      }
      return {
        lastSoftSyncAt: state.lastSoftSyncAt,
        isActive: false,
        resetTimeoutId: undefined
      };
    }
    return state;
  }
  
  // Check cooldown
  if (!isSoftSyncAllowed(state.lastSoftSyncAt, now, config)) {
    return state;
  }
  
  // Create decision
  const decision = createSoftSyncDecision(
    originalCurrentTime,
    reactionCurrentTime,
    timeOffset,
    config
  );
  
  let nextState = state;
  
  switch (decision.mode) {
    case 'no-op':
      // Already synced, reset if active
      if (state.isActive) {
        deps.resetPlaybackRate();
        if (state.resetTimeoutId !== undefined) {
          deps.clearTimeout(state.resetTimeoutId);
        }
        nextState = {
          lastSoftSyncAt: state.lastSoftSyncAt,
          isActive: false,
          resetTimeoutId: undefined
        };
      }
      break;
      
    case 'soft-sync':
      // Apply playback rate adjustment
      if (decision.playbackRate && decision.durationMs) {
        // Clear any existing timeout
        if (state.resetTimeoutId !== undefined) {
          deps.clearTimeout(state.resetTimeoutId);
        }
        
        // Apply rate
        try {
          deps.setPlaybackRate(decision.playbackRate);
          
          // Schedule reset
          const timeoutId = deps.setTimeout(() => {
            deps.resetPlaybackRate();
          }, decision.durationMs);
          
          nextState = {
            lastSoftSyncAt: now,
            isActive: true,
            resetTimeoutId: timeoutId
          };
        } catch (error) {
          // Fallback to hard-sync if playback rate fails
          console.warn('[SoftSync] Playback rate failed, falling back to hard-sync', error);
          deps.performHardSync(decision.drift);
          nextState = {
            lastSoftSyncAt: now,
            isActive: false,
            resetTimeoutId: undefined
          };
        }
      }
      break;
      
    case 'hard-sync':
      // Delegate to existing hard-sync logic
      deps.performHardSync(decision.drift);
      nextState = {
        lastSoftSyncAt: now,
        isActive: false,
        resetTimeoutId: undefined
      };
      break;
  }
  
  return nextState;
}

/**
 * Create initial soft-sync state
 * @returns {SoftSyncState}
 */
export function createInitialSoftSyncState() {
  return {
    lastSoftSyncAt: 0,
    isActive: false,
    resetTimeoutId: undefined
  };
}

/**
 * Cleanup function to be called when soft-sync is no longer needed
 * @param {SoftSyncState} state
 * @param {Pick<SoftSyncDependencies, 'clearTimeout' | 'resetPlaybackRate'>} deps
 */
export function cleanupSoftSync(state, deps) {
  if (state.resetTimeoutId !== undefined) {
    deps.clearTimeout(state.resetTimeoutId);
  }
  if (state.isActive) {
    deps.resetPlaybackRate();
  }
}
