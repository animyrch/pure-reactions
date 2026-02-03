import { executeAdaptiveSync, YouTubePlayerAdapter } from '$lib/sync';
import { detectDeviceProfile } from '$lib/helpers/deviceProfile';
import { getCurrentStateFromStateConfigs } from '$lib/helpers/reaction';

export type RunAdaptiveSyncOptions = {
  timeOffset?: number;
  seekMin?: number;
  seekMax?: number;
  playerConfigs?: any;
  isPlaying?: boolean;
};

/**
 * Calculate the expected original time using timeline configurations
 * This matches the logic from computeTwinPlayersSyncTick
 */
function calculateExpectedOriginalTime(
  reactionCurrentTime: number,
  timeOffset: number,
  playerConfigs: any,
  isPlaying: boolean
): number {
  // Calculate effective reaction time (matches currentEffective in twinPlayersSyncTick)
  const effectiveReactionTime = reactionCurrentTime - timeOffset;
  
  // Get the config for the current reaction time
  const config = getCurrentStateFromStateConfigs(reactionCurrentTime, playerConfigs, timeOffset);
  
  // Parse the base target time and anchor time
  const baseTargetTime = Number(config.time ?? 0);
  // CRITICAL: Fallback to effectiveReactionTime, not 0 (matches line 367 in twinPlayersSyncTick)
  const anchorTime = Number(config.closestSmallerTimeCode ?? effectiveReactionTime);
  
  let expectedTime = baseTargetTime;
  
  // If playing, add the delta since the anchor time
  if (isPlaying && Number.isFinite(expectedTime) && Number.isFinite(anchorTime)) {
    const deltaSinceAnchor = effectiveReactionTime - anchorTime;
    if (Number.isFinite(deltaSinceAnchor)) {
      expectedTime += Math.max(deltaSinceAnchor, 0);
    }
  }
  
  return Number.isFinite(expectedTime) ? expectedTime : 0;
}

export async function runAdaptiveSync(
  originalPlayer: any,
  reactionCurrentTime: number,
  options: RunAdaptiveSyncOptions = {}
) {
  const playerAdapter = new YouTubePlayerAdapter(originalPlayer);
  const deviceProfile = detectDeviceProfile();

  // Calculate the expected original time using proper timeline logic
  const expectedOriginalTime = calculateExpectedOriginalTime(
    reactionCurrentTime,
    options.timeOffset || 0,
    options.playerConfigs || {},
    options.isPlaying ?? true
  );

  const outcome = await executeAdaptiveSync({
    originalPlayer: playerAdapter,
    reactionCurrentTime,
    expectedOriginalTime,
    reactionConfig: {
      timeOffset: options.timeOffset || 0,
      seekMin: options.seekMin || 0,
      seekMax: options.seekMax || 999999
    },
    deviceProfile
  });

  return outcome;
}
