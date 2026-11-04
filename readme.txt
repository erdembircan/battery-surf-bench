=== Battery Surf Bench ===
Contributors: erdembircan
Tags: battery, benchmark, performance, power, testing
Requires at least: 7.0
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Find out how fast web surfing really drains your battery, with a benchmark that browses like a human instead of a script.

== Description ==

Battery Surf Bench is a WordPress plugin that measures your device's real-world battery drain. It unleashes a simulated web surfer on a course of content pages, samples your battery for the whole run, and projects an honest drain rate from what it actually measured.

No lab hardware and no server of your own: just your browser, your battery, and a surfer that never gets tired.

https://www.youtube.com/watch?v=X8CwzH_P4-g

= Made for WordPress Playground =

Battery Surf Bench is built to run in WordPress Playground, which runs a complete WordPress site, server and database included, inside your browser tab. Open this link and Playground starts a fresh site with the plugin installed and its cockpit open, with no server to rent, nothing to install and no account to create:

https://playground.wordpress.net/?plugin=battery-surf-bench&url=/wp-admin/admin.php?page=bsb-start-benchmark

A battery benchmark should be something anyone with a laptop can run, not only people who already run a WordPress site. It measures the device in front of you, so the whole test, site included, runs on that device. Every Playground starts from the same clean WordPress, which keeps results comparable across laptops and browsers and keeps benchmarking away from any real site you run. The site, its database and your recorded sessions stay in your browser.

Playground autosaves your recent sites in the browser; choose Save in browser storage to keep a site and its sessions for good. In Playground the page server runs on your device too, so a run also counts the work of serving each page: compare Playground runs with other Playground runs. The plugin installs on any WordPress site as well, if you'd rather use your own.

= An experiment in browser-native software =

Battery Surf Bench is also an experiment. Software that needs a server usually needs someone to host it, and software that doesn't usually has to stay small. We wanted to find out whether a desktop-grade application, with live dashboards, real-time charts, settings and a database of results, can skip that trade-off. WordPress provides the application platform, WordPress Playground handles everything a server and a database would, and you open a link and use the app.

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
* **No telemetry.** All sampling and math happen locally in your browser, and sessions save only to your own site. The one outside contact is YouTube, which serves the video on the bundled course's video page (see External services below).

= Speaks your language =

Fully translation-ready, with German, Spanish, French, Brazilian Portuguese, and Turkish shipped out of the box.

== External services ==

Battery Surf Bench connects to one external service: YouTube, which hosts the video on the bundled course's video page, "Watch: Inside a Modern Laptop's Power Path". Video is part of everyday browsing and one of the heaviest loads a browser puts on a battery, so the course includes it.

Nothing is sent until an operator starts a benchmark, and the video only ever appears on the operator-gated benchmark page, never on your public site. When the surfer reaches the video page during a run:

* Your site's server fetches the video's embed code from YouTube's oEmbed endpoint, sending the video's address, as WordPress does for any YouTube link in a post.
* The operator's browser loads YouTube's embedded player from youtube.com. As with any YouTube embed, YouTube receives the operator's IP address and browser details, and may set cookies and collect usage data under its own terms and privacy policy.

The same happens for a YouTube video on any of your own pages that you add to the course. The plugin itself sends no telemetry or analytics anywhere: every measurement stays in the operator's browser and is saved only to your own site.

* YouTube: https://www.youtube.com/
* YouTube Terms of Service: https://www.youtube.com/t/terms
* Google Privacy Policy: https://policies.google.com/privacy

== Source code ==

The scripts and styles in the plugin's `build/` folder are compiled from TypeScript and SCSS. The complete source, with its build configuration, is public on GitHub: https://github.com/erdembircan/battery-surf-bench

To build it yourself, install Node.js 24 with pnpm, and PHP 8.1 or later with Composer. Then, in a clone of the repository:

1. `pnpm install` and `composer install` install the dependencies.
2. `composer zip:production` runs the lints and tests, compiles `src/` into `build/`, assembles the finished plugin in `dist/battery-surf-bench/`, and zips it into `zip/battery-surf-bench.zip`, exactly as it ships.

== Installation ==

The quickest way to run a benchmark is WordPress Playground, with nothing to install: open https://playground.wordpress.net/?plugin=battery-surf-bench&url=/wp-admin/admin.php?page=bsb-start-benchmark, unplug your laptop, and start a benchmark from the cockpit.

To install it on your own site:

1. Upload the plugin to `wp-content/plugins/battery-surf-bench`, or install it through the Plugins screen.
2. Activate the plugin through the Plugins screen in WordPress.
3. Unplug your laptop, open the Battery Surf Bench admin menu (or the Start Benchmark shortcut in the admin bar), and start a benchmark from the cockpit.

== Frequently Asked Questions ==

= Do I need my own WordPress site? =

No. Open the plugin in WordPress Playground (see Installation) and it runs on a fresh WordPress site inside your browser, with nothing to host or install. It works on your own site too.

= Who can run a benchmark? =

Only users with the plugin's operator capability. The cockpit, the simulated surf pages and all recorded sessions are gated behind that capability; anonymous and unauthorised users cannot reach them.

= Which browsers are supported? =

Battery measurement relies on the Battery Status API, currently available in Chromium-based browsers (Chrome, Edge, Opera and others) on battery-powered devices. The cockpit detects support up front and blocks the run with a clear warning, instead of reporting a fabricated rate, if the browser cannot provide battery readings.

= Can I benchmark my own pages instead of the bundled ones? =

Yes. The settings screen lets you compose the surf course from your own posts and pages alongside (or instead of) the bundled ones, and reorder the sequence freely. Pages that are later trashed or unpublished drop out of the rotation automatically without breaking your saved configuration.

= Does the plugin contact external servers or track users? =

The plugin itself sends no telemetry, analytics or phone-home requests. Its one outside contact is YouTube, for the video on the bundled course's video page: during a run, your site fetches that video's embed code from YouTube, and the operator's browser loads YouTube's player. The External services section of the description lists what is sent and when, with links to YouTube's terms and privacy policy.

= Why is there a YouTube video in the surf course? =

Because real-world browsing includes video, and video is one of the heaviest things a browser asks of a battery; leaving it out would understate the drain. The video plays the same way WordPress plays any embedded video: it never autoplays, it stays muted, and the surfer decides when to watch and when to move on. It is only ever shown to the operator running a benchmark, and a YouTube embed on your own selected surf pages behaves the same way during a run.

== Screenshots ==

1. The cockpit mid-run: the surfer reads its way through a bundled article while the cockpit's header tracks the battery, both drain rates and the projected full-battery runtime.
2. A finished run's postcard, reopened from the Sessions screen: the measured drain staircase against the projected full discharge, with the run's key figures.
3. Setting up a run: a fixed duration or a target drop, a ready-made surfer personality or your own mix, and the playback speed.
4. The Sessions screen keeps every run, with its status, battery span, drain rates and projected full-battery runtime.
5. The settings screen: choose the pages the surfer visits from the five bundled pages and your own posts and pages, and put them in order.

== Changelog ==

= 1.0.0 =
* Initial release.
