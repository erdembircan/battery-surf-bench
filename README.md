<div align="center">

<img src="assets/images/icon.svg" width="300" alt="Battery Surf Bench icon" />

# Battery Surf Bench

**Find out how fast web surfing really drains your battery, with a benchmark that browses like a human instead of a script.**

[![Master CI](https://github.com/erdembircan/battery-surf-bench/actions/workflows/merge-checks.yml/badge.svg)](https://github.com/erdembircan/battery-surf-bench/actions/workflows/merge-checks.yml)
[![License: GPLv2 or later](https://img.shields.io/badge/license-GPLv2--or--later-blue.svg)](LICENSE)

</div>

---

Battery Surf Bench is a WordPress plugin that measures your device's real-world battery drain. It unleashes a simulated web surfer on a course of content pages, samples your battery for the whole run, and projects an honest drain rate from what it actually measured.

No lab hardware and no server of your own: just your browser, your battery, and a surfer that never gets tired.

> [!NOTE]
> **An experiment in browser-native software.** Battery Surf Bench is built to run in [WordPress Playground](https://playground.wordpress.net/), which runs a whole WordPress site, server and database included, inside your browser. It's our test of whether desktop-grade applications can be delivered as nothing more than a link. [Here's the idea.](#made-for-wordpress-playground)

## See it in action

[![Watch the 60-second Battery Surf Bench tour on YouTube](https://img.youtube.com/vi/X8CwzH_P4-g/maxresdefault.jpg)](https://youtu.be/X8CwzH_P4-g)

A one-minute tour: the surfer at work, the live cockpit, and the postcard every run ends with. [Watch it on YouTube](https://youtu.be/X8CwzH_P4-g).

## Made for WordPress Playground

[WordPress Playground](https://playground.wordpress.net/) is the WordPress project's way of running a complete WordPress site in a browser tab: PHP compiled to WebAssembly, with the database kept in the browser too. Battery Surf Bench is built to be used there. One link starts a fresh site with the plugin installed and its cockpit open, with no server to rent, nothing to install and no account to create.

**[Open Battery Surf Bench in WordPress Playground](https://playground.wordpress.net/?plugin=battery-surf-bench&url=/wp-admin/admin.php?page=bsbench-start-benchmark)**

The link installs the plugin from the WordPress.org plugin directory, so it works once the plugin is listed there.

### Why Playground

- **Anyone with a laptop can run it.** A battery benchmark shouldn't require running a WordPress site first. Playground takes the site off the list of requirements.
- **The test lives on the device it tests.** The benchmark measures the device in front of you, so the whole thing, site included, runs on that device.
- **Every run starts clean.** Each Playground is the same fresh WordPress, which keeps results comparable across laptops and browsers, and keeps benchmarking away from any real site you run.
- **Your results stay with you.** The site, its database and every recorded session live in your browser. No server of ours is involved, because there isn't one.

### An experiment in browser-native software

Battery Surf Bench is also an experiment. Software that needs a server usually needs someone to host it, and software that doesn't usually has to stay small. We wanted to find out whether a desktop-grade application, with live dashboards, real-time charts, settings and a database of results, can skip that trade-off. WordPress provides the application platform, Playground handles everything a server and a database would, and you open a link and use the app. A demanding, real-time tool like a battery benchmark is a good test of the idea.

### Good to know

- **Saving.** Playground autosaves your recent sites in the browser. To keep a site and its sessions for good, use Playground's **Save in browser storage**, and export the site as a ZIP if you want a backup.
- **Comparing results.** In Playground the page server runs on your device too, so a run also counts the work of serving each page. Compare Playground runs with other Playground runs.
- **Your own site works too.** The plugin installs on any WordPress 7.0+ site like any other plugin.

## Highlights

- **A surfer, not a script.** The simulated visitor makes its own decisions as it browses. No two runs play out the same.
- **A live cockpit.** A dedicated dashboard shows the whole run as it happens: battery readouts, projections, and the surfer itself browsing in a live viewport.
- **Honest math.** Drain rates come from regression over the sampled battery curve, and no number is reported before the data can support one.
- **Every run remembered.** Each benchmark is saved as a session you can browse, reopen, and compare.
- **Yours to shape.** Choose the workload, the surfer's personality, the run mode, and the pace.

## A benchmark that browses like a person

The surfer is not a scripted macro. At every moment, its possible behaviors compete for its attention, weighted by its personality and by what the current page actually offers, and the winner plays out. The behavior profile is tuned from published battery-benchmark methodologies and real-user browsing telemetry, and it shows:

- **It reads.** Genuine reading pauses on text-dense pages, with occasional scroll-backs to re-read something it passed.
- **It watches.** Video pages get real watch time through the actual embedded player, started, watched, and paused by the surfer itself.
- **It admires.** Content images earn a lingering dwell, cursor and all.
- **It fidgets.** Idle cursor drift, micro-scrolls, even the occasional absent-minded text selection.
- **It gets bored.** Leaving a page is a decision the surfer makes, not a timer expiring.

### Pick a personality, or build your own

Ready-made surfer personalities cover the spectrum, from a patient, text-hungry scholar to a restless doomscroller. Want something more specific? Open the customizer and shape your own visitor against a fixed budget: how briskly it moves, how long it stays put, how strongly text pulls at it, how strongly images and video do, and how twitchy it gets when idle.

### A course worth surfing

Five bundled pages give the surfer a balanced, realistic workload out of the box: a long-form article, an image gallery, a skimmable listicle, a video feature, and a link hub. Each carries its own self-contained design, so the workload stays consistent no matter which theme the site runs. Prefer your own content? The settings screen lets you build a custom course from any of your site's posts and pages (those render through your theme, exactly as visitors see them), reorder it freely, and mix in the bundled pages wherever you like.

## The Cockpit

Every run happens in the Cockpit, a purpose-built dashboard that stays out of the data's way:

- **Two run modes:** benchmark for a fixed **duration** (5 minutes to 4 hours), or until the battery drops a chosen number of **percentage points**.
- **Three speeds:** run at true-to-life 1×, or compress time at 4× or 10× for demos and quick checks.
- **Live readouts:** battery level, a responsive 10-minute drain rate, a stable whole-session rate, and projected time-to-empty, all updating as the samples come in.
- **A watchable run:** the surfer browses inside a live viewport, with playful caption "barks" narrating what it's up to ("Deep in the good words…", "Ooh, moving pictures!").
- **Run protection built in:** a screen wake-lock keeps the display from sleeping mid-run, a leave-confirmation guard saves you from an accidental tab close, and a finish chime announces a run that completes on its own (mutable, and it remembers your choice).
- **Charger-aware:** a benchmark won't start while you're plugged in. If the charger connects mid-run, the run pauses automatically and resumes when you unplug, with the plugged-in time excluded from the math.

## Numbers you can trust

- **Regression, not guesswork.** Battery level is sampled continuously and fitted with least-squares regression, so a brief plateau or a noisy reading doesn't skew the verdict.
- **No premature verdicts.** The plugin waits for enough distinct battery steps before quoting a rate. It would rather say "calibrating" than make something up.
- **Clear projections.** Time-to-empty is projected live and drawn on the summary chart: the measured drain staircase against a dashed full-discharge projection.
- **The postcard.** Every finished run flips over a franked, stamped summary postcard with the verdict, the drain chart, and stat tiles for elapsed time, battery levels at start and end, points dropped, both drain rates, and time-to-empty.

## A session log that keeps score

Every run, whether it finished, was stopped early, or got interrupted, is stored as a benchmark session:

- **Sessions screen:** a sortable grid of every past run with status, mode, browser, battery span, drain rates, and duration.
- **Session detail:** reopen any session to its full postcard summary, rebuilt from the stored samples.
- **Portable data:** each session keeps the browser and OS it ran on, the exact run configuration, and the complete sample log, all available over the site's own REST API for your own analysis.
- **One-click start:** launch a fresh benchmark straight from the admin bar, anywhere in wp-admin.

## Private by design

- **Operator-only, everywhere.** The cockpit, the surf pages, the sessions, the settings: all gated behind a dedicated capability. Public visitors can't reach any of it.
- **No footprint.** Course pages are served as ephemeral, in-memory pages. Nothing is written to your database and nothing new appears on your site.
- **No telemetry.** All sampling and math happen locally in your browser, and sessions save only to your own site. The one outside contact is YouTube, which serves the video on the bundled course's video page.
- **Self-healing configuration.** If a page you added to the course is later removed or unpublished, it quietly drops out of the rotation instead of breaking the run.

## Speaks your language

Fully translation-ready, with German, Spanish, French, Brazilian Portuguese, and Turkish shipped out of the box.

## Getting started

**In WordPress Playground** (the intended way):

1. Open [Battery Surf Bench in WordPress Playground](https://playground.wordpress.net/?plugin=battery-surf-bench&url=/wp-admin/admin.php?page=bsbench-start-benchmark). The cockpit opens on a fresh site.
2. Unplug your laptop.
3. Pick a surfer, pick a mode, and press start.

**On your own WordPress site:**

1. Install the plugin and activate it.
2. Unplug your laptop.
3. Open **Battery Surf Bench** in wp-admin (or hit **Start Benchmark** in the admin bar).
4. Pick a surfer, pick a mode, and press start.

> **Heads-up:** battery measurement relies on the Battery Status API, currently available in Chromium-based browsers (Chrome, Edge, Opera…) on a battery-powered device. The cockpit checks for it up front and tells you plainly if your browser can't provide readings. No fake numbers, ever.

**Requirements:** a Chromium-based browser and a device with a battery. On your own site, also WordPress 7.0+ and PHP 8.1+.

## One more thing

The Cockpit keeps at least one secret. Old-school gamers will feel right at home.

## License

[GPLv2 or later](LICENSE).
