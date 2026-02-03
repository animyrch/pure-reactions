/**
 * Sync Orchestrator
 * 
 * Main coordination logic for adaptive sync mechanism.
 * Orchestrates drift measurement, decision making, compensation,
 * settling, and outcome verification.
 */

import {
  createDriftMeasurement
} from './drift.js';
import {
  decideSyncStrategy,
  detectCatastrophicWorsening,
  didSyncImprove
} from './decision.js';
import {
  loadCompensation,
  saveCompensation,
  updateCompensationWithBoundedAverage
} from './compensationStore.js';
import {
  waitForPlayerSettle,
  DEFAULT_SETTLE_MS
} from './settle.js';

/**
 * Execute adaptive sync with drift awareness and compensation learning
 * 
 * Process:
 * 1. Measure initial drift
 * 2. Decide if sync needed (ignore if < 0.10s)
 * 3. Load device-specific compensation
 * 4. Apply correction (seek with compensation)
 * 5. Wait for settle
 * 6. Measure post-sync drift
 * 7. Evaluate outcome (improved/worsened)
 * 8. Update compensation (bounded learning)
 * 9. Apply rollback if catastrophically worse
 * 
 * @param {import('./types.js').SyncOrchestratorOptions} options - Sync orchestrator options
 * @returns {Promise<import('./types.js').SyncOutcome>} Promise<SyncOutcome> with full sync telemetry
 */
export async function executeAdaptiveSync(
  options
) {
  const {
    originalPlayer,
    reactionCurrentTime,
    expectedOriginalTime,
    reactionConfig,
    deviceProfile,
    settleMs = DEFAULT_SETTLE_MS
  } = options;
  
  const { seekMin, seekMax } = reactionConfig;
  
  // Step 1: Measure initial drift using the provided expected time
  // (which should be calculated using proper timeline logic)
  const actualOriginalTime = originalPlayer.getCurrentTime();
  
  const initialDrift = createDriftMeasurement(
    actualOriginalTime,
    expectedOriginalTime
  );
  
  console.log('[AdaptiveSync] Initial drift:', {
    drift: initialDrift.drift.toFixed(3),
    actual: actualOriginalTime.toFixed(3),
    expected: expectedOriginalTime.toFixed(3)
  });
  
  // Step 2: Decide if sync needed
  const decision = decideSyncStrategy(initialDrift.drift);
  
  if (!decision.shouldSync) {
    console.log('[AdaptiveSync] Skipping sync:', decision.reason);
    
    // Return early with no changes
    return {
      initialDrift,
      finalDrift: initialDrift,
      improved: false,
      worsenedSignificantly: false,
      compensationApplied: 0
    };
  }
  
  console.log('[AdaptiveSync] Sync decision:', decision.reason);
  
  // Step 3: Load compensation
  const compensationData = loadCompensation(deviceProfile);
  
  // Only apply compensation if we have confidence in it (at least 2 samples)
  // This prevents wild initial seeks with untrustworthy compensation
  const hasConfidentCompensation = compensationData.sampleCount >= 2;
  const compensationOffset = hasConfidentCompensation ? compensationData.offset : 0;
  
  console.log('[AdaptiveSync] Compensation offset:', {
    offset: compensationData.offset.toFixed(3),
    appliedOffset: compensationOffset.toFixed(3),
    sampleCount: compensationData.sampleCount,
    confident: hasConfidentCompensation
  });
  
  // Step 4: Apply correction with compensation
  // Target = expected + compensation (only if confident)
  const targetTime = expectedOriginalTime + compensationOffset;
  
  // Respect seek bounds
  const clampedTarget = Math.max(
    seekMin,
    Math.min(seekMax, targetTime)
  );
  
  console.log('[AdaptiveSync] Seeking to:', {
    target: targetTime.toFixed(3),
    clamped: clampedTarget.toFixed(3),
    usingCompensation: hasConfidentCompensation
  });
  
  originalPlayer.seek(clampedTarget);
  
  // Step 5: Settle
  await waitForPlayerSettle(settleMs);
  
  // Step 6: Measure post-sync drift
  const newActualTime = originalPlayer.getCurrentTime();
  const finalDrift = createDriftMeasurement(
    newActualTime,
    expectedOriginalTime
  );
  
  console.log('[AdaptiveSync] Post-sync drift:', {
    drift: finalDrift.drift.toFixed(3),
    actual: newActualTime.toFixed(3)
  });
  
  // Step 7: Evaluate outcome
  const improved = didSyncImprove(initialDrift, finalDrift);
  const worsenedSignificantly = detectCatastrophicWorsening(
    initialDrift,
    finalDrift
  );
  
  console.log('[AdaptiveSync] Outcome:', {
    improved,
    worsenedSignificantly
  });
  
  // Step 8: Update compensation if we learned something
  if (improved) {
    // Learn from the observed drift
    const updatedCompensation = updateCompensationWithBoundedAverage(
      compensationData,
      finalDrift.drift
    );
    
    saveCompensation(deviceProfile, updatedCompensation);
    
    console.log('[AdaptiveSync] Updated compensation:', {
      oldOffset: compensationOffset.toFixed(3),
      newOffset: updatedCompensation.offset.toFixed(3),
      sampleCount: updatedCompensation.sampleCount
    });
  }
  
  // Step 9: Apply rollback if catastrophic
  if (worsenedSignificantly) {
    console.warn('[AdaptiveSync] Catastrophic worsening detected! Applying rollback...');
    
    // Seek back closer to initial position (undo the bad seek)
    // Use the opposite of the observed drift to correct
    const rollbackTarget = expectedOriginalTime - finalDrift.drift;
    const clampedRollback = Math.max(
      seekMin,
      Math.min(seekMax, rollbackTarget)
    );
    
    originalPlayer.seek(clampedRollback);
    
    // Update compensation to prevent repeating this mistake
    const correctedCompensation = updateCompensationWithBoundedAverage(
      compensationData,
      -finalDrift.drift
    );
    
    saveCompensation(deviceProfile, correctedCompensation);
    
    console.log('[AdaptiveSync] Rollback applied, compensation updated');
  }
  
  return {
    initialDrift,
    finalDrift,
    improved,
    worsenedSignificantly,
    compensationApplied: compensationOffset,
    hadConfidentCompensation: hasConfidentCompensation
  };
}
