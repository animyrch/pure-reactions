import { describe, expect, it } from 'vitest';
import { contentSecurityDirectives } from '../../src/lib/server/contentSecurityPolicy.js';
import {
	FRAME_ANCESTORS_POLICY,
	X_FRAME_OPTIONS,
	allowScriptNonce,
	applyFramingHeaders,
	stampJsonLdNonce,
} from '../../src/lib/server/securityHeaders.js';

describe('applyFramingHeaders', () => {
	it('sets a same-origin framing policy when the response has no CSP', () => {
		const headers = new Headers();

		applyFramingHeaders(headers);

		expect(headers.get('X-Frame-Options')).toBe(X_FRAME_OPTIONS);
		expect(headers.get('Content-Security-Policy')).toBe(FRAME_ANCESTORS_POLICY);
	});

	it('adds frame-ancestors without replacing an existing policy', () => {
		const headers = new Headers({
			'Content-Security-Policy': "default-src 'self'",
		});

		applyFramingHeaders(headers);

		expect(headers.get('Content-Security-Policy')).toBe(
			`default-src 'self'; ${FRAME_ANCESTORS_POLICY}`,
		);
	});

	it('leaves a policy that already sets frame-ancestors unchanged', () => {
		const headers = new Headers({
			'Content-Security-Policy': "default-src 'self'; frame-ancestors 'self'",
		});

		applyFramingHeaders(headers);

		expect(headers.get('Content-Security-Policy')).toBe(
			"default-src 'self'; frame-ancestors 'self'",
		);
	});
});

describe('stampJsonLdNonce', () => {
	it('stamps JSON-LD and leaves executable script tags untouched', () => {
		const html =
			'<script type="application/ld+json">{}</script><script>alert(1)</script>';

		const stamped = stampJsonLdNonce(html, 'abc+/=');

		expect(stamped).toBe(
			'<script nonce="abc+/=" type="application/ld+json">{}</script><script>alert(1)</script>',
		);
	});
});

describe('allowScriptNonce', () => {
	it('appends the nonce to script-src', () => {
		const headers = new Headers({
			'Content-Security-Policy': "script-src 'self' https://www.youtube.com; frame-ancestors 'self'",
		});

		allowScriptNonce(headers, 'abc');

		expect(headers.get('Content-Security-Policy')).toBe(
			"script-src 'self' https://www.youtube.com 'nonce-abc'; frame-ancestors 'self'",
		);
	});

	it('does not invent a script-src on a framing-only policy', () => {
		const headers = new Headers({
			'Content-Security-Policy': FRAME_ANCESTORS_POLICY,
		});

		allowScriptNonce(headers, 'abc');

		expect(headers.get('Content-Security-Policy')).toBe(FRAME_ANCESTORS_POLICY);
	});
});

describe('contentSecurityDirectives', () => {
	it('allows the players and sign-in hosts without unsafe inline scripts', () => {
		const directives = contentSecurityDirectives();

		expect(directives['frame-ancestors']).toEqual(['self']);
		expect(directives['script-src']).toContain('self');
		expect(directives['script-src']).toContain('https://www.youtube.com');
		expect(directives['script-src']).toContain('https://www.googletagmanager.com');
		expect(directives['script-src']).not.toContain('unsafe-inline');
		expect(directives['frame-src']).toEqual(
			expect.arrayContaining([
				'https://www.youtube.com',
				'https://www.tiktok.com',
				'https://player.twitch.tv',
			]),
		);
		expect(directives['connect-src']).toEqual(
			expect.arrayContaining(['https://*.googleapis.com', 'https://*.algolia.net']),
		);
		expect(directives['connect-src']).not.toContain('http://127.0.0.1:*');
	});

	it('allows the local emulators only in dev', () => {
		const directives = contentSecurityDirectives({ dev: true });

		expect(directives['connect-src']).toContain('http://127.0.0.1:*');
		expect(directives['connect-src']).toContain('ws://localhost:*');
	});
});
