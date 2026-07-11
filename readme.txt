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

**External content note:** the bundled video-feature page embeds a YouTube video through WordPress's own native `core/embed` block, resolved by WordPress's own real oEmbed handling exactly as it would be on any WordPress site — including the outbound request that handling makes to YouTube's oEmbed endpoint to resolve the embed. The plugin does not replace or short-circuit that handling; it only amends the returned iframe's parameters (`enablejsapi`, `mute`, `playsinline`, `rel`, `origin`) so the simulation can start and stop playback itself — the surfer starts the video (muted) when it decides to watch and pauses it again when its dwell ends, rather than the embed autoplaying on page load. This embed is only rendered on the operator-gated benchmark page — it requires the operator's capability plus a valid nonce — and is never output on the public-facing site. It is a deliberate part of the battery-drain workload, not tracking or advertising. The same handling applies automatically to any YouTube embed on a site owner's own selected surf pages.

== Installation ==

1. Upload the plugin to `wp-content/plugins/battery-surf-bench`, or install it through the Plugins screen.
2. Activate the plugin through the Plugins screen in WordPress.
3. Open the Battery Surf Bench admin menu and start a benchmark from the cockpit.

== Frequently Asked Questions ==

= Who can run a benchmark? =

Only users with the plugin's operator capability. The cockpit, the simulated surf pages and all recorded sessions are gated behind that capability; anonymous and unauthorised users cannot reach them.

= Does the plugin contact external servers or track users? =

The plugin itself performs no telemetry, analytics or phone-home requests of its own. The one external contact is the bundled simulated-surf YouTube embed described above: WordPress's own real oEmbed handling contacts YouTube's oEmbed endpoint to resolve it, exactly as it would for any YouTube URL on any WordPress site. That request is part of the measured workload (real video-page browsing genuinely does this) and is only made while the operator-gated benchmark page is being rendered to the operator running a benchmark.

= Why does it use the core embed block for the YouTube video? =

Battery Surf Bench renders YouTube video the same way any WordPress site author would: through the native `core/embed` block, resolved by WordPress's own real oEmbed handling — the plugin never replaces or short-circuits it. A dedicated service (`YouTubeEmbed`) makes exactly one surgical amend to the iframe oEmbed already produced: it merges the query params (`enablejsapi`, `mute`, `playsinline`, `rel`, `origin`) the surf simulation needs to start and stop playback through YouTube's JS API, and strips any `autoplay` param, leaving everything else — the host, the path, every other param oEmbed set — untouched. This is a deliberate, ecosystem-native choice: it works the same way on any user-selected surf page containing a YouTube embed, not just the bundled video page.

== Changelog ==

= 1.0.0-dev =
* Initial development release.
