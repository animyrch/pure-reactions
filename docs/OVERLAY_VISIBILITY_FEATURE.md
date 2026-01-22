# Overlay Visibility Track Feature

## Overview
This feature implements a dedicated timeline track to control overlay visibility in fullscreen mode, allowing creators to temporarily hide the overlay to emphasize main content or reduce visual noise during key moments.

## Implementation Summary

### Data Layer
- **New Timeline Field**: `overlayVisibilityTimeline` - array of `{ t: number, visible: boolean }` entries
- **Helper Functions**:
  - `overlayVisibilityTimelineArrayToMap()` in `twinPlayersTimeline.ts` - converts timeline to map
  - `getCurrentOverlayVisibilityFromConfigs()` in `reaction.js` - gets current visibility state

### Sync Logic
- **Type Extensions**:
  - `TwinPlayersSyncTickInput` now includes `overlayVisibilityTimeline`, `isFullscreen`, and `currentFullscreenOverlayVisible`
  - `TwinPlayersSyncTickResult.stateUpdates` now includes `fullscreenOverlayVisible`
- **Computation**: `computeTwinPlayersSyncTick()` evaluates overlay visibility only when `isFullscreen` is true
- **Scheduling**: Overlay visibility timeline boundaries are included in sync scheduler for precise timing

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
- **Stateful**: Visibility persists from config until changed by another config
- **Fullscreen Only**: Visibility control only applies when `isFullscreen` is true
- **Smooth Transitions**: 300ms ease-cinematic opacity transitions

## Testing
- **Fixture**: `twin-overlay-visibility.json` - demonstrates overlay hiding at t=3s and showing at t=6s
- **Test Suite**: `twin-player-overlay-visibility.spec.js` - validates:
  - Default visibility state
  - Hiding at configured time
  - Showing again after configured time
  - Always visible in non-fullscreen
  - Reset to visible when exiting fullscreen

## Usage Example
To create a reaction with overlay visibility control:

```json
{
  "overlayVisibilityTimeline": [
    { "t": 0, "visible": true },     // Start visible
    { "t": 45, "visible": false },   // Hide at 45 seconds
    { "t": 90, "visible": true }     // Show again at 90 seconds
  ]
}
```

## Technical Notes
- Follows existing timeline patterns (volume, playback rate)
- No implicit resets between configs
- Only affects fullscreen mode
- No effect on non-fullscreen layouts
- Smooth opacity transitions maintain cinematic feel

## Future Enhancements
The editor UI for creating/editing overlay visibility configs is not included in this implementation, as the issue focuses on fullscreen playback behavior. This can be added in a future enhancement.
