# What was tested

Two suites, both runnable with `npx tsx tests/<file>`.

## Engine tests — `tests/engine.test.ts` (55 passing)

Pure logic: discipline detection, duration extraction ("2 hours", "1 hr 30 mins",
"half an hour"), difficulty classification, open-ended task parsing, workload
calibration, schedule building, and the AI response validator.

Two real bugs were found and fixed while writing these:

1. **Substring matching misclassified tasks.** `read` matched inside `already`,
   and `run errands` was classified as a workout. Now matched on word boundaries
   with a small phrase-override list.
2. The old parser hard-capped input at **3 tasks** (`.slice(0, 3)`), silently
   discarding anything beyond the third. Removed — the calibration step decides
   what survives now, not an arbitrary cap.

## UI tests — `tests/ui.test.tsx` (21 passing)

Renders the real React app in jsdom and drives it through the actual chat flow.
Covers: cold boot with no login and no network call, all four tabs, the
open-ended tomorrow question, a 7-task list surviving intact, overload trimming,
under-load prompting, balanced days, re-calibration when tasks are added,
locking, board progress, timetable ordering, localStorage persistence across a
restart, settings persistence, data wipe, remote-model success, remote-model
failure falling back on-device, and malformed model output not breaking the app.

One test initially failed and was **wrong itself**, not the app: it expected a
running timer in the Focus tab's setup phase, but the sprint is deliberately
gated behind photo proof. The test now asserts that gate holds.

## Not tested here

The live network path to Pollinations and OpenRouter. This sandbox blocks all
outbound hosts except npm/PyPI/GitHub, so those calls could not be exercised
against the real services. The request/response handling, JSON extraction,
validation, clamping and fallback are all tested with mocked responses, and any
failure falls back to the on-device engine — but the first real call from your
phone is the first true test of those two endpoints.
