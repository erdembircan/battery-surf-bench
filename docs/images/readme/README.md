# README artwork

Images that only the repository's `README.md` shows. Nothing here ships in the plugin.

## Launch button

`launch-button.svg` is the README's button that opens the plugin in WordPress Playground. It is 520 × 88: a teal `#1c7e96` bar with a `#145d70` drop edge, a sun `#ffce5c` arrow tile with a navy `#1f3a5f` arrow, and two lines of text outlined into paths, because GitHub shows a README's SVG as an image, where web fonts don't load.

| Line | Text | Font | Size | Letter spacing | Color | Position |
| --- | --- | --- | --- | --- | --- | --- |
| Title | LAUNCH THE BENCH | Anton 400, `node_modules/@fontsource/anton/files/anton-latin-400-normal.woff` | 30px | 0.9px | `#ffffff` | x 28, baseline y 43 |
| Subline | Runs in WordPress Playground, right in your browser | Hanken Grotesk 600, `node_modules/@fontsource/hanken-grotesk/files/hanken-grotesk-latin-600-normal.woff` | 13px | none | `#e7f6ff` | x 28, baseline y 64 |

To change the wording, unpack each WOFF to TrueType, outline the new text with HarfBuzz (`hb-view --output-format=svg --margin=0 --font-size=<size> <font.ttf> "<text>"`, from `brew install harfbuzz`), place each glyph's path at the positions in this table, adding the letter spacing after every title glyph, and round the coordinates to two decimals. The design exploration is on the canvas listed in `docs/mockups/README.md`.
