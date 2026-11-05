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

const TIKTOK_VIDEO_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com']);
const TIKTOK_HANDLE_PATTERN = /^[A-Za-z0-9._]{1,24}$/;
const TIKTOK_VIDEO_ID_PATTERN = /^\d{1,20}$/;
const TIKTOK_BARE_VIDEO_ID_PATTERN = /^\d{15,20}$/;

const tiktokHostname = (url) => url.hostname.toLowerCase().replace(/\.$/, '');

const decodePathSegment = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

/**
 * A TikTok handle is letters, numbers, underscores, and periods.
 * @param {unknown} value
 * @returns {string}
 */
export const sanitizeTikTokHandle = (value) => {
  if (typeof value !== 'string') return '';
  const handle = value.trim().replace(/^@+/, '');
  return TIKTOK_HANDLE_PATTERN.test(handle) ? handle : '';
};

/**
 * @param {unknown} value
 * @returns {string}
 */
export const sanitizeTikTokVideoId = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const videoId = String(value).trim();
  return TIKTOK_VIDEO_ID_PATTERN.test(videoId) ? videoId : '';
};

/**
 * Parses a profile URL on tiktok.com, www.tiktok.com, or m.tiktok.com.
 * @param {unknown} value
 * @returns {string}
 */
export const parseTikTokAuthorHandle = (value) => {
  if (typeof value !== 'string' || !value.trim()) return '';
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return '';
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !TIKTOK_VIDEO_HOSTS.has(tiktokHostname(url))) {
    return '';
  }
  const match = url.pathname.match(/^\/@([^/]+)\/?$/);
  if (!match) return '';
  const handle = decodePathSegment(match[1]);
  return handle ? sanitizeTikTokHandle(handle) : '';
};

/**
 * Parses an http(s) TikTok video URL and returns the canonical https watch URL.
 * The host must be tiktok.com, www.tiktok.com, or m.tiktok.com, and the path
 * must be /@handle/video/{id}. A TikTok path inside another address does not match.
 *
 * @param {unknown} value
 * @returns {{ videoId: string, authorHandle: string, canonicalUrl: string } | null}
 */
export const parseTikTokVideoUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !TIKTOK_VIDEO_HOSTS.has(tiktokHostname(url))) {
    return null;
  }
  const match = url.pathname.match(/^\/@([^/]+)\/video\/(\d+)\/?$/);
  if (!match) return null;
  const decodedHandle = decodePathSegment(match[1]);
  const handle = decodedHandle ? sanitizeTikTokHandle(decodedHandle) : '';
  const videoId = match[2];
  if (!handle || !sanitizeTikTokVideoId(videoId)) {
    return null;
  }
  return {
    videoId,
    authorHandle: handle,
    canonicalUrl: `https://www.tiktok.com/@${handle}/video/${videoId}`,
  };
};

/**
 * Profile URL built only from a safe handle.
 * @param {{ authorHandle?: unknown, authorUrl?: unknown }} [input]
 * @returns {string}
 */
export const resolveTikTokAuthorUrl = ({ authorHandle, authorUrl } = {}) => {
  const handle = sanitizeTikTokHandle(authorHandle)
    || parseTikTokAuthorHandle(authorUrl)
    || parseTikTokVideoUrl(authorUrl)?.authorHandle
    || '';
  return handle ? `https://www.tiktok.com/@${handle}` : '';
};

/**
 * Watch URL built from a parsed TikTok video URL or from a safe handle plus id.
 * The returned address is always https://www.tiktok.com/@handle/video/{id}.
 * @param {{ videoId?: unknown, authorHandle?: unknown, authorUrl?: unknown, originalVideoUrl?: unknown }} [input]
 * @returns {string}
 */
export const resolveTikTokWatchUrl = ({
  videoId,
  authorHandle,
  authorUrl,
  originalVideoUrl,
} = {}) => {
  const parsed = parseTikTokVideoUrl(originalVideoUrl);
  const normalizedVideoId = sanitizeTikTokVideoId(
    typeof videoId === 'number' ? String(videoId) : videoId,
  );
  if (parsed && (!normalizedVideoId || parsed.videoId === normalizedVideoId)) {
    return parsed.canonicalUrl;
  }

  const handle = sanitizeTikTokHandle(authorHandle)
    || parseTikTokAuthorHandle(authorUrl)
    || '';
  const id = normalizedVideoId;
  if (!handle || !id) return '';
  return `https://www.tiktok.com/@${handle}/video/${id}`;
};

/**
 * Fields safe to persist for a TikTok original. Empty strings mean "do not store".
 * @param {{ videoId?: unknown, authorHandle?: unknown, authorUrl?: unknown, originalVideoUrl?: unknown }} [input]
 */
export const canonicalTikTokStorageFields = ({
  videoId,
  authorHandle,
  authorUrl,
  originalVideoUrl,
} = {}) => {
  const watchUrl = resolveTikTokWatchUrl({
    videoId,
    authorHandle,
    authorUrl,
    originalVideoUrl,
  });
  // The canonical watch URL names the creator that the stored video link opens.
  const handle = parseTikTokVideoUrl(watchUrl)?.authorHandle
    || sanitizeTikTokHandle(authorHandle)
    || parseTikTokAuthorHandle(authorUrl)
    || '';
  return {
    originalVideoUrl: watchUrl,
    originalVideoAuthorHandle: handle,
    originalVideoAuthorUrl: resolveTikTokAuthorUrl({ authorHandle: handle, authorUrl }),
  };
};

/**
 * Extracts a TikTok video ID from an https TikTok video URL, or from a bare
 * 15–20 digit id. Short links (vm.tiktok.com) are not supported.
 *
 * @param {string} url
 * @returns {string | null}
 */
export const extractTikTokVideoId = (url) => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const parsed = parseTikTokVideoUrl(trimmed);
  if (parsed) return parsed.videoId;
  if (TIKTOK_BARE_VIDEO_ID_PATTERN.test(trimmed)) return trimmed;
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
export const getTikTokEmbedUrl = (videoId) => {
  const safeId = sanitizeTikTokVideoId(videoId);
  if (!safeId) return '';
  return `https://www.tiktok.com/player/v1/${safeId}?autoplay=0&muted=0&controls=1&play_button=1&volume_control=1&fullscreen_button=1&description=1`;
};
