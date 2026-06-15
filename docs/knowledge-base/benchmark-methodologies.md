# Battery benchmark methodologies

Reference survey of how the industry measures laptop/browser battery life by simulating
web surfing. These published methodologies are the evidence base for the surfer behavior
parameters and reporting conventions used by Battery Surf Bench. See
[surf-behavior-profile.md](surf-behavior-profile.md) for how they map to concrete numbers
and [drain-rate-calculation.md](drain-rate-calculation.md) for the measurement math.

Originally compiled 2026-06-12.

## Apple "Wireless Web" test
- **Page mix:** "wirelessly browsing 25 popular websites" over Wi-Fi — site list undisclosed (https://support.apple.com/en-us/122209, https://support.apple.com/en-us/111901)
- **Dwell / scroll / video:** none disclosed. Apple publishes only: 25 sites, Wi-Fi, keyboard backlight off.
- **Brightness:** "8 clicks from bottom" on M-series Macs (older models: 12 clicks, or 75% for video tests). No nit value published; reviewers estimate ~100–120 nits, which is why third-party tests at 150 nits consistently come in below Apple's numbers.
- **Reporting:** rundown to empty, "up to X hours."

## Chromium OS `power_LoadTest` (most transparent public spec)
Source: https://chromium.googlesource.com/chromiumos/third_party/autotest/+/refs/heads/master/client/site_tests/power_LoadTest/README.md and `.../extension/urls.js`
- **Loop structure:** 1-hour iterations repeated until battery <~3%. Each hour = 60% browsing / 20% email (Gmail + background audio) / 10% docs (Google Docs) / 10% video.
- **Browsing segment:** new site every **60 s** (30 s load timeout), 36 sites/hour drawn from a 50-URL list (Google, YouTube, Facebook, Amazon, Wikipedia, Reddit, CNN, NYT, GitHub, IMDb, Pinterest, Weather.com, etc.). 5 static background tabs open throughout.
- **Scroll pattern:** **600 px down every 10 s**, then scrolled back up at the same rate.
- **Video share:** 6 min/hour (10%) of full-screen 720p YouTube. Speakers at 10% volume.
- **Brightness:** platform default on battery, or 40% fallback; reset each loop.
- **Reporting:** `minutes_battery_life`, plus per-loop average power.

## Chromium Telemetry `system_health` / `power.desktop` browsing stories
Source: https://source.chromium.org/chromium/chromium/src/+/main:tools/perf/page_sets/system_health/browsing_stories.py — short regression traces (seconds–2 min), CPU-time as power proxy, not endurance:
- News (CNN/NYT/Reddit): visit 2–4 article items per story
- Infinite scroll feeds: Twitter 25,000 px total, Tumblr 20,000 px, Flickr 10,000 px, Discourse 25,000 px in 1,000 px steps
- Galleries: imgur 15 × 800 px scroll iterations, ~1 s per image
- Video: YouTube 8 clips × 3 s (mobile) / 5 s (desktop); TikTok swipes with 1 s between videos
- Scroll speeds across stories: **400–1,000 px/s**; 1–5 s wait before interacting

## Notebookcheck WiFi websurfing v1.3
Source: https://www.notebookcheck.net/How-does-Notebookcheck-test-laptops-and-smartphones-A-behind-the-scenes-look-into-our-review-process.15394.0.html
- HTML5/JS script, pages change every **30 s**; site list and scroll behavior undisclosed; no video in the surf test (separate 1080p H.264 loop test exists)
- Brightness adjusted to **~150 cd/m²**; balanced power profile
- Reporting: h:min runtime; min/max/Wi-Fi/video runtimes reported separately

## Laptop Mag Battery Test 2.0 (current since ~2018)
Sources: https://www.laptopmag.com/articles/how-we-review, https://www.laptopmag.com/articles/laptop-testing-changes-2018
- **Page mix:** ~12 custom pages scraped and served from a local lab server: static text/graphics pages, streaming video pages, WebGL animation (fish-tank demo)
- **Dwell:** 2–3 min on active (video/WebGL) pages, shorter on static
- **Brightness:** 150 nits (colorimeter-calibrated); Bluetooth/GPS/background apps off
- Legacy v1 (deprecated): 50–60 live sites × 30 s each at 100 nits
- Reporting: total runtime until depletion

## Tom's Guide
Source: https://www.tomsguide.com/computing/how-we-test-laptops-tablets-pcs — continuous surfing through a fixed page set on a closed Wi-Fi network in Edge, **150 nits**, run ≥2×; page list/dwell undisclosed; reports runtime.

## PCWorld
Source: https://www.pcworld.com/article/2236466/how-we-test-laptops-pcworld.html — **abandoned web surfing** as primary test; now loops 4K *Tears of Steel* at 250–260 nits, Wi-Fi/BT off. Old surf test ran at ~155 nits.

## BAPCo MobileMark
- MobileMark 2018 had a standalone Web Browsing scenario: unmodified retail Chrome, scripted navigation through e-commerce/news/social/entertainment pages with scroll actions + video playback; exact dwell times and site list proprietary (whitepaper: https://bapco.com/wp-content/uploads/2019/10/MobileMark_2018_White_Paper_v1.1.pdf)
- **MobileMark 30 (2024) dropped the web browsing scenario** entirely — now Office + Photoshop only (https://bapco.com/mobilemark-30/)
- Reporting: battery life in minutes + a performance rating (baseline 100).

## UL Procyon Battery Life
Source: https://support.benchmarks.ul.com/support/solutions/articles/44002347112 — **no web browsing scenario**. Only Video Playback, Idle, and Office Productivity; reports minutes per scenario. (PCMark 10 has a web *performance* workload — locally served social/shopping/map/video/static page archetypes — but it is not an endurance test.)

## Cross-benchmark patterns
30 s/page is the legacy reviewer default (Notebookcheck, old Laptop Mag); 60 s/page is the Chromium endurance default; video is included by most at ~10% of loop time; 150 nits is the de-facto reviewer brightness; results are reported as minutes-to-empty.
