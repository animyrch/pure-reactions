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

/**
 * Extracts a TikTok video ID from a URL or returns the raw value if it
 * looks like a bare numeric TikTok video ID.
 *
 * Supported formats:
 *   https://www.tiktok.com/@username/video/7056208472144235823
 *   https://www.tiktok.com/@username/video/7056208472144235823?_r=1
 *
 * Note: Short links (vm.tiktok.com) cannot be resolved client-side and are
 * not supported — this function returns null for them.
 *
 * @param {string} url
 * @returns {string | null}
 */
export const extractTikTokVideoId = (url) => {
  if (!url) return null;
  const trimmed = url.trim();
  // Reject vm.tiktok.com short links — they require server-side resolution
  if (/vm\.tiktok\.com/i.test(trimmed)) return null;
  // Full URL: https://www.tiktok.com/@<handle>/video/<numeric_id>
  const longMatch = trimmed.match(/tiktok\.com\/@[^/?#]+\/video\/(\d+)/);
  if (longMatch) return longMatch[1];
  // Bare numeric ID (15-20 digits)
  if (/^\d{15,20}$/.test(trimmed)) return trimmed;
  return null;
};

/**
 * Returns the TikTok player/v1 embed URL for a given video ID.
 * Uses the documented player/v1 API which supports postMessage control
 * (play, pause, mute, unmute).
 *
 * @param {string} videoId
 * @returns {string}
 */
export const getTikTokEmbedUrl = (videoId) =>
  `https://www.tiktok.com/player/v1/${videoId}?autoplay=0&muted=0&controls=1&play_button=1&volume_control=1&fullscreen_button=1&description=1`;
