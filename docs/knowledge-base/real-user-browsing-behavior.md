# Real-user browsing behavior

Empirical statistics on how real people read, scroll, and dwell on web pages. These figures
calibrate the simulated surfer so its behavior matches real users rather than an artificial
loop. Pairs with [benchmark-methodologies.md](benchmark-methodologies.md) (the lab side) and
feeds [surf-behavior-profile.md](surf-behavior-profile.md) (the concrete parameters).

Originally compiled 2026-06-12.

| Stat | Value | Source |
|---|---|---|
| Avg time on page | **~47 s** cross-industry (2023; down from ~2.5 min in 2004); B2B 97 s high, grocery 44 s low | Contentsquare — https://contentsquare.com/blog/average-time-spent-on-websites-is-dropping/ |
| Time-on-page model | 25 s fixed overhead + 4.4 s per 100 words; avg 593-word page ≈ 49 s | NNG 2008, 45,237 pageviews — https://www.nngroup.com/articles/how-little-do-users-read/ |
| Words actually read | **20–28%** of page words; short pages (≤111 words) ~50% | same NNG study |
| Bounce-speed | 55% of visits last **<15 s** | Chartbeat (2B visits) — https://time.com/12933/what-you-think-you-know-about-the-web-is-wrong/ |
| Avg scroll depth | **~50%** of page (desktop 50.5%, mobile 45.2%); was 54% in 2022 | Contentsquare DXB, 99B sessions — https://contentsquare.com/guides/digital-experience-benchmark/engagement/ |
| Attention by position | 57% of viewing time above the fold; 74% in first two screenfuls; 81% in first three | NNG 2018 eye-tracking, 57,453 fixations — https://www.nngroup.com/articles/scrolling-and-attention/ |
| Paragraph decay | P1 viewed by 81% of users → P2 71% → P3 63% → P4 32% | NNG — https://www.nngroup.com/articles/website-reading/ |
| Reading style | **79% scan, 16% read word-by-word**; F-pattern: two horizontal sweeps then vertical left-edge scan; layer-cake (headings-first) most effective | NNG — https://www.nngroup.com/articles/how-users-read-on-the-web/, https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content-discovered/, https://www.nngroup.com/articles/text-scanning-patterns-eyetracking/ |
| Session duration | median ~2 min 38 s (GA4); desktop 4 min 46 s vs mobile 2 min 20 s | Databox — https://databox.com/average-session-duration-benchmark; Contentsquare 2026 |
| Pages per session | **4.6 avg** (desktop 4.9, mobile 4.4); ~49% single-page sessions; organic 5.8 / social 3.2 | Contentsquare 2023; https://focus-digital.co/average-pages-per-session-industry-benchmarks/ |
| Video share | ~82% of internet *traffic* (bytes) is video; **~100 min/day** per person watching online video (~17 h/week); YouTube ~49 min/day | https://www.demandsage.com/video-marketing-statistics/ (Cisco-derived) |
| Reading mechanics | fixations ~250 ms; saccades 7–9 letters; 15–25% regressions; adult avg **238 WPM** | https://pmc.ncbi.nlm.nih.gov/articles/PMC4089416/ |
| Scroll speed (px/s) | **No published empirical figure.** Closest: eyeScrollR (2024) uses 125 px/notch wheel; informal tooling estimates 300–500 px/s casual, 700–1,000+ px/s flick | https://pmc.ncbi.nlm.nih.gov/articles/PMC11133154/ |

## Caveats
- The "88% more time on pages with video" claim has an untraceable source chain — don't rely on it.
- Vendor data (Contentsquare, Chartbeat) reflects their client base, not a random web sample.
