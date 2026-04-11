# Transport Track Sync — Implementation Retrospective

## Summary

This document captures what went wrong during the implementation of the reaction transport track feature (PR: "Add Transport Track (play/pause) for reaction video") so the team can learn from it and avoid repeating the same mistakes.

---

## What Was Built

A new `reactionTransportTrack` array was added to the Firestore reaction document. Each entry carries a `{ t, state }` pair (state 1 = PLAYING, state 2 = PAUSED). At playback time the sync engine reads these entries and pauses/resumes the reaction player independently of the original video. The intent is to allow the original video to keep playing while the reaction is programmatically paused — or vice versa.

---

## The Core Architectural Problem

The sync engine (`twinPlayersSyncTick.ts`) was designed around a single clock: **`reactionCurrentTime`**. Every timeline lookup, config lookup, and cursor advancement uses that clock. The transport track feature introduced a requirement the architecture was not designed for:

> **The reaction player can be frozen (PAUSED) while the original video continues to advance.**

When `reactionCurrentTime` stops advancing, every future entry in every timeline (stop original at t=X, resume reaction at t=Y) becomes permanently invisible. The engine keeps returning the same stale results on every tick. This one mismatch generated a long cascade of bugs.

---

## Bug Chain (in order of discovery)

### Bug 1 — Original stopped by `handleStateChangeInReactionVideo` cascade
**Symptom:** When the transport track paused the reaction, `handleStateChangeInReactionVideo` immediately called `pauseOriginalVideo()`.  
**Root cause:** The handler unconditionally cascaded any PLAYING→PAUSED reaction transition to the original.  
**Fix applied:** Added a transport track check; skip the cascade if the transport track is responsible for the pause.  
**Lesson:** Any "pause reaction → pause original" coupling must be conditioned on the **cause** of the pause, not just the state change.

---

### Bug 2 — `shouldHoldOriginalWhilePaused` held original at PAUSED
**Symptom:** Original stopped via the sync loop's `isFineTuneModeOn` path even after Bug 1 was fixed.  
**Root cause:** `shouldHoldOriginalWhilePaused = isFineTuneModeOn && !isReactionPlaying` evaluated to `true` whenever the reaction was paused, regardless of who paused it.  
**Fix applied:** Added `!transportTrackIntendsPause` to the guard.  
**Lesson:** Every fine-tune-mode guard that gates behaviour on "reaction is paused" must ask *why* the reaction is paused.

---

### Bug 3 — Seek loop (original jerked back every ~3 s)
**Symptom:** While the reaction was transport-paused, the original looped backward every few seconds.  
**Root cause:** `computedTargetTime` is derived from the frozen `reactionCurrentTime`. The original kept drifting forward; eventually the hard-drift threshold fired and sought the original back to the frozen target.  
**Fix applied:** Gated `shouldApplySeek` on `!transportTrackIntendsPause`.  
**Lesson:** Any seek/drift-correction that computes a target from `reactionCurrentTime` must be suppressed when that clock is intentionally frozen.

---

### Bug 4 — Original configs / resume configs never fired (frozen clock)
**Symptom:** Once playing, it was impossible to stop the original with a stop-original config, or restart the reaction with a play-reaction config. The original just played to the end.  
**Root cause:** All timeline/config cursors advance by comparing the current time against entry timestamps. With `reactionCurrentTime` frozen, all entries with `t > frozenTime` were permanently in the future.  
**Fix applied:** Introduced `virtualReactionTime`: while the transport track has the reaction paused, `virtualReactionTime` advances at the rate of the original video clock (`pauseStartReactionTime + (originalNow − pauseStartOriginalTime)`). All lookups use `virtualReactionTime` instead of `reactionCurrentTime`.  
**Lesson:** A frozen clock is effectively a broken clock. Any subsystem that depends on that clock for event ordering must receive a substitute that keeps ticking.

---

### Bug 5 — Stale cursor re-paused the reaction immediately after PLAY fired
**Symptom:** After transport PLAY fired and resumed the reaction, the reaction was immediately re-paused on the next tick.  
**Root cause:** When PLAY fired, `transportPauseStart*` was cleared, which dropped `virtualReactionTime` back to the frozen `reactionCurrentTime` (~50 s). The stale-cursor enforcement on the next forward-moving tick found `PAUSE@50` was the last RT entry ≤ virtual-50 and re-emitted PAUSED.  
**Fix applied (two-part):**
1. `transportPauseStart*` is no longer cleared on PLAY. It is only cleared when `reactionCurrentTime > transportPausePlayEntryT + 0.5` (reaction has physically resumed past the PLAY entry). This keeps `virtualReactionTime` elevated until the real clock catches up.
2. The stale-cursor enforcement block is gated on `movingForwardRT` to skip the single transition tick where virtual time drops.  
**Lesson:** Clearing shared state that other subsystems depend on — at the moment an event fires — creates a one-tick window where derived values collapse. Deferred clearing based on an observable condition is safer than clearing at fire time.

---

### Bug 6 — `shouldHoldOriginalWhilePaused` blocked original PLAY during post-PLAY transition
**Symptom:** After transport PLAY fired and `transportPauseStart*` was kept alive, the reaction was still physically PAUSED for one or two ticks. During that window, `transportTrackIntendsPause` was `false` (last entry is PLAY), but `isReactionPlaying` was also `false` — so `shouldHoldOriginalWhilePaused` became `true` again, blocking the original PLAY config from firing.  
**Root cause:** The guard checked `!transportTrackIntendsPause` but not `!hasActiveTransportPause`.  
**Fix applied:** Added `!hasActiveTransportPause` to the guard.  
**Lesson:** A flag that intends "is the transport track responsible?" must cover both the PAUSE-active state **and** the post-PLAY transitional state while `transportPauseStart*` is still alive.

---

### Bug 7 — Bootstrap never ran for PAUSE@0 (reaction starts already paused)
**Symptom:** With a `PAUSE@0` entry (reaction starts in paused state), `virtualReactionTime` never advanced. All future entries were invisible from tick 0.  
**Root cause:** The forward scan that populates `transportPauseStart*` uses a strict `eventTime > previousVirtualRT` window. For `t=0` and `previousVirtualRT=0`, the condition `0 > 0` is false — the entry was never processed and `transportPauseStart*` was never set.  
**Fix applied:** Added a bootstrap block before the `virtualReactionTime` computation: if the reaction is PAUSED, transport track intends PAUSE at `reactionCurrentTime`, and no pause has ever been recorded, initialize `transportPauseStart*` immediately.  
**Lesson:** Off-by-one / open-vs-closed-interval bugs at time=0 are a classic edge case. Entry detection windows that are strict-open (`>`) must be separately handled for the boundary value.

---

## Structural Lessons

### 1. A single frozen clock breaks the entire event pipeline
The fundamental mistake was using `reactionCurrentTime` as the universal clock for all subsystems without a fallback. Any feature that intentionally pauses the reaction player needs a substitute clock — or a complete architectural separation of "reaction playback time" from "experience wall time".

### 2. Incremental patching on a flawed foundation stacks fragility
Each bug fix introduced new state (`transportPauseStart*`, `transportPausePlayEntryT`, `lastVirtualReactionTime`, `hasActiveTransportPause`) and new conditions on existing guards. By Bug 6, the `shouldHoldOriginalWhilePaused` condition had four terms, each compensating for a previous fix. This is a sign that the abstraction boundary is wrong.

### 3. Integration tests must cover the full tick sequence, not isolated ticks
The original test suite tested single ticks. Multi-tick simulation (scenarios A–I) was added only after multiple production failures. A proper TDD approach would have written 5-tick simulations of the target behaviour **before** implementing anything, and the first fix would have addressed the full clock problem rather than the immediate symptom.

### 4. "It passes integration tests" ≠ "it works"
All integration tests passed at several points during this PR, yet the feature was still broken manually. The tests did not cover the real Firestore config the user had set up. Concrete, realistic end-to-end configurations should be turned into regression tests immediately upon discovering they fail — not as an afterthought.

---

## What a Better Approach Would Look Like

1. **Separate experience time from reaction time.** Introduce an "experience wall time" that always advances (driven by wall clock or original video when reaction is paused). Use that as the universal clock for all timeline/config lookups. `reactionCurrentTime` then becomes just a player state value, not a scheduling clock.

2. **Write the target behaviour as multi-tick tests first.** Before writing any code, simulate the full 7-tick sequence (scenario I: reaction plays → both events fire at t≈112.5 → original plays → both events fire at t=115 → reaction resumes) and ensure the test fails. Then implement until it passes.

3. **Keep a single, explicit "transport pause active" state object.** Instead of four separate tracking fields that evolve through multiple conditions, use one object: `{ active: boolean, pausedAt: number, originalAtPause: number, playEntryT: number | null }`. That makes every derived value (`virtualReactionTime`, `hasActiveTransportPause`, `transportTrackIntendsPause`) a pure function of this one object.

4. **Treat guard conditions as invariants with names.** Instead of `isFineTuneModeOn && !isReactionPlaying && !hasActiveTransportPause && !transportTrackIntendsPause`, define named boolean constants (`isUserPause`, `isTransportPause`, `isPostPlayTransition`) and compose them into guards with a comment explaining the invariant each guard protects.
