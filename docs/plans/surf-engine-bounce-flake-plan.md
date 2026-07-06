# Surf Engine Bounce Flake — Fix Plan

**Status:** diagnosed, design approved for implementation.
**Audience:** the implementing session/agent. Read this whole document before writing code. Read `CLAUDE.md` first — every convention there applies (tests, PHPCS, workflow replay, commit format, chart updates). This plan does not restate them; it adds the diagnosis and the design decisions.

## 1. The defect

The e2e test `Surf engine › boots and surfs when the traits URL param is present` (`tests/e2e/CockpitCourse.spec.mts`) hangs in ~10% of runs: `window.scrollY` stays `0` for the full 120 s timeout. No error, no console output — silent.

### Root cause (confirmed by seeded reproduction against the real engine)

`MoveOn` bids raw accumulated boredom from the second tick onward. Nothing guarantees the surfer scrolls before `MoveOn` wins the auction. When `MoveOn` wins first, `SurfLoop` halts and fires `onPageDone` — the engine "bounces" off the page without ever scrolling. The test then parks forever on `waitForFunction( () => window.scrollY > 0 )`.

Two paths produce it (measured by running the real `SurfLoop` + full behavior roster with seeded `mulberry32`, traits `10,0,0,0,0`, speed 10, 2000 seeds each):

1. **Auction luck on a settled page — 2.5% of seeds** (first failing seed: 7). Boredom grows 0.04/tick at endurance 0; `MoveOn`'s bid compounds against ScrollBurst's ~0.5 until it occasionally wins before any scroll behavior has won once.
2. **Unscrollable page at boot — 100% of seeds.** The engine boots at classic-script execution time, *before* the document's `load` event. If layout isn't tall enough yet (images pending), `scrollRemaining` senses `0`, which zeroes `ScrollBurst` (and `MicroScroll` can't move `scrollY` either on an unscrollable page). Boredom accrues per tick regardless — and at tempo 10 + speed 10 a tick is ~35 ms real time, so `MoveOn` becomes competitive within a few hundred milliseconds, inside the window before images finish. Playwright's `goto` resolves at `load`, so the trace shows a "fully loaded" page while the engine already bounced.

The observed ~10% is path 1's 2.5% baseline plus path 2 firing on the fraction of runs where layout lags the settle beat (100–300 ms real at speed 10).

### Why this is an engine bug, not a test bug

`docs/knowledge-base/surf-behavior-profile.md` is the behavior contract. Its shortest legitimate dwell anywhere is **12 s** (`links` page, 12–25 s); `article-1` is **45–75 s**. A sub-second leave is outside the researched profile entirely. The test's assertion ("boots and surfs") is legitimate; the engine violates its own profile. Additionally, the knowledge base defines the settle beat as "1–3 s settle **after page load** before the first scroll" — the engine currently starts settling at script execution, not at page load. Both fixes below restore documented contract behavior.

## 2. The fix — two changes

Both stay utility-driven: no if/else behavior gating in `SurfLoop`, no procedural branches. (Standing rule; see `surf-engine-plan.md` §1 and the "Behavioural sim is utility-driven" convention.)

### 2.1 `MoveOn` gains a leave-readiness affordance (dwell floor)

`MoveOn`'s bid becomes `boredom × leaveReadiness`, where leave-readiness is a multiplicative affordance ramping 0 → 1 with time on page — exactly the `drive × affordance` algebra every other behavior uses:

```ts
/** Engine-time dwell before leaving becomes possible at all (knowledge-base floor: the shortest researched dwell, `links` at 12 s). */
const MIN_DWELL_MS = 12000;
/** Ramp from first leave-readiness to full leave pressure. */
const LEAVE_RAMP_MS = 8000;

bid( ctx, appetite, boredom ) =
	Math.max( 0, boredom ) *
	clamp01( ( ctx.elapsedMs - MIN_DWELL_MS ) / LEAVE_RAMP_MS );
```

- Below 12 s of engine time on the page, `MoveOn` bids 0 — the surfer cannot leave.
- Full leave pressure by 20 s, inside every page's researched dwell band.
- Boredom bookkeeping in `SurfLoop` is untouched; only the bid changes, and it stays a pure function of its inputs.

**`BehaviorContext` gains `elapsedMs`** — engine-time milliseconds since the loop started (real elapsed × `speed`, so the demo-speed multiplier compresses dwell exactly as the knowledge base specifies). `SurfLoop` computes it per tick when building the context.

**`Clock` gains `now(): number`** so `SurfLoop` can measure elapsed time through its existing time seam:

- `RealClock.now()` → `performance.now()`.
- `FakeClock` becomes a coherent virtual clock: `now()` returns accumulated time, and each `wait( ms )` advances it by `ms`. Existing `FakeClock` consumers keep working (`waits` array stays).

`SurfLoop` records `startedAt = clock.now()` when its loop begins and builds `elapsedMs = ( clock.now() - startedAt ) * speed` into each tick's context.

### 2.2 Engine boots on document load

`src/surfer/index.ts` currently calls `loop.start()` at script execution. Change: start only once the document has fully loaded, honoring the knowledge base's "settle after page load" convention and guaranteeing affordances are sensed against final layout.

Extract a small testable helper (new module, CamelCase file, e.g. `src/surfer/PageLoad.ts`):

```ts
/** Runs `callback` once the document has fully loaded — immediately if it already has. */
export const whenDocumentLoaded = ( win: Window, callback: () => void ): void
```

- `win.document.readyState === 'complete'` → call synchronously.
- Otherwise `win.addEventListener( 'load', callback, { once: true } )`.

`index.ts` wraps `loop.start()` in it. Note fix 2.1 alone already makes the flake mathematically negligible; 2.2 removes the degenerate boot window itself and aligns the settle beat with its documented definition.

## 3. Tests

Unit (vitest), all through public interfaces:

- **`MoveOn.test.ts`** — update: bid is 0 while `elapsedMs` is below the floor regardless of boredom; ramps proportionally inside the ramp window; equals boredom at/after full ramp. Existing "bids boredom" cases get `elapsedMs` past the ramp.
- **`TestFixtures.ts`** — `makeContext` gains an `elapsedMs` default placed past the ramp (e.g. `60000`) so every other behavior's tests are unaffected and `MoveOn` tests override it explicitly.
- **`SurfLoop.test.ts`** — regression tests:
  - *The seed-7 repro, inverted:* full behavior roster, `mulberry32( 7 )`, traits `[ 10, 0, 0, 0, 0 ]`, speed 10, `FakeMotor` + `FakeClock`: a positive `scrollBy` command is recorded before `onPageDone` fires. (Before the fix this exact setup bounces without scrolling.)
  - *Dwell floor:* `onPageDone` never fires before `MIN_DWELL_MS` of engine time has elapsed on the virtual clock, even with boredom-maximizing traits.
  - *Unscrollable page:* with `senseAffordances` pinned to `scrollRemaining: 0`, the loop still doesn't fire `onPageDone` before the floor.
- **`PageLoad.test.ts`** — callback runs synchronously when `readyState` is `'complete'`; deferred to the `load` event otherwise; fires once.
- **`FakeClock`** — its virtual `now()` behavior is covered implicitly through the SurfLoop tests; add direct assertions only if a `FakeClock.test.ts` precedent exists (it doesn't today — don't create one just for this).

E2e: **no changes needed** — `boots and surfs` *is* the regression test. Validate the flake is gone by running it repeatedly (e.g. `pnpm test:e2e -g "boots and surfs" --repeat-each=15`); all runs must pass. The other two surf-engine e2e tests (`fake cursor`, `stays static`) must stay green — the load-gated boot must not break the cursor-attachment wait.

## 4. Contract chart

`docs/contracts/surf-engine-modules.mmd` — same commit:

- `Clock` / `RealClock`: add `+now() number`.
- `BehaviorContext`: add `elapsedMs` to its field list.
- `MoveOn` comment: bids boredom × leave-readiness (dwell-floor affordance).
- `EngineBoot` note: builds and starts SurfLoop **once the document has loaded**.
- Add the `PageLoad` `<<module>>` with `+whenDocumentLoaded(Window, callback) void`, with `EngineBoot --> PageLoad`.

## 5. Constants — knowledge-base derivation (do not tune blind)

| Constant | Value | Source |
|---|---|---|
| `MIN_DWELL_MS` | 12 000 | Floor of the shortest researched dwell band (`links`, 12–25 s) |
| `LEAVE_RAMP_MS` | 8 000 | Full leave pressure by 20 s — below every other page's dwell floor is *not* required; emergent boredom vs. endurance still governs when the surfer actually leaves |

Durations are engine-time (×1 speed); the runtime speed multiplier compresses them via `elapsedMs`'s `× speed` term, consistent with "a runtime demo-speed multiplier divides dwell/pause durations".

## 6. Out of scope

- Tempo's coupling to boredom growth rate (fast surfers get bored faster per wall-second). Observed during diagnosis; arguably intended flavor. Not part of this defect.
- Seedable RNG via URL param for deterministic e2e. Useful someday; not needed once the dwell floor exists.
