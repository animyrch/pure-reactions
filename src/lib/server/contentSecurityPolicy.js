/**
 * Hosts the browser must be able to reach besides this origin.
 * Script execution stays limited to our bundles plus these players and sign-in helpers.
 * style-src allows inline styles because app.html and the player UI set style attributes.
 * img-src allows any https image because YouTube and TikTok poster URLs are not on one host.
 */

const scriptSrc = [
	'self',
	'https://www.youtube.com',
	'https://www.youtube-nocookie.com',
	'https://s.ytimg.com',
	'https://www.googletagmanager.com',
	'https://www.google-analytics.com',
	'https://www.gstatic.com',
	'https://apis.google.com',
	'https://accounts.google.com',
];

const connectSrc = [
	'self',
	// Reaction and original titles are loaded in the browser from YouTube oEmbed.
	'https://www.youtube.com',
	'https://*.googleapis.com',
	'https://*.firebaseio.com',
	'wss://*.firebaseio.com',
	'https://*.firebasedatabase.app',
	'wss://*.firebasedatabase.app',
	'https://*.firebaseapp.com',
	'https://*.algolia.net',
	'https://*.algolianet.com',
	'https://www.google-analytics.com',
	'https://*.google-analytics.com',
	'https://analytics.google.com',
	'https://*.analytics.google.com',
	'https://www.googletagmanager.com',
	'https://stats.g.doubleclick.net',
];

const devConnectSrc = [
	'http://127.0.0.1:*',
	'http://localhost:*',
	'ws://127.0.0.1:*',
	'ws://localhost:*',
];

/**
 * @param {{ dev?: boolean }} [options]
 * @returns {import('@sveltejs/kit').CspDirectives}
 */
export function contentSecurityDirectives({ dev = false } = {}) {
	return {
		'default-src': ['self'],
		'base-uri': ['self'],
		'object-src': ['none'],
		'form-action': ['self'],
		'frame-ancestors': ['self'],
		'script-src': scriptSrc,
		'style-src': ['self', 'unsafe-inline'],
		'font-src': ['self', 'data:'],
		'img-src': ['self', 'data:', 'blob:', 'https:'],
		'media-src': ['self', 'blob:', 'mediastream:'],
		'worker-src': ['self', 'blob:'],
		'manifest-src': ['self'],
		'connect-src': dev ? [...connectSrc, ...devConnectSrc] : connectSrc,
		'frame-src': [
			'self',
			'https://www.youtube.com',
			'https://www.youtube-nocookie.com',
			'https://www.tiktok.com',
			'https://player.twitch.tv',
			'https://www.twitch.tv',
			'https://accounts.google.com',
			'https://apis.google.com',
			'https://*.firebaseapp.com',
			'https://*.web.app',
		],
	};
}
