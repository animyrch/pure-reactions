# 491 — TikTok embed cold start and next-video visibility

Spike for #486. No product code. Nothing here should be merged to `prod` until a clean `player/v1` first-frame sample exists.

Measured 2026-11-11, logged out (desktop Chromium, no TikTok session, Log in still in the For You header). Embed URL shape is `getTikTokEmbedUrl` in `src/lib/helpers/platform.js`: `https://www.tiktok.com/player/v1/{id}?autoplay=0&muted=0&controls=1&play_button=1&volume_control=1&fullscreen_button=1&description=1`. Clock starts when the iframe is inserted. First frame means the first `onCurrentTime` with `currentTime > 0`. Playing means `onStateChange` 1.

## Cold start

A playable cold start was **not** measured. Do not treat any number below as the range.

| Parent | Video | What happened |
| --- | --- | --- |
| `http://127.0.0.1` | `7705366256165080321` | Document HTTP 200. `onPlayerError` 2001 `SERVER_ERROR` at 602ms. No `onPlayerReady`. `player/api/v1/items` was called with that parent as `referer`. |
| `http://127.0.0.1` | `7231338487075638570` | Same failure at 616ms. |
| `referer` rewritten to `https://purereactions.com/` | `7231338487075638570` | `onPlayerReady` at 2087ms, same tick as `onPlayerError` 2005 `TOO_MANY_REQUESTS`. No playing state, no advancing `onCurrentTime`. |
| `https://purereactions.com` (real parent) | `7231338487075638570` | `player/v1` document HTTP 429, empty body, `x-tt-system-error: 1`, no `Retry-After`. Still 429 after several minutes, including from curl. |

An unsigned `player/api/v1/items` call returns `status_code` 40302 `embed request rejected` for a local parent, for `purereactions.com`, and for `tiktok.com`. The in-browser failure mode was different once cookies existed, so this is not by itself proof that production embeds are rejected.

`onPlayerReady` is not a first frame. The only time it fired, media had already failed.

## Next id before the swipe

Yes. Exactly one video ahead, on a normal logged-out For You tab (`https://www.tiktok.com/foryou`). The URL stays `/foryou`. There is no `a[href*="/video/"]`.

Before any swipe:

| Item | In view | DOM id | `<video>` |
| --- | --- | --- | --- |
| 0 | yes | `xgwrapper-0-7705366256165080321` | playing, unmuted, `currentTime` 6.3s of 7.6s, `readyState` 4 |
| 1 | no, one viewport down | `xgwrapper-0-7696692559074118918` | paused, muted, `currentTime` 0.067s, `readyState` 4 |
| 2 | no | none | no video element |

Scrolling item 1 into view made that same id the playing video and filled item 2 with `xgwrapper-0-7608248907960814879`, again paused, muted, and already at about 0.067s. The id two swipes ahead is not in the page yet.

oEmbed `embed_product_id` matched the current and next ids, so the `xgwrapper-0-` suffix is the video id. Music links are sound ids. Do not use them.

## Allowed capture surface

Read the page. Do not intercept TikTok private API responses (`/api/recommend/item_list/` and the rest).

- Visible item: `article[data-e2e="recommend-list-item-container"]` covering the viewport. `data-scroll-index` is the position.
- Video id: the integer at the end of `[id^="xgwrapper-"]` inside that article.
- Play state: that article's `<video>` (`paused`, `muted`, `currentTime`, `readyState`).
- Author handle, if wanted later: `a[href^="/@"]`. It is not the video id.

Class names are hashed. Do not select on them. `xgwrapper-*` is the hook, and it can still change. Do not read `__UNIVERSAL_DATA_FOR_REHYDRATION__` for the hunt.

## Delay

**2 seconds.** Preload is possible: the next id is in the DOM for the whole time the current video is showing, not only at the swipe. Keep the viewer offset at the top of the 1–2s broadcast delay from #486. Mount the next `player/v1` as soon as that id appears. On every video change, show a poster until `onPlayerReady` and the first advancing `onCurrentTime`.

Do not stretch the broadcast delay to a cold-start number yet. This spike never saw a first frame, so it cannot say a cold embed fits in 2s. The poster covers the first video and any swipe that beats preload. Re-time `player/v1` from `purereactions.com` on a network TikTok is not answering with 429 before calling that 2s figure a measured fit.
