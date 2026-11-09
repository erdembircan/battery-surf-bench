# WordPress.org directory art

The editable sources for the plugin's WordPress.org listing artwork. The exported PNGs live in `.wordpress-org/` at the repository root. Once releases are automated, the deploy action copies that folder into the plugin's SVN `assets/` directory.

| Source | Exports | Pixels |
| --- | --- | --- |
| `icon.svg` | `.wordpress-org/icon-128x128.png`, `.wordpress-org/icon-256x256.png` | 128 × 128, 256 × 256 |
| `banner.svg` | `.wordpress-org/banner-772x250.png`, `.wordpress-org/banner-1544x500.png` | 772 × 250, 1544 × 500 |

## Re-exporting

Edit the SVGs here, never the PNGs, then regenerate all four files with `rsvg-convert` (`brew install librsvg` on macOS):

```bash
rsvg-convert -w 128 -h 128 docs/images/wordpress-org/icon.svg -o .wordpress-org/icon-128x128.png
rsvg-convert -w 256 -h 256 docs/images/wordpress-org/icon.svg -o .wordpress-org/icon-256x256.png
rsvg-convert -w 772 -h 250 docs/images/wordpress-org/banner.svg -o .wordpress-org/banner-772x250.png
rsvg-convert -w 1544 -h 500 docs/images/wordpress-org/banner.svg -o .wordpress-org/banner-1544x500.png
```

## Banner text

The banner carries the plugin's name and tagline in the sky at the top left. WordPress.org prints the name below the banner as well; most of the directory's most-installed plugins repeat it in their banners anyway. The two lines are the `#wordmark` group at the end of `banner.svg`, outlined into paths rather than kept as `<text>`, because `rsvg-convert` can't load the repo's web fonts and would export live text in a fallback face.

| Line | Text | Font | Size | Letter spacing | Position |
| --- | --- | --- | --- | --- | --- |
| `#name` | BATTERY SURF BENCH | Anton 400, `node_modules/@fontsource/anton/files/anton-latin-400-normal.woff` | 92px | 1px | x 96, baseline y 133 |
| `#tagline` | The battery benchmark that browses like a human. | Hanken Grotesk 700, `node_modules/@fontsource/hanken-grotesk/files/hanken-grotesk-latin-700-normal.woff` | 28px | none | x 96, baseline y 179 |

Both lines are navy `#1f3a5f`, in banner pixels (1544 × 500). To change the wording, outline the new text from the same font files at these settings and replace that line's path, then re-export both banner PNGs. Shape it with HarfBuzz (`hb-shape`, from `brew install harfbuzz`), as browsers do, so the kerning matches; `hb-shape` reads TrueType, so unpack the WOFF first. The name's letter spacing goes after every glyph.

## Screenshots

`.wordpress-org/screenshot-1.png` to `screenshot-5.png` are the listing's screenshots. WordPress.org shows them in number order, each captioned by the matching line of the numbered list under `== Screenshots ==` in `readme.txt`, so the files and the list change together.

| File | Shows |
| --- | --- |
| `screenshot-1.png` | The cockpit mid-run, with the surfer on the bundled long-form article |
| `screenshot-2.png` | A finished session's summary postcard on its admin screen |
| `screenshot-3.png` | The cockpit's run setup, before a run starts |
| `screenshot-4.png` | The Sessions screen |
| `screenshot-5.png` | The settings screen's test page sequence |

They are captured from the running plugin and never edited by hand. To retake all five, for example after a UI change:

```bash
pnpm screenshots
```

The command builds the plugin, boots a throwaway WordPress Playground in the `production` environment type (so the dev-tools panel stays off), stages the site, and overwrites the five files at 1440 × 900 CSS pixels, twice that in device pixels. The three admin screens are captured in a larger window and cropped to the plugin's own screen, leaving out WordPress's admin menu and toolbar. It takes 15 to 30 minutes, almost all of it the live run in `screenshot-1.png`: the cockpit computes its drain rates from real elapsed time, so the capture waits for three real 1 % battery steps and then for the surfer to scroll the article's chart into view. The capture scripts are in `tests/screenshots/`.

What the screenshots show is staged the way the listing video was:

- **Battery.** A scripted stand-in for the Battery Status API starts at 87 % and steps down 1 % roughly every 3¾ minutes, about 16 % an hour. The cockpit's own loop and math compute every readout on screen.
- **Sessions.** The Sessions screen and the postcard show five sessions built by running simulated discharge curves through the cockpit's own run model, then saved through the plugin's REST endpoint, the way a finished run saves itself.
- **Site.** The Playground site is named "Coastline Tech Notes", with an About page and one demo post, which the settings screen adds to the course. The admin account has WordPress's "Show Toolbar when viewing site" preference turned off, so the surfed pages show no toolbar.

## Rules

- **Exact names and sizes.** WordPress.org silently ignores a file whose name or pixel size differs from the table above.
- **Nothing else in `.wordpress-org/`.** The deploy action mirrors the folder into SVN `assets/` and deletes anything that isn't in it, so a README or source file there would be published. Sources and notes stay here.
- **Text stays in the top-left sky.** wp-admin's View details popup lays the plugin name in a dark box over the banner's lower left (about x 52–628, y 348–449 in banner pixels), so the wordmark sits above the horizon (y 330). In a popup narrower than 772px (a browser window 791px wide or less), wp-admin shortens the header to 100px and moves that box to the top left, where it covers part of the wordmark. That's the accepted cost of this layout, not a bug to fix by moving the text.
- **English only.** The banner reads in English on every locale's listing. The plugin's translations all keep the name as "Battery Surf Bench", and the tagline is English by choice, so the banner needs no per-language versions.
- **Alternatives.** The other directions explored for this art are on the design canvases listed in `docs/mockups/README.md`.
