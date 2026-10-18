import { normalizeTikTokUsername } from '$lib/helpers/tiktokLive';
import { watchTikTokLivePage } from '$lib/server/tiktokLivePlayback';
import { probeTikTokLive } from '$lib/server/tiktokLiveProbe';

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const DEFAULT_ORIGINAL_VIDEO_ID = 'M7lc1UVf-VE';

export async function load({ url }) {
    const username = normalizeTikTokUsername(url.searchParams.get('user'));
    const requestedVideoId = url.searchParams.get('v') || '';
    const originalVideoId = YOUTUBE_ID_PATTERN.test(requestedVideoId)
        ? requestedVideoId
        : DEFAULT_ORIGINAL_VIDEO_ID;
    const profile = await probeTikTokLive(username);
    const watch = await watchTikTokLivePage(profile.pageUrl, profile.uniqueId);

    return {
        originalVideoId,
        live: {
            ...profile,
            ...watch
        }
    };
}
