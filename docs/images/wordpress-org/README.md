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

## Rules

- **Exact names and sizes.** WordPress.org silently ignores a file whose name or pixel size differs from the table above.
- **Nothing else in `.wordpress-org/`.** The deploy action mirrors the folder into SVN `assets/` and deletes anything that isn't in it, so a README or source file there would be published. Sources and notes stay here.
- **No text in the banner.** WordPress.org prints the plugin name under the banner, wp-admin's View details popup lays the name over the banner's lower left, and the plugin ships translations that an English wordmark wouldn't match.
- **Alternatives.** The other directions explored for this art are on the design canvas listed in `docs/mockups/README.md`.
