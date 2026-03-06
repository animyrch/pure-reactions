import { describe, it, expect } from 'vitest';
import { linkifyText } from '../../src/lib/helpers/system.js';

describe('linkifyText', () => {
    it('returns empty string for empty input', () => {
        expect(linkifyText('')).toBe('');
    });

    it('returns empty string for non-string input', () => {
        expect(linkifyText(null)).toBe('');
        expect(linkifyText(undefined)).toBe('');
    });

    it('escapes HTML entities in plain text to prevent XSS', () => {
        const result = linkifyText('<script>alert("xss")</script>');
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;script&gt;');
    });

    it('converts https:// URL to clickable link', () => {
        const result = linkifyText('Visit https://example.com for more info');
        expect(result).toContain('<a href="https://example.com"');
        expect(result).toContain('target="_blank"');
        expect(result).toContain('rel="noopener noreferrer"');
        expect(result).toContain('>https://example.com</a>');
    });

    it('converts http:// URL to clickable link', () => {
        const result = linkifyText('http://example.com');
        expect(result).toContain('<a href="http://example.com"');
    });

    it('converts bare www. URL to clickable link with https:// href', () => {
        const result = linkifyText('go to www.example.com now');
        expect(result).toContain('href="https://www.example.com"');
        expect(result).toContain('>www.example.com</a>');
    });

    it('preserves surrounding text around URLs', () => {
        const result = linkifyText('Before https://example.com after');
        expect(result).toContain('Before ');
        expect(result).toContain(' after');
        expect(result).toContain('<a href="https://example.com"');
    });

    it('handles URL at end of text (no trailing space)', () => {
        const result = linkifyText('Check https://example.com');
        expect(result).toContain('<a href="https://example.com"');
        expect(result).toContain('Check ');
    });

    it('handles multiple URLs in the same text', () => {
        const result = linkifyText('See https://one.com and https://two.com');
        expect(result).toContain('href="https://one.com"');
        expect(result).toContain('href="https://two.com"');
    });

    it('handles consecutive URLs separated only by whitespace', () => {
        const result = linkifyText('https://one.com https://two.com');
        expect(result).toContain('href="https://one.com"');
        expect(result).toContain('href="https://two.com"');
    });

    it('handles text with no URLs', () => {
        const result = linkifyText('Just plain text here.');
        expect(result).toBe('Just plain text here.');
        expect(result).not.toContain('<a');
    });

    it('preserves newlines in non-URL text', () => {
        const result = linkifyText('Line one\nLine two');
        expect(result).toContain('Line one\nLine two');
    });

    it('handles URL with path and query string', () => {
        const result = linkifyText('https://example.com/path?q=1&foo=bar');
        expect(result).toContain('href="https://example.com/path?q=1&amp;foo=bar"');
    });
});
