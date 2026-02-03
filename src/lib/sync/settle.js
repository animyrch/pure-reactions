/**
 * Settle Strategy Helpers
 * 
 * Wait for player to stabilize after seek operations.
 * Isolated side effects for timing.
 */

/**
 * Default settle duration (milliseconds)
 * Time to wait after seek for player to buffer, decode, and resume
 */
export const DEFAULT_SETTLE_MS = 500;

/**
 * Wait for player to settle after a seek operation
 * 
 * After seeking, YouTube player needs time to:
 * - Buffer new segment
 * - Decode frames
 * - Resume audio pipeline
 * - Update getCurrentTime() reliably
 * 
 * @param {number} [durationMs] - How long to wait (default: DEFAULT_SETTLE_MS)
 * @returns {Promise<void>} Promise that resolves when settle period completes
 */
export async function waitForPlayerSettle(
  durationMs = DEFAULT_SETTLE_MS
) {
  return new Promise(resolve => {
    setTimeout(resolve, durationMs);
  });
}

/**
 * Sample player time multiple times and return median
 * 
 * Helps filter out transient spikes in getCurrentTime() readings
 * during settle period.
 * 
 * @param {function(): number} getTime - Function to get current player time
 * @param {number} [sampleCount] - Number of samples to take
 * @param {number} [intervalMs] - Time between samples
 * @returns {Promise<number>} Promise that resolves to median time
 */
export async function samplePlayerTimeMedian(
  getTime,
  sampleCount = 3,
  intervalMs = 100
) {
  const samples = [];
  
  for (let i = 0; i < sampleCount; i++) {
    samples.push(getTime());
    
    if (i < sampleCount - 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
  
  // Calculate median
  samples.sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  
  if (samples.length % 2 === 0) {
    return (samples[mid - 1] + samples[mid]) / 2;
  }
  
  return samples[mid];
}
