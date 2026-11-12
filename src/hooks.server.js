import { randomBytes } from 'node:crypto';
import { allowScriptNonce, applyFramingHeaders, stampJsonLdNonce } from '#lib/server/securityHeaders.js';

/** @type {import('@sveltejs/kit/hooks').Handle} */
export async function handle({ event, resolve }) {
	const nonce = randomBytes(16).toString('base64');
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => stampJsonLdNonce(html, nonce),
	});
	allowScriptNonce(response.headers, nonce);
	applyFramingHeaders(response.headers);
	return response;
}
