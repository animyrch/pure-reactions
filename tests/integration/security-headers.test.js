import { describe, expect, it } from 'vitest';
import {
	FRAME_ANCESTORS_POLICY,
	X_FRAME_OPTIONS,
	applyFramingHeaders,
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
