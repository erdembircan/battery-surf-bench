# Surfer Media Affordances — Implementation Plan

The surf engine's media sensing is mismatched with the actual course content,
and its media behaviors don't act on the media they claim to attend to. This
plan fixes both.

## The defects (verified)

1. **`imageCount` counts the wrong things.** `senseAffordances` counts
   `doc.querySelectorAll('img')` over the whole document. No course page's
   *content* contains a single `<img>`: the gallery page renders its twenty
   artworks as inline `<svg>` inside `<figure>`. What does get counted is page
   chrome outside the content — the logged-in admin bar's avatar, a theme
   logo, WordPress emoji `<img>` replacements. Result: `lingerImage` fires on
   visually image-less article pages (observed by the maintainer as the
   "shiny pixels" bark with no image in sight) and is *starved on the gallery
   page it was designed for*.
2. **`hasVideo` never sees the video page's video.** The video course page
   embeds YouTube via `<iframe>`; `querySelectorAll('video')` finds nothing,
   so `watchVideo` can never win there. `DomMotor.playVideo` likewise only
   drives a `<video>` element.
3. **`LingerImage.run` never engages an image.** It is a bare
   `motor.pointerDrift(ms)` — random wandering, no image targeting, no
   scrolling an off-screen image into view, no cursor travel to it. Even a
   legitimate fire looks unrelated to imagery. `WatchVideo.run` similarly
   never scrolls to the video it "watches".

## Product rules (settled with the maintainer — do not re-litigate)

- Sensing must reflect **content imagery/video**, not page chrome.
- `lingerImage` must pick a real image, **scroll it into view when
  off-screen**, travel the fake cursor **onto the image**, and dwell there —
  no more random drift.
- `watchVideo` gets the same attention treatment: scroll the video/embed into
  view (and approach it with the cursor) before watching.
- The behaviors stay pure utility bidders — no new gates or branching in the
  auction; only the affordance inputs and the motor verbs change.
- Bark strings/lifecycle (PR #74) are untouched by this work.

## Design

### 1. `src/surfer/Affordances.ts` — content-scoped sensing

- Introduce a content root: `doc.querySelector('main') ?? doc.body`. Block
  themes render page content inside `<main>`; the admin bar (`#wpadminbar`)
  and theme header/footer chrome live outside it. All media/text sensing
  queries run against this root. `scrollRemaining` keeps its current
  `scrollingElement` semantics (page-level scroll is genuinely global).
- `textDensity`: measure the content root's `textContent` instead of
  `doc.body` (chrome nav text no longer inflates prose density). Saturation
  constant unchanged.
- `imageCount`: `root.querySelectorAll('img, figure svg').length` — counts
  real `<img>` wherever they appear in content plus SVG artwork presented as
  figures (the gallery's medium). Do NOT add `picture` to the selector (a
  `<picture>` wraps an `<img>` that already matches — adding it would
  double-count).
- `hasVideo`: true when the root contains a `<video>` OR a recognized
  video-host embed:
  `iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"], iframe[src*="player.vimeo.com"]`.
- Update the module's header comment (it currently narrates the `<video>`-only
  rule) and the `Affordances` interface field docs to the new semantics. The
  interface *shape* is unchanged — no chart impact from sensing.

### 2. `src/surfer/Motor.ts` — new verb `lingerImage(ms)` + attentive `playVideo`

New interface member on `Motor`:

```ts
/** Attends a content image: scrolls it into view if needed, travels the
 *  cursor onto it, and dwells there for the remainder of `ms`. Falls back to
 *  an aimless drift when the page offers no image to linger on. */
lingerImage: ( ms: number ) => Promise< void >;
```

`DomMotor.lingerImage(ms)` spec (follow `selectSnippet`'s structure —
candidates → filter → rng pick → cursor travel — with a scroll step added):

- **Candidates**: `img, figure svg` within the content root (same root rule
  as Affordances: `document.querySelector('main') ?? document.body`), filtered
  by a minimum rendered size — both `getBoundingClientRect()` dimensions
  ≥ 40px — so the cursor never fixates an emoji-sized or icon image. (The
  sensing count stays unfiltered; the motor picks a *worthwhile* target from
  the supply the bid already priced.)
- **Pick**: prefer candidates currently in the viewport (vertical overlap with
  the viewport is enough — reuse/adapt `isInViewport`, but a partial
  intersection qualifies here: the point is "reachable without scrolling",
  not "fully visible"); rng-pick among those. When none are in view, rng-pick
  any candidate and **scroll it to the viewport middle** first: delta =
  `rect.top + rect.height / 2 - window.innerHeight / 2`, eased through the
  existing `scrollBy` implementation (call `this.scrollBy(delta, SCROLL_MS)`
  with `SCROLL_MS` ≈ 600), then re-read the rect (scrolling changed it).
- **Travel**: cursor `travelTo` a point on the image — its center plus a small
  rng jitter (e.g. ±20% of the rect's dimensions), frames from
  `framesForDistance`.
- **Dwell**: spend the remaining `ms` budget on the image, waiting frame by
  frame (like `selectSnippet`'s hold). A couple of tiny in-bounds cursor
  nudges during the dwell are welcome for life-likeness but optional — keep it
  simple.
- **Fallbacks**: no candidates at all → `this.pointerDrift(ms)`; anything
  missing mid-way (no rect, no view) → return gracefully, never throw.
- Time-budget note: scroll + travel time count toward `ms` where practical
  (mirror how `pointerDrift` decrements a frame budget); precision is not
  critical — the loop tolerates a behavior overrunning slightly.

`DomMotor.playVideo()` changes:

- Target: the content root's `<video>`, else the first recognized video-host
  iframe (same selector as Affordances). Nothing found → return.
- **Attend**: scroll the target to the viewport middle when it is not in view
  (same scroll helper/constant as `lingerImage`), then travel the cursor to a
  jittered point on it.
- **Play**: a `<video>` element plays exactly as today (unmuted attempt, muted
  retry). An embed iframe gets no play call — the course embed already
  autoplays muted; "watching" is the dwell `WatchVideo.run` already performs.
- Keep the `Motor` interface doc for `playVideo` current ("plays the page's
  video" → attends & plays the page's video or embed).

Factor the shared "scroll element's center to viewport middle" logic into one
private helper both verbs use.

### 3. Behaviors

- `src/surfer/Behaviors/LingerImage.ts` — `run` becomes
  `await motor.lingerImage(ms / ctx.speed)` (duration range and bid math
  unchanged). Update the header comment: it attends an actual image now.
- `src/surfer/Behaviors/WatchVideo.ts` — `run` unchanged (`playVideo` then
  `idle`); refresh the header comment (`<video>`-only wording, embeds now
  count).
- `src/surfer/FakeMotor.ts` — record `lingerImage(ms)` calls like the other
  verbs so behavior tests can assert commands.

### 4. Contract chart — same PR, mandatory

`docs/contracts/surf-engine-modules.mmd`: add `+lingerImage(ms) Promise` to
both the `Motor` interface and `DomMotor`. (Public surface only; no other
chart changes — `Affordances`' exported shape is unchanged.)

## Testing

Follow the existing test files' structure and doubles. All unit, no e2e: this
change adds no route, markup, or store directive — the observable surface is
engine motion, which the existing live-run e2e already smoke-covers. (The
sim-behavior verification standard for motion itself is the unit seam:
FakeMotor commands.)

- `Affordances.test.ts` (extend):
  - `<img>` inside `<main>` counted; `<img>` outside `<main>` (admin-bar-like
    sibling) NOT counted; falls back to `body` scoping when no `<main>`.
  - `figure svg` counted (a 20-figure gallery fixture counts 20);
    `picture > img` counted once; bare icon `svg` outside `figure` not
    counted.
  - `hasVideo` true for `<video>`, true for a youtube-nocookie embed iframe,
    true for a vimeo player iframe, false for a non-video iframe.
  - `textDensity` measured from the content root, not chrome text.
- `Motor.test.ts` (extend, following how existing DomMotor tests fake rects
  and frames):
  - `lingerImage` travels the cursor into the chosen image's rect and dwells.
  - Off-screen-only candidates: page scrolls (window.scrollBy driven) before
    the travel.
  - Tiny images (< 40px) are never chosen.
  - No candidates → falls back to drift, resolves without throwing.
  - `playVideo` with an embed iframe: scrolls/approaches, does not throw, does
    not call `play()`; with a `<video>`: still plays (existing tests keep
    passing).
- `LingerImage.test.ts` (update): `run` issues a `lingerImage` motor command
  scaled by speed (replaces the `pointerDrift` assertion).
- `WatchVideo.test.ts`: existing `playVideo`+`idle` command assertions still
  hold.
- Bid tests for both behaviors are already affordance-driven and stay valid.

## Process requirements

- Work on the existing PR #74 branch (`worktree-simrunner-bark-messages`),
  per the maintainer's direction — this fix ships in the same PR as the barks.
  First rebase the branch onto current origin/master (it is two unrelated
  commits behind), re-run the full gates, and push with `--force-with-lease`;
  then implement this plan as its own `[FIX]` commit on top. Conventional
  Commits, no AI attribution, no session trailers.
- JSDoc rules per CLAUDE.md (descriptions only, no redundant type tags).
- Never pipe lint/test output through tail/head; check real exit codes.
- Gates before commit: `pnpm format`, `pnpm typecheck`, `pnpm lint:js`,
  `pnpm test`, `composer lint`, `composer test`, `pnpm test:e2e` (full suite —
  it exercises the course pages and the live engine run; PHP untouched but the
  gates are the gates).
- Push to the existing PR #74 branch (no new PR), update the PR description to
  cover this fix, and wait for all CI checks to finish green.
