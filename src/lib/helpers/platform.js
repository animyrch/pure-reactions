/**
 * Platform support helpers for original-video platform detection and
 * capability enforcement.
 *
 * TikTok originals have reduced capabilities compared to YouTube:
 *  - No playback-rate control
 *  - Volume is binary: 0 (mute) or 100 (unmute). Any value <100 is treated as mute.
 */

export const ORIGINAL_VIDEO_PLATFORMS = /** @type {const} */ ({
  YOUTUBE: 'youtube',
  TIKTOK: 'tiktok',
});

/**
 * Normalizes a raw platform value to a known platform string.
 * Defaults to 'youtube' for any unknown or missing value.
 *
 * @param {unknown} value
 * @returns {'youtube' | 'tiktok'}
 */
export const normalizeOriginalVideoPlatform = (value) => {
  if (value === ORIGINAL_VIDEO_PLATFORMS.TIKTOK) return ORIGINAL_VIDEO_PLATFORMS.TIKTOK;
  return ORIGINAL_VIDEO_PLATFORMS.YOUTUBE;
};

/**
 * Returns true if the given platform is TikTok.
 *
 * @param {string | undefined | null} platform
 * @returns {boolean}
 */
export const isTikTokPlatform = (platform) =>
  platform === ORIGINAL_VIDEO_PLATFORMS.TIKTOK;

/**
 * Snaps a volume value to a TikTok-compatible value (0 or 100).
 * Per platform constraints, any value < 100 is treated as mute (0).
 *
 * @param {number} volume
 * @returns {0 | 100}
 */
export const snapVolumeForTikTok = (volume) => (volume >= 100 ? 100 : 0);
