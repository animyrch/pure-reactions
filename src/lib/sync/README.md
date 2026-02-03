# Adaptive Sync Mechanism Module

> Player-agnostic drift-aware synchronization for Pure Reactions

## Overview

The adaptive sync module provides intelligent video synchronization that:

- **Avoids unnecessary seeks** when videos are already aligned (< 0.10s drift)
- **Learns device-specific latency** and compensates over time
- **Never makes sync worse** - includes rollback on catastrophic failure
- **Is player-agnostic** - designed for YouTube today, extensible for future players
- **Is thoroughly tested** - 33 unit tests covering all core logic

## Architecture

The module follows **single-responsibility principles** with clear separation:

```
src/lib/sync/
├── types.js              # JSDoc type definitions
├── drift.js              # Pure drift calculation functions
├── decision.js           # Pure decision logic (thresholds, strategy)
├── compensationStore.js  # localStorage wrapper (isolated side effects)
├── settle.js             # Player settle timing helpers
├── orchestrator.js       # Main sync coordination logic
├── adapters/
│   └── youtube.js        # YouTube IFrame API adapter
├── index.js              # Public API exports
└── integration-example.js # Usage example
```

## Key Concepts

### Drift

**Drift** = Actual Original Time - Expected Original Time

- `drift ≈ 0` → videos are in sync
- `drift < 0` → original is behind
- `drift > 0` → original is ahead

### Thresholds

- **Ignore**: < 0.10s - sync is skipped
- **Soft**: 0.10s - 0.30s - soft correction (future: playback rate nudge)
- **Hard**: ≥ 0.30s - hard seek required
- **Catastrophic**: increase > 0.50s - rollback triggered

### Compensation Learning

The module learns device-specific seek latency and stores it in `localStorage`:

- **Key format**: `pr_sync_compensation_<playerType>_<deviceClass>_<browser>`
- **Bounded averaging**: gradual convergence (alpha = 0.3)
- **Clamped**: ±2.0s maximum offset
- **Noise filtering**: ignores drift < 0.05s

## Usage

### Basic Integration

```javascript
import { executeAdaptiveSync, YouTubePlayerAdapter } from '$lib/sync';

// Wrap your YouTube player
const playerAdapter = new YouTubePlayerAdapter(ytPlayerInstance);

// Execute sync
const outcome = await executeAdaptiveSync({
  originalPlayer: playerAdapter,
  reactionCurrentTime: 42.5,
  reactionConfig: {
    timeOffset: 10.0,
    seekMin: 0,
    seekMax: 300
  },
  deviceProfile: {
    playerType: 'youtube',
    deviceClass: 'mobile', // or 'desktop'
    browser: 'chrome' // optional
  },
  settleMs: 500 // optional, default 500ms
});

console.log('Sync outcome:', {
  improved: outcome.improved,
  initialDrift: outcome.initialDrift.drift,
  finalDrift: outcome.finalDrift.drift
});
```

### Manual Sync Button

See `integration-example.js` for a complete handler that:
- Detects device class and browser
- Wraps the YouTube player
- Executes sync
- Provides user feedback

### Integration with useTwinPlayers

Add a manual sync function to the composable:

```javascript
// In useTwinPlayers.ts
import { handleManualSync } from '$lib/sync/integration-example';

export function useTwinPlayers(...) {
  // ... existing code
  
  const manualSync = async () => {
    if (!playerOriginal || !playerReaction) {
      return;
    }
    
    await handleManualSync({
      originalYtPlayer: playerOriginal,
      reactionCurrentTime: playerReaction.getCurrentTime(),
      timeOffset: timeOffset.value,
      seekMin: seekMin.value,
      seekMax: seekMax.value
    });
  };
  
  return {
    // ... existing returns
    manualSync
  };
}
```

## API Reference

### Main Functions

#### `executeAdaptiveSync(options)`

Main orchestrator function that performs adaptive sync.

**Parameters:**
- `options.originalPlayer` - PlayerAdapter instance
- `options.reactionCurrentTime` - Current reaction video time
- `options.reactionConfig.timeOffset` - Time offset from config
- `options.reactionConfig.seekMin` - Minimum seek position
- `options.reactionConfig.seekMax` - Maximum seek position
- `options.deviceProfile.playerType` - Player type (e.g., 'youtube')
- `options.deviceProfile.deviceClass` - 'mobile' or 'desktop'
- `options.deviceProfile.browser` - Optional browser identifier
- `options.settleMs` - Optional settle duration (default: 500ms)

**Returns:** `Promise<SyncOutcome>`

### Pure Functions (for testing/custom logic)

#### Drift Calculation
- `computeExpectedOriginalTime(reactionTime, timeOffset)` - Calculate expected original time
- `computeDrift(actualTime, expectedTime)` - Calculate drift
- `createDriftMeasurement(actual, expected, timestamp)` - Create measurement snapshot
- `getAbsoluteDrift(drift)` - Get absolute drift value

#### Decision Logic
- `shouldIgnoreSync(drift)` - Check if below ignore threshold
- `decideSyncStrategy(drift)` - Determine sync strategy
- `didSyncImprove(initial, final)` - Check if sync improved
- `detectCatastrophicWorsening(initial, final)` - Check for catastrophic failure

#### Compensation
- `loadCompensation(profile)` - Load from localStorage
- `saveCompensation(profile, data)` - Save to localStorage
- `updateCompensationWithBoundedAverage(current, observedDrift)` - Update with bounded average
- `resetCompensation(profile)` - Reset compensation
- `clampCompensation(value)` - Clamp to bounds
- `buildStorageKey(profile)` - Build storage key

#### Settle
- `waitForPlayerSettle(durationMs)` - Wait for player to stabilize
- `samplePlayerTimeMedian(getTime, sampleCount, intervalMs)` - Sample time with median filter

### Player Adapter Interface

Implement this interface to support new player types:

```javascript
class CustomPlayerAdapter {
  getCurrentTime() { return number; }
  seek(time) { /* seek to time */ }
  getPlayerState() { return number; }
  setPlaybackRate(rate) { /* optional */ }
}
```

## Testing

Unit tests are in `tests/sync.unit.spec.mjs`:

```bash
npm run test:unit
```

**Coverage:**
- ✓ 6 drift calculation tests
- ✓ 2 ignore threshold tests
- ✓ 4 sync strategy tests
- ✓ 5 outcome detection tests
- ✓ 4 compensation clamping tests
- ✓ 4 moving average tests
- ✓ 3 storage key tests
- ✓ 3 localStorage tests
- ✓ 2 threshold constant tests

**Total: 33 tests passing**

## Future Enhancements

1. **Soft correction via playback rate**
   - For drift between 0.10s - 0.30s
   - Gradually nudge playback rate instead of seeking
   - Requires player support (YouTube IFrame API limitations)

2. **Additional player adapters**
   - Vimeo
   - Custom HTML5 video
   - Other platforms

3. **Telemetry dashboard**
   - Track sync outcomes per device profile
   - Identify problematic devices
   - Tune thresholds based on real data

4. **Adaptive settle duration**
   - Learn optimal settle time per device
   - Reduce latency on fast devices
   - Increase on slow devices

## Troubleshooting

### Sync keeps triggering but doesn't improve

- Check if compensation is growing unbounded (shouldn't, but verify in localStorage)
- Verify settle duration is sufficient for your device (increase if needed)
- Check for drift sources outside sync (e.g., network jitter, decode lag)

### Sync makes things worse

- The module should detect this and rollback automatically
- Check console for `[AdaptiveSync] Catastrophic worsening detected!`
- Compensation will be updated to prevent recurrence

### localStorage is full

- Each device profile uses ~100 bytes
- Module handles storage errors gracefully
- Can manually clear: `localStorage.removeItem('pr_sync_compensation_*')`

## License

Part of Pure Reactions project.
