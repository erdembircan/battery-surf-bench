=== Battery Surf Bench ===
Contributors: erdembircan
Tags: battery, benchmark, performance, power, testing
Requires at least: 7.0
Tested up to: 7.0
Requires PHP: 8.1
Stable tag: 1.0.0-dev
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Find out how fast web surfing really drains your battery, with a benchmark that browses like a human instead of a script.

== Description ==

Battery Surf Bench is a WordPress plugin that measures your device's real-world battery drain. It unleashes a simulated web surfer on a course of content pages, samples your battery for the whole run, and projects an honest drain rate from what it actually measured.

No lab hardware. No external services. Just your browser, your battery, and a surfer that never gets tired.

= Highlights =

* **A surfer, not a script.** The simulated visitor makes its own decisions as it browses. No two runs play out the same.
* **A live cockpit.** A dedicated dashboard shows the whole run as it happens: battery readouts, projections, and the surfer itself browsing in a live viewport.
* **Honest math.** Drain rates come from regression over the sampled battery curve, and no number is reported before the data can support one.
* **Every run remembered.** Each benchmark is saved as a session you can browse, reopen, and compare.
* **Yours to shape.** Choose the workload, the surfer's personality, the run mode, and the pace.

= A benchmark that browses like a person =

The surfer is not a scripted macro. At every moment, its possible behaviors compete for its attention, weighted by its personality and by what the current page actually offers, and the winner plays out. The behavior profile is tuned from published battery-benchmark methodologies and real-user browsing telemetry, and it shows:

* **It reads.** Genuine reading pauses on text-dense pages, with occasional scroll-backs to re-read something it passed.
* **It watches.** Video pages get real watch time through the actual embedded player, started, watched, and paused by the surfer itself.
* **It admires.** Content images earn a lingering dwell, cursor and all.
* **It fidgets.** Idle cursor drift, micro-scrolls, even the occasional absent-minded text selection.
* **It gets bored.** Leaving a page is a decision the surfer makes, not a timer expiring.

Ready-made surfer personalities cover the spectrum, from a patient, text-hungry scholar to a restless doomscroller. Want something more specific? Open the customizer and shape your own visitor against a fixed budget: how briskly it moves, how long it stays put, how strongly text pulls at it, how strongly images and video do, and how twitchy it gets when idle.

= A course worth surfing =

Five bundled pages give the surfer a balanced, realistic workload out of the box: a long-form article, an image gallery, a skimmable listicle, a video feature, and a link hub. Each carries its own self-contained design, so the workload stays consistent no matter which theme the site runs. Prefer your own content? The settings screen lets you build a custom course from any of your site's posts and pages (those render through your theme, exactly as visitors see them), reorder it freely, and mix in the bundled pages wherever you like. Pages later removed or unpublished quietly drop out of the rotation without breaking your saved configuration.

= The cockpit =

Every run happens in the cockpit, a purpose-built dashboard that stays out of the data's way:

* **Two run modes:** benchmark for a fixed duration (5 minutes to 4 hours), or until the battery drops a chosen number of percentage points.
* **Three speeds:** run at true-to-life 1x, or compress time at 4x or 10x for demos and quick checks.
* **Live readouts:** battery level, a responsive 10-minute drain rate, a stable whole-session rate, and projected time-to-empty, all updating as the samples come in.
* **A watchable run:** the surfer browses inside a live viewport, with playful captions narrating what it's up to.
* **Run protection built in:** a screen wake-lock keeps the display from sleeping mid-run, a leave-confirmation guard saves you from an accidental tab close, and a finish chime announces a run that completes on its own (mutable, and it remembers your choice).
* **Charger-aware:** a benchmark won't start while you're plugged in. If the charger connects mid-run, the run pauses automatically and resumes when you unplug, with the plugged-in time excluded from the math.

= Numbers you can trust =

* **Regression, not guesswork.** Battery level is sampled continuously and fitted with least-squares regression, so a brief plateau or a noisy reading doesn't skew the verdict.
* **No premature verdicts.** The plugin waits for enough distinct battery steps before quoting a rate. It would rather say "calibrating" than make something up.
* **Clear projections.** Time-to-empty is projected live and drawn on the summary chart: the measured drain staircase against a dashed full-discharge projection.
* **A summary worth keeping.** Every finished run produces an illustrated postcard-style summary with the verdict, the drain chart, and stat tiles for elapsed time, battery levels at start and end, points dropped, both drain rates, and time-to-empty.

= Every run remembered =

Every run, whether it finished, was stopped early, or got interrupted, is stored as a benchmark session:

* **Sessions screen:** a sortable admin grid of every past run with status, mode, browser, battery span, drain rates, and duration.
* **Session detail:** reopen any session to its full summary, rebuilt from the stored samples.
* **Portable data:** each session keeps the browser and OS it ran on, the exact run configuration, and the complete sample log, all available over the site's own REST API for your own analysis.
* **One-click start:** launch a fresh benchmark straight from the admin bar, anywhere in wp-admin.

= Private by design =

* **Operator-only, everywhere.** The cockpit, the surf pages, the sessions, the settings: all gated behind a dedicated capability. Public visitors can't reach any of it.
* **No footprint.** Course pages are served as ephemeral, in-memory pages. Nothing is written to your database and nothing new appears on your site.
* **No telemetry.** All sampling and math happen locally in your browser; the only network traffic is your session saving to your own site.

= Speaks your language =

Fully translation-ready, with German, Spanish, French, Brazilian Portuguese, and Turkish shipped out of the box.

= External content note =

The bundled video-feature page embeds a YouTube video through WordPress's own native `core/embed` block, resolved by WordPress's own real oEmbed handling exactly as it would be on any WordPress site, including the outbound request that handling makes to YouTube's oEmbed endpoint to resolve the embed. The plugin does not replace or short-circuit that handling; it only adjusts the returned embed so the simulation can start and stop playback itself. The surfer starts the video (muted) when it decides to watch and pauses it again when its dwell ends, rather than the embed autoplaying on page load. This embed is only rendered on the operator-gated benchmark page (it requires the operator's capability plus a valid nonce) and is never output on the public-facing site. It is a deliberate part of the battery-drain workload, not tracking or advertising. The same handling applies automatically to any YouTube embed on a site owner's own selected surf pages.

== Installation ==

1. Upload the plugin to `wp-content/plugins/battery-surf-bench`, or install it through the Plugins screen.
2. Activate the plugin through the Plugins screen in WordPress.
3. Unplug your laptop, open the Battery Surf Bench admin menu (or the Start Benchmark shortcut in the admin bar), and start a benchmark from the cockpit.

== Frequently Asked Questions ==

= Who can run a benchmark? =

Only users with the plugin's operator capability. The cockpit, the simulated surf pages and all recorded sessions are gated behind that capability; anonymous and unauthorised users cannot reach them.

= Which browsers are supported? =

Battery measurement relies on the Battery Status API, currently available in Chromium-based browsers (Chrome, Edge, Opera and others) on battery-powered devices. The cockpit detects support up front and blocks the run with a clear warning, instead of reporting a fabricated rate, if the browser cannot provide battery readings.

= Can I benchmark my own pages instead of the bundled ones? =

Yes. The settings screen lets you compose the surf course from your own posts and pages alongside (or instead of) the bundled ones, and reorder the sequence freely. Pages that are later trashed or unpublished drop out of the rotation automatically without breaking your saved configuration.

= Does the plugin contact external servers or track users? =

The plugin itself performs no telemetry, analytics or phone-home requests of its own. The one external contact is the bundled simulated-surf YouTube embed described above: WordPress's own real oEmbed handling contacts YouTube's oEmbed endpoint to resolve it, exactly as it would for any YouTube URL on any WordPress site. That request is part of the measured workload (real video-page browsing genuinely does this) and is only made while the operator-gated benchmark page is being rendered to the operator running a benchmark.

= Why is there a YouTube video in the surf course? =

Because real-world browsing includes video, and video is one of the heaviest things a browser asks of a battery; leaving it out would understate the drain. The video plays the same way WordPress plays any embedded video: it never autoplays, it stays muted, and the surfer decides when to watch and when to move on. It is only ever shown to the operator running a benchmark, and a YouTube embed on your own selected surf pages behaves the same way during a run.

== Changelog ==

= 1.0.0-dev =
* Initial development release.
