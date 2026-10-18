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

export function isTikTokLiveStatus(status) {
    return Number(status) === TIKTOK_STATUS_LIVE;
}

export function describeTikTokLiveStatus(status) {
    const value = Number(status);
    if (value === TIKTOK_STATUS_LIVE) return 'Live';
    if (value === 2) return 'Offline';
    if (!Number.isFinite(value)) return 'Unknown';
    return `Status ${value}`;
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
