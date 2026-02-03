# Soft-Sync Module

Provides playback-rate-based synchronization for small drift between twin YouTube players.

## Overview

This module implements a "soft-sync" strategy that uses temporary playback speed adjustments instead of seeking for small drift corrections. This eliminates jarring jumps and provides a smoother viewing experience.

## Strategy

The module operates on three sync modes based on drift magnitude:

1. **No-op** (`|drift| < 0.10s`): Videos are already well-synchronized, no action needed
2. **Soft-sync** (`0.10s ≤ |drift| ≤ 2.0s`): Apply temporary playback rate adjustment
3. **Hard-sync** (`|drift| > 2.0s`): Use existing seek-based synchronization

## Configuration

Default configuration values (in `logic.js`):

```javascript
{
  noOpThreshold: 0.10,     // Below this, do nothing
  softSyncMax: 2.0,         // Above this, use hard-sync
  minPlaybackRate: 0.90,    // Minimum playback rate (slow down)
  maxPlaybackRate: 1.10,    // Maximum playback rate (speed up)
  cooldownMs: 750           // Minimum time between soft-sync attempts
}
```

## How It Works

### Drift Calculation

```
drift = originalCurrentTime - expectedOriginalTime
```

- **Positive drift**: Original video is ahead → slow down original
- **Negative drift**: Original video is behind → speed up original

### Playback Rate Adjustment

The playback rate scales linearly with drift magnitude:

- For maximum drift (2.0s), use maximum rate adjustment (0.90 or 1.10)
- For minimum drift (0.10s), use minimal rate adjustment (closer to 1.0)
- Rate is always clamped to [0.90, 1.10] for imperceptible correction

### Duration

Correction duration also scales with drift:

- Minimum: 1200ms (for small drift)
- Maximum: 2500ms (for larger drift)
- After duration expires, playback rate resets to the configured rate from timelines

### Cooldown

A 750ms cooldown prevents rapid oscillation between soft-sync attempts.

## Architecture

### Pure Logic (`logic.js`)

Stateless, deterministic functions for:

- Drift calculation
- Sync mode decision
- Playback rate computation
- Duration calculation

These functions are unit-tested and have no side effects.

### Orchestrator (`orchestrator.js`)

Handles side effects and coordinates soft-sync:

- Applies playback rate changes
- Schedules reset timers
- Falls back to hard-sync on errors
- Respects guard conditions (buffering, scrubbing, etc.)

### Integration

The module integrates with the existing twin player sync system:

1. **Sync Tick** (`twinPlayersSyncTick.ts`): Detects drift and emits `applySoftSync` actions
2. **Composable** (`useTwinPlayers.ts`): Applies soft-sync actions and manages reset timers
3. **Tracking**: Soft-sync state is tracked in `syncTracking` object

## Testing

Run unit tests:

```bash
node --test src/lib/sync/softSync/logic.test.js
node --test src/lib/sync/softSync/orchestrator.test.js
```

All tests pass:
- 35 logic tests
- 16 orchestrator tests

## Usage Example

```javascript
import {
  calculateDrift,
  decideSyncMode,
  computePlaybackRate,
  computeSoftSyncDuration
} from '$lib/sync/softSync';

// Calculate drift
const drift = calculateDrift(originalTime, reactionTime, timeOffset);

// Decide mode
const mode = decideSyncMode(drift);

if (mode === 'soft-sync') {
  const rate = computePlaybackRate(drift);
  const durationMs = computeSoftSyncDuration(drift);
  
  // Apply rate for durationMs, then reset
}
```

## Design Principles

1. **Small, focused files**: Each file has a single responsibility
2. **Pure logic separation**: Side effects are isolated from pure functions
3. **Testability**: All logic is unit-testable without mocks
4. **Documentation**: Code is self-documenting with clear variable names
5. **No spaghetti**: Clean separation of concerns throughout

## Future Improvements

Potential enhancements (not in scope for this ticket):

- Adaptive thresholds based on network conditions
- Different strategies for different video scenarios
- Telemetry for monitoring soft-sync effectiveness
- User-facing controls for sync sensitivity
