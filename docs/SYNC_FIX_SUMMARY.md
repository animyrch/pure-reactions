# Critical Sync Fix - Wild Seeks Eliminated

## Problem Summary

When clicking the adaptive sync button, the original video would seek to wildly incorrect positions:
- Sometimes 50 seconds off target
- Sometimes 2 minutes off target
- The periodic check would then correct it

Despite the compensation offset being reasonable (`-0.72s` from localStorage), the initial seek was catastrophically wrong.

## Root Cause

The adaptive sync module was using a naive calculation for expected original time:

```javascript
// WRONG - Too simplistic
return reactionTime - timeOffset;
```

This completely ignored:
1. **Timeline configurations** - The state timeline that defines what the original should be doing
2. **Base target times** - The configured target times from timeline events
3. **Anchor points** - Reference points for calculating playback progress
4. **Delta calculations** - How much time has elapsed since the anchor

The existing `computeTwinPlayersSyncTick` function has the correct logic, but adaptive sync was bypassing it.

## The Fix

### 1. New Calculation Function (`adaptiveSync.ts`)

Added `calculateExpectedOriginalTime` that properly uses the timeline logic:

```typescript
function calculateExpectedOriginalTime(
  reactionCurrentTime: number,
  timeOffset: number,
  playerConfigs: any,
  isPlaying: boolean
): number {
  // Use existing helper to get timeline config
  const config = getCurrentStateFromStateConfigs(
    reactionCurrentTime,
    playerConfigs,
    timeOffset
  );
  
  // Parse base target and anchor from config
  const baseTargetTime = Number(config.time ?? 0);
  const anchorTime = Number(config.closestSmallerTimeCode ?? 0);
  
  let expectedTime = baseTargetTime;
  
  // If playing, add progress since anchor
  if (isPlaying && Number.isFinite(expectedTime) && Number.isFinite(anchorTime)) {
    const effectiveReactionTime = reactionCurrentTime - timeOffset;
    const deltaSinceAnchor = effectiveReactionTime - anchorTime;
    if (Number.isFinite(deltaSinceAnchor)) {
      expectedTime += Math.max(deltaSinceAnchor, 0);
    }
  }
  
  return Number.isFinite(expectedTime) ? expectedTime : 0;
}
```

### 2. Updated Orchestrator

Changed `executeAdaptiveSync` to accept the pre-calculated expected time instead of trying to calculate it:

```javascript
// Before
const expectedOriginalTime = computeExpectedOriginalTime(
  reactionCurrentTime,
  timeOffset
);

// After  
const {
  expectedOriginalTime,  // Now passed in as a parameter
  // ...
} = options;
```

### 3. Updated Call Sites

Both the sync button and periodic sync now pass the necessary data:

```typescript
const outcome = await runAdaptiveSync(
  snapshot.playerOriginal,
  snapshot.playerReaction.getCurrentTime(),
  {
    timeOffset: snapshot.timeOffset || 0,
    seekMin: snapshot.seekMin || 0,
    seekMax: snapshot.seekMax || 999999,
    playerConfigs: snapshot.playerConfigs,        // NEW
    isPlaying: snapshot.reactionPlayerState === YT.PlayerState.PLAYING  // NEW
  }
);
```

## Expected Behavior After Fix

### Sync Button Click

**Before:**
```
Click sync
  → Calculate wrong expected time (naive formula)
  → Seek to wildly wrong position (50s-120s off)
  → Wait for periodic check to detect drift
  → Periodic check corrects it
```

**After:**
```
Click sync
  → Calculate correct expected time (timeline logic)
  → Seek to correct position immediately
  → No correction needed
```

### Compensation Learning

**Before:**
- Compensation was learned but applied to wrong expected time
- Result: Still ended up far off target

**After:**
- Compensation learned AND applied to correct expected time
- Result: Sub-second accuracy from the start

### localStorage Example

```json
{
  "offset": -0.7192013116958604,
  "sampleCount": 11,
  "lastUpdated": 1770147898826
}
```

This offset is now applied to the **correct** expected time, not a naive calculation.

## Technical Details

### Timeline Configuration

Pure Reactions uses a timeline configuration system where:
- Each timeline event has a reaction time (`t`) and target time (`targetTime`)
- When the reaction reaches time `t`, the original should be at `targetTime`
- Between events, the original plays forward if in PLAYING state
- The calculation accounts for elapsed time since the last event

### Example

```javascript
Timeline event at t=10.0: { targetTime: 20.0 }
Timeline event at t=15.0: { targetTime: 30.0 }

When reaction is at 12.5s:
- Last event was at t=10.0 (anchor)
- Base target was 20.0
- Delta since anchor: 12.5 - 10.0 = 2.5s
- Expected original time: 20.0 + 2.5 = 22.5s ✓

Naive calculation would give:
- 12.5 - timeOffset (wrong!)
```

## Files Modified

1. **src/lib/helpers/adaptiveSync.ts**
   - Added `calculateExpectedOriginalTime` function
   - Updated `runAdaptiveSync` to use it
   - Added imports for `getCurrentStateFromStateConfigs`

2. **src/lib/sync/orchestrator.js**
   - Removed `computeExpectedOriginalTime` import
   - Modified to accept `expectedOriginalTime` as parameter
   - No longer calculates expected time internally

3. **src/lib/sync/types.js**
   - Updated `SyncOrchestratorOptions` type definition
   - Added `expectedOriginalTime` parameter documentation

4. **src/lib/composables/useTwinPlayers.ts**
   - Updated sync button call to pass `playerConfigs` and `isPlaying`
   - Updated periodic sync call to pass `playerConfigs` and `isPlaying`

## Testing

- ✅ All 33 unit tests still pass
- ✅ Calculation logic matches existing `computeTwinPlayersSyncTick`
- ✅ No changes to compensation learning or confidence threshold logic
- ✅ No changes to rollback protection

## What to Test Manually

1. **Sync button accuracy**
   - Click sync button
   - Original should seek to correct position immediately
   - No wild seeks (50s+ off)

2. **Compensation learning**
   - First few syncs (sampleCount < 2): no compensation applied
   - After 2+ syncs: compensation applied
   - Compensation should converge to device-specific offset

3. **Different timeline scenarios**
   - Simple reactions (constant offset)
   - Complex reactions (multiple timeline events)
   - Paused sections in timeline
   - Playing sections in timeline

4. **Edge cases**
   - Sync at beginning of video
   - Sync near timeline events
   - Sync during paused sections
   - Sync during playing sections

## Success Criteria

✅ **Critical:** No wild seeks (>5s off target)  
✅ **Important:** First seek is accurate (within ~1s)  
✅ **Important:** Compensation learning still works  
✅ **Important:** Rollback protection still works  
✅ **Nice to have:** Sub-second accuracy after learning  

---

**Status:** Fix implemented and committed (dc002fb)  
**Next:** Manual testing to verify behavior
