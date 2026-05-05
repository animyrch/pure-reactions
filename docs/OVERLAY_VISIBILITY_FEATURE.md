# Overlay Timeline Feature

## Overview
This feature implements a dedicated **Overlay** timeline track where each cue stores a full overlay snapshot:

- `visible` (`boolean`)
- `primary` (`"original" | "reaction"`)

This enables creators to author one cue that fully defines overlay behavior at that timestamp.

## Implementation Summary

### Data Layer
- **Timeline Field**: `overlayVisibilityTimeline` - array of `{ t: number, visible: boolean, primary: "original" | "reaction" }` entries
- **Helper Functions**:
  - `overlayVisibilityTimelineArrayToMap()` in `twinPlayersTimeline.ts` - converts timeline to map
  - `getCurrentOverlaySnapshotFromConfigs()` in `reaction.js` - resolves active overlay snapshot

### Sync Logic
- **Type Extensions**:
  - `TwinPlayersSyncTickInput` includes overlay timeline + static primary fallback + current applied overlay state
  - `TwinPlayersSyncTickResult.stateUpdates` includes both `fullscreenOverlayVisible` and `fullscreenPrimaryVideo`
- **Computation**: `computeTwinPlayersSyncTick()` resolves one overlay snapshot at the current reaction time and applies it atomically
- **Scheduling**: Overlay timeline boundaries are included in sync scheduling for deterministic boundary switching

### State Management
- **Composable State**: `TwinPlayersState` includes:
  - `overlayVisibilityTimeline: any[]` - the timeline data
  - `fullscreenOverlayVisible: boolean` - current visibility state
- **Initialization**: Visibility defaults to `true`
- **Reset on Exit**: When exiting fullscreen, visibility is reset to `true`

### UI Components
- **FullscreenChrome**: Applies `opacity-100` (visible) or `opacity-0 pointer-events-none` (hidden) classes with 300ms transition
- **ReactionStage**: Applies same visibility logic to overlay containers in fullscreen/mobile landscape
- **All Pages Wired**: reaction, playlist, and edit-reaction pages all pass `fullscreenOverlayVisible` prop

### Timeline Semantics
- **Stateful snapshots**: Last cue at or before `t` is active
- **Carry-forward defaults**:
  - first cue defaults to static values (`visible: true`, static `fullscreenPrimaryVideo`)
  - later cues default to previous active overlay snapshot
- **Backward compatible**: Legacy visibility-only cues are normalized by carrying forward `primary`

## Testing
- **Fixture**: `twin-overlay-visibility.json` - demonstrates overlay hiding at t=3s and showing at t=6s
- **Test Suite**: `twin-player-overlay-visibility.spec.js` - validates:
  - Default visibility state
  - Hiding at configured time
  - Showing again after configured time
  - Always visible in non-fullscreen
  - Reset to visible when exiting fullscreen

## Usage Example
To create a reaction with overlay snapshot control:

```json
{
  "overlayVisibilityTimeline": [
    { "t": 0, "visible": true, "primary": "original" },
    { "t": 45, "visible": false, "primary": "reaction" },
    { "t": 90, "visible": true, "primary": "reaction" }
  ]
}
```

## Technical Notes
- Follows existing timeline patterns (volume, playback rate)
- No implicit resets between configs
- Applied consistently across fullscreen, desktop overlay mode, and mobile landscape mode
- Smooth opacity transitions maintain cinematic feel
