import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import adapter from "@sveltejs/adapter-netlify";
import { contentSecurityDirectives } from "./src/lib/server/contentSecurityPolicy.js";
import { withPwa } from "@vite-pwa/sveltekit";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { enhancedImages } from "@sveltejs/enhanced-img";

export default defineConfig({
	plugins: [
		// Vite 8 runs postcss-import before PostCSS plugins, so @import "tailwindcss"
		// must be compiled by this plugin first.
		tailwindcss(),
		enhancedImages(),
		withPwa(
			{
				preprocess: [vitePreprocess({})],
				adapter: adapter(),
				csp: {
					mode: "auto",
					directives: contentSecurityDirectives({
						dev: process.env.NODE_ENV !== "production",
					}),
				},
			},
			{
				registerType: "autoUpdate",
				manifest: false, // We're using static/manifest.json instead
				generateSW: {
					// Paths are relative to .svelte-kit/output. A catch-all overlaps
					// the client glob the plugin adds and precaches each file twice.
					globPatterns: [
						"client/**/*.{js,css,html,ico,png,svg,webp,woff,woff2,webmanifest}",
						"prerendered/**/*.{html,json}",
					],
					cleanupOutdatedCaches: true,
					clientsClaim: true,
					skipWaiting: true,
					// null is required. Omitting this key makes the plugin use "/".
					navigateFallback: null,
					// No routes are prerendered, so that second pattern matches nothing.
					globStrict: false,
				},
				devOptions: {
					enabled: false,
					type: "module",
				},
			}
		),
	],
});
