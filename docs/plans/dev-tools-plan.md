# Frontend Dev Tools — Implementation Plan

**Status:** approved architecture, ready to implement.
**Audience:** the implementing session/agent. Read this whole document before writing code. Read `CLAUDE.md` first — every convention there applies (SCSS, tests, PHPCS, workflow replay, commit format, chart updates, mockups-first). This plan does not restate them; it adds the design decisions.

## 1. Goal

The cockpit refuses to start a run while the laptop is plugged in, and ends a live run the moment the charger connects — correct product behavior, but it forces the maintainer to unplug the laptop every time they want to check a style, a layout, or any run-time functionality during development.

Build a **development-build-only floating dev-tools panel** on the cockpit page:

- A small floating box, collapsible (collapsed chip ↔ expanded card), that exists **only in development builds**. Production builds contain none of its code and change no behavior.
- Its first (and for now only) tool: **Bypass charging gate** — a toggle that makes the whole cockpit behave as if the device were on battery, so runs can start, record samples, compute drain rates, and finish normally while plugged in.
- The architecture must make **adding future tools cheap** (mock battery level, force-unsupported API, etc.) without redesigning the seam.

This is a pure frontend feature. **No PHP changes, no blueprint changes, no server-side environment detection.**

## 2. Activation — the `SCRIPT_DEBUG` build-time flag

`@wordpress/scripts` injects a compile-time global via `webpack.DefinePlugin` in **both** its bundle configs (classic scripts and the script-module config that builds the cockpit's `viewScriptModule`):

- `pnpm start` (development watch, what `pnpm dev` runs) → `SCRIPT_DEBUG === true`
- `pnpm build` (production, what CI/e2e/zip run) → `SCRIPT_DEBUG === false`

wp-scripts' own comment calls it out as "used for development features flagging" — it is the intended switch. Verify this in the installed package (`node_modules/@wordpress/scripts/config/webpack.config.js`, the two `DefinePlugin` blocks) before relying on it, per `CLAUDE.md`.

Because DefinePlugin substitutes the literal at parse time, `if ( SCRIPT_DEBUG ) { … }` becomes `if ( false ) { … }` in production and webpack drops the branch **and any dynamic `import()` inside it** from the dependency graph — the dev-tools code contributes zero bytes to the production bundle.

Two supporting pieces:

- **TypeScript:** declare the global in a new ambient declaration file next to the existing `src/StyleModules.d.ts` precedent — `src/Globals.d.ts` with `declare const SCRIPT_DEBUG: boolean;` (plus a JSDoc line saying who defines it). Confirm `tsconfig.json`'s `include` picks it up.
- **Vitest:** the flag doesn't exist under vitest. Add `define: { SCRIPT_DEBUG: 'true' }` to `vitest.config.mts` so imported modules referencing it don't throw.

## 3. Architecture — override at the source, not at the gates

### 3.1 Why not flag-check each gate

"Plugged in" is enforced in **three** places, all reading `context.batteryCharging` (fed by `BatteryMonitor` readings):

- **Layer A** — `RunStore.ts` `get isStartBlocked()` (~L63): `! running && batteryCharging` → disables the run button, swaps its label to "Plugged in".
- **Layer B** — `RunStore.ts` `toggleRun()` (~L129): imperative refusal `if ( ! batterySupported || batteryCharging ) return;`.
- **Layer C** — `BatteryStore.ts` `initBattery` reading callback (~L123): `if ( reading.charging && context.running ) stopRun( …, 'plugged' )`.

Plus two downstream consumers of the same fact: the sample-recording gate (`BatteryStore.ts` ~L112 — charging readings are never logged) and the drain-rate fit (`DrainRate.ts` ~L60 — filters charging samples).

Sprinkling `|| devBypass` into five sites is procedural sprawl, easy to miss one, and leaves the run half-working (e.g. gates open but no samples recorded → empty readouts/summary — useless for checking layout). Rejected.

### 3.2 The chosen seam: transform the battery reading

**One interception point:** the `onReading` funnel in `BatteryStore.ts`'s `initBattery` callback — the single place every battery fact enters the system. When the bypass is active, the raw reading is transformed to `charging: false` **before** anything consumes it. Every downstream consumer — all three gates, the sample log, the drain fit, the summary reason — coherently sees "on battery". A bypassed run is a *complete* run: samples record, drain math runs, the summary freezes. (The numbers are garbage while actually charging; that is fine — this is a dev tool for checking behavior and layout, not a measurement.)

This is also the extension point for future tools: the override module is a pure transform over `BatteryReading`, so "mock battery level" later is another field on the same transform, not a new seam.

### 3.3 Panel placement — vanilla DOM, not Interactivity directives

The Interactivity API hydrates directives from **server-rendered** markup; it does not process DOM injected later at runtime. Since the panel exists only in dev builds, its markup cannot be server-rendered — so the panel is a small **vanilla-DOM component**: a module that builds its elements, wires plain event listeners, and mounts itself. It lives in the same cockpit bundle, so it reaches everything directly by import — the override state, and the monitor via the `instanceFor()` module singleton (`RunInstance.ts`; callable from anywhere, not scope-bound).

No store slice, no new context fields, no directives — `view.ts` gains only the guarded boot call. Everything reactive stays untouched.

## 4. Components & interfaces

New/changed files, all in `src/cockpit/` (CamelCase, JSDoc on classes/functions, none on types/interfaces):

```ts
// DevOverrides.ts — the ONLY dev-tools module production code touches.
// Holds the override state and the pure transform. Small enough to cost one
// property read per battery reading when inactive.
//   interface DevOverridesState {
//     bypassCharging: boolean;
//     actualCharging: boolean | null;  // last RAW charging seen while bypassing
//   }
//   export const devOverrides: DevOverridesState   // module singleton, seeded
//                                                  // { bypassCharging: false,
//                                                  //   actualCharging: null }
//   export function applyDevOverrides( raw: BatteryReading ): BatteryReading
// Behavior:
//   - bypassCharging false → returns raw unchanged (production path, zero cost).
//   - bypassCharging true  → records the truth (devOverrides.actualCharging =
//     raw.charging), notifies subscribers, returns { ...raw, charging: false }.
//   - never mutates the raw reading.
//   export function onDevReading( listener: () => void ): () => void
//     // subscribe/unsubscribe, so the panel can live-update its "actually
//     // plugged in / on battery" line; no-op cost when no listener.

// BatteryStore.ts — one-line integration at the top of initBattery's onReading:
//   const reading = applyDevOverrides( raw );
// …then the existing body runs against `reading` untouched.

// BatteryMonitor.ts — one addition:
//   refresh(): void   // public; re-emits the current manager reading through the
//                     // normal onReading path. No-op before the manager promise
//                     // resolves or after stop(). (emit() stays private.)

// DevToolsPanel.ts — dev-only, never imported statically by production code.
//   export function mountDevToolsPanel( host: Element ): void
// Vanilla DOM: builds the floating panel, appends it to the host (the
// `.wp-block-bsb-cockpit` wrapper, so the theme's CSS custom properties cascade
// into it), wires listeners:
//   - chip / header control toggles collapsed ↔ expanded (class toggle);
//   - the "Bypass charging gate" toggle flips devOverrides.bypassCharging,
//     persists, then calls instanceFor().monitor?.refresh() so the gate state
//     updates IMMEDIATELY — without it the next reading might be 30 s away on
//     the heartbeat, or never while idle (idle readings are event-driven only);
//   - subscribes via onDevReading to keep the actual-state line current;
//   - restores { collapsed, bypassCharging } from localStorage key
//     'bsb-dev-tools' on mount (JSON payload; silently tolerant of absent or
//     corrupt values — fall back to defaults, never throw), and refreshes the
//     monitor if a persisted bypass came back on. The monitor may not exist yet
//     at mount (init order is async both ways); the refresh no-op plus the
//     transform on the next natural reading make that race harmless.

// view.ts — boot, after the store registration:
//   if ( SCRIPT_DEBUG ) {
//     void import( './DevToolsPanel' ).then( ( mod ) => {
//       const host = document.querySelector( '.wp-block-bsb-cockpit' );
//       if ( host ) mod.mountDevToolsPanel( host );
//     } );
//   }
// The folded-false branch means production emits no chunk and ships no code.
// Fallback if the dynamic-import chunk misbehaves under the script-modules
// output (verify in a dev build that the panel actually loads): switch to a
// static import with the same SCRIPT_DEBUG guard around the mount call and
// confirm what production tree-shaking leaves behind is acceptable/inert.
```

## 5. Panel UX & styling

- **Placement:** `position: fixed`, bottom-right corner, above the cockpit layout (`z-index` above everything the cockpit uses). Must never intercept clicks outside its own box.
- **Collapsed:** a small pill/chip ("DEV"). When the bypass is active, the chip carries a visible accent so an enabled override is never invisible.
- **Expanded:** compact card — header ("Dev tools" + collapse control), one labeled toggle row ("Bypass charging gate" + a one-line helper, e.g. "Run while plugged in — readings are not a real benchmark"), and the actual-state line while bypass is on ("Actually: plugged in / on battery").
- **Copy:** plain untranslated strings in the panel module. This is maintainer-only tooling that never ships; do not add `__()` calls (JS string extraction isn't wired in this repo anyway).
- **Styles:** a new `.bsb-devtools` section in `src/cockpit/style.scss` (SCSS only, never a hand-written `.css`). Reuse the existing theme tokens defined on `.wp-block-bsb-cockpit` — both light and `[data-theme='dark']` must look right; verify any token you reference actually exists in the theme before using it. Tradeoff, accepted: the compiled stylesheet ships these few unused selectors in production (the SCSS pipeline has no build-flag branch, and a dev-only style entry isn't worth the enqueue plumbing).
- **Mockup first (CLAUDE.md rule):** this is a new UI surface. Before production code, build `docs/mockups/dev-tools-panel.html` — self-contained (inline CSS/JS, no build step), showing collapsed + expanded states, light + dark, toggle on/off — add a line to `docs/mockups/README.md`, and get the direction approved by the reviewing session before porting it into SCSS/DOM code (PR 1, see §8).

## 6. Behavior specification

- **Toggling bypass ON (while plugged, idle):** `monitor.refresh()` re-emits → transform yields `charging: false` → `isStartBlocked` clears → run button enables instantly.
- **During a bypassed run:** readings keep flowing as "on battery": samples record (`session.record`), readouts/drain-rate/projection update, target-drop logic works. Plugging/unplugging the physical charger changes nothing.
- **Toggling bypass OFF while plugged and running:** the toggle's `refresh()` re-emits the raw reading → `charging: true` reaches Layer C → the run stops with reason `'plugged'`, exactly as an unplugged-then-plugged run would. This is intended and must be covered by a test.
- **Persistence:** collapsed state and bypass state survive a reload via localStorage (dev-only convenience; the accented chip keeps a persisted bypass visible).
- **Production build:** `SCRIPT_DEBUG` folds to `false` → no panel module in the bundle, `devOverrides.bypassCharging` is permanently `false` → `applyDevOverrides` returns the raw reading. The only production-path cost is one function call and one boolean read per battery reading.

## 7. Contracts (charts)

Same PR as the implementation, never a follow-up:

- `docs/contracts/cockpit-frontend-modules.mmd` — add `DevOverrides` (state + transform + subscription, public surface only), `DevToolsPanel` (dev-build-only marker), `BatteryMonitor.refresh()`, and the relationships `BatteryStore → DevOverrides`, `DevToolsPanel → DevOverrides` / `RunInstance`.
- **Broken window, fix in passing:** both `cockpit-frontend-modules.mmd` (~L50) and `CockpitContext.ts` (~L50) still say "six-stat" for `traits`; the code migrated to five (commit `a4daf9a`). Correct the wording in the same PR.
- No PHP chart changes — no PHP is touched.

## 8. Testing spec

Behavior through public interfaces only; vitest (jsdom) carries the behavior coverage, since production e2e builds exclude the panel by design.

**Vitest:**
- `DevOverrides`: bypass off → input returned unchanged and raw not mutated; bypass on → `charging` forced false, `actualCharging` records the raw truth, subscribers notified; unsubscribe works.
- `DevToolsPanel` (jsdom): `mountDevToolsPanel` renders the chip into the host; expand/collapse round-trips; the toggle flips `devOverrides.bypassCharging`, persists to localStorage, and calls `refresh()` on the instance's monitor (observable via a fake monitor placed on `instanceFor()`); mount restores persisted state and tolerates absent/corrupt payloads; a restored active bypass triggers a monitor refresh.
- `BatteryMonitor.refresh()`: emits the current reading through `onReading`; no-op before the manager resolves and after `stop()` (extend the existing `BatteryMonitor.test.ts`).
- Gate integration (behavioral, through the store): with bypass on, a charging reading flowing through the battery pipeline leaves the run startable and records samples during an active session; with bypass off mid-run, a charging reading stops the run with reason `'plugged'`. Follow the existing `view.test.ts` / `RunLifecycle.test.ts` patterns for driving readings.
- Reset `devOverrides` state between tests (it is a module singleton).

**Playwright e2e** (extend `tests/e2e/CockpitCourse.spec.mts` or a small new spec):
- The cockpit page contains **no** `.bsb-devtools` element — e2e runs the production build (`pretest:e2e` → `pnpm build`), so this asserts the dev tooling can never leak into a shipped bundle. That absence selector is a contract with the panel's root class: rename them together.

**Manual dev verification (before the PR):** run `pnpm dev`, confirm the panel mounts, the dynamic-import chunk loads under the script-modules output, and the bypass actually enables the run button while plugged in. Screenshot in the PR description.

## 9. Delivery — two PRs, in order

1. **PR 1 — mockup.** `docs/mockups/dev-tools-panel.html` + README entry, nothing else. The reviewing session approves the direction (offer the tweak levers: size, colour, spacing) before PR 2 starts.
2. **PR 2 — implementation.** Everything else in this plan: `DevOverrides`, `DevToolsPanel`, `BatteryMonitor.refresh()`, the `view.ts` boot guard, `src/Globals.d.ts`, the vitest `define`, SCSS, all tests, the chart update, the six-stat wording fix.

Each PR: replay the PR workflow locally until green, Conventional Commits (`[FEAT]` for PR 2, `[DOCS]`/`[CHORE]` as fits PR 1), no AI attribution, push and open the PR without asking (standing convention).

## 10. Acceptance criteria (reviewer checks these)

- Production bundle ships zero dev-tools code: build with `pnpm build` and grep `build/` for panel markers (e.g. `bsb-devtools`, `mountDevToolsPanel`) — nothing outside the compiled stylesheet's dormant selectors; the e2e absence assertion passes.
- Exactly **one** bypass seam: grep shows no bypass checks added to `RunStore`, `RunLifecycle`, `DrainRate`, or the sample-recording gate — only the `applyDevOverrides` call in `BatteryStore`.
- A bypassed run is complete: samples recorded, readouts live, summary produced.
- Toggling bypass takes effect immediately in both directions (no 30 s heartbeat wait), including the mid-run stop on toggle-off while plugged.
- `SCRIPT_DEBUG` usage verified against the installed `@wordpress/scripts` config; typed via the ambient declaration; vitest `define` added.
- No PHP changes anywhere in the diff.
- All styles in SCSS; panel strings untranslated by design; chart updated in the same PR; mockup approved before implementation; all CLAUDE.md conventions hold (PHPCS untouched-green, lint/tests replayed locally with real exit codes).
