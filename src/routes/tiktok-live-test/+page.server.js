import { normalizeTikTokUsername } from '$lib/helpers/tiktokLive';
import { watchTikTokLivePage } from '$lib/server/tiktokLivePlayback';

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const DEFAULT_ORIGINAL_VIDEO_ID = 'M7lc1UVf-VE';

export async function load({ url }) {
    const username = normalizeTikTokUsername(url.searchParams.get('user'));
    const requestedVideoId = url.searchParams.get('v') || '';
    const originalVideoId = YOUTUBE_ID_PATTERN.test(requestedVideoId)
        ? requestedVideoId
        : DEFAULT_ORIGINAL_VIDEO_ID;

    return {
        originalVideoId,
        live: await watchTikTokLivePage(username)
    };
}
