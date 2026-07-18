=== Battery Surf Bench ===
Contributors: erdembircan
Tags: battery, benchmark, performance, power, testing
Requires at least: 7.0
Tested up to: 7.0
Requires PHP: 8.1
Stable tag: 1.0.0-dev
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Measures real-world battery drain by driving a human-like simulated surfer through real pages — live cockpit, honest math, saved sessions.

== Description ==

Battery Surf Bench measures how fast a device's battery drains under a realistic web-browsing workload. Instead of a synthetic loop, it unleashes a research-derived simulated "surfer" on a sequence of real content pages — reading articles, lingering on images, watching video, scrolling, fidgeting, moving on — while continuously sampling battery state, then projects an honest drain rate from the captured samples.

Everything runs inside your own WordPress site: no lab hardware, no external measurement services, no telemetry.

= A surfer, not a script =

The simulated visitor is not a scripted macro. Each moment, competing behaviors — reading, watching, scrolling, glancing back to re-read, idle fidgeting, leaving the page — bid against each other based on the surfer's personality and what the current page actually offers, and the winner plays out. Pick a ready-made surfer class (Scholar, Binge-Watcher, Doomscroller, Skimmer, Jitterbug, Balanced) or build your own by spending a point budget across five personality stats. Its behavior profile is tuned from published battery-benchmark methodologies and real-user browsing telemetry.

= A live cockpit =

Every run happens in a dedicated dashboard: live battery level, a responsive 10-minute drain rate, a stable whole-session rate, projected time-to-empty, and a viewport where you can watch the surfer browse in real time. Benchmark for a fixed duration (5 minutes to 4 hours) or until the battery drops a chosen number of percentage points, at 1x, 4x, or 10x speed. A screen wake-lock keeps the display awake for the whole run, a leave-confirmation guard protects an in-progress benchmark, and the run refuses to start — and automatically pauses — while the charger is connected, excluding plugged-in time from the math.

= Numbers you can trust =

Drain rates come from least-squares regression over the sampled battery curve, not a naive start-minus-end delta. The plugin will not quote a rate before it has observed enough distinct battery steps to support one, and it blocks the run outright — with a clear warning — if the browser cannot provide battery readings, rather than reporting a fake number. Battery measurement uses the Battery Status API, currently available in Chromium-based browsers on battery-powered devices.

= Every run remembered =

Each benchmark is stored as a session: a sortable admin grid lists every past run (status, mode, browser, battery span, drain rates, duration), and reopening a session rebuilds its full illustrated summary — verdict, drain chart with a projected full-discharge line, and stat tiles — from the stored samples. Sessions keep the browser, OS, run configuration, and complete sample log, available over the site's own REST API for further analysis.

= Your content, your course =

Five bundled pages provide a balanced workload out of the box — a long-form article, an image gallery, a skimmable listicle, a video feature, and a link hub — all rendered through your active theme exactly as a visitor would see them. The settings screen lets you build a custom surf course from your own posts and pages, reorder it freely, and mix in the bundled pages wherever you like. Pages later removed or unpublished quietly drop out of the rotation.

= Private by design =

Only users with the plugin's operator capability can reach the cockpit, the surf pages, the recorded sessions, or the settings. Course pages are served as ephemeral in-memory pages — nothing is written to the database and nothing new appears on the public site. The plugin performs no telemetry or phone-home requests; the only network traffic is the session saving to your own site's REST API. Translation-ready, with German, Spanish, French, Brazilian Portuguese, and Turkish shipped out of the box.

**External content note:** the bundled video-feature page embeds a YouTube video through WordPress's own native `core/embed` block, resolved by WordPress's own real oEmbed handling exactly as it would be on any WordPress site — including the outbound request that handling makes to YouTube's oEmbed endpoint to resolve the embed. The plugin does not replace or short-circuit that handling; it only amends the returned iframe's parameters (`enablejsapi`, `mute`, `playsinline`, `rel`, `origin`) so the simulation can start and stop playback itself — the surfer starts the video (muted) when it decides to watch and pauses it again when its dwell ends, rather than the embed autoplaying on page load. This embed is only rendered on the operator-gated benchmark page — it requires the operator's capability plus a valid nonce — and is never output on the public-facing site. It is a deliberate part of the battery-drain workload, not tracking or advertising. The same handling applies automatically to any YouTube embed on a site owner's own selected surf pages.

== Installation ==

1. Upload the plugin to `wp-content/plugins/battery-surf-bench`, or install it through the Plugins screen.
2. Activate the plugin through the Plugins screen in WordPress.
3. Unplug your laptop, open the Battery Surf Bench admin menu (or the Start Benchmark shortcut in the admin bar), and start a benchmark from the cockpit.

== Frequently Asked Questions ==

= Who can run a benchmark? =

Only users with the plugin's operator capability. The cockpit, the simulated surf pages and all recorded sessions are gated behind that capability; anonymous and unauthorised users cannot reach them.

= Which browsers are supported? =

Battery measurement relies on the Battery Status API, currently available in Chromium-based browsers (Chrome, Edge, Opera and others) on battery-powered devices. The cockpit detects support up front and blocks the run with a clear warning — instead of reporting a fabricated rate — if the browser cannot provide battery readings.

= Can I benchmark my own pages instead of the bundled ones? =

Yes. The settings screen lets you compose the surf course from your own posts and pages alongside (or instead of) the bundled ones, and reorder the sequence freely. Pages that are later trashed or unpublished drop out of the rotation automatically without breaking your saved configuration.

= Does the plugin contact external servers or track users? =

The plugin itself performs no telemetry, analytics or phone-home requests of its own. The one external contact is the bundled simulated-surf YouTube embed described above: WordPress's own real oEmbed handling contacts YouTube's oEmbed endpoint to resolve it, exactly as it would for any YouTube URL on any WordPress site. That request is part of the measured workload (real video-page browsing genuinely does this) and is only made while the operator-gated benchmark page is being rendered to the operator running a benchmark.

= Why does it use the core embed block for the YouTube video? =

Battery Surf Bench renders YouTube video the same way any WordPress site author would: through the native `core/embed` block, resolved by WordPress's own real oEmbed handling — the plugin never replaces or short-circuits it. A dedicated service (`YouTubeEmbed`) makes exactly one surgical amend to the iframe oEmbed already produced: it merges the query params (`enablejsapi`, `mute`, `playsinline`, `rel`, `origin`) the surf simulation needs to start and stop playback through YouTube's JS API, and strips any `autoplay` param, leaving everything else — the host, the path, every other param oEmbed set — untouched. This is a deliberate, ecosystem-native choice: it works the same way on any user-selected surf page containing a YouTube embed, not just the bundled video page.

== Changelog ==

= 1.0.0-dev =
* Initial development release.
