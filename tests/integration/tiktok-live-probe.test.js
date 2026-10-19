import { describe, expect, it } from 'vitest';
import {
    classifyLiveWatch,
    describeLiveWatchState,
    isTikTokPlaybackUrl,
    normalizeTikTokUsername,
    parseTikTokLiveHtml,
    pickTikTokPlayback,
    tiktokLivePageUrl
} from '../../src/lib/helpers/tiktokLive.js';

function pageHtml(liveRoom) {
    return `<html><script id="SIGI_STATE" type="application/json">${JSON.stringify({
        LiveRoom: liveRoom
    })}</script></html>`;
}

describe('tiktok live probe', () => {
    it('reads the room id and name from the live page payload', () => {
        const parsed = parseTikTokLiveHtml(pageHtml({
            liveRoomUserInfo: {
                user: {
                    uniqueId: 'tierisonn',
                    nickname: 'tierison',
                    roomId: '7698070297372412693',
                    status: 2
                },
                liveRoom: { title: 'Hello', status: 2 }
            }
        }));

        expect(parsed.ok).toBe(true);
        expect(parsed.nickname).toBe('tierison');
        expect(parsed.roomId).toBe('7698070297372412693');
        expect(parsed.title).toBe('Hello');
    });

    it('plays a public flv url from the room payload', () => {
        const watch = classifyLiveWatch({
            playbackUrl: 'https://pull-flv.tiktokcdn-eu.com/stage/stream_hd.flv',
            playbackType: 'flv'
        });

        expect(watch.watchState).toBe('live');
        expect(watch.playbackType).toBe('flv');
        expect(watch.playbackUrl).toContain('_hd.flv');
        expect(describeLiveWatchState(watch.watchState)).toBe('Live');
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
            ageRestricted: true,
            playbackUrl: 'https://pull-flv.tiktokcdn-eu.com/stage/stream.flv',
            playbackType: 'flv'
        });

        expect(watch.watchState).toBe('age-gated');
        expect(watch.isLive).toBe(true);
        expect(watch.playbackUrl).toBeNull();
        expect(describeLiveWatchState(watch.watchState)).toBe('Live, age login required');
        expect(isTikTokPlaybackUrl('http://pull.tiktokcdn.com/a.flv')).toBe(false);
    });

    it('falls back to the default username when the query is unsafe', () => {
        expect(normalizeTikTokUsername(' @tierisonn ')).toBe('tierisonn');
        expect(normalizeTikTokUsername('../admin')).toBe('tierisonn');
        expect(tiktokLivePageUrl('tierisonn')).toBe('https://www.tiktok.com/@tierisonn/live');
    });

    it('reports a missing payload', () => {
        expect(parseTikTokLiveHtml('<html></html>').ok).toBe(false);
    });
});
