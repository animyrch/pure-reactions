/**
 * Adaptive Sync Mechanism - Type Definitions (JSDoc)
 * Player-agnostic types for drift-aware synchronization
 */

/**
 * @typedef {Object} PlayerAdapter
 * Player adapter interface - abstraction over YouTube/future players
 * @property {function(): number} getCurrentTime
 * @property {function(number): void} seek
 * @property {function(): number} getPlayerState
 * @property {function(number): void} [setPlaybackRate]
 */

/**
 * @typedef {Object} DeviceProfile
 * Device profile for compensation learning
 * @property {'youtube'|string} playerType
 * @property {'mobile'|'desktop'} deviceClass
 * @property {string} [browser]
 */

/**
 * @typedef {Object} CompensationData
 * Compensation data stored per device
 * @property {number} offset
 * @property {number} sampleCount
 * @property {number} lastUpdated
 */

/**
 * @typedef {Object} DriftMeasurement
 * Drift measurement result
 * @property {number} drift
 * @property {number} actualTime
 * @property {number} expectedTime
 * @property {number} timestamp
 */

/**
 * @typedef {'ignore'|'soft'|'hard'} SyncStrategy
 * Sync strategy decision
 */

/**
 * @typedef {Object} SyncDecision
 * Sync decision result
 * @property {SyncStrategy} strategy
 * @property {boolean} shouldSync
 * @property {string} reason
 */

/**
 * @typedef {Object} SyncOutcome
 * Sync outcome after applying correction
 * @property {DriftMeasurement} initialDrift
 * @property {DriftMeasurement} finalDrift
 * @property {boolean} improved
 * @property {boolean} worsenedSignificantly
 * @property {number} compensationApplied
 */

/**
 * @typedef {Object} ReactionConfig
 * @property {number} timeOffset
 * @property {number} seekMin
 * @property {number} seekMax
 */

/**
 * @typedef {Object} SyncOrchestratorOptions
 * Sync orchestrator options
 * @property {PlayerAdapter} originalPlayer
 * @property {number} reactionCurrentTime
 * @property {ReactionConfig} reactionConfig
 * @property {DeviceProfile} deviceProfile
 * @property {number} [settleMs]
 */

// Export empty object to make this a module
export default {};
