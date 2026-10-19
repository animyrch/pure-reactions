import { describe, expect, it } from 'vitest';
import {
    classifyLiveWatch,
    describeLiveWatchState,
    isTikTokLiveStatus,
    isTikTokPlaybackUrl,
    normalizeTikTokUsername,
    parseTikTokLiveHtml,
    pickTikTokPlayback,
    tiktokLiveEmbedUrl
} from '../../src/lib/helpers/tiktokLive.js';

function pageHtml(liveRoom) {
    return `<html><script id="SIGI_STATE" type="application/json">${JSON.stringify({
        LiveRoom: liveRoom
    })}</script></html>`;
}

describe('tiktok live probe', () => {
    it('reads an offline room from the live page payload', () => {
        const parsed = parseTikTokLiveHtml(pageHtml({
            liveRoomUserInfo: {
                user: {
                    uniqueId: 'tierisonn',
                    nickname: 'tierison',
                    roomId: '7698070297372412693',
                    status: 2,
                    avatarThumb: 'https://example.com/a.jpg'
                },
                liveRoom: {
                    title: '',
                    status: 2,
                    liveRoomStats: { userCount: 0 }
                }
            }
        }));

        expect(parsed.ok).toBe(true);
        expect(parsed.isLive).toBe(false);
        expect(parsed.uniqueId).toBe('tierisonn');
        expect(parsed.nickname).toBe('tierison');
        expect(parsed.roomId).toBe('7698070297372412693');
        expect(parsed.isLive).toBe(false);
    });

    it('does not trust the logged-out status field when the live page is playing', () => {
        const watch = classifyLiveWatch({
            bodyText: 'StayCalmCam Follow',
            videoCount: 1,
            playbackUrl: 'https://pull-flv.tiktokcdn-eu.com/stage/stream.flv',
            playbackType: 'flv'
        });

        expect(watch.watchState).toBe('live');
        expect(watch.playbackType).toBe('flv');
        expect(describeLiveWatchState(watch.watchState)).toBe('Live');
    });

    it('plays a public stream url without a browser video element', () => {
        const watch = classifyLiveWatch({
            playbackUrl: 'https://pull-flv.tiktokcdn-eu.com/stage/stream_hd.flv',
            playbackType: 'flv'
        });

        expect(watch.watchState).toBe('live');
        expect(watch.playbackUrl).toContain('_hd.flv');
    });

    it('prefers the h264 hd stream over the hevc rendition', () => {
        const picked = pickTikTokPlayback({
            stream_url: {
                live_core_sdk_data: {
                    pull_data: {
                        stream_data: JSON.stringify({
                            data: {
                                hd: {
                                    main: {
                                        flv: 'https://pull-flv.tiktokcdn-eu.com/stage/stream_hd.flv',
                                        sdk_params: JSON.stringify({ VCodec: 'h264' })
                                    }
                                },
                                origin: {
                                    main: {
                                        flv: 'https://pull-flv.tiktokcdn-eu.com/stage/stream_hd5.flv',
                                        sdk_params: JSON.stringify({ VCodec: 'h265' })
                                    }
                                }
                            }
                        })
                    }
                }
            }
        });

        expect(picked.playbackUrl).toBe('https://pull-flv.tiktokcdn-eu.com/stage/stream_hd.flv');
    });

    it('keeps an age-gated live from playing and does not call it offline', () => {
        const watch = classifyLiveWatch({
            bodyText: 'Log in to confirm your age. This LIVE may not be comfortable for some audiences.',
            videoCount: 0,
            playbackUrl: 'https://pull-flv.tiktokcdn-eu.com/stage/stream.flv',
            playbackType: 'flv'
        });

        expect(watch.watchState).toBe('age-gated');
        expect(watch.isLive).toBe(true);
        expect(watch.playbackUrl).toBeNull();
        expect(isTikTokPlaybackUrl('http://pull.tiktokcdn.com/a.flv')).toBe(false);
    });

    it('treats status 4 as live', () => {
        const parsed = parseTikTokLiveHtml(pageHtml({
            liveRoomUserInfo: {
                user: { uniqueId: 'someone', nickname: 'Someone', status: 4, roomId: '1' },
                liveRoom: { title: 'Hello', status: 4, liveRoomStats: { userCount: 12 } }
            }
        }));

        expect(isTikTokLiveStatus(4)).toBe(true);
        expect(parsed.isLive).toBe(true);
        expect(parsed.viewerCount).toBe(12);
        expect(parsed.title).toBe('Hello');
    });

    it('falls back to the requested username when the query is unsafe', () => {
        expect(normalizeTikTokUsername(' @tierisonn ')).toBe('tierisonn');
        expect(normalizeTikTokUsername('../admin')).toBe('tierisonn');
        expect(tiktokLiveEmbedUrl('tierisonn')).toBe('https://www.tiktok.com/embed/@tierisonn/live');
    });

    it('reports a missing payload', () => {
        expect(parseTikTokLiveHtml('<html></html>').ok).toBe(false);
    });
});
