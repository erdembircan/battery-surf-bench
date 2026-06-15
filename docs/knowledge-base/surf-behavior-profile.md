# Surf behavior profile — research-derived parameters

How the published benchmark methodologies ([benchmark-methodologies.md](benchmark-methodologies.md))
and real-user statistics ([real-user-browsing-behavior.md](real-user-browsing-behavior.md)) are
distilled into the concrete numbers that drive the simulated surfer. The drain these parameters
produce is measured per [drain-rate-calculation.md](drain-rate-calculation.md).

All durations are at speed ×1 (measurement mode). A runtime demo-speed multiplier divides
dwell/pause durations for demoing without waiting; ×1 is the only valid measurement mode.

## Derivation rationale
- **Article dwell 45–75 s** straddles the real-user ~47 s median and Chromium's 60 s/page.
- **Scroll bursts 500–700 px** ≈ Chromium's 600 px convention and one physical wheel flick; gaps
  of several seconds on reading pages approximate the 600 px / 10 s endurance cadence, faster on
  gallery/feed pages per Telemetry's gallery stories (~800 px / 1–2 s).
- **Scroll-depth targets** centered near ~50–60% with only some pages reaching bottom
  (Contentsquare ~50% average depth).
- **Reading pauses 8–20 s** after a few bursts (NNG above-the-fold attention clustering);
  occasional scroll-ups model regression behavior (~30% of pages).
- **Video page 60–90 s** per loop. With a 5-page course this is ~25–30% of loop time —
  intentionally heavier than Chromium's 10% because video is a headline feature of this demo; a
  "lean video" profile variant can drop it to one shorter watch.
- **1–3 s settle** after page load before the first scroll (Telemetry convention), implemented as
  the first burst gap.

## Per-page behavior parameters
Each course page type has a behavior profile. Ranges are sampled uniformly per event (jitter).

| Page | Dwell (s) | Scroll depth | Burst (px) | Burst gap (s) | Reading-pause chance | Reading pause (s) | Scroll-up chance | Notes |
|---|---|---|---|---|---|---|---|---|
| `article-1` | 45–75 | 0.55–0.90 | 500–700 | 2–6 | 0.35 | 8–20 | 0.15 | Long-form read |
| `gallery` | 30–50 | 0.80–1.00 | 600–900 | 1–2.5 | 0.25 | 1.5–4 | 0.08 | imgur-style: ~800 px/image |
| `article-2` | 25–45 | 0.40–0.70 | 500–700 | 1.5–5 | 0.30 | 6–15 | 0.15 | Skim/scan (F-pattern) |
| `video` | 60–90 | 0.10–0.30 | 300–500 | 3–8 | 0.10 | 5–12 | 0.30 | One watch/loop; heavier by design |
| `links` | 12–25 | 0.30–0.60 | 500–700 | 1.5–3.5 | 0.20 | 1.2–3.5 | 0.08 | Headline scan, fast steps |
| `blank` | 300 (fixed) | 0 | 0 | 0 | 0 | 0 | 0 | Baseline-calibration idle page |

**Course order:** `article-1 → gallery → article-2 → video → links → article-1 → …` (infinite loop).

## Parameter definitions
- **Dwell** — total time on the page; after scrolling completes, the surfer idles out the remainder.
- **Scroll depth** — fraction of scrollable height (0–1) the surfer aims to reach.
- **Burst** — pixels per scroll burst (wheel-flick sized), eased over ~150–300 ms.
- **Burst gap** — pause between scroll bursts.
- **Reading-pause chance** — probability a burst gap becomes a longer "reading pause."
- **Reading pause** — length of such a pause.
- **Scroll-up chance** — probability of a brief re-read scroll-up after a reading pause.
