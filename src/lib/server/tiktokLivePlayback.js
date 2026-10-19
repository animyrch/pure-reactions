import { classifyLiveWatch } from '$lib/helpers/tiktokLive';

const CACHE_MS = 15000;
const cache = new Map();
let browserPromise = null;

function remember(username, value) {
    cache.set(username, { at: Date.now(), value });
    return value;
}

async function launchBrowser() {
    if (browserPromise) {
        const existing = await browserPromise.catch(() => null);
        if (existing?.isConnected()) return existing;
        browserPromise = null;
    }

    browserPromise = import('@playwright/test')
        .then(({ chromium }) => chromium.launch({ headless: true }))
        .catch((error) => {
            browserPromise = null;
            throw error;
        });
    return browserPromise;
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

export async function watchTikTokLivePage(pageUrl, username) {
    const cached = cache.get(username);
    if (cached && Date.now() - cached.at < CACHE_MS) {
        return cached.value;
    }

    try {
        return await readLivePage(pageUrl, username);
    } catch (error) {
        browserPromise = null;
        try {
            return await readLivePage(pageUrl, username);
        } catch (retryError) {
            console.error('TikTok live watch failed:', retryError || error);
            const message = String(retryError?.message || error?.message || error).split('\n')[0].slice(0, 180);
            return unavailable(message || 'Could not open the TikTok live page to check the real player.');
        }
    }
}

async function readLivePage(pageUrl, username) {
    let page = null;
    try {
        const browser = await launchBrowser();
        page = await browser.newPage({ viewport: { width: 900, height: 800 } });
        let playbackUrl = '';
        let playbackType = '';

        page.on('response', (response) => {
            if (playbackUrl || response.status() !== 200) return;
            const contentType = response.headers()['content-type'] || '';
            if (contentType.includes('video/x-flv')) {
                playbackUrl = response.url();
                playbackType = 'flv';
            } else if (contentType.includes('mpegurl')) {
                playbackUrl = response.url();
                playbackType = 'hls';
            }
        });

        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const started = Date.now();
        let bodyText = '';
        while (Date.now() - started < 12000) {
            bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => bodyText);
            if (playbackUrl || /log in to confirm your age/i.test(bodyText)) break;
            await page.waitForTimeout(400);
        }

        const videoCount = await page.locator('video').count();
        return remember(
            username,
            classifyLiveWatch({ bodyText, videoCount, playbackUrl, playbackType })
        );
    } finally {
        await page?.close().catch(() => {});
    }
}
