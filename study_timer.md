# Study Timer

## Timer Logic

The timer is a **timestamp-based stopwatch**. It doesn't count seconds with intervals — it stores `startedAt` and `pausedAccumMs` (total paused time), then computes elapsed as:

```
elapsed = (now - startedAt) - pausedAccumMs - (currently paused gap)
```

This means the elapsed time is always accurate regardless of intervals drifting, tabs throttling, etc.

## State Machine

```
idle → Start → running → Pause → paused → Resume → running
                  ↓                  ↓
                Stop               Stop / End Session
                  ↓                  ↓
               stopped ←─────────────┘
                  ↓
            Complete / Discard → idle

running → (strict + away too long) → interrupted → Discard → idle
```

## Strict Mode

A pre-session toggle. Controls what happens when you leave the app:

- **Off (normal)**: Leaving > 3s auto-pauses the session. Your study time is preserved — the away gap doesn't count.
- **On (strict)**: Leaving > 15s **interrupts** the session permanently. It's discarded without scoring. The idea is accountability — you committed to focused study.

## Wake Lock

Requests the browser's Screen Wake Lock API to prevent the screen from dimming/locking while the timer is running. It:
- Only activates when: session is running + the setting is on + browser supports it
- Releases on: pause, stop, interrupt, tab hidden, unmount
- Re-acquires when the tab becomes visible again (if still running)
- Shows "Not supported in this browser" if the API isn't available

## All Leave/Return Scenarios

| Scenario | Away Duration | Strict Off | Strict On | Elapsed Impact |
|---|---|---|---|---|
| Switch tab, return quickly | ≤ 3s | Keeps running, "restored" toast | Keeps running, "restored" toast | None — time counts normally |
| Switch tab, return after a while | 3s – 15s | **Auto-pauses**, "paused while away" banner | Keeps running, "restored" toast | Normal: away gap excluded. Strict: counts as study time |
| Switch tab, return much later | > 15s | **Auto-pauses**, "paused while away" banner | **Interrupted**, session discarded | Normal: away gap excluded. Strict: session lost |
| Close tab / browser, reopen | Any | **Auto-pauses** at reopen time | **Auto-pauses** at reopen time | Study time before close is preserved. No away gap subtracted (we don't know when the app actually closed) |
| Close tab, reopen after 4+ hrs | > 4 hrs | **Stale — discarded** | **Stale — discarded** | Session gone |
| Stopped session, reopen | ≤ 30 min | Post-session screen restored | Post-session screen restored | None — already stopped |
| Stopped session, reopen late | > 30 min | **Stale — discarded** | **Stale — discarded** | Session gone |

## Button Behavior

**Principle**: Pause is instant and reversible. Anything that ends the session confirms first.

| Button | State | What happens |
|---|---|---|
| Pause | Running | Instant, no confirm — fully reversible |
| Stop Studying | Running | Pauses, confirms "End this study session and move to review?" Cancel = resumes. Confirm = stops into review. |
| Finish Session | Paused | Confirms "End this study session and move to review?" Cancel = stays paused. Confirm = stops into review. |
| Back | Running | Pauses, confirms "End this session without saving?" Cancel = resumes. Confirm = discards + exits. |
| Back | Paused | Confirms "End this session without saving?" Cancel = stays paused. Confirm = discards + exits. |
| Back | Pre (idle) | Exits immediately, no confirm. |
| Back | Stopped / Interrupted | Hidden (dedicated post-session screens handle exit). |

## Key Constants

- **GRACE_MS** = 3s (brief leave, both modes forgive)
- **STRICT_THRESHOLD_MS** = 15s (strict mode interrupt cutoff)
- **STALE_RUNNING_MS** = 4 hours (abandoned running/paused session)
- **STALE_STOPPED_MS** = 30 minutes (unfinished post-session review)
