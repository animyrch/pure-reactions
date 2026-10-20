import { describe, it, expect } from 'vitest';
import {
    buildTwitchChatUrl,
    buildTwitchPlayerUrl,
    normalizeTwitchChannel,
} from '../../src/lib/helpers/twitchChannel.js';

describe('normalizeTwitchChannel', () => {
    it('treats blank values as not set', () => {
        expect(normalizeTwitchChannel('')).toBe('');
        expect(normalizeTwitchChannel('   ')).toBe('');
        expect(normalizeTwitchChannel(null)).toBe('');
        expect(normalizeTwitchChannel(undefined)).toBe('');
    });

    it('accepts a channel login and lowercases it', () => {
        expect(normalizeTwitchChannel('Animy_TR')).toBe('animy_tr');
        expect(normalizeTwitchChannel('@nightbot')).toBe('nightbot');
    });

    it('accepts twitch.tv links and player urls', () => {
        expect(normalizeTwitchChannel('https://www.twitch.tv/Animy_TR/')).toBe('animy_tr');
        expect(normalizeTwitchChannel('twitch.tv/animy_tr/videos')).toBe('animy_tr');
        expect(normalizeTwitchChannel('https://player.twitch.tv/?channel=animy_tr&parent=localhost')).toBe('animy_tr');
        expect(normalizeTwitchChannel('https://m.twitch.tv/animy_tr')).toBe('animy_tr');
    });

    it('rejects names and links that are not a channel', () => {
        expect(normalizeTwitchChannel('no')).toBeNull();
        expect(normalizeTwitchChannel('has spaces')).toBeNull();
        expect(normalizeTwitchChannel('https://example.com/animy_tr')).toBeNull();
        expect(normalizeTwitchChannel('https://clips.twitch.tv/SomeClip')).toBeNull();
    });
});

describe('twitch embed urls', () => {
    it('does not invent a channel when none is configured', () => {
        expect(buildTwitchPlayerUrl('', 'localhost')).toBe('');
        expect(buildTwitchChatUrl(null, 'localhost')).toBe('');
        expect(buildTwitchPlayerUrl('animy_tr', '')).toBe('');
    });

    it('builds player and chat urls for the configured channel', () => {
        expect(buildTwitchPlayerUrl('Animy_TR', 'localhost')).toBe(
            'https://player.twitch.tv/?channel=animy_tr&parent=localhost'
        );
        expect(buildTwitchChatUrl('animy_tr', 'example.com')).toBe(
            'https://www.twitch.tv/embed/animy_tr/chat?parent=example.com'
        );
    });
});
