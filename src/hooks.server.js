import { applyFramingHeaders } from '$lib/server/securityHeaders';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const response = await resolve(event);
	applyFramingHeaders(response.headers);
	return response;
}
