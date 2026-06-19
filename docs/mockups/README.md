# Cockpit deck — design mockups

Standalone, throwaway HTML explorations of the front-end cockpit. They are
**experiments**, not production code: open any file directly in a browser (no
build step). `surfer.svg` is the brand mark some of them mask.

Kept here so the explorations are not lost; safe to delete once a design is
settled. New significant style decisions are mocked here first — see the
mockup-first workflow in the repo `CLAUDE.md`.

## Whole-deck palette/type directions

| File              | Direction                          |
| ----------------- | ---------------------------------- |
| `1-coastal.html`  | Coastal Daybreak — light           |
| `2-citrus.html`   | Citrus Pop — light / warm          |
| `3-dusk.html`     | Dusk Lineup — refined dark ocean   |

The shipped deck draws from **Coastal Daybreak** (light) and **Dusk Lineup**
(dark), selectable via a light/dark toggle.

## Component studies

| File                   | Component                                        |
| ---------------------- | ------------------------------------------------ |
| `target-control.html`  | Target-drop battery slider (the battery *is* the slider; drag/keys set the stop-at %, green→red) |
