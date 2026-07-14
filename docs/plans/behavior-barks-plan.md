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
6. **Lifecycle**: non-persistent and duration-tied. A bark holds for the full
   wall-clock duration of the behavior it announces, then auto-dismisses. A
   newer bark **always replaces the showing one immediately, at any phase**
   (including mid-leave) — there is no safe period and no pending/replace
   slot. The store is the sole authority: two store-owned timers drive every
   transition, never an animation event.
7. **Bottom toast queue untouched**: errors and the view-only notice keep their
   current placement, timing, and behavior exactly.

## Design decisions (settled)

- **Timing**: no fixed hold and no safe period. The pill holds for the
  behavior's own announced wall-clock `durationMs` — the surfer's `run()`
  reports its dwell once, via an `announce` callback, at the moment it knows
  it (same rng draw as it already uses; never sampled twice). `BARK_LEAVE_MS
  = 320` is the one fixed constant left — it matches the CSS exit keyframe's
  duration, so the store clears the bark exactly as it finishes animating
  out. Own constant in the bark module — `TOAST_HOLD_MS` and everything else
  in `Toasts.ts` stays untouched.
- **Same-key suppression**: a bark arriving for the behavior key currently
  *entering* (still on screen, not yet leaving) is ignored — replacing text
  with identical text reads as a glitch. A same-key arrival while the current
  bark is already *leaving* is treated as fresh and replaces immediately
  (a long-dwelling behavior may legitimately re-win and re-bark).
- **Store-authoritative, replace-at-any-phase**: a bark arriving for a
  *different* key always replaces the showing one immediately, whatever phase
  it's in (entering or leaving) — no pending slot, no waiting. Two
  store-owned timers (armed on the per-instance state, never the reactive
  context) drive every transition: a **duration timer**, armed for
  `durationMs`, moves `entering` → `leaving`; a **leave timer**, armed for
  `BARK_LEAVE_MS`, moves `leaving` → cleared. No animation ever drives a
  state transition — the pill's CSS (including the ebbing-tide countdown
  fill) is a pure reactive projection of `barkDurationMs`/`barkPhase`.
- **Run-gated**: barks only raise while `context.running`; on run stop the
  showing bark and its timers are cleared immediately.
- **Accessibility**: the bark layer is `aria-hidden="true"` and
  `pointer-events: none`. Barks are decorative eye-candy; announcing every one
  would spam screen readers. Real information keeps flowing through the
  existing ARIA-live toast. The countdown itself is pure styling — no
  numeric/text remaining-time indicator, so there's nothing to announce there
  either.
- **Engine stays flavor-free**: the engine posts *every* winner's key and its
  announced duration; the cockpit's string table decides what barks (a key
  with no strings entry is silently ignored). Flavor, filtering, and
  presentation all live cockpit-side. A behavior that never calls `announce`
  (the mechanical `scrollBurst`/`microScroll`/`fidgetWiggle`) simply never
  notifies at all — there is no heartbeat re-notify of any kind.

## Architecture

Mirrors the page-done handshake and the toast queue exactly:

```
SurfLoop (iframe)                      Cockpit (parent frame)
  winner.run(motor, ctx, announce)
    └─ announce(durationMs)  ── once, at the moment run() knows its
                      │          own wall-clock dwell
                      ▼
        deps.onBehaviorRun(key, durationMs)
                      │ (wired in EngineBoot; moveOn uses a fixed
                      │  MOVE_ON_DISPLAY_MS instead of announce)
                      ▼
        postMessage {type:'bsb:behaviorStart', key, durationMs}
                      │
                      ▼
        BarkStore callbacks.initBark  ── window 'message' listener,
                      │                  same-origin check, running gate
                      ▼
        Barks.raiseBark(ctx, instance, key, durationMs)
                      │  store-authoritative: replaces the showing bark
                      ▼  immediately, at any phase — no pending slot
        reactive context (barkBehavior, barkText, barkDurationMs, barkPhase)
                      │
                      ├─► duration timer (armed for durationMs):
                      │     entering → leaving
                      └─► leave timer (armed for BARK_LEAVE_MS):
                            leaving → cleared

        pill in .bsb-cockpit__bark-layer: phase classes + the
        ebbing-tide fill (animation-duration bound to barkDurationMs via
        --bark-dur) are a PURE PROJECTION of the state above — no
        animationend, no callback, feeds nothing back into the model.
```

## Files — new

### `src/surfer/` (engine)

Nothing new — edits below (the `Behavior` contract, five barking behaviors,
`SurfLoop`, and `EngineBoot`).

### `src/cockpit/BehaviorStart.ts`

The cockpit's side of the behavior-start handshake. Mirrors `PageAdvance.ts`:

```ts
export const BEHAVIOR_START_TYPE = 'bsb:behaviorStart';
export const isBehaviorStartMessage = (event: MessageEvent, expectedOrigin: string): boolean
export const behaviorKeyOf = (event: MessageEvent): string   // '' when absent/malformed
export const durationOf = (event: MessageEvent): number      // the announced durationMs
```

Same-origin check identical to `isPageDoneMessage`, plus a `durationMs` check:
`isBehaviorStartMessage` is only `true` when the message also carries a
finite, positive `durationMs` — the store's dismiss timer is armed directly
off this value, so a malformed or missing duration must never reach it.
`behaviorKeyOf` returns the `key` field only when it is a non-empty string;
`durationOf` reads `durationMs` and is only called after
`isBehaviorStartMessage` has already validated it.

### `src/cockpit/Barks.ts`

The bark model — pure over an injected context + instance, unit-testable
without the Interactivity runtime (same philosophy as `Toasts.ts`).
Store-authoritative and duration-tied: the pill stays for the full wall-clock
duration the behavior announces, and a newer bark always replaces the one
showing immediately, at any phase. Owns:

```ts
export const BARK_LEAVE_MS = 320;

/** Picks one of the behavior's flavor variants; '' when the key has none. */
export const pickBarkText = (
    strings: Record<string, string[]>, key: string, rng?: () => number
): string;

/** Raises a bark for a behavior start. Implements the full lifecycle:
 *  - key with no strings entry → no-op (non-barking behavior);
 *  - same key as showing, still entering → no-op (dedupe a repeat while
 *    still on screen — a same key while already leaving is NOT deduped,
 *    since a long-dwelling behavior may legitimately re-win and re-bark);
 *  - otherwise: replace immediately, at any phase — clear any armed
 *    timers, write the new key/text/duration, set phase 'entering', arm a
 *    duration timer for durationMs (fires beginLeave). */
export const raiseBark = (
    context: CockpitContext, instance: InstanceState, key: string, durationMs: number
): void;

/** Clears the bark that just finished leaving. Called by the leave timer
 *  once BARK_LEAVE_MS elapses. */
export const finishBark = (context: CockpitContext, instance: InstanceState): void;

/** Immediately clears everything — the showing bark and every timer.
 *  Called when a run stops. */
export const clearBark = (context: CockpitContext, instance: InstanceState): void;
```

Internal state machine details:

- Showing a bark writes `barkBehavior = key`, `barkText = pickBarkText(...)`,
  `barkDurationMs = durationMs`, `barkPhase = 'entering'`, and arms
  `instance.barkDurationTimer` for `durationMs` — when it fires, a
  module-private `beginLeave` sets phase `'leaving'` and arms
  `instance.barkLeaveTimer` for `BARK_LEAVE_MS`, which in turn calls
  `finishBark`.
- There is no pending slot: `raiseBark` for a different key clears whichever
  timers are currently armed and starts the new bark's own duration timer
  fresh, so a stale timer from the replaced bark can never fire later and
  disturb the new one.
- `finishBark` resets `barkBehavior`/`barkText`/`barkDurationMs`/`barkPhase`
  to `''`/`0`. There is nothing to pump — the newest arrival already won by
  replacing immediately, whenever it arrived.
- Timer ids live on the instance (`barkDurationTimer`, `barkLeaveTimer`),
  never on the reactive context.

### `src/cockpit/BarkStore.ts`

The bark slice of the `bsb/cockpit` store (a `StorePart`, composed in
`view.ts`). Reads off the reactive context and drives the pill purely from
store-owned timers — no `animationend` binding, unlike the toast:

- `state` getters: `hasBark` (`barkBehavior !== ''`), `barkKey` (the raw
  behavior key, bound onto the `data-bark` attribute), `barkMessage`,
  `isBarkEntering`, `isBarkLeaving`, and `barkDurationCss` — the showing
  bark's `barkDurationMs` formatted as a CSS time value (e.g. `"8000ms"`),
  bound onto the tide element's `--bark-dur` custom property so its ebbing
  animation matches the actual dwell.
- `callbacks.initBark(): () => void` — attaches a window `message` listener
  (pattern-copy of `RunStore.initPageAdvance`): no-op unless `context.running`
  and `isBehaviorStartMessage(event, window.location.origin)`; then
  `raiseBark(context, instanceFor(), behaviorKeyOf(event), durationOf(event))`.
  Returns the detach cleanup.
- No `onBarkAnimationEnd` — deleted entirely. The store's own duration/leave
  timers (owned by `Barks.ts`) drive every phase transition; no animation
  event may ever drive state.

No actions — barks have no user interaction (no dismiss button).

### Tests (new files)

- `src/cockpit/BehaviorStart.test.ts`
- `src/cockpit/Barks.test.ts` — the heart of the coverage; see Testing below.

## Files — edited

### `src/surfer/Behavior.ts`

- New exported type: `BehaviorAnnounce = (durationMs: number) => void`, called
  once from inside `run()`, at the moment the behavior knows its own
  wall-clock dwell, before awaiting — the cockpit's bark countdown then
  matches that dwell exactly. Same single rng draw the behavior already
  makes; never sampled twice.
- `Behavior.run` gains a third, optional parameter:
  `run: (motor: Motor, ctx: BehaviorContext, announce?: BehaviorAnnounce) => Promise<void>`.

### `src/surfer/Behaviors/{ReadPause,WatchVideo,LingerImage,GlanceBack,SelectSnippet}.ts`

Each barking behavior calls `announce` once, at sample time, with its
wall-clock ms, before awaiting:

- `ReadPause`/`WatchVideo`/`LingerImage`: announce the sampled `ms / ctx.speed`
  right after computing it, before the motor await(s).
- `GlanceBack`: samples both the scroll px and the settle ms *before* either
  await (moving the settle sample earlier doesn't perturb the shared rng
  sequence — the scroll await consumes no rng of its own), then announces
  `SCROLL_UP_MS + settleMs / ctx.speed` (the fixed scroll leg plus the
  speed-scaled settle) before the scroll/idle awaits.
- `SelectSnippet`: the motor's `selectSnippet()` choreography is fixed,
  non-speed-scaled internal constants (approach 500ms + sweep 700ms + hold
  600ms). A new `export const SELECT_SNIPPET_DISPLAY_MS = 1800;` mirrors that
  total, and `run()` announces it before the motor await — not sampled from
  rng at all.
- `MoveOn` is unchanged — `SurfLoop` handles its notification (see below);
  its `run()` stays a no-op.
- The mechanical behaviors (`ScrollBurst`, `MicroScroll`, `FidgetWiggle`)
  are unchanged — they never call `announce`, so they never notify at all.

### `src/surfer/SurfLoop.ts`

- `SurfLoopDeps.onBehaviorRun` becomes
  `onBehaviorRun?: (key: string, durationMs?: number) => void` (still
  optional — existing tests and callers stay valid).
- **The 20s wall-clock heartbeat is deleted entirely** —
  `BEHAVIOR_HEARTBEAT_MS` and the `runWithHeartbeat` wrapper are both gone.
  The tick loop now calls `winner.run(this.deps.motor, ctx, announce)`
  directly, where `announce` forwards to
  `this.deps.onBehaviorRun?.(winner.key, durationMs)`. A behavior notifies
  (at most) once, exactly when it calls `announce` from inside its own
  `run()`.
- The old pre-run `this.deps.onBehaviorRun?.(winner.key)` call (fired for
  every winner before `run()`) is removed for non-`moveOn` behaviors — the
  notification now comes from inside `run()` via `announce`, so the duration
  travels with it.
- `moveOn` is the one exception: it has no dwell of its own (it leaves
  immediately), so `SurfLoop` still notifies it directly, with a new fixed
  local constant `MOVE_ON_DISPLAY_MS = 2500` (a short display so its
  "paddling off" quip is visible during the page swap) — called *before*
  `onPageDone()` fires.

### `src/surfer/index.ts` (EngineBoot)

Wire the new dep next to `onPageDone`, now carrying the duration too:

```ts
onBehaviorRun: (key, durationMs) => {
    window.parent.postMessage(
        { type: 'bsb:behaviorStart', key, durationMs },
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
barkDurationMs: number;                  // full announced duration, 0 when none
barkPhase: BarkPhase;                    // '' | 'entering' | 'leaving' — own type
barkStrings: Record<string, string[]>;   // behavior key → 2 translated variants
```

A dedicated `BarkPhase = '' | 'entering' | 'leaving'` type, not the shared
`ToastPhase` — the bark has no `holding` phase (the duration timer covers the
whole visible life, so `entering` stays applied throughout), and `ToastPhase`
itself must stay untouched (the toast keeps its own `holding` phase and
`animationend`-driven lifecycle unchanged).

### `src/cockpit/RunInstance.ts`

`InstanceState` additions + seeding + `__resetInstance` coverage:

```ts
barkDurationTimer: number | null; // armed for the full announced dwell; fires entering -> leaving
barkLeaveTimer: number | null;    // armed for BARK_LEAVE_MS; fires leaving -> cleared
```

Replaces the old `pendingBark` / `barkTimer` / `barkReplaceTimer` /
`barkShownAt` fields entirely — there is no pending slot and no safe-period
bookkeeping left to track.

### `src/cockpit/RunLifecycle.ts`

`stopRun` calls `clearBark(context, instance)` — clearing the showing bark
and its two timers — so a stopped run never leaves a bark hanging over the
idle card.

### `src/cockpit/view.ts`

Compose `barkStore` into the merged store parts.

### `src/cockpit/render.php`

Context seeding:

```php
'barkBehavior'   => '',
'barkText'       => '',
'barkDurationMs' => 0,
'barkPhase'      => '',
// Translated bark quips by behavior key, two variants each; the cockpit picks
// one at random when the behavior starts. A behavior absent here never barks.
'barkStrings'    => array(
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
    <div class="bsb-cockpit__bark" hidden data-wp-bind--hidden="!state.hasBark" data-wp-bind--data-bark="state.barkKey" data-wp-class--is-entering="state.isBarkEntering" data-wp-class--is-leaving="state.isBarkLeaving">
        <span class="bsb-cockpit__bark-tide" aria-hidden="true" data-wp-style----bark-dur="state.barkDurationCss"></span>
        <span class="bsb-cockpit__bark-icon" aria-hidden="true"></span>
        <span class="bsb-cockpit__bark-msg" data-wp-text="state.barkMessage"></span>
    </div>
</div>
```

No `data-wp-class--is-holding` and no `data-wp-on--animationend` — the pill's
lifecycle is driven entirely by the store's own timers, never by an animation
event. The tide element is the first child (behind the icon/message, via
z-index) and carries no text of its own — `data-wp-style----bark-dur` sets its
`--bark-dur` custom property from the store's `barkDurationCss` getter, which
the stylesheet's ebb keyframe reads as its `animation-duration`.

All markup stays in the view heredoc per the repo's markup rules. No new
dynamic PHP values are needed beyond the store-bound custom property (no close
button, no labels, no numeric countdown text — the layer is `aria-hidden`).

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
    &[data-bark='readPause']     { --bark-icon: #{theme.$icon-book}; }
    &[data-bark='glanceBack']    { --bark-icon: #{theme.$icon-glance-back}; }
    &[data-bark='watchVideo']    { --bark-icon: #{theme.$icon-play}; }
    &[data-bark='lingerImage']   { --bark-icon: #{theme.$icon-picture}; }
    &[data-bark='selectSnippet'] { --bark-icon: #{theme.$icon-text-cursor}; }
    &[data-bark='moveOn']        { --bark-icon: #{theme.$icon-wave}; }
}
```

(These live in `src/styles/_icons.scss`, re-exported through the `theme`
namespace, not `_theme.scss` itself — six simple, single-color SVG-as-data-URI
masks: an open book, a back-curving arrow, a play triangle, a framed picture,
a terminal text-cursor caret, and a stylized wave curl, each legible at
0.72rem.)

- `.bsb-cockpit__bark-icon`: same accent-circle + white masked glyph pattern
  as `.bsb-cockpit__toast-icon`. Sits at `z-index: 2`, above the tide fill.
- Animations: `@keyframes bsb-bark-in` / `bsb-bark-out` — mirror the toast's
  timing/easing (460ms in, 320ms out, same cubic-beziers) but drop **down
  from the top** (translateY from a small negative offset) instead of rising
  from the bottom. Only two phases drive them, `is-entering`/`is-leaving` —
  there is no `is-holding` class; `is-entering`'s `animation: … both` keeps
  its end state (`opacity: 1`) applied for the whole visible life, since the
  store's duration timer (not this animation) owns when the pill actually
  leaves.
- **The ebbing-tide countdown** (`.bsb-cockpit__bark-tide`): an absolutely
  positioned fill (`inset: 0`), sitting behind the icon/message at
  `z-index: 1`, clipped to the pill's rounded shape by the parent's
  `overflow: hidden`. A wavy top edge reuses the same tileable wave motif and
  sizing convention as the deck's parallax waves (`theme.wave($fill,
  $opacity)`, `background-size: 200px 100%`, anchored to the bottom), tinted
  with the bark's own teal accent at low alpha so text stays legible.
  `transform-origin: bottom; transform: scaleY(1);` at rest; while
  `.bsb-cockpit__bark.is-entering`, it runs
  `animation: bsb-bark-ebb var(--bark-dur, 6000ms) linear forwards;` — a
  plain `scaleY(1) → scaleY(0)` keyframe, so it visually recedes from full to
  empty over exactly the store-set `--bark-dur` duration. This is a **pure
  visual projection**: it does not drive any JS, and the store's
  `barkDurationTimer` independently owns the actual dismiss timing — both are
  fed the same duration so they finish together.
- `@media (prefers-reduced-motion: reduce)`: collapses the enter/leave
  animation durations to `1ms` as before, and additionally disables the
  tide's ebb animation (`animation: none`) — no smooth countdown glide under
  reduced motion, but the store timer still runs the full duration
  underneath, so dismiss timing is unaffected.

## Testing

### Vitest (unit)

`Barks.test.ts` — pure-model coverage through the public functions, injected
fake timers (`vi.useFakeTimers`), asserted through context/getters:

1. `raiseBark` on a free pill shows immediately with the announced duration
   (`entering`, text from the key's variants, `barkDurationMs` set).
2. Variant pick: rng at 0 → first variant, rng near 1 → second.
3. Unknown key (e.g. `scrollBurst`) → no-op.
4. A repeat arrival for the key already showing, still `entering` → no-op.
5. A different key replaces the showing bark **immediately**, whatever phase
   it's in — including mid-`leaving`.
6. A repeat arrival for the same key while it is already `leaving` is *not*
   deduped — it replaces (fresh text/duration), since same-key suppression
   only applies while entering.
7. The duration timer arms a leave after exactly `durationMs` elapses.
8. The leave timer finishes (clears) after exactly `BARK_LEAVE_MS` following
   the duration timer.
9. A replacement cancels the old bark's duration timer — advancing past what
   would have been its original fire time must not touch the new bark.
10. `finishBark` resets the context to its idle shape.
11. `clearBark` mid-anything (entering or leaving) clears both timers; the
    cleared timers must not fire later and resurrect a phase.

`BehaviorStart.test.ts` — origin mismatch, wrong type, missing/blank key,
missing/invalid `durationMs` (zero, negative, `NaN`, `Infinity`, a string),
`durationOf` reads a valid duration back, happy path (mirrors
`PageAdvance.test.ts`).

`SurfLoop.test.ts` (extend) — `onBehaviorRun` fires with the winner's key
*and* its announced duration for a behavior that calls `announce`; fires with
`moveOn`'s key and `MOVE_ON_DISPLAY_MS` before `onPageDone`; a long-dwelling
behavior notifies exactly once (regression for the removed heartbeat — no
re-notify on any interval while its `run()` is still pending); absent dep is
safe.

`view.test.ts` (extend) — bark slice merged; state getters read the context,
including `barkDurationCss`; the pill holds for the announced `durationMs`
then leaves and finishes after `BARK_LEAVE_MS`, driven entirely by the store's
own timers (no `animationend` callback exists to walk); a fresh message
replaces the showing bark immediately, at any phase; `initBark` raises on a
legitimate message (with a valid duration) only while running, and its
cleanup detaches.

`RunLifecycle.test.ts` (extend) — `stopRun` clears an active bark and its two
timers.

Barking-behavior tests (`ReadPause`/`WatchVideo`/`LingerImage`/`GlanceBack`/
`SelectSnippet.test.ts`, extend) — each behavior's `run()` calls its `announce`
argument with the expected wall-clock ms (a spy passed as the 3rd `run` arg).
`GlanceBack` additionally asserts the announced total equals `SCROLL_UP_MS +
settle/speed`, and that the sample reorder kept the motor calls and rng draws
identical to before (a pinned-rng regression test).

### PHPUnit

Extend the existing cockpit view/render coverage (find the existing test files
for `CockpitView`/render context and follow their pattern): the rendered
markup contains the bark layer with its directives (`data-wp-bind--data-bark`,
`data-wp-class--is-entering`/`is-leaving`, the `bsb-cockpit__bark-tide`
element with `data-wp-style----bark-dur="state.barkDurationCss"`, `aria-hidden`),
does **not** contain `is-holding` or `onBarkAnimationEnd`, and the seeded
context carries `barkStrings` with exactly two variants for each of the six
behavior keys.

### E2E (`tests/e2e/CockpitCourse.spec.mts`, extend)

1. Contract assertions (always): the bark pill exists inside
   `.bsb-cockpit__viewport-wrap`, is hidden at rest, carries no
   `data-wp-on--animationend` binding, and contains a `.bsb-cockpit__bark-tide`
   element bound via `data-wp-style----bark-dur="state.barkDurationCss"`.
2. Live assertion (attempt): start a run at the fastest speed and `expect`
   `.bsb-cockpit__bark` to become visible within a generous timeout (~30s) —
   six of nine behaviors bark, so one should win quickly — and assert it
   carries no numeric/text remaining-time indicator (the countdown is pure
   styling). Run it locally at least 3 times; if it flakes, drop the live
   assertion, keep the contract assertions, and flag the flake in the PR
   description for the reviewer.

Remember the selector/directive contract rule: any e2e selector added here is
kept in sync with the markup in the same change, forever.

## Contract charts (same PR — mandatory)

- `docs/contracts/cockpit-frontend-modules.mmd`: add `BarkStore` (composed by
  `CockpitView`; state includes `barkDurationCss`, no `isBarkHolding`;
  callbacks: `initBark` only, no `onBarkAnimationEnd`), `Barks` (module:
  `raiseBark(ctx, instance, key, durationMs)`/`finishBark`/`clearBark`/
  `pickBarkText`/`BARK_LEAVE_MS`), `BehaviorStart` (module:
  `isBehaviorStartMessage`/`behaviorKeyOf`/`durationOf`); relations — BarkStore
  → Barks/BehaviorStart/RunInstance/CockpitContext, RunLifecycle → Barks
  (clears the showing bark + timers on stop), RunInstance owns the duration +
  leave timers (no pending slot).
- `docs/contracts/surf-engine-modules.mmd`: `SurfLoop` notes the
  `onBehaviorRun` dep now carries `(key, durationMs)` and that the 20s
  heartbeat re-notify is gone; the `Behavior` interface gains the optional
  `announce` parameter; `EngineBoot` gains a `..>` relation posting
  `bsb:behaviorStart` (`{key, durationMs}`) to the cockpit-side receiver
  (mirror the existing `postMessage 'bsb:pageDone'` note).

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
