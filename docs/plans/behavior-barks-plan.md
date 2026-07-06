# Behavior Barks — Implementation Plan

The cockpit shows a short, playful "bark" at the top of the running viewport
whenever the surf engine starts a *novelty* behavior — e.g. the surfer starts
lingering on images and the cockpit quips "Basking in the beauty of the
pictures…". Barks make a run watchable without narrating every mechanical
action.

This plan is authoritative for the feature. It reuses the existing toast
architecture (queue module + store slice + PHP-seeded strings) and the existing
engine→cockpit `postMessage` seam. Nothing in the current toast system's look,
feel, or timing changes.

## Product rules (settled — do not re-litigate)

1. **Trigger**: a bark fires when a behavior starts executing (auction winner
   begins its `run()`).
2. **Novelty only**: barking behaviors are `readPause`, `glanceBack`,
   `watchVideo`, `lingerImage`, `selectSnippet`, `moveOn`. Non-barking
   (mechanical, frequent): `scrollBurst`, `microScroll`, `fidgetWiggle`.
3. **Two variants per behavior**: each barking behavior has exactly 2 flavor
   strings; one is picked at random each time it barks. No session budget — a
   behavior may bark every time it wins.
4. **Placement**: top of the **iframe** (the `.bsb-cockpit__viewport-wrap`),
   not the viewport top — it must read as "inside" the simulated page.
5. **Styling**: same pill language as the bottom toast — text + a unique icon
   per behavior.
6. **Lifecycle**: non-persistent. A bark auto-dismisses after its hold time. A
   newer bark replaces it early — but never during the bark's **safe period**
   (minimum on-screen time). A bark arriving during the safe period *waits* and
   replaces at safe-period end; if several arrive, only the newest is kept
   (pending slot of depth 1). No flicker, no backlog.
7. **Bottom toast queue untouched**: errors and the view-only notice keep their
   current placement, timing, and behavior exactly.

## Design decisions (settled)

- **Timing**: `BARK_HOLD_MS = 6000`, `BARK_SAFE_MS = 2500`. Own constants in
  the bark module — `TOAST_HOLD_MS` and everything else in `Toasts.ts` stays
  untouched. Rationale: barks are ambient flavor, shorter than the 10s
  actionable toasts; 2.5s is enough to read a short quip.
- **Same-key suppression**: a bark arriving for the behavior key currently
  showing (or currently pending) is ignored — replacing text with identical
  text reads as a glitch.
- **Run-gated**: barks only raise while `context.running`; on run stop every
  bark (showing + pending + timers) is cleared immediately.
- **Accessibility**: the bark layer is `aria-hidden="true"` and
  `pointer-events: none`. Barks are decorative eye-candy; announcing every one
  would spam screen readers. Real information keeps flowing through the
  existing ARIA-live toast.
- **Engine stays flavor-free**: the engine posts *every* winner's key; the
  cockpit's string table decides what barks (a key with no strings entry is
  silently ignored). Flavor, filtering, and presentation all live cockpit-side.

## Architecture

Mirrors the page-done handshake and the toast queue exactly:

```
SurfLoop (iframe)                      Cockpit (parent frame)
  winner picked ──► deps.onBehaviorRun(key)
                      │ (wired in EngineBoot)
                      ▼
        postMessage {type:'bsb:behaviorStart', key}
                      │
                      ▼
        BarkStore callbacks.initBark  ── window 'message' listener,
                      │                  same-origin check, running gate
                      ▼
        Barks.raiseBark(ctx, instance, key, now)
                      │  pure lifecycle: show / safe-period wait /
                      ▼  pending-slot replace / hold timer
        reactive context (barkBehavior, barkText, barkPhase)
                      │
                      ▼
        pill in .bsb-cockpit__bark-layer, CSS animations,
        animationend → callbacks.onBarkAnimationEnd (phase machine)
```

## Files — new

### `src/surfer/` (engine)

Nothing new — two edits below.

### `src/cockpit/BehaviorStart.ts`

The cockpit's side of the behavior-start handshake. Mirrors `PageAdvance.ts`:

```ts
export const BEHAVIOR_START_TYPE = 'bsb:behaviorStart';
export const isBehaviorStartMessage = (event: MessageEvent, expectedOrigin: string): boolean
export const behaviorKeyOf = (event: MessageEvent): string   // '' when absent/malformed
```

Same-origin check identical to `isPageDoneMessage`. `behaviorKeyOf` returns the
`key` field only when it is a non-empty string.

### `src/cockpit/Barks.ts`

The bark model — pure over an injected context + instance, unit-testable
without the Interactivity runtime (same philosophy as `Toasts.ts`). Owns:

```ts
export const BARK_HOLD_MS = 6000;
export const BARK_SAFE_MS = 2500;

/** Picks one of the behavior's flavor variants; '' when the key has none. */
export const pickBarkText = (
    strings: Record<string, string[]>, key: string, rng?: () => number
): string;

/** Raises a bark for a behavior start. Implements the full lifecycle:
 *  - no bark showing → show immediately (phase 'entering');
 *  - same key as showing/pending → no-op;
 *  - showing, safe period elapsed → store as pending, start leave now;
 *  - showing, inside safe period → store as pending, arm a replace timer
 *    for the remainder of the safe period (timer starts the leave);
 *  - key with no strings entry → no-op (non-barking behavior). */
export const raiseBark = (
    context: CockpitContext, instance: InstanceState, key: string, now?: number
): void;

/** Clears the bark that finished leaving and pumps the pending one (if any). */
export const finishBark = (context: CockpitContext, instance: InstanceState): void;

/** Immediately clears everything — showing bark, pending slot, all timers.
 *  Called when a run stops. */
export const clearBark = (context: CockpitContext, instance: InstanceState): void;
```

Internal state machine details:

- Showing a bark writes `barkBehavior = key`, `barkText = pickBarkText(...)`,
  `barkPhase = 'entering'`, records `instance.barkShownAt` (from
  `performance.now()` via the injectable `now` param), and does **not** arm the
  hold timer yet — the hold timer is armed by the store when the enter
  animation ends (identical to the toast's phase machine).
- The pending slot is `instance.pendingBark: string | null`. Overwriting it is
  the "only newest kept" rule.
- `startLeave` (module-private or shared with the store): clears hold timer
  and replace timer, sets phase `'leaving'`.
- `finishBark` resets `barkBehavior`/`barkText`/`barkPhase` to `''`, then if
  `pendingBark` is set, immediately shows it (fresh `barkShownAt`).
- Timer ids live on the instance (`barkTimer`, `barkReplaceTimer`), never on
  the reactive context.

### `src/cockpit/BarkStore.ts`

The bark slice of the `bsb/cockpit` store (a `StorePart`, composed in
`view.ts`). Mirrors `ToastStore.ts`:

- `state` getters: `hasBark` (`barkBehavior !== ''`), `barkKey` (the raw
  behavior key, bound onto the `data-bark` attribute), `barkMessage`,
  `isBarkEntering`, `isBarkHolding`, `isBarkLeaving`.
- `callbacks.initBark(): () => void` — attaches a window `message` listener
  (pattern-copy of `RunStore.initPageAdvance`): no-op unless `context.running`
  and `isBehaviorStartMessage(event, window.location.origin)`; then
  `raiseBark(context, instanceFor(), behaviorKeyOf(event))`. Returns the
  detach cleanup.
- `callbacks.onBarkAnimationEnd()` — phase machine, identical shape to
  `onToastAnimationEnd`: after `'entering'` → `'holding'` + arm
  `BARK_HOLD_MS` timer (timer starts the leave); after `'leaving'` →
  `finishBark`.

No actions — barks have no user interaction (no dismiss button).

### Tests (new files)

- `src/cockpit/BehaviorStart.test.ts`
- `src/cockpit/Barks.test.ts` — the heart of the coverage; see Testing below.

## Files — edited

### `src/surfer/SurfLoop.ts`

- `SurfLoopDeps` gains `onBehaviorRun?: (key: string) => void` (optional —
  existing tests and callers stay valid).
- In the tick loop, inside `if (winner)` and **before** the `MOVE_ON_KEY`
  branch: `this.deps.onBehaviorRun?.(winner.key);` — so `moveOn` also
  notifies (it barks its "paddling on" line as the page turns).

### `src/surfer/index.ts` (EngineBoot)

Wire the new dep next to `onPageDone`:

```ts
onBehaviorRun: (key) => {
    window.parent.postMessage(
        { type: 'bsb:behaviorStart', key },
        window.location.origin
    );
},
```

Define the type string as a local const like `PAGE_DONE_MESSAGE` is. (The
cockpit-side `BehaviorStart.ts` owns its own copy of the literal, exactly as
`PAGE_DONE_TYPE` does today — the engine bundle and the cockpit module don't
share imports across the frame boundary today; keep that symmetry.)

### `src/cockpit/CockpitContext.ts`

Context additions (all documented, following the toast fields' comment style):

```ts
barkBehavior: string;                    // behavior key showing, '' when none
barkText: string;
barkPhase: ToastPhase;                   // reuse the phase union
barkStrings: Record<string, string[]>;   // behavior key → 2 translated variants
```

### `src/cockpit/RunInstance.ts`

`InstanceState` additions + seeding + `__resetInstance` coverage:

```ts
pendingBark: string | null;   // depth-1 slot, newest wins
barkTimer: number | null;     // hold timeout id
barkReplaceTimer: number | null; // safe-period replace timeout id
barkShownAt: number | null;   // performance.now() the showing bark appeared
```

### `src/cockpit/RunLifecycle.ts`

`stopRun` calls `clearBark(context, instance)` so a stopped run never leaves a
bark hanging over the idle card.

### `src/cockpit/view.ts`

Compose `barkStore` into the merged store parts.

### `src/cockpit/render.php`

Context seeding:

```php
'barkBehavior' => '',
'barkText'     => '',
'barkPhase'    => '',
// Translated bark quips by behavior key, two variants each; the cockpit picks
// one at random when the behavior starts. A behavior absent here never barks.
'barkStrings'  => array(
    'readPause'     => array(
        __( 'Deep in the good words…', 'battery-surf-bench' ),
        __( 'Catching up on the fine print…', 'battery-surf-bench' ),
    ),
    'glanceBack'    => array(
        __( 'Wait — what did that say?', 'battery-surf-bench' ),
        __( 'Paddling back for a second look…', 'battery-surf-bench' ),
    ),
    'watchVideo'    => array(
        __( 'Ooh, moving pictures!', 'battery-surf-bench' ),
        __( 'Popcorn out — the video is rolling…', 'battery-surf-bench' ),
    ),
    'lingerImage'   => array(
        __( 'Basking in the beauty of the pictures…', 'battery-surf-bench' ),
        __( 'Ooh, shiny pixels…', 'battery-surf-bench' ),
    ),
    'selectSnippet' => array(
        __( 'Highlighting the juicy bits…', 'battery-surf-bench' ),
        __( 'This part deserves a highlight…', 'battery-surf-bench' ),
    ),
    'moveOn'        => array(
        __( 'Paddling off to the next page…', 'battery-surf-bench' ),
        __( 'This wave is done — surfing on…', 'battery-surf-bench' ),
    ),
),
```

Behavior keys are string literals here (they mirror the engine's exported
`*_KEY` constants; PHP cannot import them — note this adjacency in a comment).

### `includes/Cockpit/Views/CockpitView.php`

Two edits:

1. Root element: add `data-wp-init---bark="callbacks.initBark"` next to the
   existing `data-wp-init---page-advance`.
2. Inside `.bsb-cockpit__viewport-wrap`, after the `<iframe>`:

```html
<div class="bsb-cockpit__bark-layer" aria-hidden="true">
    <div class="bsb-cockpit__bark" hidden data-wp-bind--hidden="!state.hasBark" data-wp-bind--data-bark="state.barkKey" data-wp-class--is-entering="state.isBarkEntering" data-wp-class--is-holding="state.isBarkHolding" data-wp-class--is-leaving="state.isBarkLeaving" data-wp-on--animationend="callbacks.onBarkAnimationEnd">
        <span class="bsb-cockpit__bark-icon" aria-hidden="true"></span>
        <span class="bsb-cockpit__bark-msg" data-wp-text="state.barkMessage"></span>
    </div>
</div>
```

All markup stays in the view heredoc per the repo's markup rules. No new
dynamic PHP values are needed (no close button, no labels — the layer is
`aria-hidden`).

### `src/cockpit/style.scss`

- `.bsb-cockpit__bark-layer`: `position: absolute; inset-inline: 0;
  inset-block-start: 0.9rem; display: flex; justify-content: center;
  padding-inline: 1rem; pointer-events: none; z-index: 5;` — inside the
  already-`position: relative` `.bsb-cockpit__viewport-wrap`, so it anchors to
  the iframe top.
- `.bsb-cockpit__bark`: same frosted-pill construction as
  `.bsb-cockpit__toast` (radius, background, border, blur, typography). Factor
  the shared pill declarations into one SCSS mixin (e.g. `@mixin cockpit-pill`)
  used by **both** toast and bark so the look stays in sync — with the hard
  constraint that the compiled toast CSS is unchanged (byte-diff the built
  toast rules if in doubt; the toast e2e and its visual identity must not
  move). If a clean extraction risks changing toast output, duplicate the
  declarations for the bark with a comment pointing at the toast rules instead.
- Bark accent: one accent for all barks, from existing theme tokens — use the
  teal family (`$coastal-teal` / `$coastal-teal-deep`), structure identical to
  the toast's `is-notice` custom-property block.
- Icon selection by attribute (single binding, no per-class getters):

```scss
.bsb-cockpit__bark {
    &[data-bark='readPause']     { --bark-icon: #{theme.$book-icon}; }
    &[data-bark='glanceBack']    { --bark-icon: #{theme.$glance-back-icon}; }
    &[data-bark='watchVideo']    { --bark-icon: #{theme.$play-icon}; }
    &[data-bark='lingerImage']   { --bark-icon: #{theme.$picture-icon}; }
    &[data-bark='selectSnippet'] { --bark-icon: #{theme.$text-cursor-icon}; }
    &[data-bark='moveOn']        { --bark-icon: #{theme.$wave-icon}; }
}
```

- `.bsb-cockpit__bark-icon`: same accent-circle + white masked glyph pattern
  as `.bsb-cockpit__toast-icon`.
- Animations: new `@keyframes bsb-bark-in` / `bsb-bark-out` — mirror the
  toast's timing/easing (460ms in, 320ms out, same cubic-beziers) but drop
  **down from the top** (translateY from a small negative offset) instead of
  rising from the bottom. Phases `is-entering`/`is-holding`/`is-leaving` drive
  them exactly like the toast.

### `src/styles/_theme.scss`

Six new SVG-as-data-URI mask variables, same style/format as the existing
`$lock-icon` etc. (simple, single-color, `fill`-based or stroked shapes —
match the drawing style of the existing set):

- `$book-icon` — an open book (readPause)
- `$glance-back-icon` — an arrow curving back/left (glanceBack)
- `$play-icon` — a play triangle (watchVideo)
- `$picture-icon` — a framed picture: rectangle, small sun, mountain line
  (lingerImage)
- `$text-cursor-icon` — a **terminal cursor**: a solid block/I-beam caret, not
  a mouse pointer (selectSnippet)
- `$wave-icon` — a stylized wave curl (moveOn)

Keep each glyph legible at 0.72rem — bold, minimal detail.

## Testing

### Vitest (unit)

`Barks.test.ts` — pure-model coverage through the public functions, injected
fake timers (`vi.useFakeTimers`) and injected `now`/`rng`:

1. `raiseBark` with a free pill shows immediately (`entering`, text from the
   key's variants, `barkShownAt` recorded).
2. Variant pick: rng at 0 → first variant, rng near 1 → second.
3. Unknown key (e.g. `scrollBurst`) → no-op.
4. Same key as showing → no-op; same key as pending → no-op.
5. New key inside safe period → pending set, nothing visible changes yet;
   replace timer fires at safe-period end → phase `leaving`.
6. Two arrivals inside safe period → only the newest survives as pending.
7. New key after safe period → pending set + immediate `leaving`.
8. `finishBark` clears the context and pumps pending (fresh shownAt).
9. `clearBark` mid-anything → context empty, pending null, timers cleared.

`BehaviorStart.test.ts` — origin mismatch, wrong type, missing/blank key,
happy path (mirrors `PageAdvance.test.ts`).

`SurfLoop.test.ts` (extend) — `onBehaviorRun` fires with the winner's key for
a normal behavior; fires with `moveOn`'s key before `onPageDone`; absent dep
is safe.

`view.test.ts` (extend) — bark slice merged; state getters read the context;
`onBarkAnimationEnd` walks entering → holding (arms hold timer) → leaving →
finish; `initBark` raises on a legitimate message only while running, and its
cleanup detaches.

`RunLifecycle.test.ts` (extend) — `stopRun` clears an active bark.

### PHPUnit

Extend the existing cockpit view/render coverage (find the existing test files
for `CockpitView`/render context and follow their pattern): the rendered
markup contains the bark layer with its directives (`data-wp-bind--data-bark`,
`data-wp-on--animationend="callbacks.onBarkAnimationEnd"`, `aria-hidden`), and
the seeded context carries `barkStrings` with exactly two variants for each of
the six behavior keys.

### E2E (`tests/e2e/CockpitCourse.spec.mts`, extend)

1. Contract assertions (always): the bark pill exists inside
   `.bsb-cockpit__viewport-wrap`, is hidden at rest, and carries the store
   bindings the slice exposes (`data-wp-on--animationend`, hidden binding).
2. Live assertion (attempt): start a run at the fastest speed and `expect`
   `.bsb-cockpit__bark` to become visible within a generous timeout (~30s) —
   six of nine behaviors bark, so one should win quickly. Run it locally at
   least 3 times; if it flakes, drop the live assertion, keep the contract
   assertions, and flag the flake in the PR description for the reviewer.

Remember the selector/directive contract rule: any e2e selector added here is
kept in sync with the markup in the same change, forever.

## Contract charts (same PR — mandatory)

- `docs/contracts/cockpit-frontend-modules.mmd`: add `BarkStore` (composed by
  `CockpitView`), `Barks` (module: raiseBark/finishBark/clearBark/
  pickBarkText/BARK_HOLD_MS/BARK_SAFE_MS), `BehaviorStart` (module:
  isBehaviorStartMessage/behaviorKeyOf); relations — BarkStore →
  Barks/BehaviorStart/RunInstance/CockpitContext, RunLifecycle → Barks
  (clears on stop), RunInstance owns the pending slot + timers.
- `docs/contracts/surf-engine-modules.mmd`: `SurfLoop` notes the
  `onBehaviorRun` dep; `EngineBoot` gains a `..>` relation posting
  `bsb:behaviorStart` to the cockpit-side receiver (mirror the existing
  `postMessage 'bsb:pageDone'` note).

Follow the charts' content rules: public surface only.

## Process requirements

- Work in this worktree/branch; Conventional Commits (`[FEAT]: …`), no AI
  attribution, no session trailers.
- JSDoc on every new exported function/class (descriptions only, no redundant
  types); PHPDoc with full type tags on any PHP additions.
- CamelCase file names.
- No HTML in PHP outside the view heredoc; no inline styles; SCSS only.
- Never pipe lint/test output through tail/head; check real exit codes.
- Verify: `pnpm typecheck`, `pnpm lint:js`, `pnpm test`, `composer lint`,
  `composer test`, `pnpm test:e2e` all green before the PR.
- Push the branch and open a **draft PR** when green; then wait for CI to
  finish fully green.
