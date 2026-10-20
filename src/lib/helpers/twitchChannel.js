const CHANNEL_PATTERN = /^[a-z0-9][a-z0-9_]{3,24}$/;

const readTwitchCandidate = (value) => {
    const raw = String(value).trim();
    if (!raw) {
        return '';
    }

    const looksLikeUrl = /^https?:\/\//i.test(raw) || /^(?:[\w-]+\.)?twitch\.tv\//i.test(raw);
    if (!looksLikeUrl) {
        return raw;
    }

    try {
        const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        const url = new URL(withProtocol);
        const host = url.hostname.replace(/^www\./i, '').toLowerCase();

        if (host === 'player.twitch.tv') {
            return url.searchParams.get('channel') || '';
        }

        if (host === 'twitch.tv' || host === 'm.twitch.tv') {
            return url.pathname.split('/').filter(Boolean)[0] || '';
        }
    } catch {
        return null;
    }

    return null;
};

// Blank input is "not set". A non-blank value that is not a channel login returns null.
export const normalizeTwitchChannel = (value) => {
    if (value == null) {
        return '';
    }

    const candidate = readTwitchCandidate(value);
    if (candidate == null) {
        return null;
    }

    const channel = String(candidate).trim().replace(/^@+/, '').toLowerCase();
    if (!channel) {
        return '';
    }

    return CHANNEL_PATTERN.test(channel) ? channel : null;
};

export const buildTwitchChannelUrl = (channel) => {
    const normalized = normalizeTwitchChannel(channel);
    if (!normalized) {
        return '';
    }

    return `https://www.twitch.tv/${encodeURIComponent(normalized)}`;
};

export const buildTwitchPlayerUrl = (channel, parentHostname) => {
    const normalized = normalizeTwitchChannel(channel);
    const parent = typeof parentHostname === 'string' ? parentHostname.trim() : '';
    if (!normalized || !parent) {
        return '';
    }

    return `https://player.twitch.tv/?channel=${encodeURIComponent(normalized)}&parent=${encodeURIComponent(parent)}`;
};

export const buildTwitchChatUrl = (channel, parentHostname) => {
    const normalized = normalizeTwitchChannel(channel);
    const parent = typeof parentHostname === 'string' ? parentHostname.trim() : '';
    if (!normalized || !parent) {
        return '';
    }

    return `https://www.twitch.tv/embed/${encodeURIComponent(normalized)}/chat?parent=${encodeURIComponent(parent)}`;
};
