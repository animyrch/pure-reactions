# Adaptive Sync Mechanism - Architecture Diagrams

## Module Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Adaptive Sync Module                         │
│                   (src/lib/sync/)                                │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│  Pure Logic  │        │ Side Effects │        │   Adapters   │
│  (Testable)  │        │  (Isolated)  │        │ (Extensible) │
└──────────────┘        └──────────────┘        └──────────────┘
        │                        │                        │
        │                        │                        │
  ┌─────┴─────┐          ┌──────┴──────┐        ┌────────┴────────┐
  │           │          │             │        │                 │
  ▼           ▼          ▼             ▼        ▼                 ▼
┌──────┐  ┌──────────┐ ┌────────┐ ┌─────────┐ ┌─────────┐    ┌─────────┐
│drift │  │decision  │ │  comp  │ │ settle  │ │ youtube │    │ future  │
│      │  │          │ │ Store  │ │         │ │         │    │ players │
└──────┘  └──────────┘ └────────┘ └─────────┘ └─────────┘    └─────────┘
   │           │            │           │            │
   │           │            │           │            │
   └───────────┴────────────┴───────────┴────────────┘
                           │
                           ▼
                   ┌──────────────┐
                   │ orchestrator │
                   │   (Main)     │
                   └──────────────┘
```

## Sync Flow Diagram

```
User clicks "Sync" button
         │
         ▼
┌─────────────────────────────────────┐
│  handleManualSync                    │
│  (integration-example.js)            │
│  - Wrap YT player                    │
│  - Build device profile              │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  executeAdaptiveSync                 │
│  (orchestrator.js)                   │
└─────────────────┬───────────────────┘
                  │
      ┌───────────┴───────────┐
      │                       │
      ▼                       ▼
┌──────────┐           ┌──────────┐
│ STEP 1:  │           │ Pure     │
│ Measure  │◄──────────┤ drift.js │
│ Initial  │           │          │
│ Drift    │           └──────────┘
└────┬─────┘
     │
     ▼
┌──────────┐           ┌──────────┐
│ STEP 2:  │           │ Pure     │
│ Decide   │◄──────────┤ decision │
│ Strategy │           │   .js    │
└────┬─────┘           └──────────┘
     │
     ├─ drift < 0.10s? → RETURN (skip sync)
     │
     ▼
┌──────────┐           ┌──────────┐
│ STEP 3:  │           │ Side-fx  │
│ Load     │◄──────────┤ compStore│
│ Compens. │           │   .js    │
└────┬─────┘           └──────────┘
     │
     ▼
┌──────────┐           ┌──────────┐
│ STEP 4:  │           │ Adapter  │
│ Seek To  │──────────►│ youtube  │
│ Target   │           │   .js    │
└────┬─────┘           └──────────┘
     │
     ▼
┌──────────┐           ┌──────────┐
│ STEP 5:  │           │ Side-fx  │
│ Settle   │◄──────────┤ settle   │
│ Wait     │           │   .js    │
└────┬─────┘           └──────────┘
     │
     ▼
┌──────────┐           ┌──────────┐
│ STEP 6:  │           │ Pure     │
│ Measure  │◄──────────┤ drift.js │
│ Final    │           │          │
│ Drift    │           └──────────┘
└────┬─────┘
     │
     ▼
┌──────────┐           ┌──────────┐
│ STEP 7:  │           │ Pure     │
│ Evaluate │◄──────────┤ decision │
│ Outcome  │           │   .js    │
└────┬─────┘           └──────────┘
     │
     ├─ improved? → UPDATE compensation ─┐
     │                                    │
     ├─ catastrophic? → ROLLBACK ────────┤
     │                                    │
     ▼                                    ▼
┌──────────┐           ┌──────────┐ ┌──────────┐
│ STEP 8:  │           │ Side-fx  │ │ Adapter  │
│ Learn &  │──────────►│ compStore├►│ youtube  │
│ Save     │           │   .js    │ │   .js    │
└────┬─────┘           └──────────┘ └──────────┘
     │
     ▼
┌──────────┐
│ STEP 9:  │
│ Return   │
│ Outcome  │
└──────────┘
     │
     ▼
User sees result
```

## Compensation Learning Flow

```
Device A (Desktop Chrome)
         │
         ▼
┌────────────────────────┐
│ First sync attempt     │
│ compensation = 0       │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Seek to expected + 0   │
│ Settle...              │
│ Measure drift = +0.3s  │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Learn from drift       │
│ new = 0.3×0.3 + 0.7×0  │
│ compensation = 0.09s   │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Second sync attempt    │
│ compensation = 0.09s   │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Seek to expected+0.09  │
│ Settle...              │
│ Measure drift = +0.2s  │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Learn again            │
│ new = 0.3×0.2 + 0.7×0.09│
│ compensation = 0.123s  │
└────────┬───────────────┘
         │
         ▼
      (Continues to converge...)
         │
         ▼
┌────────────────────────┐
│ After N syncs          │
│ compensation ≈ 0.15s   │
│ (Stable)               │
└────────────────────────┘
```

## Data Flow

```
┌─────────────┐
│   Input     │
│  (React)    │
│  - Time     │
│  - Config   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Drift     │
│ Calculation │
│  (Pure)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Decision   │
│   Logic     │
│  (Pure)     │
└──────┬──────┘
       │
       ├─── Skip? ───► Return (no-op)
       │
       ▼
┌─────────────┐
│   Load      │
│ Compensate  │
│ (Storage)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Seek      │
│  (Player)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Settle    │
│  (Timing)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Measure    │
│   Again     │
│  (Pure)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Evaluate   │
│  Outcome    │
│  (Pure)     │
└──────┬──────┘
       │
       ├─── Good? ───► Update compensation
       │
       └─── Bad? ────► Rollback + Update
```

## Component Responsibilities

```
┌────────────────────────────────────────────────────────┐
│ drift.js                                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ RESPONSIBILITY: Calculate drift                         │
│ INPUT: actual time, expected time                       │
│ OUTPUT: drift value                                     │
│ GUARANTEES: Pure, deterministic                         │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ decision.js                                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ RESPONSIBILITY: Decide sync strategy                    │
│ INPUT: drift value, thresholds                          │
│ OUTPUT: strategy (ignore/soft/hard)                     │
│ GUARANTEES: Pure, threshold-based                       │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ compensationStore.js                                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ RESPONSIBILITY: Persist compensation                    │
│ INPUT: device profile, compensation value               │
│ OUTPUT: stored/loaded compensation                      │
│ GUARANTEES: Bounded, clamped, graceful failure          │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ settle.js                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ RESPONSIBILITY: Wait for player stability               │
│ INPUT: duration (ms)                                    │
│ OUTPUT: Promise (resolved after wait)                   │
│ GUARANTEES: Async, non-blocking                         │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ adapters/youtube.js                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ RESPONSIBILITY: Wrap YouTube IFrame API                 │
│ INPUT: YT player instance                               │
│ OUTPUT: PlayerAdapter interface                         │
│ GUARANTEES: Error handling, null safety                 │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ orchestrator.js                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ RESPONSIBILITY: Coordinate all sync steps               │
│ INPUT: player, reaction time, config, profile           │
│ OUTPUT: SyncOutcome with telemetry                      │
│ GUARANTEES: Safe, logged, rollback on failure           │
└────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────┐
│ User Action     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Try Sync        │
└────────┬────────┘
         │
         ├──► Player missing? ──► Return early
         │
         ├──► getCurrentTime() fails? ──► Catch, return 0
         │
         ├──► localStorage unavailable? ──► Use default (0)
         │
         ├──► JSON parse error? ──► Catch, return default
         │
         ├──► Seek throws? ──► Catch, log, continue
         │
         └──► Catastrophic drift? ──► Rollback, update comp
```

## Key Invariants

```
┌────────────────────────────────────────────────────────┐
│ INVARIANTS (Always True)                                │
├────────────────────────────────────────────────────────┤
│ 1. Compensation is clamped: -2.0 ≤ comp ≤ 2.0          │
│ 2. Drift < 0.10s → no seek                             │
│ 3. Catastrophic (increase > 0.50s) → rollback          │
│ 4. Pure functions have no side effects                  │
│ 5. Side effects are isolated and wrapped                │
│ 6. Compensation only updates after actual seek          │
│ 7. Storage keys are deterministic                       │
│ 8. Errors don't crash, degrade gracefully               │
└────────────────────────────────────────────────────────┘
```
