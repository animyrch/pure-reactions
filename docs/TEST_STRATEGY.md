# Test Strategy & Organization

## Overview

Pure Reactions follows a strict testing pyramid with clear boundaries between E2E (smoke-level only), integration, and unit tests. This document explains the rationale and organization.

---

## Testing Pyramid

```
     /\
    /  \   E2E (Smoke)        <- Minimal, critical user journeys only
   /----\
  / Int. \  Integration       <- Pure logic, mocked boundaries
 /--------\
/ Unit     \ Unit Tests       <- (Not yet implemented)
------------
```

---

## E2E Tests (`tests/e2e/<route>/*.spec.js`)

### Purpose
Validate **critical cross-system integration** that cannot be tested at lower levels. E2E tests are expensive, flaky-prone, and should be **minimal**.

### Rules (see AGENTS.md § "Writing Reliable E2E Tests")
1. **No wall-clock timing assertions** ("starts within 2500ms")
2. **No exact drift measurements** (media playback is nondeterministic)
3. **No external API dependencies** (Algolia, YouTube quota)
4. **No nondeterministic ordering** without stable tie-breakers

### Route suites

Playwright specs live in `tests/e2e/<route>/`, one directory per application route they cover. `tests/e2e/suites.json` maps each suite to the route, API, and spec paths that should select it. Desktop and mobile projects still run for every selected suite.

| Suite | Directory | Routes |
| :--- | :--- | :--- |
| `account` | `tests/e2e/account` | `/login`, `/account`, `/api/account` |
| `my-reactions` | `tests/e2e/my-reactions` | `/my-reactions`, plus login and account because those specs pass through them |
| `reaction` | `tests/e2e/reaction` | `/reaction`, `/edit-reaction` (remix editor cases in `remix-mode.spec.js`) |
| `edit-reaction` | `tests/e2e/edit-reaction` | `/edit-reaction` |
| `playlist` | `tests/e2e/playlist` | `/playlist` |
| `backend` | `tests/e2e/backend` | `/backend`, `/login` |
| `test-layout` | `tests/e2e/test-layout` | `/test-layout` |

A change under `src/lib/`, the root layout, app shell, fixtures, Playwright config, or dependency files runs every suite. Routes with no Playwright specs are listed in `unmappedRoutes` and do not start a browser run. Add a suite directory and a `suites.json` entry when a route gains an end-to-end spec.

Firestore security rules stay in `tests/firestore.rules.spec.mjs` and are not part of the Playwright run.

### What was removed (moved to integration)
- **Drift measurement** → Integration tests for `computeTwinPlayersSyncTick`
- **Volume stability** → Integration tests for volume timeline helpers
- **Playlist transitions** → Integration tests for playlist state logic
- **Overlay track snapshots** → Integration tests for `getCurrentOverlaySnapshotFromConfigs`
- **Homepage sorting** → (Removed; nondeterministic Firestore ordering)

---

## Integration Tests (`tests/integration/*.test.js`)

### Purpose
Test **stateless logic** and **mocked API boundaries** without browser/network overhead.

### Rules
1. Test pure functions and deterministic state transitions
2. Mock external dependencies (Firebase, Algolia, YouTube API)
3. No browser, no real network, no timers
4. Fast (< 100ms per test)

### Current Integration Tests

| Test File | Coverage |
| :--- | :--- |
| `twin-player-sync.test.js` | `getCurrentVolumeFromVolumeConfigs`, `getCurrentStateFromStateConfigs`, `getCurrentPlaybackRateFromConfigs`, overlay snapshot resolution, timeline boundary detection, volume change stability |
| `search-provider.test.js` | Search provider interface, filtering, pagination, error handling |
| `playlist-logic.test.js` | Playlist state transitions, timing preservation logic, volume state transitions, offset time handling |

---

## Running Tests

### Integration Tests
```bash
# Run once
npm run test:integration

# Watch mode
npm run test:integration:watch
```

### E2E Tests
```bash
# Every suite (Firestore emulator required)
npm run test:e2e:ci

# One route suite, on desktop and mobile
E2E_SUITES=reaction npm run test:e2e:ci

# Several suites
E2E_SUITES=account,my-reactions npm run test:e2e:ci

# See which suites a pull request would run
npm run test:e2e:select -- --base origin/prod

# Check the suite map without browsers
npm run test:e2e:suites

# Headed mode (for debugging)
npx playwright test tests/e2e/reaction --headed
```

Pull requests run `scripts/select-e2e-suites.mjs` against the base branch. The Playwright job installs browsers only when at least one suite matches. A manual workflow run executes every suite.

### Firestore Rules Tests
```bash
npm run test:rules
```

---

## When to Add a New Test

### Add an E2E test IF:
- The behavior requires **cross-system integration** (Auth → Firestore → Svelte store → UI)
- It's a **critical user journey** (login, playback boot, account deletion)
- It **cannot** be validated via integration/unit tests
- The spec belongs in `tests/e2e/<route>/`. When the route is new, add its paths to `tests/e2e/suites.json` and remove it from `unmappedRoutes`.

### Add an integration test IF:
- The behavior is **pure logic** (timeline lookups, state transitions, formatting)
- It involves **mocked API boundaries** (search provider, playlist state)
- It's **deterministic** and **fast**

### Never add an E2E test for:
- Exact timing ("starts in 2500ms")
- Media drift measurement
- External API ranking/ordering
- Internal component structure

---

## Test Maintenance

### Integration tests moved from E2E
The following E2E tests were **converted to integration tests** to improve reliability and speed:

1. **`twin-player-basic-sync.spec.js`** "Verify drift <= threshold"
   - **Why moved:** Drift measurement is nondeterministic in CI (Rule 6)
   - **Integration coverage:** `twin-player-sync.test.js` covers `computeTwinPlayersSyncTick`
   - **E2E smoke remains:** "Should load both players and reach playing state"

2. **`twin-player-basic-sync.spec.js`** "Volume Stability"
   - **Why moved:** Continuous polling of player volume is flaky (Rule 2 & 11)
   - **Integration coverage:** `twin-player-sync.test.js` tests volume timeline helpers
   - **E2E smoke:** Volume slider UI update (if needed)

3. **`twin-player-playlist-transitions.spec.js`** (entire file removed)
   - **Why moved:** Timing preservation logic is pure (Rule 3)
   - **Integration coverage:** `playlist-logic.test.js` covers state transitions, timing, volume

4. **`homepage-reactions-sorting.spec.js`** (removed)
   - **Why moved:** Depends on nondeterministic Firestore ordering (Rule 3)
   - **Integration coverage:** None (no ordering logic to test; rely on Firestore behavior)

---

## Decision Matrix

When deciding where a test belongs:

| Characteristic | E2E | Integration | Unit |
| :--- | :---: | :---: | :---: |
| Requires browser | ✅ | ❌ | ❌ |
| Requires Firebase emulator | ✅ | ❌ | ❌ |
| Tests pure logic | ❌ | ✅ | ✅ |
| Tests cross-system integration | ✅ | ❌ | ❌ |
| Fast (< 100ms) | ❌ | ✅ | ✅ |
| Stable in CI | ⚠️ | ✅ | ✅ |
| Measures timing/drift | ❌ | ⚠️ | ⚠️ |

---

## Future Work

### Unit Tests
- Component-level Svelte tests (Testing Library)
- Helper function unit tests (overlap with integration; keep integration coverage)

### Additional Integration Tests
- `twinPlayersSyncScheduling.ts` (boundary-aware scheduling)
- `softSync/logic.js` (soft sync decision logic)
- `reaction.js` (remaining helpers: `getCompensatedReactionTime`)

### Additional E2E Smoke Tests
- **Shared session join** (`routes/shared/[sessionId]`)
- **Search input focus + submit** (no ranking assertions)
- **Playlist "Next" button** (no timing assertions)

---

## References

- [AGENTS.md § "Writing Reliable E2E Tests"](/.github/copilot-instructions.md)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing Library Philosophy](https://testing-library.com/docs/guiding-principles/)

---

*Last updated: 2026-02-05*
