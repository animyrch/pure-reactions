/**
 * Manual Sync Button Handler Example
 * 
 * Shows how to integrate the adaptive sync module into the existing
 * twin players system.
 * 
 * This file demonstrates the integration pattern but is not yet wired
 * into the actual UI. It should be integrated into the playback page
 * where the manual sync button exists.
 */

import { executeAdaptiveSync, YouTubePlayerAdapter } from '$lib/sync';

/**
 * Detect device class for compensation learning
 * @returns {'mobile' | 'desktop'}
 */
function getDeviceClass() {
  if (typeof window === 'undefined') {
    return 'desktop';
  }
  
  // Simple mobile detection
  const userAgent = window.navigator.userAgent || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  return isMobile ? 'mobile' : 'desktop';
}

/**
 * Detect browser for compensation learning
 * @returns {string | undefined}
 */
function getBrowser() {
  if (typeof window === 'undefined') {
    return undefined;
  }
  
  const userAgent = window.navigator.userAgent || '';
  
  if (userAgent.includes('Chrome')) return 'chrome';
  if (userAgent.includes('Safari')) return 'safari';
  if (userAgent.includes('Firefox')) return 'firefox';
  if (userAgent.includes('Edge')) return 'edge';
  
  return undefined;
}

/**
 * Handle manual sync button click
 * 
 * This should be called when the user clicks a "Sync" button
 * or keyboard shortcut.
 * 
 * @param {Object} options
 * @param {Object} options.originalYtPlayer - YouTube IFrame API player for original video
 * @param {number} options.reactionCurrentTime - Current time of reaction video
 * @param {number} options.timeOffset - Time offset from reaction config
 * @param {number} options.seekMin - Minimum seek position
 * @param {number} options.seekMax - Maximum seek position
 * @param {number} [options.settleMs] - Optional settle duration override
 * @returns {Promise<void>}
 */
export async function handleManualSync({
  originalYtPlayer,
  reactionCurrentTime,
  timeOffset,
  seekMin,
  seekMax,
  settleMs
}) {
  try {
    // Wrap YouTube player with adapter
    const originalPlayerAdapter = new YouTubePlayerAdapter(originalYtPlayer);
    
    // Build device profile for compensation learning
    const deviceProfile = {
      playerType: 'youtube',
      deviceClass: getDeviceClass(),
      browser: getBrowser()
    };
    
    console.log('[ManualSync] Starting adaptive sync...', {
      deviceProfile,
      reactionCurrentTime,
      timeOffset
    });
    
    // Execute adaptive sync
    const outcome = await executeAdaptiveSync({
      originalPlayer: originalPlayerAdapter,
      reactionCurrentTime,
      reactionConfig: {
        timeOffset,
        seekMin,
        seekMax
      },
      deviceProfile,
      settleMs
    });
    
    console.log('[ManualSync] Sync completed:', {
      initialDrift: outcome.initialDrift.drift.toFixed(3),
      finalDrift: outcome.finalDrift.drift.toFixed(3),
      improved: outcome.improved,
      worsenedSignificantly: outcome.worsenedSignificantly,
      compensationApplied: outcome.compensationApplied.toFixed(3)
    });
    
    // Optional: Show user feedback
    if (!outcome.initialDrift || Math.abs(outcome.initialDrift.drift) < 0.10) {
      console.log('[ManualSync] Videos were already in sync');
      // Could show toast: "Videos are already in sync"
    } else if (outcome.improved) {
      console.log('[ManualSync] Sync improved alignment');
      // Could show toast: "Sync applied successfully"
    } else if (outcome.worsenedSignificantly) {
      console.warn('[ManualSync] Sync worsened alignment (rollback applied)');
      // Could show toast: "Sync correction applied"
    }
  } catch (error) {
    console.error('[ManualSync] Failed to execute sync:', error);
    // Could show toast: "Sync failed, please try again"
  }
}

/**
 * Example: Integration into existing useTwinPlayers composable
 * 
 * Add this to the composable's returned object:
 * 
 * ```javascript
 * return {
 *   // ... existing returns
 *   
 *   // New manual sync function
 *   manualSync: async () => {
 *     if (!playerOriginal || !playerReaction) {
 *       return;
 *     }
 *     
 *     await handleManualSync({
 *       originalYtPlayer: playerOriginal,
 *       reactionCurrentTime: playerReaction.getCurrentTime(),
 *       timeOffset: timeOffset.value,
 *       seekMin: seekMin.value,
 *       seekMax: seekMax.value
 *     });
 *   }
 * };
 * ```
 * 
 * Then in the UI component:
 * 
 * ```svelte
 * <button on:click={manualSync}>
 *   Sync Videos
 * </button>
 * ```
 */
