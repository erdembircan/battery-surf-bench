<div align="center">

<img src="assets/images/icon.svg" width="300" alt="Battery Surf Bench icon" />

# Battery Surf Bench

**Find out how fast web surfing really drains your battery — with a benchmark that browses like a human, not a script.**

[![Master CI](https://github.com/erdembircan/battery-surf-bench/actions/workflows/merge-checks.yml/badge.svg)](https://github.com/erdembircan/battery-surf-bench/actions/workflows/merge-checks.yml)
[![License: GPLv2 or later](https://img.shields.io/badge/license-GPLv2--or--later-blue.svg)](LICENSE)

</div>

---

Battery Surf Bench is a WordPress plugin that measures your device's real-world battery drain by unleashing a simulated web surfer on your own site. Instead of an idle loop or a synthetic stress test, it drives a research-derived browsing session — reading articles, lingering on images, watching video, scrolling, fidgeting, moving on — while sampling your battery the whole time, then projects an honest drain rate from what it actually measured.

No lab hardware. No external services. Just your browser, your battery, and a surfer that never gets tired.

## ✨ Highlights

- **A surfer, not a script.** The simulated visitor decides what to do next through a live auction of competing behaviors — reading, watching, scrolling, glancing back, fidgeting — shaped by its personality and by what the current page actually offers. No two runs play out the same.
- **A live cockpit.** Watch the whole run unfold from a dedicated dashboard: current battery, drain rate, time-to-empty, and the surfer itself browsing in a live viewport.
- **Honest math.** Drain rates come from least-squares regression over the sampled battery curve — not a naive start-minus-end guess — with charging time excluded and no number reported before the data can support one.
- **Every run remembered.** Each benchmark is saved as a session you can browse, reopen, and compare, complete with its full sample log and a beautiful postcard-style summary.
- **Yours to shape.** Surf the bundled course or point the surfer at your own posts and pages, tune its personality, pick a duration or a battery-drop target, and set the pace.

## 🏄 A benchmark that browses like a person

The surfer's behavior profile is tuned from published battery-benchmark methodologies and real-user browsing telemetry — and it shows:

- **It reads.** Genuine reading pauses on text-dense pages, with occasional scroll-backs to re-read something it passed.
- **It watches.** Video pages get real watch time through the actual embedded player — started, watched, and paused by the surfer itself.
- **It admires.** Content images earn a lingering dwell, cursor and all.
- **It fidgets.** Idle cursor drift, micro-scrolls, even the occasional absent-minded text selection.
- **It gets bored.** Leaving a page is a decision the surfer makes, not a timer expiring.

### Six personalities, or build your own

Pick a ready-made surfer class — **Scholar**, **Binge-Watcher**, **Doomscroller**, **Skimmer**, **Jitterbug**, or **Balanced** — or open the customizer and spend a 25-point budget across five stats (Tempo, Endurance, Literacy, Allure, Fidget) to sculpt exactly the visitor you want to simulate.

### A course worth surfing

Five bundled pages give the surfer a balanced, realistic workload out of the box: a long-form article, an image gallery, a skimmable listicle, a video feature, and a link hub — all rendered through your real theme, exactly as a visitor would see them. Prefer your own content? The settings screen lets you build a custom course from any of your site's posts and pages, reorder it freely, and mix in the bundled pages wherever you like.

## 🎛️ The Cockpit

Every run happens in the Cockpit — a purpose-built dashboard that stays out of the data's way:

- **Two run modes:** benchmark for a fixed **duration** (5 minutes to 4 hours) or until the battery drops a chosen number of **percentage points**.
- **Three speeds:** run at true-to-life 1×, or compress time at 4× or 10× for demos and quick checks.
- **Live readouts:** battery level, 10-minute drain rate, whole-session drain rate, and projected time-to-empty — updating as the samples come in.
- **A watchable run:** the surfer browses inside a live viewport, with playful caption "barks" narrating what it's up to ("Deep in the good words…", "Ooh, moving pictures!").
- **Run protection built in:** a screen wake-lock keeps the display from sleeping mid-run, a leave-confirmation guard saves you from an accidental tab close, and a finish chime (mutable, and it remembers your choice) announces when the run completes on its own.
- **Charger-aware:** a benchmark won't start while you're plugged in, pauses automatically if the charger connects mid-run, and resumes when you unplug — with the plugged-in time excluded from the math.

## 📈 Numbers you can trust

- **Regression, not guesswork.** Battery level is sampled continuously and fitted with least-squares regression, reported as both a responsive 10-minute rate and a stable full-session rate.
- **No premature verdicts.** The plugin waits for enough distinct battery steps before quoting a rate — it would rather say "calibrating" than make something up.
- **Clear projections.** Time-to-empty is projected live and drawn on the summary chart: the measured drain staircase against a dashed full-discharge projection.
- **The postcard.** Every finished run flips over a franked, stamped summary postcard: the verdict, the drain chart, and stat tiles for elapsed time, battery start→end, points dropped, both drain rates, and time-to-empty.

## 🗂️ A session log that keeps score

Every run — finished, stopped early, or interrupted — is stored as a benchmark session:

- **Sessions screen:** a sortable grid of every past run with status, mode, browser, battery span, drain rates, and duration.
- **Session detail:** reopen any session to its full postcard summary, rebuilt from the stored samples.
- **Portable data:** each session keeps the browser and OS it ran on, the exact run configuration, and the complete sample log — available over the site's own REST API for your own analysis.
- **One-click start:** launch a fresh benchmark straight from the admin bar, anywhere in wp-admin.

## 🔒 Private by design

- **Operator-only, everywhere.** The cockpit, the surf pages, the sessions, the settings — all gated behind a dedicated capability. Public visitors can't reach any of it.
- **No footprint.** Course pages are served as ephemeral, in-memory pages — nothing is written to your database and nothing new appears on your site.
- **No telemetry.** All sampling and math happen locally in your browser; the only network traffic is your session saving to your own site.
- **Self-healing configuration.** If a page you added to the course is later removed or unpublished, it quietly drops out of the rotation instead of breaking the run.

## 🌍 Speaks your language

Fully translation-ready, with German, Spanish, French, Brazilian Portuguese, and Turkish shipped out of the box.

## 🚀 Getting started

1. Install the plugin and activate it.
2. Unplug your laptop.
3. Open **Battery Surf Bench** in wp-admin (or hit **Start Benchmark** in the admin bar).
4. Pick a surfer, pick a mode, and press start.

> **Heads-up:** battery measurement relies on the Battery Status API, currently available in Chromium-based browsers (Chrome, Edge, Opera…) on a battery-powered device. The cockpit checks for it up front and tells you plainly if your browser can't provide readings — no fake numbers, ever.

**Requirements:** WordPress 7.0+, PHP 8.1+, a Chromium-based browser, and a device with a battery.

## 🦈 One more thing

The Cockpit has at least one secret. Old-school gamers will find it. ↑ ↑ ↓ ↓ …

## 📄 License

[GPLv2 or later](LICENSE).
