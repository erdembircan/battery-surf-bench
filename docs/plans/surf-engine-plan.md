# Surf Engine — Implementation Plan

**Status:** approved architecture, ready to implement.
**Audience:** the implementing session/agent. Read this whole document before writing code. Read `CLAUDE.md` first — every convention there applies (views, SCSS, tests, PHPCS, workflow replay, commit format, chart updates). This plan does not restate them; it adds the design decisions.

## 1. Goal

Replace the current dummy six-stat surfer profile with a five-stat, **behavioral** simulation system, and build the **surf engine** that runs inside the course-page iframe and acts those stats out.

Guiding principles (maintainer's words, binding):

- **Taste first.** The stats exist to delight the user watching the simulation ("nice touch"), NOT to move battery numbers. No stat needs a battery-usage counterpart. Allure happening to burn more battery (video playback) is incidental, never the design driver.
- **Behavioral, not procedural.** No stat may hard-gate another. A low stat means an action bids weakly, never that it is ruled out — like RPG attributes. **The engine must contain no if/else behavior trees.** Action selection is utility-driven: score candidate actions from traits + weighted randomness, pick stochastically. (This is a standing project rule; see the memory note "Behavioural sim is utility-driven".)
- **Emergence over knobs.** Scroll depth and time-on-page are *outcomes* of drives, never sliders or timers of their own.

## 2. The five stats (final, approved)

Vector order (this order is the contract everywhere — presets, URL transport, sliders):

| # | Key | Label | Lever line (slider helper) | Drives |
|---|---|---|---|---|
| 0 | `tempo` | Tempo | pace of every motion — lazy crawl to rapid flicks | tick cadence, scroll-flick size/easing speed, cursor speed. A metronome, not a bidder. |
| 1 | `endurance` | Endurance | staying power — bounces fast to camps the page | suppresses the growth of the MoveOn (leave-page) bid. Dwell time is emergent. |
| 2 | `literacy` | Literacy | pull of text — ignores it to stops and reads | bids ReadPause, GlanceBack (re-read scroll-up), SelectSnippet. |
| 3 | `allure` | Allure | pull of media — skips it to sits and watches | bids WatchVideo, ReplayVideo, LingerImage. Applies to video AND gallery images. |
| 4 | `fidget` | Fidget | restlessness — statue-still to squirmy | bids FidgetWiggle (aimless cursor), MicroScroll (jitter up/down), idle text selection. Pure taste. |

Cut from the old set: `haste` (renamed→tempo), `reach` (depth is emergent), `recall` (folded into literacy's GlanceBack).

Point-buy: `MIN = 0`, `MAX = 10`, **`BUDGET = 25`** (was 30 for six stats; 25 keeps the same 5-point average).

### Archetypes (derived, never stored)

`Re-Reader` dies with recall. New archetype `Jitterbug` (high fidget). Classification rules, first match wins — starting values, tune if needed, but **every preset must classify back to its own name** (existing test pattern in `SurferStats.test.ts` enforces this):

```ts
if ( allure >= 8 && literacy <= 3 )  return 'Binge-Watcher';
if ( fidget >= 8 && literacy <= 4 )  return 'Jitterbug';
if ( tempo >= 8 && literacy <= 3 )   return 'Doomscroller';
if ( tempo >= 6 && endurance <= 4 )  return 'Skimmer';
if ( literacy >= 8 && tempo <= 3 )   return 'Scholar';
if ( every stat in [4,6] )           return 'Balanced';
return 'Custom';
```

Presets (each sums to 25, order `tempo, endurance, literacy, allure, fidget`):

```ts
Balanced:        [ 5, 5, 5, 5, 5 ],
Scholar:         [ 2, 8, 10, 2, 3 ],
'Binge-Watcher': [ 3, 7, 2, 10, 3 ],
Doomscroller:    [ 10, 4, 2, 5, 4 ],
Skimmer:         [ 8, 3, 5, 4, 5 ],
Jitterbug:       [ 6, 4, 2, 3, 10 ],
```

## 3. Architecture — Utility AI

Every action the surfer can take is a **Behavior** implementing one interface. Behaviors are never *called* — each engine tick they **bid** in an auction; a weighted-random draw picks the winner. Traits are weights in the bid, never gates.

### 3.1 Bid formula

```
bid(b) = drive(b, traits) × affordance(b, page) × appetite(b) × noise(rng)
```

- **drive** — linear map of the behavior's governing stat: `DRIVE_FLOOR + (1 - DRIVE_FLOOR) * stat / MAX`, `DRIVE_FLOOR = 0.05`. The floor keeps a zero-stat behavior faintly alive (RPG rule).
- **affordance** — 0..1 from page sensing. No `<video>` on the page → WatchVideo's affordance is 0 → bid 0 by multiplication, not by branching.
- **appetite** — 0..1 satiation. Running a behavior consumes its novelty (`appetite *= SATIATION`, per-behavior, e.g. 0.5); it recovers per tick (`appetite = min(1, appetite + RECOVERY)`, e.g. +0.02). Prevents repetitive loops, produces lifelike variety.
- **noise** — `1 + NOISE_AMP * (rng() * 2 - 1)`, `NOISE_AMP ≈ 0.35`, clamped ≥ 0.

### 3.2 Selection — roulette wheel, not argmax, not softmax

`P(b) = bid(b) / Σ bids`. Zero-affordance behaviors naturally get zero probability (softmax would resurrect them via `exp(0)=1` — do not use softmax). Argmax is forbidden: it would let one high stat rule out everything, exactly what the maintainer rejects. Seeded RNG makes the draw deterministic in tests.

### 3.3 Leaving is a behavior

`MoveOn` bids like everyone else. Its bid = accumulated `boredom`, which grows each tick:

```
boredom += BOREDOM_RATE * (1 - ENDURANCE_DAMP * endurance / MAX)
```

(`BOREDOM_RATE ≈ 0.04/tick`, `ENDURANCE_DAMP ≈ 0.85`.) High endurance ⇒ boredom grows slowly ⇒ surfer camps. Interesting pages also delay leaving *emergently*: while content behaviors win ticks, their runs take time, so fewer ticks feed boredom per second of watching. No dwell timer exists anywhere. When MoveOn wins, the page session ends.

### 3.4 Tempo is the metronome

Tempo does not bid. It scales the clock and the motor:

- tick interval: `lerp(1400ms, 350ms, tempo / MAX)`
- scroll flick: `lerp(350px, 800px, tempo / MAX)` per burst, eased over `lerp(400ms, 150ms, …)`
- cursor motion speed scales the same way.

The run's demo **speed multiplier** (`RunConfig.normalizeSpeed`, crossed via URL, see §5) additionally divides idle/pause durations — demo speed only; ×1 is the measurement mode (see `docs/knowledge-base/surf-behavior-profile.md`).

### 3.5 Lifecycle

```
iframe loads course page
  → boot guard: engine starts only when the traits URL param is present
  → sense affordances (DOM scan)
  → settle beat (1–3 s, jittered — knowledge-base convention)
  → ↻ tick:
      collect bids → roulette pick → winner runs its motor commands (async)
      → appetite/boredom update → wait tick interval
  → MoveOn wins → engine shell posts page-done to parent → loop halts
cockpit hears page-done → advances activeIndex (modulo) → iframe navigates → engine boots fresh
```

Per-page engine state (appetites, boredom) resets on each page load. That is fine and intended.

## 4. Components & interfaces

New module directory: `src/surfer/` (CamelCase files, JSDoc on every class/function, no doc comments on types/interfaces — CLAUDE.md).

```ts
// Rng.ts — seedable PRNG (mulberry32). Injected everywhere randomness is used.
type Rng = () => number;                    // uniform [0,1)
export const mulberry32: ( seed: number ) => Rng;

// Clock.ts — time seam so tests never sleep.
interface Clock { wait( ms: number ): Promise<void>; }
export class RealClock implements Clock { … }

// Affordances.ts — what the page offers. Pure data + one DOM sensor.
interface Affordances {
  scrollRemaining: number;   // 0..1 fraction of scrollable height below
  textDensity: number;       // 0..1 rough share of viewport that is prose
  hasVideo: boolean;
  imageCount: number;
}
export const senseAffordances: ( doc: Document ) => Affordances;

// Motor.ts — motion primitives. DomMotor is the only DOM writer in the engine.
interface Motor {
  scrollBy( px: number, ms: number ): Promise<void>;   // eased
  pointerDrift( ms: number ): Promise<void>;           // aimless cursor path (fidget)
  selectSnippet(): Promise<void>;                      // brief text selection + clear
  playVideo(): Promise<void>;
  idle( ms: number ): Promise<void>;
}
export class DomMotor implements Motor { … }            // production
// tests use a FakeMotor that records commands: { kind, args }[]

// Behavior.ts — the contract every action implements.
interface BehaviorContext {
  traits: readonly number[];
  affordances: Affordances;
  rng: Rng;
  clock: Clock;
  speed: number;            // demo multiplier, divides pauses only
}
interface Behavior {
  readonly key: string;
  bid( ctx: BehaviorContext, appetite: number, boredom: number ): number;  // pure
  run( motor: Motor, ctx: BehaviorContext ): Promise<void>;
}

// Appetite.ts — satiation bookkeeping. Pure state machine keyed by behavior key.
export class Appetite {
  valueFor( key: string ): number;      // 0..1
  consume( key: string ): void;         // after a run
  recoverTick(): void;
}

// Arbiter.ts — roulette-wheel pick over positive bids. Pure given rng.
export const pickBehavior: ( bids: ReadonlyArray<{ b: Behavior; bid: number }>, rng: Rng ) => Behavior | null;

// SurfLoop.ts — the orchestrator. Owns tick loop, boredom, appetite, halt-on-MoveOn.
export class SurfLoop {
  constructor( deps: { behaviors: Behavior[]; motor: Motor; clock: Clock; rng: Rng;
                       traits: number[]; affordances: Affordances; speed: number;
                       onPageDone: () => void } );
  start(): void;
  stop(): void;
}

// Behaviors/ — one file per behavior:
//   ScrollBurst.ts  (baseline mover; modest constant drive so pages always progress,
//                    scaled by scrollRemaining affordance — at the bottom it goes quiet)
//   ReadPause.ts    (literacy; idle 8–20 s scaled by speed)
//   GlanceBack.ts   (literacy; short scroll-up then settle — absorbs old `recall`)
//   WatchVideo.ts   (allure; play + sit for a jittered stretch; replay emerges from re-winning)
//   LingerImage.ts  (allure; slow drift over gallery imagery)
//   FidgetWiggle.ts (fidget; pointerDrift)
//   MicroScroll.ts  (fidget; ±40–80 px jitter)
//   SelectSnippet.ts(fidget × literacy blend — pick primary governing stat = fidget)
//   MoveOn.ts       (bid = boredom; run = no-op, the loop halts and fires onPageDone)

// index.ts — entry: boot guard (traits param present?), parse+normalize traits/speed
//            from URL via shared SurferStats.normalizeTraits + RunConfig-equivalent
//            clamp, build DomMotor/RealClock/Rng(seeded from rng-less source: use
//            crypto.getRandomValues or performance.now at boot — production only),
//            start SurfLoop, postMessage page-done.
```

Duration/pixel ranges for behavior runs come from `docs/knowledge-base/surf-behavior-profile.md` (dwell/burst/pause tables) — use them as the jitter ranges inside behaviors; they are research-derived, don't invent new ones.

## 5. Transport & wiring

- **Traits + speed → iframe URL.** `RunStore.currentSrc` (cockpit) appends `bsbTraits=<t,e,l,a,f>` and `bsbSpeed=<n>` to `pages[activeIndex].url` while running. Engine treats both as untrusted: `normalizeTraits` for the vector, clamp for speed (mirror `RunConfig.normalizeSpeed` bounds — import shared code, do not duplicate).
- **Page-done ← postMessage.** Engine shell: `window.parent.postMessage( { type: 'bsb:pageDone' }, <cockpit origin> )`. Cockpit: a listener (new small store part or RunLifecycle extension) verifies `event.origin` is same-origin, checks `running`, then `activeIndex = (activeIndex + 1) % pages.length`. The iframe's `src` binding re-navigates automatically.
- **Enqueue.** New webpack classic-script entry `surfer: src/surfer/index.ts`. `Assets` service enqueues the built script on course-page requests, alongside the existing course stylesheet enqueue in `CourseRouter` (follow the existing style-enqueue path; PHP side prepares nothing else — no markup, no inline scripts).
- **Boot guard.** Engine activates only when the traits param is present, so a human opening a course URL directly sees a normal static page.

## 6. Migration touchpoints (6 → 5 stats)

- `src/shared/SurferStats.ts` — StatKey, STATS (new lever lines), STAT_COUNT (derived), BUDGET 30→25, CLASSES, Archetype union (−Re-Reader, +Jitterbug), classify rules. Update module JSDoc (it references six stats).
- `src/shared/SurferStats.test.ts` — rewrite table tests for new rules; keep the "every preset classifies to itself" invariant.
- `src/cockpit/render.php` — stat card list (names + lever helper lines, all `__()`-translated; JS `__()` extraction is NOT wired in this repo — user-facing strings stay in PHP), archetypeLabels map (new names translated).
- `src/cockpit/TraitsStore.ts` — mostly index-driven, verify nothing hardcodes 6; getters are generated from STATS so they follow.
- e2e specs touching the surfer profile — slider count, chip names, archetype label assertions. **Same change, never a follow-up.**
- `docs/contracts/cockpit-frontend-modules.mmd` — update for traits-on-URL + pageDone listener.
- New chart: `docs/contracts/surf-engine-modules.mmd` — Behavior interface, SurfLoop, Motor/Affordances/Appetite/Arbiter relationships, the postMessage seam to the cockpit. Public APIs only.

## 7. Testing spec

Unit (vitest; no real DOM writes, no real timers — fake Clock, seeded Rng, FakeMotor):

- **Behavior.bid tables** — per behavior: stat 0 → small-but-nonzero bid (floor), stat 10 → max drive; affordance 0 → bid exactly 0; appetite scales linearly.
- **Arbiter distribution** — seeded rng over N=10 000 draws: probabilities proportional to bids within tolerance; zero-bid never picked; single-bid always picked; all-zero → null.
- **Appetite** — consume drops, recoverTick restores, clamps [0,1].
- **SurfLoop** — with FakeMotor + fake Clock: content behaviors run motor commands; boredom grows slower with high endurance (compare tick counts until MoveOn wins across two traits vectors — behavior, not internals: assert via onPageDone timing); MoveOn firing calls onPageDone exactly once and stops the loop.
- **senseAffordances** — jsdom fixtures: video page → hasVideo, gallery → imageCount, article → textDensity > links page.
- **URL parsing** — malformed/hostile traits & speed params normalize safely.
- **SurferStats** — as §6.

E2E (Playwright, `tests/e2e/*.spec.mts`):

- Course page with traits+speed params: page scrolls on its own (`scrollY` increases), and a `bsb:pageDone` message is posted (listen via `page.evaluate` hook).
- Course page WITHOUT params: no auto-scroll (boot guard).
- Cockpit run: after page-done, iframe advances to the next course URL.
- Update existing surfer-profile specs per §6.

Test behavior, not implementation — assert through public interfaces and motor-command effects, never internal fields (CLAUDE.md testing philosophy).

## 8. Delivery — three PRs, in order

1. **PR 1 — stat migration.** §6 in full. Cockpit works exactly as today, five sliders instead of six. All lint/tests/e2e green (replay the PR workflow locally per CLAUDE.md).
2. **PR 2 — engine core, headless.** `src/surfer/` complete with all unit tests, plus the new contract chart. No build entry, no enqueue, nothing user-visible yet.
3. **PR 3 — wiring.** Webpack entry, Assets/CourseRouter enqueue, traits+speed on `currentSrc`, pageDone listener + advance, boot guard, e2e, chart updates.

Each PR: Conventional Commits (`[FEAT]`/`[REFACTOR]`/`[TEST]`), no AI attribution, push and open the PR without asking (standing convention).

## 9. Acceptance criteria (reviewer checks these)

- Zero behavior-selection branching: no `if (stat > x) doThing()` anywhere; only multiplicative utilities + roulette draw.
- A vector of all zeros still surfs (floors keep it alive), just listlessly. A maxed single stat visibly dominates without silencing everything else.
- Dwell and depth are emergent — grep proves no dwell timer / depth target exists.
- Every component in §4 is independently unit-tested through its interface; seeded RNG makes every test deterministic.
- Knowledge-base ranges used for durations/pixels.
- Charts updated in the same PRs; e2e in the same PRs; lever/label strings translated in PHP.
- All CLAUDE.md conventions hold (views, no raw filesystem, PHPCS clean without self-applied suppressions, workflow replayed locally).
