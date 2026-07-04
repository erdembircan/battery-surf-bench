# Dev-Tools Plan — Environment-Gated Development Tools with Battery Override

## Problem

Testing the cockpit's battery behavior requires physically unplugging the laptop (and the
monitor that powers it). We need a development-tools system that can inject and manipulate
runtime values — first tool: **overriding the battery charging state (and level)** seen by
the cockpit — active only in development environments, on both the PHP and the client side.

## Ground truth this plan is built on

Verified against the installed source (WordPress 7.0 under `wp-playground/wordpress/`,
`@wordpress/interactivity` 6.48.1 under `node_modules/`) — not training data:

1. **Native environment value.** WordPress has the NODE_ENV analog:
   `wp_get_environment_type()` (`wp-includes/load.php`), fed by the `WP_ENVIRONMENT_TYPE`
   constant or system env var. Values: `local | development | staging | production`;
   anything invalid falls back to `production`. This is the activation switch. (The
   separate `wp_get_development_mode()` governs core-internals nuances, not "is this a dev
   site" — we do not use it.)
2. **Store merging is the sanctioned extension mechanism.** `store()` calls with the same
   namespace from *different script modules* deep-merge into the same raw store and return
   the same reactive `state`/`actions` proxies (`@wordpress/interactivity/src/store.ts`).
   Core ships this exact pattern in every core block view module. Our `bsb/cockpit` store
   is public (no `lock`), so a dev-only module can join it. Collision rule: the later
   call's members **override** — dev-tools members must therefore be namespaced by prefix
   (see below).
3. **No flux-style `subscribe`/middleware exists.** The Interactivity API's supported
   interception points are (a) mutating the shared state proxy — every directive/getter
   that reads it re-evaluates via Preact signals — and (b) `data-wp-watch` /
   exported `watch()` effects. We use (a) + a `data-wp-watch` directive; no monkey-patching.
4. **Battery data flows through per-element context, not global state.**
   `callbacks.initBattery` (`src/cockpit/BatteryStore.ts`) is the sole consumer of
   `navigator.getBattery`; its `BatteryMonitor` `onReading` path drives *everything*:
   context display values, sample recording, the plugged auto-stop, the target-drop stop.
   Real `chargingchange` events re-write context, so a display-only fake would be stomped
   and run logic would still see the truth. **The override must be applied inside the
   reading-processing path.**

## Architecture

### Activation — one switch, both sides

- **PHP:** a `DevTools` manager is registered like every other manager in
  `BatterySurfBench::managers()`, but its `register()` bails immediately unless
  `wp_get_environment_type()` returns one of the allowed values (`local`, `development`)
  read from `Config.php` (e.g. `devtools.environments`). Expose the check as a public
  method (e.g. `DevTools::is_active(): bool`) so tests and other managers can consult it.
- **Client:** there is no separate JS env check — the dev-tools script module and panel
  markup are **only emitted when the PHP gate is open**. Production pages ship zero dev
  bytes. The seam inside the production cockpit module is inert without the dev module
  (optional-chained state slice, see below).
- **Playground:** add `WP_ENVIRONMENT_TYPE: 'development'` to the existing
  `defineWpConfigConsts` debug step in `wp-playground/blueprint.mts` (dev *and* e2e
  blueprints — e2e must be able to exercise the tools; production gating is covered by
  PHP unit tests instead). Verify at runtime that the constant actually wins (the function
  also reads a system env var; constant takes precedence).

### Frontend — dev module joins the cockpit store

New script module (own webpack module entry, not part of the cockpit view module):

- `src/devtools/view.ts` — thin composition root, same convention as the cockpit:
  `store( 'bsb/cockpit', mergeStoreParts( batteryOverrideStore ) )`. Joining the existing
  namespace is the whole point: same state proxy, reactivity for free.
- `src/devtools/BatteryOverrideStore.ts` — the domain slice (CamelCase, unit-tested).
  **Every member it merges into `bsb/cockpit` carries a `devtools` prefix**
  (`state.devtools.*`, `actions.devtoolsToggleCharging`, getters like
  `state.devtoolsIsChargingForced`, …) so the override-on-collision merge rule can never
  clobber production members.
- `src/devtools/style.scss` — compiled by the build like every other stylesheet; panel
  styling lives here, never inline.

Override state shape (in cockpit store state, so it is shared and reactive):

```ts
state.devtools = {
  battery: {
    charging: boolean | null, // null = don't override
    level:    number  | null, // 0–1, null = don't override
  },
};
```

### The seam — override applied at the reading choke point

Production-side changes in `src/cockpit/BatteryStore.ts` (small, inert without dev tools):

1. Extract the current `onReading` closure body into a named, exported, testable function
   (e.g. `applyReading( context, instance, reading )`) — behavior unchanged.
2. Add a tiny pure resolver, e.g. `src/cockpit/BatteryOverride.ts`:
   `resolveReading( raw: Reading | null, override?: { charging: boolean | null; level: number | null } ): Reading | null`
   — returns `raw` untouched when the override slice is absent/null-valued (production);
   substitutes the overridden fields when set; may synthesize a full reading when the
   platform reports no battery support but both override fields are set (makes the tools
   usable in Safari/Firefox where `navigator.getBattery` is absent).
3. `initBattery`'s `onReading` becomes: cache the raw reading on the run instance
   (`RunInstance`), then `applyReading( context, instance, resolveReading( raw, state.devtools?.battery ) )`.
4. New cockpit callback (e.g. `callbacks.syncBatteryOverride`) bound on the cockpit
   wrapper via `data-wp-watch--devtools-battery`. It reads `state.devtools?.battery`
   (reactive dependency) and re-runs the resolve+apply path with the cached raw reading.
   This is what makes flipping the toggle take effect *immediately* — including
   triggering the plugged auto-stop mid-run — instead of waiting for the next real
   battery event. In production `state.devtools` is undefined; the watch reads
   `undefined` once and never does anything.

This gives one uniform truth: display getters, sample recording, plugged-stop and
target-stop all see the same (possibly overridden) reading. No second code path.

### Panel UI

- Rendered server-side (only when the gate is open) by a View class —
  `includes/DevTools/Views/DevToolsPanelView.php` implementing the `View` interface,
  heredoc markup, the view escapes its own output. No HTML in the manager.
- **Floating collapsible widget, fixed to the bottom-right corner of the page** (high
  z-index, above the cockpit). Two states:
  - **Collapsed (default):** a small pill/badge (e.g. "DEV") — unobtrusive, always
    visible while the tools are active.
  - **Expanded:** clicking the pill reveals the panel card (opening upward from the
    corner): a header ("Dev Tools", collapse control) and one **section per sub-tool**.
- **Each sub-tool has its own enable/disable master toggle.** A disabled sub-tool is
  fully inert — its overrides are not applied regardless of its control values — and its
  controls render visually muted. Only enabling the section arms it.
- Sub-tool sections are additive: a future tool is a new section + state slice, no
  rework. Today there is exactly one section:
  - **Battery** — enable toggle; charging override tri-state (System / Charging /
    Discharging); level override (on/off + slider).
- Panel/off/on state shape (extends the store slice above):

  ```ts
  state.devtools = {
    open: boolean,             // panel expanded vs collapsed pill
    battery: {
      enabled:  boolean,       // sub-tool master switch — gate for the resolver
      charging: boolean | null, // null = follow system
      level:    number  | null, // 0–1, null = follow system
    },
  };
  ```

  `resolveReading` applies overrides **only when `enabled` is true**.
- **Persistence:** the `devtools` slice is persisted to `localStorage` (versioned key,
  written via a watch on the slice, hydrated on module init). Without it every reload
  would snap back to the real charging state and re-block the run — the exact friction
  this tool exists to remove. Dev-only code path, so `localStorage` is acceptable here.
- Wrapper is `data-wp-interactive="bsb/cockpit"` and binds only to `devtools*`-prefixed
  state/actions (the panel sits outside the cockpit block, so it has **no cockpit
  context** — it must bind to state only, never `getContext()`-derived getters).
- Panel + module load on every surface where the cockpit view module loads (course
  pages, cockpit dashboard, session-detail screen) — discover those surfaces from the
  `Cockpit` and `SessionDetail` managers rather than hard-coding assumptions.
- This is dev-only chrome, not product UI — deliberately minimal styling. The
  interaction pattern (bottom-right collapsible floating widget, per-tool sections with
  master toggles) was specified directly by the maintainer, so no `docs/mockups/` round;
  visual polish stays utilitarian.

### PHP wiring

- `includes/DevTools/DevTools.php` — manager: env gate; registers the script module
  (`wp_register_script_module`, dep on `@wordpress/interactivity`, content-hash version
  via the existing `Assets` service conventions); enqueues it and renders the panel view
  on the cockpit surfaces; enqueues the compiled panel stylesheet.
- `includes/Config.php` — `devtools` section (allowed environments, handles/paths as the
  existing config conventions dictate).
- Build: extend the **module** config in `webpack.config.js` with the `devtools/view`
  entry (the config already destructures `[ scriptConfig, ...moduleConfigs ]`; module
  configs currently pass through untouched — add the entry, keep the rest untouched).

## Not in scope (this PR)

- Migrating existing e2e battery workarounds to the override (follow-up).
- Any second dev tool (time warp, speed hacks, state snapshots) — architecture leaves
  room, nothing built.
- `wp_get_development_mode()` — different semantics, not our switch.

## Tests (same PR, non-negotiable)

- **PHPUnit** (`tests/DevTools/…`, base `TestCase`, Brain\Monkey):
  gate closed on `production`/`staging` (no hooks registered, nothing enqueued); gate
  open on `development`/`local`; script-module registration/enqueue calls made with
  correct args; panel view implements `View`, escapes its slots.
- **Vitest** (`src/cockpit/`, `src/devtools/`): `BatteryOverride.resolveReading` pure
  cases (passthrough / charging-only / level-only / synth-when-unsupported);
  `applyReading` extraction keeps existing behavior (charging mid-run → `plugged` stop,
  target reached → `targetDrop` stop, sample recording gates) — extend existing battery
  tests rather than duplicating; `BatteryOverrideStore` slice actions.
- **Playwright e2e** (`tests/e2e/DevTools.spec.mts`): panel present on a course page
  (blueprint env = development); with a run active, forcing "Charging" stops the run with
  the plugged reason; forcing "Discharging" allows starting and sustaining a run on a
  host that is actually plugged in — the exact friction this feature removes. Blueprint
  runs `WP_DEBUG_DISPLAY` on: any PHP notice fails the run. Keep selectors/directives in
  the spec in sync with the panel markup in the same change.

## Charts

`docs/contracts/` must gain/update the chart(s) covering: the `DevTools` manager and its
public surface, the dev-tools script module joining the `bsb/cockpit` store, and the
override seam in the battery flow. Public API only, abstractions marked. Same PR.

## Delivery

Single PR from this branch (`worktree-dev-tools-fresh`), which already carries the
removal of the superseded plan. Conventional Commits, no AI attribution. Before pushing:
replay the PR workflow from `.github_bak/workflows/` locally (read it fresh, run every
job's steps, all green — full output, real exit codes, no `tail`). The worktree is fresh:
run `composer install` and `pnpm install` first (real installs, no symlinked `vendor`).
