# PWA Verification Checklist

This document provides step-by-step instructions for verifying the PWA implementation.

## Quick Test (Local Development)

### 1. Build and Preview Locally

```bash
npm run build
npm run preview
```

**Note**: The dev server (`npm run dev`) has PWA disabled by default. You must use the production build to test PWA features.

### 2. Open Chrome DevTools

1. Navigate to the preview URL (typically http://localhost:4173)
2. Open DevTools (F12)
3. Go to **Application** tab

### 3. Verify Manifest

In Application → Manifest:
- ✅ Name: "Pure Reactions"
- ✅ Short name: "Pure Reactions"
- ✅ Start URL: "/"
- ✅ Theme color: "#050505"
- ✅ Display: "standalone"
- ✅ Icons: Should show 192x192 and 512x512 icons

### 4. Verify Service Worker

In Application → Service Workers:
- ✅ Service worker should be registered at `/sw.js`
- ✅ Status should be "activated and running"
- ✅ Scope should be "/"

### 5. Test Offline Mode

1. In DevTools, go to **Network** tab
2. Check the "Offline" checkbox
3. Reload the page
4. ✅ Page should load from cache (may show some loading errors for dynamic content, but static shell should work)

### 6. Test Installability (Desktop)

1. Look for the install icon (⊕) in the address bar
2. Click it to install
3. ✅ App should install and open in a standalone window
4. ✅ No browser UI should be visible (address bar, tabs, etc.)

## Production Testing

### Deploy to HTTPS

PWA features require HTTPS (except localhost). Deploy to:
- Netlify (already configured in `netlify.toml`)
- Vercel
- Any HTTPS hosting

### Android Testing (Chrome)

1. Visit your deployed site on Android Chrome
2. **Wait for the install prompt** (may take 30-60 seconds or require revisiting)
   - Alternative: Chrome menu (⋮) → "Add to Home screen"
3. Install the app
4. Launch from home screen
5. ✅ App should run full-screen
6. ✅ Status bar should use theme color (#050505)
7. ✅ No browser UI visible

**Test offline mode:**
1. With app open, turn on Airplane mode
2. Close and reopen the app
3. ✅ App shell should load (may not show dynamic content)

### iOS Testing (Safari)

1. Visit your deployed site in Safari
2. Tap the Share button (box with arrow)
3. Tap "Add to Home Screen"
4. Tap "Add" in the top right
5. ✅ Icon should appear on home screen
6. Launch the app
7. ✅ App should run in standalone mode
8. ✅ Status bar should match theme

**Note**: iOS has limited offline support compared to Android. The service worker will work, but iOS Safari has stricter limitations on cache duration and storage.

### Desktop Testing (Chrome/Edge)

1. Visit your deployed site
2. Click the install icon in address bar (⊕ or similar)
3. Click "Install"
4. ✅ App window opens
5. ✅ Look for app icon in taskbar/dock
6. ✅ App appears in OS app drawer/menu

## Lighthouse PWA Audit

Run a comprehensive PWA audit:

1. Open DevTools → Lighthouse
2. Select **Progressive Web App** category
3. Click "Analyze page load"
4. Wait for results

**Expected Results:**
- ✅ Installable (should be 100%)
- ✅ PWA Optimized
- ✅ Service worker registered
- ✅ Fast and reliable
- ✅ Works offline

**Acceptable failures** (if any):
- Push notifications (intentionally not implemented)
- Some performance metrics (unrelated to PWA)

## Troubleshooting

### "Install" button doesn't appear
- Verify you're using HTTPS (or localhost)
- Check DevTools Console for errors
- Run Lighthouse audit to see what's missing
- On Android, try clearing Chrome cache and revisiting

### Service worker not registering
- Check Console for registration errors
- Verify `/sw.js` is accessible (visit URL directly)
- Check Service Workers in DevTools Application tab
- Clear site data and try again

### Icons not showing
- Clear browser cache completely
- Check that icons exist: `/icon-192.png`, `/icon-512.png`, `/apple-touch-icon.png`
- Verify `manifest.json` is accessible
- Check icon dimensions: `identify static/icon-*.png`

### Offline mode not working
- Clear all caches and reinstall
- Check Service Worker status (should be "activated")
- Look for cache entries in Application → Cache Storage
- Verify `workbox` cache entries exist

### iOS app doesn't look right
- Check that `apple-touch-icon.png` exists
- Verify `apple-mobile-web-app-capable` meta tag in HTML
- Check `theme-color` meta tag
- iOS caches aggressively - try clearing Safari cache

## Expected Behavior Summary

| Feature | Android | iOS | Desktop |
|---------|---------|-----|---------|
| Install prompt | ✅ Automatic/Manual | ⚠️ Manual only | ✅ Automatic |
| Full-screen mode | ✅ Yes | ✅ Yes | ✅ Yes |
| Offline support | ✅ Full | ⚠️ Limited | ✅ Full |
| App icon | ✅ Yes | ✅ Yes | ✅ Yes |
| Auto-update | ✅ Yes | ⚠️ Limited | ✅ Yes |
| Push notifications | ❌ Not implemented | ❌ Not available | ❌ Not implemented |

✅ = Fully supported
⚠️ = Limited or requires manual action
❌ = Not available/implemented

## What's NOT Included

This implementation intentionally excludes:
- ❌ Push notifications
- ❌ Background sync
- ❌ App Store / Play Store submission
- ❌ Native wrappers (Capacitor, Cordova)
- ❌ Offline form submission queuing
- ❌ Advanced caching strategies for dynamic content

These can be added later if needed.

## Success Criteria

Your PWA implementation is successful if:

1. ✅ Lighthouse PWA audit passes installability checks
2. ✅ App can be installed on Android Chrome
3. ✅ App can be added to iOS home screen
4. ✅ App runs full-screen without browser UI
5. ✅ Service worker is registered and active
6. ✅ App shell loads when offline
7. ✅ No console errors related to PWA
8. ✅ Icons display correctly on all platforms

## Next Steps

Once PWA is verified:
1. Deploy to production
2. Monitor service worker updates in production
3. Test on real devices (Android & iOS)
4. Collect user feedback on install experience
5. Consider adding push notifications (separate implementation)
6. Consider App Store distribution via Capacitor (separate implementation)

## Support Resources

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Workbox Documentation](https://developer.chrome.com/docs/workbox/)
- [PWA Builder](https://www.pwabuilder.com/) - Test your PWA
- [SvelteKit PWA Plugin](https://vite-pwa-org.netlify.app/frameworks/sveltekit.html)
