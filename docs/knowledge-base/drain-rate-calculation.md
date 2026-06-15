# Battery drain-rate calculation & projection

How Battery Surf Bench turns a stream of Battery Status API samples into a drain rate and a
battery-life projection. This is the measurement math behind the cockpit; the behavior that
generates the drain is documented in [surf-behavior-profile.md](surf-behavior-profile.md).

## Data source: the Battery Status API
- Battery is read via `navigator.getBattery()` → `(level, charging)`, sampled every ~10 s and
  additionally on the `levelchange` / `chargingchange` events.
- **Chrome/Chromium only.** Safari has no Battery Status API. A secure context is required;
  `127.0.0.1` qualifies (so WordPress Playground works).
- Each retained sample is the tuple `(t, level, charging)`.
- **Granularity caveat:** Chrome reports battery level at **1% granularity on macOS**. Until at
  least two *distinct* level values have been observed, no rate can be computed — the cockpit
  shows "calibrating — waiting for first battery step."

## Drain rate (%/h)
Computed by **least-squares linear regression** of `level` over `time`, reported two ways:
- **Sliding window:** slope over the most recent 10-minute window (responsive, current rate).
- **Whole run:** slope over the entire run, **excluding paused spans** (stable, overall rate).

Both are shown so a viewer can compare instantaneous vs. average drain.

## Projections
- **Time-to-empty** = `current level / drain rate`.
- **ETA-to-target** (target-drop mode) = time until the battery has dropped the configured
  number of percentage points from the start level.
- A mode progress bar tracks `elapsed / T` (duration mode) or `dropped / N` (target mode).

## Run modes
1. **Duration** — run for `T` minutes (default 30).
2. **Target drop** — run until the battery has dropped `N` percentage points from start (default 5).
3. **Baseline calibration** (optional, off by default) — before the surf loop, dwell `M` minutes
   (default 5) on a static blank page sampling battery, then report surf drain as a **delta vs.
   that baseline** (isolates the surfing cost from idle system drain).

## Guards that protect measurement integrity
- **Charger guard:** refuse to start while `charging === true`. If charging begins mid-run,
  auto-pause the loop, log the event, and auto-resume on unplug. **Paused time is excluded from
  the drain regression** so plugged-in spans don't flatten the slope.
- **Sleep guard:** a simulated surf produces no real input, so the OS would sleep mid-run. The
  cockpit holds a Screen Wake Lock (`navigator.wakeLock.request('screen')`), re-acquiring on
  `visibilitychange` (the browser releases it when the tab is hidden). If Wake Lock is
  unsupported, the user is warned to disable system sleep manually (`caffeinate -d`, or Battery
  settings → display sleep Never).
- **Desktop / no-drain detection:** if the OS reports `charging` and level 100 throughout, the
  run still proceeds but is flagged "no drain detected — is this a desktop?".

## Reporting convention
Following the cross-benchmark norm (see [benchmark-methodologies.md](benchmark-methodologies.md)):
report **%/hour drain plus projected minutes-to-empty**. On finish/stop, a summary captures
duration, Δ%, both rates (window + session), and the projection.
