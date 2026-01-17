# PWA Implementation Guide

## What Was Implemented

This document describes the Progressive Web App (PWA) features that have been added to the Pure Reactions Svelte web app.

### 1. Web App Manifest (`static/manifest.json`)

The manifest provides metadata about the app for installability:
- **name**: "Pure Reactions"
- **short_name**: "Pure Reactions"
- **display**: "standalone" (runs full-screen without browser UI)
- **theme_color**: "#050505" (matches the app's dark theme)
- **background_color**: "#050505"
- **icons**: 192x192 and 512x512 PNG icons
- **start_url**: "/" (app starts at the root)

### 2. PWA Icons

Three icon sizes were generated from the existing `favicon.svg`:
- **icon-192.png**: 192x192px - Required for Android install prompt
- **icon-512.png**: 512x512px - Required for Android splash screen
- **apple-touch-icon.png**: 180x180px - For iOS "Add to Home Screen"

All icons are set as "maskable" to support Android's adaptive icons.

### 3. Service Worker

Implemented using `@vite-pwa/sveltekit` plugin with the following features:

#### Precaching
- All static assets (JS, CSS, HTML, images, fonts) are precached
- Automatic cache updates when new versions are deployed

#### Runtime Caching
- Google Fonts: Cached for 1 year (CacheFirst strategy)
- Static assets: Cached with automatic cleanup

#### Configuration
- **Auto-update**: Service worker updates automatically when new version is detected
- **Skip waiting**: New service worker activates immediately
- **Clients claim**: Takes control of pages immediately upon activation

### 4. HTML Updates (`src/app.html`)

Added PWA-specific meta tags:
```html
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="theme-color" content="#050505" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

### 5. Service Worker Registration (`src/routes/+layout.svelte`)

Service worker is registered in the root layout's `onMount` lifecycle:
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' });
}
```

## Testing PWA Features

### Desktop (Chrome/Edge)
1. Run the app in production mode: `npm run build && npm run preview`
2. Open DevTools → Application → Manifest
3. Click "Install" button in the address bar
4. App should install and run as a standalone window

### Android (Chrome)
1. Deploy to HTTPS (required for PWA)
2. Visit the site on Android Chrome
3. Look for "Add to Home Screen" prompt
4. Install and launch from home screen
5. App should run full-screen without browser UI

### iOS (Safari)
1. Deploy to HTTPS (required)
2. Visit the site in Safari
3. Tap Share → "Add to Home Screen"
4. Launch from home screen
5. App should run in standalone mode

### Service Worker Verification
1. Open DevTools → Application → Service Workers
2. Verify service worker is registered and active
3. Go offline (Network tab → Offline checkbox)
4. Reload page - app should still load from cache

## Lighthouse PWA Audit

Run Lighthouse audit to verify PWA implementation:
1. Open DevTools → Lighthouse
2. Select "Progressive Web App" category
3. Run audit
4. Should pass all installability checks

## Implementation Notes

### Why @vite-pwa/sveltekit?
- Zero-config PWA generation for SvelteKit
- Automatic service worker generation with Workbox
- Integrates seamlessly with Vite build process
- Supports SvelteKit's adapter system

### Static Manifest vs Generated
We use a static `manifest.json` file instead of generating it through the plugin because:
- Simpler to customize and maintain
- No build-time dependencies for manifest changes
- Easier to understand for future developers

### Service Worker Scope
The service worker scope is set to '/' to cache all routes and assets in the app.

## Future Enhancements (Out of Scope)

The following were intentionally excluded from this implementation:
- Push notifications
- App Store / Play Store submission
- Capacitor / Cordova integration
- Background sync
- Offline form submission

These can be added in future iterations if needed.

## Troubleshooting

### Service Worker Not Updating
- Service worker caches aggressively. Clear cache or use "Update on reload" in DevTools
- Check that `skipWaiting: true` is set in vite.config.js

### Icons Not Showing
- Verify icons exist in `static/` directory
- Check manifest.json paths are correct
- Clear browser cache and reinstall

### Install Prompt Not Appearing
- Ensure app is served over HTTPS
- Check Lighthouse PWA audit for missing criteria
- Android may delay prompt based on user engagement
- iOS doesn't show automatic prompts (manual "Add to Home Screen" only)

## Files Changed

- `vite.config.js` - Added PWA plugin configuration
- `src/app.html` - Added PWA meta tags and manifest link
- `src/routes/+layout.svelte` - Added service worker registration
- `static/manifest.json` - Created web app manifest
- `static/icon-192.png` - Created PWA icon (192x192)
- `static/icon-512.png` - Created PWA icon (512x512)
- `static/apple-touch-icon.png` - Created iOS icon (180x180)
- `package.json` - Added @vite-pwa/sveltekit dependency
- `.gitignore` - Added .netlify to ignore build artifacts
