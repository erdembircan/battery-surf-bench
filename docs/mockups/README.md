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

The shipped deck is **Coastal Daybreak** (light only) — dark mode (Dusk
Lineup) was explored here but was severed from the plugin; the dark-mode
studies below are kept as history, not as an active direction.

## Component studies

| File                   | Component                                        |
| ---------------------- | ------------------------------------------------ |
| `startup-postcard-flip.html` | The **session-start** stage built from the shared flip postcard. Opens on the postcard alone (deck hidden) with an **appear animation** (sails up + settles into its tilt); flipping turns it to the **how-it-works** back while the **deck slides in from the left** — the card keeps its exact size and recenters into the remaining space (no squeeze). Toggle the **deck behavior** (coupled to the flip vs reveal-once-then-stays) and the **cancellation postmark flag** (off at startup, on for the summary). Serve from the **repo root** for the brand mark |
| `run-summary-flip.html` | The run summary as a flip card: front is the picture side ("Greetings from" + logo) with a discreet corner Flip badge, click to turn it in 3D to the written back (the report). Never auto-flips. Serve from the **repo root** for the brand mark |
| `run-summary.html`     | End-of-run report shown when a run stops (any cause: duration / target / stopped / plugged-in). Reuses the idle **postcard** object (to be extracted into one shared view), now carrying the results: the info readouts as stat tiles plus an optional battery drain graph. Toggle end reason / graph / dark. Serve from the **repo root** for the brand mark |
| `run-summary-graph.html` | The redesigned drain graph + battery arrow: a **data-driven** chart on a fixed normalised frame (y 0–100 %, x 0 → full-charge time) so the dashed 100→0 projection meets the x-axis, with real axes and crisp uniform scaling (no viewBox stretching); plus the battery start→end value using a **masked SVG arrow glyph** instead of the misshapen unicode `→`. Built from a JS data model mirroring `DrainGraph`/`GraphSvg` |
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
| `compact-brand.html`   | Placing the **project name** (wordmark only, no logo, Anton) inside the compact top pill — five placements compared: left lockup + divider, two-line stack, brand-over-status eyebrow, centered watermark, inset chip; light + dusk |
| `brand-header.html`    | Deck brand-header directions — current faded watermark vs no-logo, icon badge, inline mark, wave accent, side bar, corner watermark. Serve from the **repo root** (`python3 -m http.server` at the project root, open `/docs/mockups/brand-header.html`) so it can load `/assets/images/menu-icon.svg` |
| `brand-lockup.html`    | Brand mark auto-sized to the title via grid, checked across the real deck-width clamp (300–372px). Serve from the **repo root** for the icon |
| `pill-dark.html`       | Readouts-pill dark-mode colour options (isolated cards on the dusk deck bg): current teal vs deep slate / aqua values / warm amber / glass / deep teal-green |
| `pill-dark-deck.html`  | The same dark-mode pill options shown **in the full dark deck** (brand + pill + stop), switchable. Serve from the **repo root** for the icon |
| `viewport-shield.html` | How to signal the viewport iframe is **view-only** during a run — cursor-only / foam wash / corner chip / hover hint / behind-glass vignette / wash+chip combo, over a faux page in light + dark. Self-contained (no asset) |
| `idle-stage.html`      | The pre-run **idle "ready" screen** that fills the stage before a run starts (block-editable front-end content later). Two summer directions: a **postcard** whose written "back" carries the how-it-works note (decoration + report in one), and **how it works** redesigned as a surf route (buoys on a dashed swell). No top status chip; full cockpit, light + dark. Serve from the **repo root** for the brand mark |
| `sound-toggle.html`    | **Finish-sound toggle** placement study — a single speaker icon muting/sounding a chime when a run ends naturally (duration reached / target drop hit), never on manual stop or unplug; state persists in `localStorage`. Compares three deck placements (**header icon** (shipped) / config row / footer icon) and the fixed compact-pill placement. The chime is **synthesised with the Web Audio API** (no sound file ships) — a *Preview chime* button sounds it. Self-contained (no asset) |
| `sessions-listing.html`| **Admin session-listing (DataViews) restyle** — the back-end sessions table reskinned to the cockpit's Coastal Daybreak language (light only; dark dropped). The visual target that shipped into `src/sessions`: a **full-bleed coastal surface** that covers the whole admin content area (no card, wp-admin chrome and page title hidden behind it), a cockpit **brand header** (bare teal surfer mark masking `/assets/images/menu-icon.svg` + Anton wordmark + teal subtitle + Open Cockpit button), the real DataViews columns (`#id`, status, mode, started, start/end level, elapsed, dropped, rates, 100%→0%, duration, target, **selection** + **actions**), uppercase teal column labels, **Space Mono** numeric cells (only start/end levels bold), coastal **status badges** (pulsing dot for *running*), gradient **battery-level bars**, selection wash + left accent bar, a native **bulk-actions footer**, sticky header/columns/footer with only the rows scrolling, and a coastal **No-results** state. Serve from the **repo root** (`python3 -m http.server` at the project root) so the brand mark can mask the real `/assets/images/menu-icon.svg` — the same surfer the cockpit deck header uses |
| `error-toast.html`     | **Toast system** — one bottom, fixed, queued pill layer (above everything) serving two kinds, both small frosted pills mirroring the viewport "view only" chip (`.bsb-cockpit__shield-badge`), icon + single message, **no title**: an **error** (coral, warning) for the silent session-upload failure, and a **notice** (teal, lock) that replaces the hover-only view-only chip. **Sequential queue** — the next rises only after the previous finishes its leave animation (`animationend`-driven), so a toast survives the summary screen and "new run". **Slide &amp; clear** animation (chosen), medium error copy, 10s hold, `×` dismiss. The view-only notice is **throttled** so cursor motion can't flood it: bound to `pointerenter` only (never `mousemove`), shown **once per run** (suppressed once shown, or while one is live/queued; a new run re-arms it) — a live log shows shown-vs-suppressed. Self-contained (no asset) |
| `unsupported-battery-warning.html` | When the browser lacks the **Battery Status API** (Safari, Firefox) no run can be benchmarked, so the cockpit must say why and **lock every control** (backlog #15). A permanent block (coral, browser-switch copy), distinct from the recoverable amber plugged-in nudge. Switch between three lock treatments over the real deck+stage shell: **stage takeover** (warning card replaces the idle postcard, deck dimmed + dead, brand "Unsupported" chip), **full scrim + modal** (translucent blur over the whole cockpit), and **deck banner** (permanent coral banner above dimmed fields). Serve from the **repo root** for the brand mark |
| `surfer-stats.html`    | **Surfer profile — RPG stats, shown inside the real cockpit deck** (not a floating card): the profile sits as a `.bsb-field` among the actual Mode / Run-for / Speed controls, at true deck width (`clamp(300px,28vw,372px)`), reusing the deck brand header, `.bsb-seg`/`.bsb-stepper` inset surfaces and the full-width `.bsb-run` footer. The Surfer field is **class chips** (Balanced / Scholar / Binge-Watcher / Doomscroller / Skimmer / Re-Reader) + a **Customize** disclosure that reveals the six atomic stats (Haste / Endurance / Reach / Literacy / Recall / Allure), each a 1–10 slider driving one sim lever. A **fixed 30-point pool** (1–10 each) makes it point-buy — raising one stat forces lowering another; a live "points left" number + pip strip shows the budget. Editing any slider flips off-preset and the field label shows the live "≈ nearest class" build name. Two deck states side by side (class-picked-collapsed / customize-open). Coastal Daybreak (light only). Serve from the **repo root** so the brand mark can mask `/assets/images/menu-icon.svg` |
| `unsupported-postcard-back.html` | The chosen direction for backlog #15: the startup **flip postcard carries the unsupported warning on its back** instead of the how-it-works note, and — unlike the normal startup — **flipping never reveals the deck** (no run is possible). Same shared postcard shell. Front is the plain greeting (the "See why" flip badge invites the flip); the back is the warning (Caveat heading, plain copy with no API jargon, coral "open in Chrome/Edge" hint) **franked with the real cancellation postmark recoloured red** (normally grey for the summary "run done") reading NO BATTERY / NOT SUPPORTED. Serve from the **repo root** for the brand mark |
| `dev-tools-panel.html` | Redesign of the env-gated dev-tools floating widget, replacing the rejected dark "AI console" pill: collapsed is a simple coastal **DEV pill** (Anton on the card surface, no decoration) whose text and border quietly turn **coral** while an override is armed, swapping — mutually exclusive, never both on screen — into a coastal field card (battery enable switch, charging tri-state segmented control, force-level slider, plain coral "Override active" header text when armed). Armed state is **derived from the real controls** (battery on + a non-System charging choice or forced level), never set directly. Toggle collapsed/expanded, armed, and reduced-motion. Self-contained (no asset) |

## Admin config screen

M1 of the admin-config-pages feature (see `docs/plans/admin-config-pages.md`):
the approved mock of the new **Settings** admin screen whose first section
lets a site owner add their own posts/pages to the surfer's test-page
rotation alongside the bundled set. Shares the same brand header (mirrors
`bsb-sessions__*` exactly) and full-bleed coastal deck as the earlier
variants. There is no separate bundled-pages group or include toggle — the
5 bundled pages live **inside** the single selected sequence as locked rows
(no remove control, but fully drag-reorderable). Two earlier single-control
variants (a combobox+list and a FormTokenField, each with their own bundled
group) were rejected as not built for scale — a real site can have hundreds
of pages/posts, and a single box filtering an already-loaded short list
reads as a filter, not a selection. Serve from the **repo root**
(`python3 -m http.server` at the project root) so `surfer.svg` loads for the
brand mark, or open directly — the mark also resolves relative to the file.

| File                | Direction                          |
| ------------------- | ----------------------------------- |
| `config-pages.html` | **Two-pane content picker, built for scale.** Left pane ("Browse your content") is a DataViews-style paginated, server-searched list of the site's whole content (10/page, `All \| Pages \| Posts` segmented filter, search that queries the full pool and re-paginates from page 1, `‹ Prev`/`Next ›`) with a per-row outline "Add" pill that flips to a disabled "✓ Added" state. Right pane ("Selected pages") is the single ordered surf sequence — seeded with the 5 bundled pages (lock glyph + "Bundled" badge, no `×`) followed by user picks (type badge, Space Mono permalink, coral `×` remove) — that persists independently of the browse pane's paging/search and is fully drag-reorderable end to end, bundled rows included. Wired with dummy JS over ~140 fake pages/posts spanning 14 browse pages. |
