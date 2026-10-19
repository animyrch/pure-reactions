import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { classifyLiveWatch } from '$lib/helpers/tiktokLive';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

const CACHE_MS = 15000;
const cache = new Map();
let browserPromise = null;
let installAttempted = false;

function remember(username, value) {
    cache.set(username, { at: Date.now(), value });
    return value;
}

async function openChromium(chromium) {
    try {
        return await chromium.launch({ headless: true });
    } catch (error) {
        const missing = /Executable doesn't exist/i.test(String(error?.message || ''));
        if (missing && !installAttempted) {
            installAttempted = true;
            const cli = require.resolve('playwright/cli');
            await execFileAsync(process.execPath, [cli, 'install', 'chromium'], {
                timeout: 180000,
                env: process.env
            });
            return chromium.launch({ headless: true });
        }

        try {
            return await chromium.launch({ channel: 'chrome', headless: true });
        } catch {
            throw error;
        }
    }
}

async function launchBrowser() {
    if (browserPromise) {
        const existing = await browserPromise.catch(() => null);
        if (existing?.isConnected()) return existing;
        browserPromise = null;
    }

    browserPromise = import('@playwright/test')
        .then(({ chromium }) => openChromium(chromium))
        .catch((error) => {
            browserPromise = null;
            throw error;
        });
    return browserPromise;
}

function playbackFromRoomEnter(payload) {
    const pullRaw = payload?.data?.stream_url?.live_core_sdk_data?.pull_data?.stream_data;
    if (typeof pullRaw !== 'string') return null;

    let parsed;
    try {
        parsed = JSON.parse(pullRaw);
    } catch {
        return null;
    }

    const entries = parsed?.data || {};
    for (const name of ['hd', 'sd', 'ld', 'origin']) {
        const flvUrl = entries[name]?.main?.flv;
        if (typeof flvUrl === 'string' && flvUrl.startsWith('https://')) {
            return { playbackUrl: flvUrl, playbackType: 'flv' };
        }
    }

    return null;
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
            return unavailable('Could not open the TikTok live page from this machine.');
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
        let fallbackUrl = '';
        let fallbackType = '';
        let roomEnterPromise = null;

        page.on('response', (response) => {
            if (response.status() !== 200) return;
            const contentType = response.headers()['content-type'] || '';
            if (response.url().includes('/webcast/room/enter')) {
                roomEnterPromise = response
                    .json()
                    .then((payload) => playbackFromRoomEnter(payload))
                    .catch(() => null);
                return;
            }
            if (fallbackUrl) return;
            if (contentType.includes('video/x-flv')) {
                fallbackUrl = response.url();
                fallbackType = 'flv';
            } else if (contentType.includes('mpegurl')) {
                fallbackUrl = response.url();
                fallbackType = 'hls';
            }
        });

        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const started = Date.now();
        let bodyText = '';
        let videoCount = 0;
        while (Date.now() - started < 12000) {
            if (roomEnterPromise) {
                const picked = await roomEnterPromise;
                if (picked) {
                    playbackUrl = picked.playbackUrl;
                    playbackType = picked.playbackType;
                }
            }
            bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => bodyText);
            videoCount = await page.locator('video').count();
            if (/log in to confirm your age/i.test(bodyText) && videoCount < 1) break;
            if (playbackUrl && videoCount > 0) break;
            await page.waitForTimeout(400);
        }

        if (!playbackUrl) {
            playbackUrl = fallbackUrl;
            playbackType = fallbackType;
        }
        return remember(
            username,
            classifyLiveWatch({ bodyText, videoCount, playbackUrl, playbackType })
        );
    } finally {
        await page?.close().catch(() => {});
    }
}
