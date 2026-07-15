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
6. **Lifecycle**: non-persistent, duration-tied, and queued. A bark holds for
   the full wall-clock duration of the behavior it announces, then
   auto-dismisses. There is **no minimum on-screen time**: a different key
   arriving while one is showing (or already leaving) queues in a depth-1
   pending slot (only the newest of several arrivals survives) and
   immediately begins the showing bark's leave — the showing bark always
   plays its full leave animation before the queued one enters, but never
   waits any longer than that. This is safe *because* each bark lasts its
   behavior's full duration and behaviors run one at a time, so barks never
   fire in a rapid burst — there is nothing here for a safe period to guard
   against. Barks are shown in order; none are dropped, and none are ever
   instantly swapped mid-life (the outgoing one always finishes its leave
   first). The store is the sole authority: store-owned timers drive every
   transition, never an animation event.
7. **Bottom toast queue untouched**: errors and the view-only notice keep their
   current placement, timing, and behavior exactly.

## Design decisions (settled)

- **Timing**: no minimum on-screen time, no safe period (an earlier revision
  of this plan had one — `BARK_SAFE_MS`; it was removed, since barks never
  fire in a rapid burst that would need guarding against — see the Lifecycle
  rule above). The showing bark holds for the behavior's own announced
  wall-clock `durationMs` — the surfer's `run()` reports its dwell once, via
  an `announce` callback, at the moment it knows it (same rng draw it already
  makes; never sampled twice). `BARK_LEAVE_MS = 320` is the one fixed
  constant left — it matches the CSS exit keyframe's duration, so the store
  clears the bark exactly as it finishes animating out. Own constant in the
  bark module — `TOAST_HOLD_MS` and everything else in `Toasts.ts` stays
  untouched.
- **Same-key suppression**: a bark arriving for the behavior key currently
  showing or currently pending is ignored — replacing text with identical
  text reads as a glitch.
- **Store-driven queue, leave-then-show**: a bark arriving for a *different*
  key while one is showing (or already leaving) never swaps in immediately —
  it queues in a depth-1 pending slot (newest arrival wins the slot; older
  queued arrivals are discarded, never shown) and immediately begins the
  showing bark's leave. Once the leave finishes, the queued bark (if any) is
  pumped in fresh. Store-owned timers (armed on the per-instance state, never
  the reactive context) drive every transition, never an animation event: a
  **duration timer**, armed for the showing bark's own `durationMs`, moves
  `entering` → `leaving` on its own once the dwell elapses (or is cancelled
  early, when a different key's arrival begins the leave itself instead); a
  **leave timer**, armed for `BARK_LEAVE_MS`, moves `leaving` → cleared (and
  pumps the pending bark). No animation ever drives a state transition — the
  pill's CSS (including the ebbing-tide countdown fill) is a pure reactive
  projection of `barkDurationMs`/`barkPhase`.
- **Run-gated**: barks only raise while `context.running`; on run stop the
  showing bark, the pending slot, and every timer are cleared immediately.
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
                      │  store-driven queue: shows immediately when free;
                      │  otherwise queues (depth-1, newest wins) and begins
                      ▼  the showing bark's leave immediately — no wait
        reactive context (barkBehavior, barkText, barkDurationMs, barkPhase)
                      │
                      ├─► duration timer (armed for durationMs):
                      │     entering → leaving (own dwell elapsed, or
                      │     cancelled early by a different key's arrival)
                      └─► leave timer (armed for BARK_LEAVE_MS):
                            leaving → cleared, pumps the pending bark fresh

        pill in .bsb-cockpit__bark-layer: phase classes + the layered
        ebbing-tide fill (drain animation-duration bound to barkDurationMs
        via --bark-dur; the ripple is a separate, constant, --bsb-wave-speed
        -linked loop) are a PURE PROJECTION of the state above — no
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
without the Interactivity runtime (same philosophy as `Toasts.ts`). A
store-driven queue, duration-tied: the showing bark holds for the full
wall-clock duration the behavior announces (not a fixed hold), and a bark has
at most one pending replacement. No minimum on-screen time: a different key
arriving while one is showing queues and immediately begins the showing
bark's leave. Owns:

```ts
export const BARK_LEAVE_MS = 320;

/** Picks one of the behavior's flavor variants; '' when the key has none. */
export const pickBarkText = (
    strings: Record<string, string[]>, key: string, rng?: () => number
): string;

/** Raises a bark for a behavior start. Implements the full lifecycle:
 *  - key with no strings entry → no-op (non-barking behavior);
 *  - same key as showing or pending → no-op;
 *  - no bark showing → show immediately (phase 'entering'), arming a
 *    duration timer for durationMs;
 *  - a bark already showing (entering or leaving) → store the key + duration
 *    as pending (newest wins the slot) and begin the showing bark's leave
 *    immediately — no wait of any kind. */
export const raiseBark = (
    context: CockpitContext, instance: InstanceState, key: string,
    durationMs: number
): void;

/** Clears the bark that just finished leaving and pumps the pending one (if
 *  any), showing it fresh. Called by the leave timer once BARK_LEAVE_MS
 *  elapses. */
export const finishBark = (context: CockpitContext, instance: InstanceState): void;

/** Immediately clears everything — the showing bark, the pending slot, and
 *  every timer. Called when a run stops. */
export const clearBark = (context: CockpitContext, instance: InstanceState): void;
```

Internal state machine details:

- Showing a bark writes `barkBehavior = key`, `barkText = pickBarkText(...)`,
  `barkDurationMs = durationMs`, `barkPhase = 'entering'`, **advances
  `barkGeneration` by 1** (see below), and arms `instance.barkDurationTimer`
  for `durationMs` — when it fires, a module-private `beginLeave` sets phase
  `'leaving'` and arms `instance.barkLeaveTimer` for `BARK_LEAVE_MS`, which in
  turn calls `finishBark`.
- The pending slot is `instance.pendingBark: string | null` +
  `instance.pendingDurationMs: number | null`. Overwriting them is the "only
  newest kept" rule.
- `beginLeave` (module-private) clears the duration timer, so it cannot fire
  after the leave has already started — and no-ops if already `leaving`, so a
  stale duration timer racing in after the leave began cannot restart the
  leave countdown. This matters because a different key's arrival can call
  `beginLeave` directly (from `raiseBark`) while the showing bark's own
  duration timer is still armed; `beginLeave` disarms that timer so it can
  never fire later against whatever bark ends up showing next.
- `finishBark` resets `barkBehavior`/`barkText`/`barkDurationMs`/`barkPhase`
  to `''`/`0`, then if `pendingBark` is set, immediately shows it (fresh
  duration timer for its own `pendingDurationMs`).
- Timer ids live on the instance (`barkDurationTimer`, `barkLeaveTimer`),
  never on the reactive context.
- **`barkGeneration` and the drain's guaranteed restart.** The tide's drain
  animation is applied through both `is-entering` and `is-leaving` (so
  removing `is-entering` at the entering → leaving transition never strips
  the animation off the element mid-flight — see the `style.scss` section).
  That means a *genuinely new* bark's `entering` phase must force the
  browser to treat its drain as a fresh animation instance, not a
  continuation of whatever the previous bark's drain was doing. A change to
  `--bark-dur` alone cannot be relied on for this: two consecutive barks can
  share the exact same announced duration (`moveOn` is always `2500`,
  `selectSnippet` is always `1800`), in which case nothing about the
  animation declaration would even change. `barkGeneration` is a plain
  incrementing counter, bumped in `showBark` on every fresh bark (whether
  raised directly or pumped from the pending slot) regardless of key or
  duration; `BarkStore.barkEbbName` alternates it between two byte-identical
  `@keyframes` names, and that named change is a genuine, CSS-spec-guaranteed
  restart trigger. It is never reset — a monotonic counter that only ever
  moves forward, so each fresh bark's generation is always distinct from the
  one immediately before it.

### `src/cockpit/BarkStore.ts`

The bark slice of the `bsb/cockpit` store (a `StorePart`, composed in
`view.ts`). Reads off the reactive context and drives the pill purely from
`Barks.ts`'s store-owned queue/timers — no `animationend` binding, unlike the
toast:

- `state` getters: `hasBark` (`barkBehavior !== ''`), `barkKey` (the raw
  behavior key, bound onto the `data-bark` attribute), `barkMessage`,
  `isBarkEntering`, `isBarkLeaving`, `barkDurationCss` — the showing bark's
  `barkDurationMs` formatted as a CSS time value (e.g. `"8000ms"`), bound onto
  the tide's `--bark-dur` custom property so its drain matches the actual
  dwell — and `barkEbbName`, which alternates between two byte-identical ebb
  keyframes (`bsb-bark-ebb-a`/`-b`) by the parity of `barkGeneration` (which
  `Barks.ts` advances on every fresh bark), bound onto the tide's
  `--bark-ebb-name` custom property. This is what *guarantees* the drain
  restarts from full on every new bark: a change in `animation-name`'s own
  computed value is the one CSS-spec-guaranteed restart trigger, whereas a
  mere `--bark-dur` change is not — two consecutive barks can share the exact
  same announced duration (e.g. two `moveOn` or two `selectSnippet` barks),
  in which case the `animation-duration` alone wouldn't differ and a
  duration-only scheme could silently fail to restart.
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
barkGeneration: number;                  // advances every fresh bark; drives barkEbbName
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
pendingBark: string | null;        // depth-1 slot, newest wins
pendingDurationMs: number | null;  // the queued bark's announced duration
barkDurationTimer: number | null;  // armed for the full announced dwell; fires entering -> leaving
barkLeaveTimer: number | null;     // armed for BARK_LEAVE_MS; fires leaving -> cleared
```

### `src/cockpit/RunLifecycle.ts`

`stopRun` calls `clearBark(context, instance)` — clearing the showing bark,
the pending slot, and every timer — so a stopped run never leaves a bark
hanging over the idle card.

### `src/cockpit/view.ts`

Compose `barkStore` into the merged store parts.

### `src/cockpit/render.php`

Context seeding:

```php
'barkBehavior'   => '',
'barkText'       => '',
'barkDurationMs' => 0,
'barkPhase'      => '',
'barkGeneration' => 0,
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
        <span class="bsb-cockpit__bark-tide" aria-hidden="true" data-wp-style----bark-dur="state.barkDurationCss" data-wp-style----bark-ebb-name="state.barkEbbName" data-wp-style----bsb-wave-speed="context.speed">
            <span class="bsb-cockpit__bark-tide-wave bsb-cockpit__bark-tide-wave--back" aria-hidden="true"></span>
            <span class="bsb-cockpit__bark-tide-wave bsb-cockpit__bark-tide-wave--mid" aria-hidden="true"></span>
            <span class="bsb-cockpit__bark-tide-wave bsb-cockpit__bark-tide-wave--front" aria-hidden="true"></span>
        </span>
        <span class="bsb-cockpit__bark-icon" aria-hidden="true"></span>
        <span class="bsb-cockpit__bark-msg" data-wp-text="state.barkMessage"></span>
    </div>
</div>
```

No `data-wp-class--is-holding` and no `data-wp-on--animationend` — the pill's
lifecycle is driven entirely by the store's own timers, never by an animation
event. The outer tide element carries three custom properties and no text of
its own: `data-wp-style----bark-dur` sets `--bark-dur` from the store's
`barkDurationCss` getter (the drain's `animation-duration`);
`data-wp-style----bark-ebb-name` sets `--bark-ebb-name` from `barkEbbName`
(the drain's `animation-name`, alternated on every fresh bark to guarantee a
restart — see the `Barks.ts`/`BarkStore.ts` sections above); and
`data-wp-style----bsb-wave-speed` sets `--bsb-wave-speed` from `context.speed`
— the same binding pattern `.bsb-deck__waves` uses — so the ripple layers'
speed tracks the run's demo-speed multiplier. Inside it: three full-height
"water sheet" spans (`--back`/`--mid`/`--front`), stacked directly under the
tide with no separate fill span or clipping band — each sheet carries its own
wavy crest (the deck's own wave texture, scaled down to the pill's
proportions) *and* its own same-colour fill running to the tide's bottom, so
the three sheets together compose the entire water body and no seam can form
between "waves" and "body".

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
- **The ebbing-tide countdown** — two independent animations, layered, never
  coupled to each other:
  - **The drain** (`.bsb-cockpit__bark-tide`, `@keyframes bsb-bark-ebb-a` /
    `bsb-bark-ebb-b`): the water level dropping top → bottom over the
    behavior's wall-clock `--bark-dur`. This is the one-shot countdown. An
    absolutely positioned box (`inset: 0`), sitting behind the icon/message
    at `z-index: 1`, clipped to the pill's rounded shape by the parent's
    `overflow: hidden`. **A downward `translateY`, not a `scaleY`** — the
    water body's own size never changes (so its wave-layer children keep
    their exact height and never squish); the pill's `overflow: hidden`
    clips whatever portion has slid below the pill's bottom edge, and that
    clipping is what makes the visible water level appear to drop. At
    `translateY(50%)` the box has moved down by half its own height, so the
    pill's top half is empty and its bottom half shows the water body's own
    top edge (waves at constant size) — that's the surface descending. (An
    earlier revision used `scaleY`, which visibly squished the wave layers
    thinner as it drained — a real bug, fixed by switching to translate.)
    The base rule carries **no forced `transform`** (identity
    `translateY(0)`, only ever visible for a single frame at the drain's own
    0% keyframe, so there is no flash). Applied through **both**
    `.is-entering` AND `.is-leaving` (the identical declaration in both —
    this is the part that matters): if the drain were scoped to
    `.is-entering` alone, removing that class at the entering → leaving
    transition would strip the animation off the element entirely, leaving
    `animation-fill-mode: forwards` nothing to hold, and the element would
    snap to whatever the base rule forced (a real bug an earlier revision
    had). Keeping the animation applied across both phases means: a drain
    that completes naturally holds at `translateY(100%)` via `forwards`
    (nothing forced, nothing to snap); and a drain cut short by an early
    leave (a different key's arrival, which begins the leave immediately —
    see the "leave-then-show queue" above) simply *continues*, uninterrupted,
    from wherever it actually was — the pill slides out from its real water
    level, never snapping to either end. Purely visual: it does not drive
    any JS, and the store's `barkDurationTimer` independently owns the
    actual dismiss timing — both are fed the same duration so they finish
    together.
  - **Guaranteed restart on every fresh bark** (`--bark-ebb-name` /
    `barkGeneration` / `barkEbbName` — see the `Barks.ts`/`BarkStore.ts`
    sections above). Declared as **longhand**, not the `animation` shorthand:
    `animation-name: var(--bark-ebb-name, bsb-bark-ebb-a); animation-duration:
    var(--bark-dur, 6000ms); animation-timing-function: linear;
    animation-fill-mode: forwards;`. Because the SAME animation declaration
    now spans both `is-entering` and `is-leaving`, a genuinely new bark's
    `entering` phase must force a fresh animation instance rather than
    continuing (or ignoring) whatever the previous bark's drain was doing —
    and `--bark-dur` alone cannot guarantee that, since two consecutive barks
    can share the exact same announced duration (`moveOn` is always `2500`,
    `selectSnippet` is always `1800`), leaving nothing about the computed
    `animation` value different. `animation-name`'s own computed value
    changing is the one CSS-spec-guaranteed restart trigger, so
    `--bark-ebb-name` alternates between two byte-identical `@keyframes`
    (`bsb-bark-ebb-a`/`-b`) every time `barkGeneration` advances (i.e. on
    every fresh bark, direct or pumped).
  - **The water body is the waves, not a layer under them**
    (`.bsb-cockpit__bark-tide-wave--back/--mid/--front`, reusing `@keyframes
    bsb-wave`): there is no separate fill span or clipping band. Each of the
    three layers is a full-height "water sheet" — two stacked backgrounds on
    one element: a tileable wave-crest texture (fixed `100px 12px`,
    `repeat-x`, a scaled-down port of the deck's own wave simulation via
    `theme.wave($fill, $opacity)`) at its own top offset (0/2/5px, mirroring
    the deck's stagger), and beneath it that same layer's own solid-colour
    fill (a `linear-gradient` between two identical stops, so it reads as
    flat colour) running from 1px above the crest tile's bottom edge down to
    the sheet's own bottom — the sheet is never resized, only translated by
    the drain, so the fill always reaches the tide box's true bottom.
    Stacking all three sheets composes the *entire* water body: the surface
    composite (where crests overlap) and the depth composite (below all
    three crests) are the same three paints layered in the same order, so no
    seam between "waves" and "body" can exist — the front sheet's own fill
    (coastal aqua at 0.55, matching its own crest tile exactly) *is* what the
    eye reads as the water underneath, deliberately graded down to the deeper
    teal at its very bottom for a touch of depth. Scroll is constant,
    looping, **never tied to the drain duration, and never resized by it**.
    Fixed pixel tile heights (not percentages) are what keep the crests from
    squishing into flat slabs regardless of the pill's own size. Speed is
    bound to the run's demo-speed multiplier exactly like the header waves:
    `data-wp-style----bsb-wave-speed="context.speed"` on the tide element,
    and each layer's `animation-duration: calc(<base>s /
    var(--bsb-wave-speed, 1));`.
- `@media (prefers-reduced-motion: reduce)`: collapses the enter/leave
  animation durations to `1ms` as before. The tide additionally goes static —
  `animation: none; transform: translateY(0);` (the water body at its
  resting, undisplaced position — full, rather than a countdown) — and the
  ripple layers get `animation: none` too (no horizontal motion). **Both**
  `.is-entering` and `.is-leaving` selectors must be repeated inside this
  media block alongside the bare `.bsb-cockpit__bark-tide` selector: the
  drain rule outside the media block is scoped to those two phase selectors
  at specificity (0,3,0), and a media query adds no specificity of its own,
  so a bare (0,1,0) override here would silently lose to the
  higher-specificity drain rule regardless of source order — the override
  must match that specificity to actually win, in
  either phase. The store's duration timer still runs the full time
  underneath either way, so dismiss timing is unaffected — only the visual
  glide is dropped.

## Testing

### Vitest (unit)

`Barks.test.ts` — pure-model coverage through the public functions, injected
fake timers (`vi.useFakeTimers`), asserted through context/getters:

1. `raiseBark` on a free pill shows immediately with the announced duration
   (`entering`, text from the key's variants, `barkDurationMs` set).
2. Variant pick: rng at 0 → first variant, rng near 1 → second.
3. Unknown key (e.g. `scrollBurst`) → no-op.
4. Same key as showing → no-op; same key as pending → no-op.
5. A different key arriving while one is showing queues it as pending (newest
   wins the slot) and begins the showing bark's leave **immediately** —
   synchronously, no wait of any kind.
6. The queued bark shows only once the leave animation finishes
   (`BARK_LEAVE_MS` later).
7. Several different-key arrivals while one bark is showing → only the
   newest survives as pending; earlier ones are discarded, never shown.
8. A different key arriving while the showing bark is *already* leaving still
   queues (newest wins), without restarting the in-progress leave
   (`beginLeave` is idempotent once `barkPhase === 'leaving'`).
9. A completed-duration bark with no interruption still leaves on its own
   duration timer and finishes normally.
10. `finishBark` clears the context and shows the pending bark fresh (fresh
    duration timer for the pending's own duration).
11. `finishBark` leaves the pill idle when nothing is pending.
12. The same key can bark again once it has fully finished (idle) — same-key
    suppression only applies while showing or pending.
13. `clearBark` mid-anything (entering or leaving, with or without something
    pending) clears the pending slot and both timers; the cleared timers must
    not fire later and resurrect a phase.
14. `barkGeneration` advances every time a bark is shown — including a full
    show → finish → re-show cycle of the *same* key with the *same*
    duration, and a queued/pumped bark that shares its duration with the one
    that just left — since neither case can be told apart by comparing
    key/duration alone (the exact edge case the tide's restart guarantee
    exists for).

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
own timers (no `animationend` callback exists to walk); a message arriving
while one bark is showing queues rather than replacing, and begins the
showing bark's leave immediately (no wait) — asserting `barkEbbName` actually
changes once the queued bark shows, so the tide is guaranteed to restart its
drain rather than possibly continue a still-running one; only the newest of
several queued arrivals is shown next; `initBark` raises on a legitimate
message (with a valid duration) only while running, and its cleanup detaches.
Every test that calls `initBark()` tracks and detaches its own listener in
`afterEach` —
jsdom's `window` persists across tests in this file, so a listener left
dangling from one test would otherwise keep firing in every later test,
racing a stale `raiseBark` call against the same shared `instanceFor()`
singleton a later test's fresh listener also writes to (this bit a real
cross-test contamination bug during development: a leaked listener silently
duplicated every dispatched message).

`RunLifecycle.test.ts` (extend) — `stopRun` clears an active bark, its
pending slot, and its timers.

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
element with all three of `data-wp-style----bark-dur="state.barkDurationCss"`,
`data-wp-style----bark-ebb-name="state.barkEbbName"`, and
`data-wp-style----bsb-wave-speed="context.speed"`, plus the three
`bsb-cockpit__bark-tide-wave--back/--mid/--front` water-sheet children
(no separate fill/band elements), `aria-hidden`),
does **not** contain `is-holding` or
`onBarkAnimationEnd`, and the seeded context carries `barkStrings` with
exactly two variants for each of the six behavior keys.

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
  `CockpitView`; state includes `barkDurationCss`, `barkEbbName` (alternates
  two identical keyframes per `barkGeneration`, guaranteeing the tide's drain
  restarts on every fresh bark), no `isBarkHolding`; callbacks: `initBark`
  only, no `onBarkAnimationEnd`), `Barks` (module:
  `raiseBark(ctx, instance, key, durationMs)`/`finishBark`/`clearBark`/
  `pickBarkText`/`BARK_LEAVE_MS` — no safe period, no minimum on-screen time),
  `BehaviorStart` (module: `isBehaviorStartMessage`/`behaviorKeyOf`/
  `durationOf`); relations — BarkStore → Barks/BehaviorStart/RunInstance/
  CockpitContext, RunLifecycle → Barks (clears the showing bark, the pending
  slot, and the timers on stop), RunInstance owns the pending slot and the
  duration/leave timers.
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
