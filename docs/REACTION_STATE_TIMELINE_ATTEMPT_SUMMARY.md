# Reaction State Timeline Attempt Summary

Date: 2026-04-03

Status: unresolved

This note summarizes the reaction-state timeline work, the bugs we actually fixed, the assumptions that were wrong, and the constraints we should respect before touching this area again.

## Goal

- Add a fine-tune track for reaction-side play/pause configs.
- Support config-driven reaction pause gaps without breaking original-video sync.
- Keep the editor/runtime scrubber visually aligned with pause-gap virtualization.

## What Was Implemented

### 1. Reaction-side config editing

- Added `reactionStateTimeline` CRUD in `src/lib/helpers/twinPlayersEditorController.ts`.
- Added a new `Reaction video` track in `src/lib/components/Video/InteractiveSynchronizer.svelte`.
- Added normalization and dispatch logic in `src/lib/components/Video/ConfigEditorV2.svelte`.
- Wired panel/page callbacks through `src/lib/components/reaction/EditorPanelsV2.svelte` and `src/routes/edit-reaction/[slug]/+page.svelte`.

### 2. Reaction pause-gap virtualization

- Added pause-extension derivation in `src/lib/helpers/twinPlayersPauseExtensionSpans.ts`.
- Added virtual timeline projection helpers in `src/lib/helpers/twinPlayersVirtualTimeline.ts`.
- Added live pause-gap clock logic in `src/lib/helpers/twinPlayersPauseGapClock.ts`.
- Fed virtual scrubber/editor projections into reaction, playlist, and edit pages.

### 3. Attempted runtime timing fix

- Added `src/lib/helpers/twinPlayersStateTimelineProjection.ts`.
- Changed `src/lib/helpers/twinPlayersPlaybackSyncController.ts` to project original state timeline entries into experience time before sync.
- Changed `src/lib/helpers/twinPlayersSyncTick.ts` to prefer the passed timeline array over `playerConfigs` for current-state lookup.

## Bugs That Were Actually Fixed

### Missing action wiring for reaction config CRUD

This was a real bug.

- `createReactionStateConfig`, `updateReactionStateConfig`, and `deleteReactionStateConfig` were implemented in the editor controller.
- They were not wired through `src/lib/composables/useTwinPlayers.ts`.
- Result: reaction markers could appear from existing data, but create/delete from fine-tune did not work.

That wiring issue is fixed and should be kept.

## What We Got Wrong

### 1. We changed runtime time-base behavior before reproducing the exact failing doc

We moved from symptoms to theory too quickly.

- We should have reproduced the user's exact failing reaction document first.
- We instead reasoned from synthetic configs and simplified test shapes.
- That made it too easy to "prove" a theory with a synthetic test while still missing the real runtime bug.

### 2. We over-trusted passing tests

The tests we added or passed do not prove the real bug is solved.

- Integration tests can validate a theory, but not necessarily the real production path.
- Mocked player tests are especially weak when timing, buffering, route-level projections, and state-change handlers all interact.
- Passing tests after the projection change did not match the user's report, so the tests are incomplete for this failure mode.

### 3. We likely violated an important runtime contract

The current architecture around pause virtualization has a key constraint:

- `reactionStateTimeline` is experience-time oriented and exists to derive pause extensions.
- Route/editor scrubbers may project raw reaction time into virtual time.
- Runtime playback/sync/scheduling for original-state configs are supposed to remain raw-time based unless the contract is intentionally redesigned end to end.

The attempt to project `stateTimeline` inside `src/lib/helpers/twinPlayersPlaybackSyncController.ts` is therefore suspect.

It may help one synthetic boundary case while breaking or masking another runtime path.

### 4. We treated `stateTimeline` and `playerConfigs` as interchangeable when they are not safely interchangeable anymore

Historically they can describe the same logical config, but once pause virtualization is involved the system must be explicit about which one is authoritative for:

- raw-time runtime sync
- experience-time editor projection
- boundary scheduling
- immediate state-change handlers

Mixing these without a single source of truth creates bugs that are hard to reason about.

## Why The Last Runtime Fix Should Be Treated As Unconfirmed

The user reported the bug still exists after the projection-based runtime fix.

That means at least one of these is true:

- the theory was incomplete
- the theory was wrong
- the fix only covered one code path
- another handler still uses a different time base and overrides the main sync loop

The last attempted fix should therefore not be treated as established truth just because it passed tests.

## Most Likely Remaining Failure Surfaces

### A. Main sync loop versus direct state-change handlers

The original-state decision may differ between:

- `runSyncCycle` in `src/lib/helpers/twinPlayersPlaybackSyncController.ts`
- `handleStateChangeInReactionVideo(...)`
- startup / resume logic such as `startVideos()` and `handlePlayStateChange(...)`

If those paths use different time bases or different config sources, the original can stop at the wrong boundary even when the editor marker looks correct.

### B. Live pause-gap clock tolerance / resume hold behavior

The live pause-gap clock may still be interacting with the resume boundary in a way that causes premature original-state evaluation.

### C. Editor display is correct, runtime decision is wrong

This is still a strong possibility.

- The visual marker can be positioned from projected/editor time.
- The runtime stop can still be selected from a raw-time decision path.

If so, the bug is not a marker-placement problem. It is a runtime config-selection problem.

## Debugging Rules For The Next Attempt

### Rule 1. Reproduce the exact failing document first

Do not begin from a synthetic timeline or a guessed config.

Start from the exact failing reaction document and boundary the user reported.

### Rule 2. Instrument before changing behavior

Before any more fixes, add temporary logs at the failing boundary for:

- raw reaction current time
- experience / virtual current time
- chosen reaction config entry
- chosen original config entry
- `stateTimelineIndex`
- emitted `applyOriginalStateChange` actions
- live pause-gap clock fields
- whether the decision came from the sync loop, a resume handler, or a direct state-change handler

### Rule 3. Verify one boundary across all decision paths

At the exact bad moment, compare the decision made by:

- the sync loop
- `handleStateChangeInReactionVideo(...)`
- startup / resume paths

If they disagree, fix that disagreement before adding new abstractions.

### Rule 4. Do not redefine time-base contracts casually

If runtime original-state sync truly needs experience-time configs, redesign that intentionally and document it.

Do not partially switch one file or one helper to virtual time while the rest of runtime still assumes raw time.

### Rule 5. Treat passing tests as necessary, not sufficient

Any new test must cover the real failing config shape, not only a simplified version of it.

## Recommended Next Move

The next debugging pass should do this in order:

1. Reproduce the exact failing reaction document.
2. Add temporary logging around the bad boundary in `src/lib/helpers/twinPlayersPlaybackSyncController.ts`.
3. Capture which path emits the wrong original stop.
4. Confirm whether runtime is incorrectly reading raw time, virtual time, or mixed sources.
5. Only then decide whether to keep, revise, or revert `src/lib/helpers/twinPlayersStateTimelineProjection.ts`.

## Files To Revisit First

- `src/lib/helpers/twinPlayersPlaybackSyncController.ts`
- `src/lib/helpers/twinPlayersSyncTick.ts`
- `src/lib/helpers/reaction.js`
- `src/lib/helpers/twinPlayersStateTimelineProjection.ts`
- `src/lib/components/Video/ConfigEditorV2.svelte`
- `src/routes/edit-reaction/[slug]/+page.svelte`

## Bottom Line

Two facts are solid:

- the reaction config CRUD wiring bug was real and fixed
- the remaining original-stop timing bug is still unresolved

The biggest lesson is simple:

Do not change runtime time-base behavior from theory alone. Reproduce the exact failing document, instrument the exact boundary, and only then make a targeted fix.