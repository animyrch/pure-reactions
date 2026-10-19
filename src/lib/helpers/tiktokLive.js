const TIKTOK_STATUS_LIVE = 4;
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

export function tiktokLiveEmbedUrl(username) {
    return `https://www.tiktok.com/embed/@${username}/live`;
}

const AGE_GATE_TEXT = /log in to confirm your age/i;

export function isTikTokLiveStatus(status) {
    return Number(status) === TIKTOK_STATUS_LIVE;
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
    bodyText = '',
    videoCount = 0,
    playbackUrl = '',
    playbackType = '',
    ageRestricted = false
} = {}) {
    const ageGated = Boolean(ageRestricted) || (AGE_GATE_TEXT.test(bodyText) && Number(videoCount) < 1);
    if (ageGated) {
        return {
            watchState: 'age-gated',
            isLive: true,
            ageGated: true,
            playbackUrl: null,
            playbackType: null,
            detail: 'This LIVE is on, but TikTok asks for an age login before the video plays. The embed hides that and says the creator is offline.'
        };
    }

    const type = playbackType === 'hls' ? 'hls' : playbackType === 'flv' ? 'flv' : null;
    if (isTikTokPlaybackUrl(playbackUrl) && type) {
        return {
            watchState: 'live',
            isLive: true,
            ageGated: false,
            playbackUrl,
            playbackType: type,
            detail: 'Playing the same public stream as the TikTok live page. Their embed player still reports this room as offline.'
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

    const room = state?.LiveRoom || {};
    const info = room.liveRoomUserInfo || {};
    const user = info.user || {};
    const liveRoom = info.liveRoom || {};
    const userStatus = Number(user.status);
    const roomStatus = Number(liveRoom.status);

    return {
        ok: true,
        uniqueId: user.uniqueId || '',
        nickname: user.nickname || '',
        avatarUrl: user.avatarThumb || user.avatarMedium || '',
        roomId: user.roomId ? String(user.roomId) : '',
        signature: user.signature || '',
        userStatus: Number.isFinite(userStatus) ? userStatus : null,
        roomStatus: Number.isFinite(roomStatus) ? roomStatus : null,
        title: liveRoom.title || '',
        viewerCount: liveRoom.liveRoomStats?.userCount ?? null,
        isLive: isTikTokLiveStatus(userStatus) || isTikTokLiveStatus(roomStatus)
    };
}
