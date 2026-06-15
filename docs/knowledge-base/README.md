# Knowledge base

Reference material informing the design and implementation of Battery Surf Bench — how the
industry measures battery life via web surfing, how real users actually browse, and how those
findings translate into the plugin's surfer behavior and drain-rate math. This is background
research; consult it when making decisions about how the tool should behave.

Salvaged from the deprecated prototype (`battery-surf-bench_dep`), originally compiled 2026-06-12.

- [benchmark-methodologies.md](benchmark-methodologies.md) — published battery/browser benchmark methods (Apple, Chromium, Notebookcheck, Laptop Mag, BAPCo, UL, …) and cross-benchmark patterns.
- [real-user-browsing-behavior.md](real-user-browsing-behavior.md) — empirical stats on real-user dwell, scroll depth, reading patterns, sessions, video.
- [drain-rate-calculation.md](drain-rate-calculation.md) — Battery Status API sampling, least-squares drain rate, projections, run modes, and measurement guards.
- [surf-behavior-profile.md](surf-behavior-profile.md) — how the research distills into concrete per-page surfer parameters.
