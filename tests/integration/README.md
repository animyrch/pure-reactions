# Integration Tests

## Overview

This directory contains **integration tests** for Pure Reactions. These tests validate **pure logic** and **mocked API boundaries** without browser/network overhead.

---

## Principles

Integration tests should:
- ✅ Test stateless, deterministic logic
- ✅ Mock external dependencies (Firebase, Algolia, YouTube)
- ✅ Run fast (< 100ms per test)
- ✅ Be stable across all environments

Integration tests should **NOT**:
- ❌ Require a browser
- ❌ Make real network requests
- ❌ Depend on wall-clock timing
- ❌ Test UI/rendering (that's E2E or component tests)

---

## Test Files

### `twin-player-sync.test.js`
**Coverage:** Timeline helper functions from `src/lib/helpers/reaction.js`

Tests:
- `getCurrentVolumeFromVolumeConfigs` — Volume timeline lookups (array + legacy object format)
- `getCurrentStateFromStateConfigs` — State timeline lookups with target time
- `getCurrentPlaybackRateFromConfigs` — Playback rate timeline lookups
- Timeline boundary detection (binary search behavior)
- Volume change stability across rapid queries
- Global gain application + clamping (0-200 range)
- Time offset handling

**Why integration?** These are pure functions with deterministic outputs; no browser needed.

---

### `search-provider.test.js`
**Coverage:** Search provider interface from `src/lib/services/search/`

Tests:
- Search result ordering (mocked)
- Empty results handling
- Pagination parameters
- Filter application
- Error handling (network, malformed responses)
- Single reaction fetch by ID

**Why integration?** Mocking the search provider avoids external Algolia/network dependencies while still validating the interface contract.

---

### `playlist-logic.test.js`
**Coverage:** Playlist state transition logic

Tests:
- Playlist state transitions (next, end of playlist)
- Same vs different video detection (timing preservation decision)
- Autoplay state handling
- Document creation structure
- Volume config preservation/reset
- Offset time handling (`offsetStartTime`)

**Why integration?** This is pure state transition logic; no browser/Firebase needed.

---

## Running Tests

### Run once
```bash
npm run test:integration
```

### Watch mode (during development)
```bash
npm run test:integration:watch
```

### Run specific file
```bash
npx vitest run tests/integration/twin-player-sync.test.js
```

---

## Adding New Integration Tests

### 1. Create a new test file
```javascript
// tests/integration/my-feature.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { myFunction } from '../../src/lib/helpers/myHelper.js';

describe('My Feature', () => {
    it('should behave deterministically', () => {
        const result = myFunction(input);
        expect(result).toBe(expected);
    });
});
```

### 2. Follow the integration test principles
- Keep tests **fast** and **deterministic**
- Mock external dependencies (`vi.fn()`)
- Test **logic**, not UI

### 3. Run the test
```bash
npm run test:integration
```

---

## When to Use Integration Tests vs E2E

| Scenario | Integration | E2E |
| :--- | :---: | :---: |
| Pure logic (timeline lookups, state transitions) | ✅ | ❌ |
| Mocked API boundaries (search, playlist state) | ✅ | ❌ |
| Cross-system integration (Auth → Firestore → UI) | ❌ | ✅ |
| Critical user journey (login, playback boot) | ❌ | ✅ |
| Media playback/timing behavior | ❌ | ⚠️ |

**Rule of thumb:** If you can test it without a browser, it should be an integration test.

---

## Common Patterns

### Mocking external dependencies
```javascript
import { vi } from 'vitest';

const mockFirebase = {
    updateDoc: vi.fn().mockResolvedValue(true)
};
```

### Testing pure functions
```javascript
it('should compute correctly', () => {
    const result = myPureFunction(input);
    expect(result).toBe(expected);
});
```

### Testing state transitions
```javascript
it('should transition from state A to state B', () => {
    const initialState = { ... };
    const nextState = stateTransitionFunction(initialState, action);
    expect(nextState).toEqual(expectedState);
});
```

---

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Philosophy](https://testing-library.com/docs/guiding-principles/)
- [Project Test Strategy](../docs/TEST_STRATEGY.md)

---

*Last updated: 2026-02-05*
