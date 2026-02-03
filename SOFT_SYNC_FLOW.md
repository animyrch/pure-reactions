# Soft-Sync Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Sync Polling Loop                             │
│                     (every 250ms when playing)                      │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
         ┌───────────────────────────────────────────────┐
         │   computeTwinPlayersSyncTick()                │
         │   (src/lib/helpers/twinPlayersSyncTick.ts)    │
         └───────────────────────┬───────────────────────┘
                                 │
                                 │ Calculate drift
                                 │ drift = originalTime - expectedTime
                                 ▼
         ┌────────────────────────────────────────────────┐
         │              Decide Sync Mode                  │
         │         (from soft-sync logic)                 │
         └───────────┬───────────┬───────────┬───────────┘
                     │           │           │
       |drift|<0.10s │  0.10-2.0s│  >2.0s    │
                     │           │           │
                     ▼           ▼           ▼
         ┌────────┐  ┌──────────┐  ┌──────────────────┐
         │ NO-OP  │  │SOFT-SYNC │  │   HARD-SYNC      │
         └───┬────┘  └────┬─────┘  └────────┬─────────┘
             │            │                  │
             │            │                  │
             │            │ Generate         │ Generate
             │  No action │ applySoftSync    │ applyOriginalStateChange
             │            │ action           │ action (seek)
             │            │                  │
             └────────────┴──────────┬───────┘
                                     │
                                     ▼
         ┌──────────────────────────────────────────────┐
         │      useTwinPlayers Composable               │
         │   (src/lib/composables/useTwinPlayers.ts)    │
         └────────────┬─────────────────────────────────┘
                      │
                      │ Find applySoftSync action
                      │
         ┌────────────┴─────────────┐
         │                          │
         │ softSyncAction found?    │
         │                          │
         └────────┬─────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
       YES                 NO
        │                   │
        ▼                   ▼
┌───────────────────┐  ┌─────────────────────┐
│ Apply Soft-Sync   │  │ Check if was active │
│                   │  │                     │
│ 1. Filter out     │  │ If yes: reset to    │
│    playback rate  │  │ config rate         │
│    config actions │  │ immediately         │
│                   │  │                     │
│ 2. Set player to  │  └─────────────────────┘
│    soft-sync rate │
│    (0.90-1.10)    │
│                   │
│ 3. Schedule reset │
│    after durationMs│
│    (1.2-2.5s)     │
│                   │
│ 4. Mark active    │
└────────┬──────────┘
         │
         │ setTimeout fires after durationMs
         │
         ▼
┌────────────────────────┐
│  Reset Handler         │
│                        │
│  1. Get desired rate   │
│     from configs       │
│                        │
│  2. Set player rate    │
│     to desired         │
│                        │
│  3. Update state       │
│                        │
│  4. Mark inactive      │
└────────────────────────┘


Guard Conditions (soft-sync skipped if any true):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├─ Not playing
├─ Buffering
├─ User scrubbing
├─ State change needed (play→pause or vice versa)
├─ Cooldown not elapsed (< 750ms since last soft-sync)
└─ Playback rate changes disabled


Example Timeline:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

t=0ms      Original: 10.5s, Expected: 10.0s
           Drift: +0.5s
           Mode: SOFT-SYNC
           ├─ Apply rate 0.95 (5% slower)
           └─ Schedule reset for t=1800ms

t=250ms    Rate: 0.95 (correction in progress)
           Drift: +0.4s (improving)
           Mode: SOFT-SYNC (filtered - cooldown)

t=500ms    Rate: 0.95 (correction in progress)
           Drift: +0.3s (improving)
           Mode: SOFT-SYNC (filtered - cooldown)

t=750ms    Rate: 0.95 (correction in progress)
           Drift: +0.2s (improving)
           Mode: SOFT-SYNC (filtered - cooldown)

t=1000ms   Rate: 0.95 (correction in progress)
           Drift: +0.1s (improving)
           Mode: SOFT-SYNC (filtered - cooldown)

t=1250ms   Rate: 0.95 (correction in progress)
           Drift: +0.05s (below threshold!)
           Mode: NO-OP

t=1800ms   Reset timeout fires
           ├─ Get config rate: 1.0
           ├─ Set player rate: 1.0
           ├─ Update state: currentPlaybackRate = 1.0
           └─ Mark inactive

t=2000ms   Rate: 1.0 (normal playback)
           Drift: +0.03s
           Mode: NO-OP
           ✅ Correction complete!


Playback Rate Calculation:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Drift    | Direction      | Rate   | Effect
─────────┼────────────────┼────────┼────────────────
-2.0s    | Behind (max)   | 1.10   | Speed up 10%
-1.0s    | Behind (mid)   | 1.05   | Speed up 5%
-0.1s    | Behind (min)   | 1.00   | Speed up 0%
 0.0s    | Synced         | 1.00   | Normal
+0.1s    | Ahead (min)    | 1.00   | Slow down 0%
+1.0s    | Ahead (mid)    | 0.95   | Slow down 5%
+2.0s    | Ahead (max)    | 0.90   | Slow down 10%

Note: Rate scales linearly between min/max based on drift magnitude
```
