# Cockpit deck — design mockups

Standalone, throwaway HTML explorations of the front-end cockpit. They are
**experiments**, not production code: open any file directly in a browser (no
build step). `surfer.svg` is the brand mark some of them mask.

Kept here so the explorations are not lost; safe to delete once a design is
settled. New significant style decisions are mocked here first — see the
mockup-first workflow in the repo `CLAUDE.md`.

## Whole-deck palette/type directions

| File              | Direction                          |
| ----------------- | ---------------------------------- |
| `1-coastal.html`  | Coastal Daybreak — light           |
| `2-citrus.html`   | Citrus Pop — light / warm          |
| `3-dusk.html`     | Dusk Lineup — refined dark ocean   |

The shipped deck draws from **Coastal Daybreak** (light) and **Dusk Lineup**
(dark), selectable via a light/dark toggle.

## Component studies

| File                   | Component                                        |
| ---------------------- | ------------------------------------------------ |
| `target-control.html`  | Target-drop battery slider (the battery *is* the slider; drag/keys set the stop-at %, green→red) |
| `info-section.html`    | Live readouts as a card grid: battery (level + fill colour, charging via cable), drain rates, time-to-empty |
| `cable-animate.html`   | Charging cable slide-in / slide-out animation for the readout battery |
| `info-pill.html`       | Final readouts layout: folded into the taller wave pill (no battery gauge), charging shown by a bolt; shown only while a run is live |
| `config-pill-transition.html` | Config ⇄ pill swap motion study: crossfade / **slide swap** (shipped) / sequential, with a speed slider; also the softened, less-blocky pill shadow |
| `pill-shadow.html`     | Info-pill drop-shadow study — six treatments compared |
| `pill-shadow-clip.html`| Before/after for the pill shadow being clipped by the deck's scroll overflow (the fix: padded scroll viewport + contained shadow) |
| `plugged-in-warning.html` | "Unplug to start" config-section warning study — banner / **disabled-button** (shipped) / chip, for when the device is charging |
| `duration-odometer.html` | Run-duration stepper analog-counter roll: each digit rolls (+ up / − down), seamless 9⇄0 wrap, up to 3 digits (5–240); speed + easing levers |
| `theme-toggle-3state.html` | Three-state theme control — light / dark / **system** (follows OS, sticky stored choice); cycle-button vs segmented options |
| `compact-mode.html`    | Compact layout: deck slides out → full-width viewport + a horizontal top info pill. Options for the compact icon, top-info layout (spread / left-stacked), and expand control (pill icon / left edge-handle) |
