# Test & Debug Features

## Firestore Fixtures (E2E / Emulator / Prod)

This repo includes a small set of **reaction document fixtures** under `tests/fixtures/`.
They can be seeded into either:
- a **Firestore emulator** (recommended for Playwright e2e)
- a **live Firebase project** (for verifying behavior against prod data)

### Seed into Firestore emulator (recommended)

1) Start a Firestore emulator (you can use the Firebase CLI).
2) Run Playwright with emulator env enabled (global setup will seed if missing):

`PUBLIC_FIREBASE_USE_EMULATORS=true PUBLIC_FIRESTORE_EMULATOR_HOST=127.0.0.1 PUBLIC_FIRESTORE_EMULATOR_PORT=8080 npm run test:e2e`

The seeder writes to the collection from `.env` (`PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES`).

### Seed into a live Firebase project (guarded)

This is intentionally hard to do by accident.

- Set credentials via `FIREBASE_SERVICE_ACCOUNT=/abs/path/to/serviceAccount.json`
  (or `FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'`).
- Explicitly allow prod seeding: `ALLOW_PROD_SEED=1`
- Run:

Seed a single per-test fixture:

`FIREBASE_SEED_TARGET=prod ALLOW_PROD_SEED=1 node scripts/seed-firestore-fixtures.mjs --fixture tests/fixtures/reactions/twin-basic-sync.json`

Seed all twin-player fixtures (one reaction doc per test case):

`FIREBASE_SEED_TARGET=prod ALLOW_PROD_SEED=1 npm run seed:twin-fixtures`

By default the seeder is **idempotent**: it only creates docs that do not exist.

If you update a fixture but keep the same document id, you must delete the existing doc (or use a new id) for the seeder to apply the change.

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
