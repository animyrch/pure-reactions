export const X_FRAME_OPTIONS = 'SAMEORIGIN';
export const FRAME_ANCESTORS_POLICY = "frame-ancestors 'self'";

/**
 * Stop another site from embedding this origin.
 * An existing Content-Security-Policy is kept. frame-ancestors is added only when that policy does not already name it.
 * @param {Headers} headers
 */
export function applyFramingHeaders(headers) {
	headers.set('X-Frame-Options', X_FRAME_OPTIONS);

	const existing = headers.get('content-security-policy');
	if (!existing) {
		headers.set('Content-Security-Policy', FRAME_ANCESTORS_POLICY);
		return;
	}

	if (!hasFrameAncestors(existing)) {
		headers.set('Content-Security-Policy', `${existing}; ${FRAME_ANCESTORS_POLICY}`);
	}
}

/**
 * @param {string} policy
 */
function hasFrameAncestors(policy) {
	return policy.split(';').some((directive) => directive.trim().toLowerCase().startsWith('frame-ancestors'));
}
