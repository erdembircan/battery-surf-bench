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
- **JS control via the raw IFrame API postMessage protocol, not the
  `iframe_api` remote script.** `enablejsapi=1` on the iframe's own `src` is
  all a page needs to accept `{event:'command', func, args:[]}` messages
  posted to its `contentWindow` — no external script load, keeping the
  surf engine's DOM footprint exactly as small as before.
- **`VideoControl` (`src/surfer/VideoControl.ts`) is the one seam that knows
  how to start/stop a given element**, so `Motor` stays element-agnostic:
  - a real `<video>` — the existing muted-retry-on-rejected-autoplay
    fallback, unchanged, now lives here instead of inline in `DomMotor`;
  - a YouTube/youtube-nocookie iframe — posts the play/pause command to its
    `contentWindow`, target origin derived from the iframe's own `src`;
  - anything else (Vimeo, or a YouTube iframe with an unparseable `src`) —
    a safe no-op in both directions, preserving today's behavior exactly.
- **Start → dwell → stop.** `DomMotor.playVideo()` builds and keeps the
  `VideoControl` for whatever it attended; the new `DomMotor.stopVideo()`
  pauses that same control and clears it (a safe no-op when nothing was
  started). `WatchVideo.run()` is now
  `playVideo() → idle(dwell) → stopVideo()` — the 30–45s dwell window and
  bid math are unchanged.
- **Detection is unchanged.** `VIDEO_EMBED_SELECTOR` already matches
  `youtube.com/embed` and `youtube-nocookie.com/embed` iframes — exactly
  what the native block (after WordPress's real oEmbed handling plus the
  `embed_oembed_html` amend) renders as. What changed is what
  `playVideo`/`stopVideo` now do with a match, not how a match is found.

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

- **Unit (vitest):** `VideoControl.test.ts` covers `play()`/`pause()` for a
  `<video>` element, a YouTube iframe (exact postMessage payload + target
  origin), and the no-op paths (Vimeo, unparseable src, unrelated element).
  `Motor.test.ts` covers `playVideo` issuing the play command and
  `stopVideo` pausing the started target (or no-op). `WatchVideo.test.ts`
  covers the `playVideo → idle → stopVideo` command sequence.
  `Affordances.test.ts` covers detection against full native-block markup.
  `blueprint.test.mts` covers the YouTube oEmbed stub mu-plugin's content
  and which blueprints install it.
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
  Actual play/pause command dispatch is unit-tested only — cross-origin
  playback state can't be asserted deterministically in e2e.

## Out of scope

- Battery drain math (`DrainRate`, `RunSession`, `BatteryStore`) — untouched,
  as it has no behavior awareness by design.
- The `iframe_api` remote script — deliberately not used; see "JS control"
  above.
