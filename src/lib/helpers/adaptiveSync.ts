import { executeAdaptiveSync, YouTubePlayerAdapter } from '$lib/sync';
import { detectDeviceProfile } from '$lib/helpers/deviceProfile';

export type RunAdaptiveSyncOptions = {
  timeOffset?: number;
  seekMin?: number;
  seekMax?: number;
};

export async function runAdaptiveSync(
  originalPlayer: any,
  reactionCurrentTime: number,
  options: RunAdaptiveSyncOptions = {}
) {
  const playerAdapter = new YouTubePlayerAdapter(originalPlayer);
  const deviceProfile = detectDeviceProfile();

  const outcome = await executeAdaptiveSync({
    originalPlayer: playerAdapter,
    reactionCurrentTime,
    reactionConfig: {
      timeOffset: options.timeOffset || 0,
      seekMin: options.seekMin || 0,
      seekMax: options.seekMax || 999999
    },
    deviceProfile
  });

  return outcome;
}
