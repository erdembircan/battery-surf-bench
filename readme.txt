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

Battery Surf Bench measures how fast a device's battery drains under a realistic web-browsing workload. Instead of a synthetic loop, it drives a research-derived "surfer" behaviour profile through a sequence of content pages — articles, an image gallery, a link hub and an autoplaying video feature — while sampling battery state, then projects a drain rate from the captured samples.

The benchmark runs entirely inside your own WordPress site. All content it navigates is bundled with the plugin; the simulated surf pages are only ever rendered to an authorised operator running a benchmark and are never shown to public visitors.

**External content note:** one of the bundled simulated pages embeds a YouTube video through a `youtube-nocookie.com` iframe (autoplaying, muted, looped) so the measured workload reflects real-world video playback. This iframe is only rendered on the operator-gated benchmark page — it requires the operator's capability plus a valid nonce — and is never output on the public-facing site. It is a deliberate part of the battery-drain workload, not tracking or advertising.

== Installation ==

1. Upload the plugin to `wp-content/plugins/battery-surf-bench`, or install it through the Plugins screen.
2. Activate the plugin through the Plugins screen in WordPress.
3. Open the Battery Surf Bench admin menu and start a benchmark from the cockpit.

== Frequently Asked Questions ==

= Who can run a benchmark? =

Only users with the plugin's operator capability. The cockpit, the simulated surf pages and all recorded sessions are gated behind that capability; anonymous and unauthorised users cannot reach them.

= Does the plugin contact external servers or track users? =

No. The plugin performs no telemetry, analytics or phone-home requests. The only external content is the bundled simulated-surf YouTube iframe described above, which is part of the measured workload and is only shown to the operator running a benchmark.

= Why does it embed a YouTube video instead of the core embed block? =

The benchmark needs the video to autoplay and loop so the workload reflects real video playback battery cost — behaviour the core embed block cannot express, and which would also add a server-side oEmbed request. The plugin therefore renders a self-contained, operator-gated `youtube-nocookie.com` iframe.

== Changelog ==

= 1.0.0-dev =
* Initial development release.
