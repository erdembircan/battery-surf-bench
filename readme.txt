=== Battery Surf Bench ===
Contributors: erdembircan
Tags: battery, benchmark, performance, power, testing
Requires at least: 7.0
Tested up to: 7.0
Requires PHP: 8.1
Stable tag: 1.0.0-dev
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Benchmarks battery drain by simulating real-world web surfing.

== Description ==

Battery Surf Bench measures how fast a device's battery drains under a realistic web-browsing workload. Instead of a synthetic loop, it drives a research-derived "surfer" behaviour profile through a sequence of content pages — articles, an image gallery, a link hub and a video feature — while sampling battery state, then projects a drain rate from the captured samples.

The benchmark runs entirely inside your own WordPress site. All content it navigates is bundled with the plugin; the simulated surf pages are only ever rendered to an authorised operator running a benchmark and are never shown to public visitors.

**External content note:** the bundled video-feature page embeds a YouTube video through WordPress's own native `core/embed` block, rendered as a `youtube-nocookie.com` iframe. Playback is driven by the simulation itself — the surfer starts the video (muted) when it decides to watch and pauses it again when its dwell ends — rather than autoplaying on page load. This iframe is only rendered on the operator-gated benchmark page — it requires the operator's capability plus a valid nonce — and is never output on the public-facing site. It is a deliberate part of the battery-drain workload, not tracking or advertising. The same handling applies automatically to any YouTube embed on a site owner's own selected surf pages.

== Installation ==

1. Upload the plugin to `wp-content/plugins/battery-surf-bench`, or install it through the Plugins screen.
2. Activate the plugin through the Plugins screen in WordPress.
3. Open the Battery Surf Bench admin menu and start a benchmark from the cockpit.

== Frequently Asked Questions ==

= Who can run a benchmark? =

Only users with the plugin's operator capability. The cockpit, the simulated surf pages and all recorded sessions are gated behind that capability; anonymous and unauthorised users cannot reach them.

= Does the plugin contact external servers or track users? =

No. The plugin performs no telemetry, analytics or phone-home requests. The only external content is the bundled simulated-surf YouTube embed described above, which is part of the measured workload and is only shown to the operator running a benchmark.

= Why does it use the core embed block for the YouTube video? =

Battery Surf Bench renders YouTube video the same way any WordPress site author would: through the native `core/embed` block. A dedicated service (`YouTubeEmbed`) keeps that embed's rendering offline and deterministic — it short-circuits WordPress's own oEmbed HTTP fetch and builds the `youtube-nocookie.com` iframe locally, so no network request is made and no benchmark run depends on YouTube's oEmbed endpoint being reachable — and normalizes the iframe's parameters so the surfer simulation can start and stop playback through YouTube's JS API, rather than relying on autoplay. This is a deliberate, ecosystem-native choice: it works the same way on any user-selected surf page containing a YouTube embed, not just the bundled video page.

== Changelog ==

= 1.0.0-dev =
* Initial development release.
