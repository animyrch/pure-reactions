const USERNAME_PATTERN = /^[A-Za-z0-9._]{2,24}$/;

export const DEFAULT_TIKTOK_LIVE_USERNAME = 'tierisonn';

export function normalizeTikTokUsername(value) {
    const username = String(value || '')
        .trim()
        .replace(/^@/, '');
    return USERNAME_PATTERN.test(username) ? username : DEFAULT_TIKTOK_LIVE_USERNAME;
}

export function tiktokLivePageUrl(username) {
    return `https://www.tiktok.com/@${username}/live`;
}

export function isTikTokPlaybackUrl(value) {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:') return false;
        const host = url.hostname.toLowerCase();
        return (
            host.endsWith('.tiktokcdn.com') ||
            host.endsWith('.tiktokcdn-eu.com') ||
            host.endsWith('.tiktokcdn-us.com') ||
            host.endsWith('.tiktokcdn-in.com')
        );
    } catch {
        return false;
    }
}

function streamCodec(entry) {
    try {
        return JSON.parse(entry?.main?.sdk_params || '{}').VCodec || '';
    } catch {
        return '';
    }
}

export function pickTikTokPlayback(room) {
    const pullRaw = room?.stream_url?.live_core_sdk_data?.pull_data?.stream_data;
    if (typeof pullRaw !== 'string') return null;

    let parsed;
    try {
        parsed = JSON.parse(pullRaw);
    } catch {
        return null;
    }

    const candidates = [];
    for (const [name, entry] of Object.entries(parsed?.data || {})) {
        const flvUrl = entry?.main?.flv;
        if (name === 'ao' || typeof flvUrl !== 'string' || !flvUrl.startsWith('https://')) continue;
        const codec = String(streamCodec(entry)).toLowerCase();
        if (codec.includes('265') || codec.includes('hevc')) continue;
        let path = '';
        try {
            path = new URL(flvUrl).pathname;
        } catch {
            continue;
        }
        const score = /_hd\.flv$/i.test(path) ? 3 : /hd5/i.test(path) ? 0 : 2;
        candidates.push({ flvUrl, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates.find((candidate) => candidate.score > 0);
    if (!best) return null;
    return { playbackUrl: best.flvUrl, playbackType: 'flv' };
}

export function classifyLiveWatch({
    playbackUrl = '',
    playbackType = '',
    ageRestricted = false
} = {}) {
    if (ageRestricted) {
        return {
            watchState: 'age-gated',
            isLive: true,
            ageGated: true,
            playbackUrl: null,
            playbackType: null,
            detail: 'This LIVE is on, but TikTok asks for an age login before the video plays.'
        };
    }

    if (playbackType === 'flv' && isTikTokPlaybackUrl(playbackUrl)) {
        return {
            watchState: 'live',
            isLive: true,
            ageGated: false,
            playbackUrl,
            playbackType: 'flv',
            detail: 'Playing the public live stream.'
        };
    }

    return {
        watchState: 'offline',
        isLive: false,
        ageGated: false,
        playbackUrl: null,
        playbackType: null,
        detail: 'The TikTok live page did not start a public video.'
    };
}

export function describeLiveWatchState(state) {
    if (state === 'live') return 'Live';
    if (state === 'age-gated') return 'Live, age login required';
    if (state === 'offline') return 'Offline';
    return 'Unavailable';
}

export function parseTikTokLiveHtml(html) {
    const match = String(html || '').match(
        /<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/
    );
    if (!match) {
        return { ok: false, error: 'TikTok did not return a live-room payload.' };
    }

    let state;
    try {
        state = JSON.parse(match[1]);
    } catch {
        return { ok: false, error: 'TikTok live-room payload could not be read.' };
    }

    const user = state?.LiveRoom?.liveRoomUserInfo?.user || {};
    const liveRoom = state?.LiveRoom?.liveRoomUserInfo?.liveRoom || {};

    return {
        ok: true,
        nickname: user.nickname || '',
        roomId: user.roomId ? String(user.roomId) : '',
        title: liveRoom.title || ''
    };
}
