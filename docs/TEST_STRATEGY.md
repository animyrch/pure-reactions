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

## E2E Tests (`tests/*.spec.js`)

### Purpose
Validate **critical cross-system integration** that cannot be tested at lower levels. E2E tests are expensive, flaky-prone, and should be **minimal**.

### Rules (see AGENTS.md § "Writing Reliable E2E Tests")
1. **No wall-clock timing assertions** ("starts within 2500ms")
2. **No exact drift measurements** (media playback is nondeterministic)
3. **No external API dependencies** (Algolia, YouTube quota)
4. **No nondeterministic ordering** without stable tie-breakers

### Current E2E Tests

| Test File | Purpose | What it validates |
| :--- | :--- | :--- |
| `twin-player-basic-sync.spec.js` | Twin player boot smoke | Both YouTube IFrames load and reach `PLAYING` state |
| `reaction-layout-visual.spec.js` | Layout visual regression | Reactor attribution, layout stability (visual snapshots) |
| `account-deletion.spec.js` | Account deletion journey | Firebase Auth + Firestore cascade deletion |
| `firestore.rules.spec.mjs` | Firestore security rules | Rule enforcement via Firebase emulator |

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
# Local (Firestore emulator required)
npm run test:e2e:ci

# Specific test
PW_ARGS="twin-player-basic-sync" npm run test:e2e:ci:only

# Headed mode (for debugging)
npx playwright test --headed
```

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
