# Native YouTube Embed + Simulated Playback — Implementation Plan

The bundled video course page rendered a hand-written, autoplaying,
looping `<iframe>` — a "band-aid" that bypassed WordPress's own embed
handling entirely. This plan replaces it with the native `core/embed`
YouTube block, resolved by WordPress's own real oEmbed handling, and makes
the browsing simulation genuinely start and stop playback during a watch
period, for both the bundled page and any user-selected surf page
containing a YouTube embed.

## Decisions

- **Render through `core/embed`, not a hand-written iframe.** The bundled
  video page's content is a real `<!-- wp:embed -->` block: a bare
  `youtube.com/watch?v=` URL inside `.wp-block-embed__wrapper`, which
  WordPress's own `WP_Embed::autoembed()` (hooked on `the_content` at
  priority 8, before `do_blocks()` at priority 9) converts to an iframe
  before the block is ever rendered. This is the same path any site owner's
  own YouTube embed goes through — no special-casing for the bundled page.
- **WordPress's real oEmbed handling is never replaced or short-circuited.**
  Resolving a YouTube URL — including the outbound network request to
  YouTube's oEmbed endpoint — happens exactly as it would on any WordPress
  site, for the bundled page and a user's own page alike. The plugin does
  not build its own iframe markup and does not intercept `pre_oembed_result`
  in production.
- **One surgical amend — `YouTubeEmbed::embed_oembed_html()`.** The single
  production touch is a filter on `embed_oembed_html`, which fires for ANY
  iframe HTML reaching `WP_Embed::shortcode()` — a fresh fetch or a
  pre-existing cache hit. Through the real `WP_HTML_Tag_Processor`, it:
  1. finds each `<iframe>`,
  2. checks its `src` host against a boundary-anchored
     `youtube(-nocookie).com` match (`is_youtube_src()` — a non-YouTube
     iframe, e.g. Vimeo, or a lookalike host like `myyoutube.com`, is left
     completely untouched),
  3. for a match, merges four query params onto the EXISTING query string
     (`amend_control_params()`) — preserving the host, the path and every
     other param oEmbed already set (e.g. `feature=oembed`), never
     rebuilding the URL from scratch.
  Both `is_youtube_src()` and `amend_control_params()` are pure string
  logic with no dependency on `WP_HTML_Tag_Processor` — kept public
  specifically so they are unit-testable on their own (see Testing below).
  The amend is idempotent.
- **Control params merged, no autoplay/loop.** `enablejsapi=1`,
  `mute=1`, `playsinline=1`, `rel=0`, `origin={home origin, port included}`
  are merged onto whatever query string oEmbed already produced; any
  `autoplay` param is stripped. `enablejsapi=1` is required for the raw
  postMessage command protocol; `mute=1` is required because a programmatic
  (non-user-gesture) `playVideo` command is only honored by browsers'
  autoplay policy when the player is muted; `origin` (scheme + host + port)
  must match the serving page's own origin or YouTube refuses the
  postMessage commands entirely. No `autoplay`, no `loop` — the simulation
  now owns start/stop.
- **Scoped registration, not global.** `CourseRouter::serve()` calls
  `YouTubeEmbed::register()` per served course page, not at plugin boot —
  the filter is only active for the course-serving sub-request's
  `the_content`/`do_blocks()` pass, never for ordinary site content.
- **Offline determinism lives in dev/e2e tooling, never in production.**
  wp-playground (the persistent dev server and the non-persistent e2e
  instances) has no reliable outbound network, so real oEmbed there
  otherwise yields no iframe at all. A dev/e2e-only mu-plugin
  (`wp-playground/blueprint.mts`'s `youtubeOembedStubMuPlugin`, wired into
  `devBlueprint`, `devResumeBlueprint` and `e2eBlueprint` the same way the
  existing `autoLoginMuPlugin` is injected) hooks `pre_oembed_result` to
  return a canned `youtube.com/embed/...` iframe, so the real, unmodified
  production `embed_oembed_html` amend still has something to amend. The
  production plugin ships no such stub and never touches
  `pre_oembed_result`.
- **JS control AND state reading via the raw IFrame API postMessage
  protocol, not the `iframe_api` remote script.** `enablejsapi=1` on the
  iframe's own `src` is all a page needs to accept `{event:'command', func,
  args}` messages posted to its `contentWindow`, and to opt in (via
  `{event:'listening'}`) to the player's own event-message stream — no
  external script load, keeping the surf engine's DOM footprint exactly as
  small as before.
- **The watch is genuinely player-state-aware, driven off `'ended'`, never
  off a duration/currentTime number.** The one signal that matters —
  whether the player reports `'ended'` — covers both length-mismatch
  directions in a single rule: a video shorter than the watch window ends
  early and gets replayed so the surfer keeps watching; a video longer than
  the window (or an unreadable target, e.g. Vimeo) never reports `'ended'`,
  so the loop just dwells the full window. `Motor`/`VideoControl`
  deliberately expose no duration or currentTime at all — there is nothing
  to compare numbers against, only state to react to.
- **`VideoControl` (`src/surfer/VideoControl.ts`) is the one seam that knows
  how to start, stop, replay and read the state of a given element**, so
  `Motor` stays element-agnostic:
  - `play()` — starts/resumes; replays from `0` when the player has ended
    (YouTube: `seekTo [0, true]` then `playVideo`; `<video>`: reset
    `currentTime` then `.play()` with the existing muted-retry fallback);
    a no-op when already playing.
  - `stop()` — a genuine full stop, not a pause (YouTube: `stopVideo`
    command; `<video>`: `.pause()` + reset `currentTime` to `0`), so a later
    `play()` always starts clean.
  - `getState()` — the player's own reported `VideoPlaybackState`
    (`'unavailable' | 'unstarted' | 'playing' | 'paused' | 'ended' |
    'buffering' | 'cued'`). For a YouTube iframe this is read, not
    inferred: the control registers a `window` `message` listener on
    creation, asserts `{event:'listening'}` (re-asserted once more on the
    first `play()`, defensively), and updates a cached state from the
    player's own `onStateChange`/`infoDelivery` event messages — gated on
    `event.source === iframe.contentWindow` and `event.origin ===
    targetOrigin`, so nothing but the exact embed this control was built
    for can influence it. For a `<video>` element, state is derived
    directly from `ended`/`paused`/`currentTime`.
  - `dispose()` — removes the message listener (YouTube only); a no-op
    otherwise. Idempotent.
  - anything else (Vimeo, or a YouTube iframe with an unparseable `src`) —
    every verb is a safe no-op and `getState()` reports `'unavailable'`,
    preserving today's behavior exactly (attended, dwelled the full
    window, never actually started/stopped/replayed/queried).
- **`Motor` grows `replayVideo()` and `videoState()` alongside `playVideo()`/
  `stopVideo()`.** `playVideo()` attends (scroll + cursor, once), disposes
  any control left over from a prior watch cycle (no listener leaks across
  cycles or pages), builds a new `VideoControl` and calls `play()`.
  `replayVideo()` calls the active control's `play()` WITHOUT re-attending —
  restarting from `0` is `play()`'s own job when the state is `'ended'`.
  `videoState()` delegates to the active control, `'unavailable'` when none
  is active. `stopVideo()` stops AND disposes the active control, then
  clears it.
- **`WatchVideo.run()` dwells in slices, watching for `'ended'`.** Start,
  then loop: idle a `STATE_CHECK_SLICE_MS` (750 ms) slice, check
  `motor.videoState()`, replay on `'ended'`, repeat until the watch
  window's remaining budget is exhausted; then a full `stopVideo()`. A
  replay never extends the window — it only prevents the surfer from
  idling next to a finished player. The 30–45 s window and bid math are
  unchanged.
- **Detection is unchanged.** `VIDEO_EMBED_SELECTOR` already matches
  `youtube.com/embed` and `youtube-nocookie.com/embed` iframes — exactly
  what the native block (after WordPress's real oEmbed handling plus the
  `embed_oembed_html` amend) renders as. What changed is what
  `playVideo`/`replayVideo`/`stopVideo`/`videoState` now do with a match,
  not how a match is found.

## Verifying the real IFrame API protocol against a live embed

Driven directly (wp-playground + Playwright, against the bundled video page
with a real, live YouTube embed — not a mock), confirmed:

- Posting `{event:'listening'}` (no `id` field needed at all — a real embed
  never validates one, only ever echoes back whatever it was sent)
  immediately triggers an `initialDelivery` message carrying the current
  `info.playerState`, plus `onReady`.
- Every subsequent state change arrives as `infoDelivery` with
  `info.playerState` — the live embed observed here reports state changes
  exclusively this way. The documented `onStateChange` shape
  (`{event:'onStateChange', info:<code>}`) is handled too, for parity with
  the published API, even though it was never actually observed.
- A full watch cycle against a real, short (19 s) video:
  `{event:'command', func:'playVideo', args:[]}` →
  `unstarted(-1)` → `buffering(3)` → `playing(1)` → naturally `ended(0)` at
  `currentTime≈19`.
- From `ended`, `{func:'seekTo', args:[0, true]}` followed by
  `{func:'playVideo'}` genuinely restarts playback: `playing` at
  `currentTime` `0` again.
- `{func:'stopVideo'}` genuinely resets the player away from `'ended'`
  (observed transitioning to `unstarted(-1)` then `cued(5)`), confirming a
  deliberately-stopped player is never later mistaken for one that merely
  reached the end.

## Why the amend runs on `embed_oembed_html`, not `pre_oembed_result`

A site owner's own page might embed YouTube via a bare URL that WordPress
already resolved and cached (in an `oembed_cache` post, or post meta)
before this plugin's `YouTubeEmbed` service ever ran. `WP_Embed::shortcode()`
returns a cache hit straight through `embed_oembed_html` — a filter on
`pre_oembed_result` would never even run for that request, since it only
guards the network-fetch path. Hooking `embed_oembed_html` instead catches
every iframe regardless of how it reached that point: a fresh fetch, an
existing cache hit, or (in dev/e2e) the stub mu-plugin's canned response.

## Testing

- **Unit (vitest):** `VideoControl.test.ts` covers, for a `<video>` element:
  `play()`/`stop()`, replay-from-ended, no-op-when-already-playing, and
  `getState()` across unstarted/playing/paused/ended. For a YouTube iframe:
  the listening handshake posted on creation; `play()`'s exact command
  payload, its no-op when already playing, and its seekTo-then-playVideo
  replay when ended; `stop()`'s exact `stopVideo` command; `getState()`
  reflecting both the `onStateChange` and `infoDelivery` message shapes for
  every numeric code; messages from a different `source` or `origin` being
  ignored (synthetic `MessageEvent`s dispatched with `source`/`origin` set
  directly to the same `contentWindow`/origin the control reads — no
  relaxed production check, jsdom simply stores whatever `source` a
  `MessageEvent` is constructed with); `dispose()` removing the listener.
  Plus the no-op/`'unavailable'` paths (Vimeo, unparseable src, unrelated
  element). `Motor.test.ts` covers `playVideo` attending once, starting
  playback, and disposing a prior active control before replacing it;
  `replayVideo` replaying without re-attending (no new cursor travel);
  `videoState` delegating to the active control (`'unavailable'` when
  none); `stopVideo` stopping, disposing and clearing. `WatchVideo.test.ts`
  covers the slice-dwell loop: no replay (and a single trailing
  `stopVideo`) when the scripted video state never reports `'ended'`;
  exactly one `replayVideo` when it's scripted to report `'ended'` once
  mid-window, immediately after the slice that observed it, with the total
  dwell budget unaffected; the `'unavailable'` (no video) path idling the
  full window with no replay. `Affordances.test.ts` covers detection
  against full native-block markup. `blueprint.test.mts` covers the
  YouTube oEmbed stub mu-plugin's content and which blueprints install it.
- **Unit (phpunit):** `YouTubeEmbedTest` covers only the PURE logic that
  never touches `WP_HTML_Tag_Processor` — `is_youtube_src()` (host
  detection, including the boundary-anchor negative cases) and
  `amend_control_params()` (query-param merge, autoplay stripped,
  port-aware `origin`, idempotency) — plus `embed_oembed_html`'s two early
  returns that never construct the processor at all (an empty string, HTML
  with no `<iframe`). The actual tag-walking orchestration inside
  `embed_oembed_html` is NOT unit-tested: this test process has no real
  WordPress to load `WP_HTML_Tag_Processor` from (`wp-playground/wordpress/`
  is gitignored and absent in CI/a fresh checkout), and no test may assert
  against a fake of the very class it is verifying. `CourseRouterTest`
  covers the filter being registered once a course page is served.
- **E2e (Playwright):** `CockpitCourse.spec.mts` serves the bundled video
  page through the real request pipeline — WordPress's real oEmbed handling
  (its one HTTP fetch stubbed by the dev/e2e-only mu-plugin), the real,
  unmodified production `embed_oembed_html` amend running through the real
  `WP_HTML_Tag_Processor` — and asserts a `figure.wp-block-embed` with an
  iframe is present, the iframe's `src` carries `enablejsapi=1`, `mute=1`
  and `origin=`, carries no `autoplay=1`, and no PHP notice is printed. This
  is the ONLY coverage of the amend's actual tag-processor orchestration.
  E2e coverage stops at that markup contract: the dev/e2e stub returns a
  canned iframe pointed at a real YouTube URL, but never actually loads
  YouTube's real player, so it never emits genuine player-state event
  messages — faking that emission would mean asserting against a fake of
  the very protocol under test, which is deliberately not done. The
  player-state-aware watch/replay/full-stop logic is covered entirely by
  the unit tests above, verified in turn against a real, live embed (see
  above) while implementing it.

## Out of scope

- Battery drain math (`DrainRate`, `RunSession`, `BatteryStore`) — untouched,
  as it has no behavior awareness by design.
- The `iframe_api` remote script — deliberately not used; see "JS control"
  above.
