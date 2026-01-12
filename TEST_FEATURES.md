# Test & Debug Features

This document tracks **intentional test/debug knobs** (mostly query params) that help us reproduce issues, compare behavior, and validate fixes.

## Query Params

### Twin player playback (reaction page)

- `mobileLazySync=true` (alias: `lazySync=true`)
  - **Scope:** mobile devices only (iPhone/iPad/Android). Desktop ignores it.
  - **Effect:** enables “lazy sync” where drift corrections only happen when drift exceeds **2.0s**.
  - **Goal:** reduce rebuffering triggered by aggressive seeks on mobile devices.

- `isFullscreen=true`
  - Opens the player in fullscreen.

- `playlistId=<id>`
  - Selects a playlist context.

- `queueSlug=<slug>` / `queueIndex=<number>` / `queueAutoPlay=true`
  - Queue playback context + optional autoplay.

### Backend recorder

- `?record`
  - Enables recorder UI.

- `debug=true`
  - Enables debug output/UI when supported.

- `id=<youtubeVideoId>`
  - Selects the original video.

- `playlist=<playlistId>`
  - Selects a playlist.

- `playlistBufferTime=<seconds>`
  - Sets buffer time for playlist flow.

- `playlistDocumentId=<id>`
  - Selects a playlist document.

- `sharedSessionId=<id>`
  - Forces/sets a shared session id.

### Misc

- `sortBy=<key>`
  - Controls home-page sorting.

- `item=<youtubeVideoId>`
  - Used in playlist/edit flows to select a specific item.

## How to Use

- Compare mobile behavior by loading the same reaction URL with and without:
  - `?mobileLazySync=true`
- When sharing links, prefer explicit booleans (`true`) for consistency.

## Adding new test features

When introducing a new test/debug flag:

1. Add it here with **scope**, **default**, and **intended use**.
2. Prefer `...=true` boolean flags unless presence-only is required.
3. Keep behavior behind the flag **off by default** unless it’s a permanent product change.
