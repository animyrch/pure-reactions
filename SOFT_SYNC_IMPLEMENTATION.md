# Soft-Sync Implementation Summary

## Implementation Overview

This document summarizes the soft-sync implementation that adds playback-rate-based synchronization for small drift between twin YouTube players.

## Requirements Met

### ✅ Drift Strategy

The implementation correctly handles three drift scenarios:

1. **No-op** (`|drift| < 0.10s`): No action taken, videos are well-synchronized
2. **Soft-sync** (`0.10s ≤ |drift| ≤ 2.0s`): Temporary playback speed adjustment applied
3. **Hard-sync** (`|drift| > 2.0s`): Existing seek-based synchronization used

### ✅ Drift Calculation

Implemented in `src/lib/sync/softSync/logic.js`:

```javascript
drift = originalCurrentTime - expectedOriginalTime
```

- Positive drift: original ahead → slow down original
- Negative drift: original behind → speed up original

### ✅ Soft-Sync Best Practices

- **Subtle rates**: Bounded to [0.90, 1.10] for imperceptible correction
- **Direction-aware**: Speeds up or slows down based on drift sign
- **Always resets**: Returns to configured rate (or 1.0) after duration
- **Cooldown**: 750ms minimum between soft-sync attempts
- **Guard conditions**: Skips soft-sync when:
  - Not playing
  - Buffering
  - User is scrubbing  
  - Playback rate changes disabled

### ✅ Implementation Architecture

#### Small, Focused Modules

**`src/lib/sync/softSync/logic.js`** (Pure logic)
- `calculateDrift()` - Drift calculation
- `decideSyncMode()` - Mode decision (no-op/soft/hard)
- `computePlaybackRate()` - Rate computation with clamping
- `computeSoftSyncDuration()` - Duration scaling
- `createSoftSyncDecision()` - Decision creation
- `isSoftSyncAllowed()` - Cooldown check

**`src/lib/sync/softSync/orchestrator.js`** (Side effects)
- `applySoftSync()` - Main orchestrator with guards
- `createInitialSoftSyncState()` - State initialization
- `cleanupSoftSync()` - Cleanup function

**`src/lib/sync/softSync/index.js`** (Public API)
- Re-exports all public functions

### ✅ Unit Tests

**`src/lib/sync/softSync/logic.test.js`**
- 35 tests covering all pure logic functions
- Tests for edge cases, clamping, stability

**`src/lib/sync/softSync/orchestrator.test.js`**
- 16 tests covering orchestration and side effects
- Tests for guard conditions, cooldown, fallback

All tests pass using Node.js test runner:
```bash
node --test src/lib/sync/softSync/logic.test.js      # 35/35 passed
node --test src/lib/sync/softSync/orchestrator.test.js # 16/16 passed
```

### ✅ Integration Points

#### 1. Sync Tick (`src/lib/helpers/twinPlayersSyncTick.ts`)

Added soft-sync decision logic:

```typescript
// Lines 465-525: Soft-sync decision and action generation
const isPlaying = effectiveConfigState === yt.PLAYING && input.originalPlayerState === yt.PLAYING;
const canUseSoftSync = isPlaying && !isBuffering && !shouldApplyState && Number.isFinite(driftAbs);
const syncMode = canUseSoftSync ? decideSyncMode(drift, DEFAULT_SOFT_SYNC_CONFIG) : 'hard-sync';

if (canUseSoftSync && syncMode === 'soft-sync' && targetMismatch && isSoftSyncCooledDown) {
  actions.push({
    type: 'applySoftSync',
    rate: computePlaybackRate(drift, DEFAULT_SOFT_SYNC_CONFIG),
    durationMs: computeSoftSyncDuration(drift, DEFAULT_SOFT_SYNC_CONFIG),
    drift
  });
  // ... update tracking
} else {
  // Fall through to hard-sync logic
}
```

Added new action type:
```typescript
export type TwinPlayersSyncAction =
  | { type: 'applySoftSync'; rate: number; durationMs: number; drift: number }
  | ... // existing actions
```

Added tracking fields:
```typescript
export type TwinPlayersSyncTracking = {
  lastSoftSyncAt: number;
  softSyncIsActive: boolean;
  softSyncResetTimeoutId?: number;
  // ... existing fields
};
```

#### 2. Composable (`src/lib/composables/useTwinPlayers.ts`)

Initialized tracking:
```typescript
const syncTracking: TwinPlayersSyncTracking = {
  lastSoftSyncAt: 0,
  softSyncIsActive: false,
  softSyncResetTimeoutId: undefined,
  // ... existing fields
};
```

Added soft-sync action handling (lines 1183-1273):
```typescript
// Filter out playback rate config actions during soft-sync
const softSyncAction = result.actions.find((a: any) => a.type === 'applySoftSync');
const filteredActions = softSyncAction || syncTracking.softSyncIsActive
  ? result.actions.filter((a: any) => a.type !== 'setOriginalPlaybackRate')
  : result.actions;

if (softSyncAction) {
  // Apply soft-sync rate
  setPlaybackRateForOriginalVideo(softSyncAction.rate);
  
  // Schedule reset to config rate
  syncTracking.softSyncResetTimeoutId = setTimeout(() => {
    const desiredRate = getCurrentPlaybackRateFromConfigs(...);
    setPlaybackRateForOriginalVideo(desiredRate);
    updateState({ currentPlaybackRate: desiredRate });
    syncTracking.softSyncIsActive = false;
  }, softSyncAction.durationMs);
} else if (syncTracking.softSyncIsActive) {
  // Reset immediately if no longer needed
  const desiredRate = getCurrentPlaybackRateFromConfigs(...);
  setPlaybackRateForOriginalVideo(desiredRate);
  syncTracking.softSyncIsActive = false;
}
```

Added cleanup on destroy:
```typescript
onDestroy(() => {
  if (typeof syncTracking.softSyncResetTimeoutId === 'number') {
    clearTimeout(syncTracking.softSyncResetTimeoutId);
  }
  // ... existing cleanup
});
```

## Configuration

Default values (can be customized):

```javascript
{
  noOpThreshold: 0.10,      // 100ms
  softSyncMax: 2.0,         // 2 seconds
  minPlaybackRate: 0.90,    // 10% slower
  maxPlaybackRate: 1.10,    // 10% faster
  cooldownMs: 750           // 750ms cooldown
}
```

## Observability

Internal debug logging can be added via console.warn in orchestrator for:
- Drift before sync
- Selected mode (no-op/soft-sync/hard-sync)
- Playback rate applied and duration
- Fallback events (rate unsupported, buffering, etc.)

Currently minimal logging exists only for error cases.

## Acceptance Criteria

✅ **Sync does nothing when videos are already aligned**
- Implemented via `decideSyncMode()` returning 'no-op' for drift < 0.10s
- No action generated, no player calls made

✅ **For desync ≤ 2s, Sync does not seek and uses playback speed correction**
- Implemented via `decideSyncMode()` returning 'soft-sync' for 0.10s ≤ drift ≤ 2.0s
- `applySoftSync` action generated with appropriate rate
- No seek action generated

✅ **For desync > 2s, existing hard-sync behavior is used**
- Implemented via `decideSyncMode()` returning 'hard-sync' for drift > 2.0s
- Falls through to existing `applyOriginalStateChange` action
- Seek-based sync used as before

✅ **No more wild jumps to far timestamps**
- Small drift now handled via imperceptible playback rate changes
- Large drift still uses seek but with existing throttling

✅ **Playback rate reliably returns to configured value**
- Reset timer always fires after `durationMs`
- Reset uses `getCurrentPlaybackRateFromConfigs()` to get correct timeline value
- Cleanup on destroy prevents orphaned timers

✅ **Unit tests cover decision logic and orchestration paths**
- 51 total unit tests (35 logic + 16 orchestrator)
- All paths tested including error cases and edge conditions

## File Structure

```
src/lib/sync/softSync/
├── README.md              # Module documentation
├── index.js               # Public API exports
├── logic.js               # Pure logic functions
├── logic.test.js          # Logic unit tests
├── orchestrator.js        # Side effect coordination
└── orchestrator.test.js   # Orchestrator unit tests
```

## Future Enhancements

Potential improvements not in scope for this ticket:

1. **Adaptive thresholds**: Adjust based on network conditions or device performance
2. **Telemetry**: Track soft-sync effectiveness and drift patterns
3. **User controls**: Allow users to adjust sync sensitivity
4. **Multi-platform**: Extend beyond YouTube to other video platforms
5. **Predictive sync**: Anticipate drift based on historical patterns

## Testing Strategy

### Unit Tests
```bash
npm test src/lib/sync/softSync/logic.test.js
npm test src/lib/sync/softSync/orchestrator.test.js
```

### E2E Tests
Existing Playwright tests should continue to pass:
```bash
npm run e2e
```

The soft-sync should be transparent to E2E tests - they should see improved sync behavior without requiring test changes.

### Manual Testing
1. Load a reaction with twin players
2. Observe sync behavior during playback
3. Check that:
   - Small drift corrections are smooth (no visible jumps)
   - Large drift still triggers seeks
   - Playback rate returns to normal after correction
   - No oscillation or jerky behavior

## Conclusion

The soft-sync implementation successfully addresses the issue of jarring seeks for small drift by using temporary playback rate adjustments. The implementation is:

- **Modular**: Small, focused files with clear responsibilities
- **Testable**: Pure logic separated from side effects, comprehensive unit tests
- **Safe**: Guard conditions prevent inappropriate application
- **Backward compatible**: Existing hard-sync logic preserved for large drift
- **Well-documented**: Inline comments, JSDoc types, and README

The implementation follows all specified requirements and best practices from the issue description.
