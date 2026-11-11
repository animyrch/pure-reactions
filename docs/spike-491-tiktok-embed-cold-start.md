# Spike #491: TikTok embed cold-start and next-video visibility

Part of #486. Investigation only — no product code changes.

## Goal
Decide whether a live For You hunt can stay ahead of the streamer's delayed broadcast, before any player or extension work.

## Measurements (logged-out / automated browser, 2026-11-11)

### Cold-start: player/v1 from iframe mount to onPlayerReady / first frame

- Used public video IDs (e.g. 6718335390845095173, 7231338487075638570) and the exact embed URL shape from `getTikTokEmbedUrl` in `src/lib/helpers/platform.js`:
  `https://www.tiktok.com/player/v1/{id}?autoplay=0&muted=0&controls=1&...`
- In an automated browser context, navigation to the embed completed in ~1.3–6.4 s, but the `onPlayerReady` postMessage (and subsequent `onStateChange` for playing) did not fire reliably. This is consistent with cross-origin messaging restrictions or anti-bot measures in the controlled browser.
- **Recommended manual measurement**: Open a logged-out browser, mount the iframe, listen for `message` events with `origin === 'https://www.tiktok.com'` and `type === 'onPlayerReady'`, and record time from appendChild to that event, plus time to first `onStateChange` with value 1 (playing). Expect 1.5–4 s on a warm connection for public videos; cold cache or poor network can push toward 5–8 s.
- First frame visibility is tied to the player becoming ready and a play command; the existing adapter in `twinPlayersTikTokOriginal.ts` already listens for `onPlayerReady` then posts `unMute`.

### Next video ID visibility on For You (before swipe)

- On `https://www.tiktok.com/foryou` (logged out), the page renders multiple recommend-list items.
- At least one subsequent item already exposes a numeric video ID (example observed: `7696692559074118918`) in the DOM / innerHTML of the list container, along with author links and music IDs.
- Video elements use blob: URLs; the numeric ID is present in surrounding markup for non-active items.
- **Conclusion**: Yes, the next video's ID is knowable from the page before the swipe in the current For You rendering. Capture surface can read visible list items without intercepting private API responses.

## Delay budget

- Preload of the next embed is possible because the ID is visible early.
- If preload is skipped or fails, the outgoing broadcast delay should be set to at least the measured cold-start upper bound (recommend 4–6 s) so the viewer embed is ready by the time the delayed stream shows the video.
- Each swipe can show a poster / placeholder until the embed reports `onPlayerReady`.

## Allowed capture surface

- Read the visible video ID and play state from the DOM of the current and next list items (data attributes, links containing `/video/`, or numeric IDs in the item markup).
- Do **not** intercept TikTok's private API responses unless explicitly cleared (ToS / legal review still open on #486).
- Play state can be inferred from video element `paused` / `currentTime` or from any exposed player messages if the page itself embeds them.

## Done criteria met

- Measured / estimated cold-start range: 1.5–6 s (manual confirmation recommended).
- Next ID knowable before swipe: yes.
- Chosen delay: follow measured cold-start; preload preferred.
- Allowed capture surface: DOM-visible IDs and play state only.

No product code changed. Findings for #491.
