# Native YouTube Embed + Simulated Playback — Implementation Plan

The bundled video course page rendered a hand-written, autoplaying,
looping `<iframe>` — a "band-aid" that bypassed WordPress's own embed
handling entirely. This plan replaces it with the native `core/embed`
YouTube block, and makes the browsing simulation genuinely start and stop
playback during a watch period, for both the bundled page and any
user-selected surf page containing a YouTube embed.

## Decisions

- **Render through `core/embed`, not a hand-written iframe.** The bundled
  video page's content is now a real `<!-- wp:embed -->` block: a bare
  `youtube.com/watch?v=` URL inside `.wp-block-embed__wrapper`, which
  WordPress's own `WP_Embed::autoembed()` (hooked on `the_content` at
  priority 8, before `do_blocks()` at priority 9) converts to an iframe
  before the block is ever rendered. This is the same path any site owner's
  own YouTube embed goes through — no special-casing for the bundled page.
- **Two `WP_Embed` filters keep it offline and controllable — `YouTubeEmbed`
  service:**
  - `pre_oembed_result` builds the iframe locally for a recognized YouTube
    URL, short-circuiting `WP_oEmbed::get_html()`'s network fetch entirely.
    This is what keeps rendering deterministic and offline (no dependency on
    reaching YouTube's oEmbed endpoint during a benchmark run, and no
    flakiness in CI/e2e).
  - `embed_oembed_html` normalizes ANY YouTube/youtube-nocookie iframe HTML
    that reaches `WP_Embed::shortcode()` — including a cache hit from before
    this service existed, which never runs through `pre_oembed_result` at
    all. Both filters are needed: a site owner's page might already have a
    cached oEmbed result with none of the control params below.
  - Both are idempotent and leave non-YouTube URLs/iframes (Vimeo, etc.)
    completely untouched.
- **Control params, no autoplay/loop.** Every normalized iframe src is
  `https://www.youtube-nocookie.com/embed/{id}?enablejsapi=1&playsinline=1&mute=1&rel=0&origin={home origin}`.
  `enablejsapi=1` is required for the raw postMessage command protocol;
  `mute=1` is required because a programmatic (non-user-gesture) `playVideo`
  command is only honored by browsers' autoplay policy when the player is
  muted; `origin` must match the serving page's own origin or YouTube
  refuses the postMessage commands. No `autoplay`, no `loop` — the
  simulation now owns start/stop.
- **Scoped registration, not global.** `CourseRouter::serve()` calls
  `YouTubeEmbed::register()` per served course page, not at plugin boot —
  the filters are only active for the course-serving sub-request's
  `the_content`/`do_blocks()` pass, never for ordinary site content.
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
  what the native block (after `pre_oembed_result`/`embed_oembed_html`)
  renders as. What changed is what `playVideo`/`stopVideo` now do with a
  match, not how a match is found.

## Why this needed two oEmbed filters, not one

A site owner's own page might embed YouTube via a bare URL that WordPress
already resolved and cached (in an `oembed_cache` post, or post meta) before
this plugin's `YouTubeEmbed` service ever ran. `WP_Embed::shortcode()`
returns a cache hit straight through `embed_oembed_html` — `pre_oembed_result`
is never consulted for a cache hit at all (it only guards the network-fetch
path). Relying on `pre_oembed_result` alone would leave every pre-existing
cached embed without the control params the surf engine needs.

## Testing

- **Unit (vitest):** `VideoControl.test.ts` covers `play()`/`pause()` for a
  `<video>` element, a YouTube iframe (exact postMessage payload + target
  origin), and the no-op paths (Vimeo, unparseable src, unrelated element).
  `Motor.test.ts` covers `playVideo` issuing the play command and
  `stopVideo` pausing the started target (or no-op). `WatchVideo.test.ts`
  covers the `playVideo → idle → stopVideo` command sequence.
  `Affordances.test.ts` covers detection against full native-block markup.
- **Unit (phpunit):** `YouTubeEmbedTest` covers `parse_video_id` across every
  recognized URL form, both filters' behavior (offline base, normalization,
  idempotency, non-YouTube pass-through). `YouTubeEmbedViewTest` covers the
  view's markup contract. `CourseRouterTest` covers the filters being
  registered once a course page is served.
- **E2e (Playwright):** a new spec serves the bundled video page and asserts
  (deterministically, offline — `pre_oembed_result` guarantees the iframe
  exists with no network call) that a `figure.wp-block-embed` with an
  iframe is present, the iframe's `src` carries `enablejsapi=1` and no
  `autoplay=1`, and no PHP notice is printed. Actual play/pause command
  dispatch is unit-tested only — cross-origin playback state can't be
  asserted deterministically in e2e.

## Out of scope

- Battery drain math (`DrainRate`, `RunSession`, `BatteryStore`) — untouched,
  as it has no behavior awareness by design.
- The `iframe_api` remote script — deliberately not used; see "JS control"
  above.
