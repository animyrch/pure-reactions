import {
    classifyLiveWatch,
    parseTikTokLiveHtml,
    pickTikTokPlayback,
    tiktokLivePageUrl
} from '$lib/helpers/tiktokLive';

const CACHE_MS = 15000;
const cache = new Map();
const BROWSER_USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function remember(username, value) {
    cache.set(username, { at: Date.now(), value });
    return value;
}

function cookieHeader(response) {
    const cookies =
        typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    if (cookies.length > 0) {
        return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
    }
    return response.headers.get('set-cookie') || '';
}

function unavailable(detail) {
    return {
        watchState: 'unavailable',
        isLive: false,
        ageGated: false,
        playbackUrl: null,
        playbackType: null,
        detail
    };
}

async function fetchLivePage(pageUrl) {
    const response = await fetch(pageUrl, {
        headers: {
            'user-agent': BROWSER_USER_AGENT,
            accept: 'text/html,application/xhtml+xml',
            'accept-language': 'en-US,en;q=0.9'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000)
    });
    return {
        html: await response.text(),
        cookie: cookieHeader(response),
        ok: response.ok
    };
}

async function fetchRoomInfo(roomId, pageUrl, cookie) {
    const params = new URLSearchParams({
        aid: '1988',
        app_language: 'en',
        app_name: 'tiktok_web',
        browser_language: 'en-US',
        browser_name: 'Mozilla',
        browser_online: 'true',
        cookie_enabled: 'true',
        device_platform: 'web_pc',
        room_id: roomId
    });
    const response = await fetch(`https://webcast.tiktok.com/webcast/room/info/?${params}`, {
        headers: {
            'user-agent': BROWSER_USER_AGENT,
            accept: 'application/json, text/plain, */*',
            referer: pageUrl,
            cookie
        },
        signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (payload?.status_code && payload.status_code !== 0) return null;
    return payload?.data || null;
}

export async function watchTikTokLivePage(pageUrl, username) {
    const cached = cache.get(username);
    if (cached && Date.now() - cached.at < CACHE_MS) {
        return cached.value;
    }

    const livePageUrl = pageUrl || tiktokLivePageUrl(username);

    try {
        const page = await fetchLivePage(livePageUrl);
        const parsed = page.ok ? parseTikTokLiveHtml(page.html) : { ok: false };
        if (!parsed.roomId) {
            return remember(username, classifyLiveWatch());
        }

        const room = await fetchRoomInfo(parsed.roomId, livePageUrl, page.cookie);
        const playback = pickTikTokPlayback(room) || {};
        const watch = classifyLiveWatch({
            ageRestricted: Boolean(room?.age_restricted?.restricted),
            playbackUrl: playback.playbackUrl,
            playbackType: playback.playbackType
        });

        return remember(username, {
            ...watch,
            ...(room?.title ? { title: room.title } : {})
        });
    } catch (error) {
        console.error('TikTok live watch failed:', error);
        return unavailable('Could not reach TikTok to check this LIVE.');
    }
}
