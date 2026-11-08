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

/**
 * Give server-rendered JSON-LD the request nonce. Other script tags are left alone,
 * so an HTML sink cannot borrow the nonce and run as a script.
 * @param {string} html
 * @param {string} nonce
 */
export function stampJsonLdNonce(html, nonce) {
	if (!html || !nonce || !html.includes('application/ld+json')) return html;
	return html.replace(
		/<script(?![^>]*\bnonce=)(\s+type="application\/ld\+json")/g,
		`<script nonce="${nonce}"$1`,
	);
}

/**
 * Add this response's JSON-LD nonce to script-src.
 * A framing-only policy has no script-src, and this leaves it unchanged.
 * @param {Headers} headers
 * @param {string} nonce
 */
export function allowScriptNonce(headers, nonce) {
	const existing = headers.get('content-security-policy');
	if (!existing || !nonce) return;

	const token = `'nonce-${nonce}'`;
	if (existing.includes(token)) return;

	const next = existing.replace(
		/(^|;\s*)script-src((?:\s+[^;]+)*)/,
		(_match, prefix, sources) => `${prefix}script-src${sources} ${token}`,
	);
	if (next !== existing) headers.set('content-security-policy', next);
}
