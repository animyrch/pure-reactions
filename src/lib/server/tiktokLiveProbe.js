import {
    normalizeTikTokUsername,
    parseTikTokLiveHtml,
    tiktokLiveEmbedUrl,
    tiktokLivePageUrl
} from '$lib/helpers/tiktokLive';

const BROWSER_USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function framingFromHeaders(headers) {
    const xFrameOptions = headers.get('x-frame-options') || '';
    const csp = headers.get('content-security-policy') || '';
    const frameAncestors = csp.match(/frame-ancestors[^;]*/i)?.[0] || '';
    const blockedByAncestor =
        /frame-ancestors\s+(?:'none'|'self')/i.test(frameAncestors) &&
        !/frame-ancestors[^;]*\*/i.test(frameAncestors);
    return {
        xFrameOptions: xFrameOptions || null,
        frameAncestors: frameAncestors || null,
        frameable: !xFrameOptions && !blockedByAncestor
    };
}

async function fetchText(url) {
    const response = await fetch(url, {
        headers: {
            'user-agent': BROWSER_USER_AGENT,
            accept: 'text/html,application/xhtml+xml',
            'accept-language': 'en-US,en;q=0.9'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000)
    });
    const html = await response.text();
    return { response, html };
}

export async function probeTikTokLive(username) {
    const uniqueId = normalizeTikTokUsername(username);
    const pageUrl = tiktokLivePageUrl(uniqueId);
    const embedUrl = tiktokLiveEmbedUrl(uniqueId);
    const checkedAt = new Date().toISOString();

    try {
        const [{ response, html }, embedResponse] = await Promise.all([
            fetchText(pageUrl),
            fetch(embedUrl, {
                method: 'HEAD',
                headers: { 'user-agent': BROWSER_USER_AGENT },
                redirect: 'manual',
                signal: AbortSignal.timeout(15000)
            }).catch((error) => ({ error }))
        ]);

        const parsed = response.ok
            ? parseTikTokLiveHtml(html)
            : { ok: false, error: `TikTok returned ${response.status}.` };
        const embedHeaders = embedResponse?.headers ? framingFromHeaders(embedResponse.headers) : null;

        return {
            uniqueId,
            pageUrl,
            embedUrl,
            checkedAt,
            httpStatus: response.status,
            pageFraming: framingFromHeaders(response.headers),
            embedFraming: embedHeaders,
            embedHeadStatus: embedResponse?.status ?? null,
            embedHeadError: embedResponse?.error
                ? String(embedResponse.error.message || embedResponse.error)
                : null,
            ...parsed
        };
    } catch (error) {
        return {
            ok: false,
            uniqueId,
            pageUrl,
            embedUrl,
            checkedAt,
            error: error?.name === 'TimeoutError' ? 'TikTok took too long to answer.' : 'Could not reach TikTok.',
            isLive: false
        };
    }
}
