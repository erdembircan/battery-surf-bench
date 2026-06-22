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
| `run-summary-flip.html` | The run summary as a flip card: front is the picture side ("Greetings from" + logo) with a discreet corner Flip badge, click to turn it in 3D to the written back (the report). Never auto-flips. Serve from the **repo root** for the brand mark |
| `run-summary.html`     | End-of-run report shown when a run stops (any cause: duration / target / stopped / plugged-in). Reuses the idle **postcard** object (to be extracted into one shared view), now carrying the results: the info readouts as stat tiles plus an optional battery drain graph. Toggle end reason / graph / dark. Serve from the **repo root** for the brand mark |
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
| `brand-header.html`    | Deck brand-header directions — current faded watermark vs no-logo, icon badge, inline mark, wave accent, side bar, corner watermark. Serve from the **repo root** (`python3 -m http.server` at the project root, open `/docs/mockups/brand-header.html`) so it can load `/assets/images/menu-icon.svg` |
| `brand-lockup.html`    | Brand mark auto-sized to the title via grid, checked across the real deck-width clamp (300–372px). Serve from the **repo root** for the icon |
| `pill-dark.html`       | Readouts-pill dark-mode colour options (isolated cards on the dusk deck bg): current teal vs deep slate / aqua values / warm amber / glass / deep teal-green |
| `pill-dark-deck.html`  | The same dark-mode pill options shown **in the full dark deck** (brand + pill + stop), switchable. Serve from the **repo root** for the icon |
| `viewport-shield.html` | How to signal the viewport iframe is **view-only** during a run — cursor-only / foam wash / corner chip / hover hint / behind-glass vignette / wash+chip combo, over a faux page in light + dark. Self-contained (no asset) |
| `idle-stage.html`      | The pre-run **idle "ready" screen** that fills the stage before a run starts (block-editable front-end content later). Two summer directions: a **postcard** whose written "back" carries the how-it-works note (decoration + report in one), and **how it works** redesigned as a surf route (buoys on a dashed swell). No top status chip; full cockpit, light + dark. Serve from the **repo root** for the brand mark |
