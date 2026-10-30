import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		enhancedImages(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: false, // We're using static/manifest.json instead
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
				cleanupOutdatedCaches: true,
				clientsClaim: true,
				skipWaiting: true
			},
			devOptions: {
				enabled: false,
				type: 'module'
			}
		})
	]
});
