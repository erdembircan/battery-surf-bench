# Battery Surf Bench: 60 s listing spot (production source)

This orphan branch holds only the source of the plugin's WordPress.org listing video: scenes, plates, audio tooling and docs. It shares no history with the plugin. Everything the pipeline generates (frames, audio renders, MP4s, stems, thumbnails, captions) is gitignored and rebuilt with the steps below. The approved animatic's shot list is in `animatic/`. The deliverables and their provenance are described in `final/README.md`.

## Setup

You need Node 22+ with pnpm, ffmpeg, ImageMagick 7 (`magick`), and, for the voice-over, Python 3.12.

```sh
pnpm install
pnpm exec playwright install chromium

# Voice-over only (Kokoro-82M): the model downloads from Hugging Face on first use.
python3.12 -m venv .venv
.venv/bin/pip install -r src/audio/kokoro/requirements.txt
```

With uv, `uv venv .venv --python 3.12` and `uv pip install --python .venv/bin/python -r src/audio/kokoro/requirements.txt` do the same.

The Kokoro scripts stub out misaki's espeak-ng fallback, because the bundled binary exits on a hard-coded build path on macOS. Every word in the script is in misaki's lexicon. If you add a word that isn't, it fails loudly instead of being mispronounced.

## Build

```sh
pnpm render:all    # 1,800 frames → work/frames/ (S09 and S11 supersample, so allow ~15 min)
pnpm audio:takes   # Kokoro takes → work/audio/vo-kokoro/ (uses .venv; $PYTHON overrides)
pnpm audio         # score, SFX, VO fit, mix and QC → final/audio/, final/stems/, final/captions.en.srt
pnpm encode        # master + review MP4 and thumbnails → final/
```

`pnpm build` runs render, audio and encode in sequence (the takes must exist). Render a single scene with `pnpm render s09`, or stills with `pnpm render s09 --preview 0.5,1.8` (→ `work/previews/`). Set `BSB_VIDEO_WORK` to keep `work/` somewhere else.

## Pipeline

1. **Plates** (`plates/`): 2× captures of the real plugin running in a throwaway WordPress Playground. They cover the cockpit, course pages, bark pills, deck, settings, sessions and postcard. Swap a plate to re-shoot a moment without touching any scene. The capture scripts needed the plugin running, so they aren't part of this branch.
2. **Scenes** (`src/scenes/<name>.html`): one HTML page per scene, each a pure function of time. A scene calls `S.scene({ dur, render(t) })` from `src/lib/stage.js`. There are no CSS animations or timers, so every frame is reproducible. The deck scenes (S09, S11) clone the plugin's real cockpit markup (`src/scenes/deck/cockpit-markup.js`). They style it with the plugin's compiled stylesheet and fonts, vendored in `src/vendor/` from plugin commit `8e5b0b3`, so the clone and its CSS stay a matched pair.
3. **Render** (`src/tools/render.mjs <scene>`): headless Chromium renders 30 fps, 1920×1080 frames, globally numbered. Every scene owns a disjoint frame range in `src/shots.json` (1,800 frames in total). Scenes that push a camera across live UI text (S09, S11) declare `<meta name="supersample" content="4">`: they render at 4× and are box-filtered down, because at 1× Chrome snaps every glyph to whole pixels and a slow zoom makes static text hop about 1 px between frames. Chrome sometimes captures a 4× frame before it has painted every tile, so parts go missing. Each 4× frame is therefore checked against a 1× render of the same instant, captured again if it doesn't match, and the render stops if it still can't get a complete one.
4. **Audio** (`src/audio/`): an original score, synthesized SFX (the finish chime is byte-exact from the plugin's `src/cockpit/FinishChime.ts`), and a Kokoro-82M neural voice-over (female voice `af_heart`, fitted to the cuts by `vo-kokoro.mjs`). Two lines are tuned in `src/audio/kokoro/make-takes.sh`: the S16 sign-off and the accent in S11. Kokoro's vocoder is seeded, and the score and SFX use seeded noise, so a rebuild reproduces the same audio. Mastered to −14 LUFS, −1 dBTP, with separate stems.
5. **Assembly** (`src/tools/encode.mjs`): ffmpeg encodes the 1,800 frames to H.264. It converts the JPEG frames from BT.601 full range to BT.709 limited range, tags the stream BT.709, muxes `final/audio/mix-master.wav`, and writes the master, a review copy and two thumbnails.

## Art direction

- **World.** The plugin's own light theme ("Coastal Daybreak") and the WordPress.org banner's dawn seascape: sky `#e7f6ff → #fdf2da → #ffd9a6`, sun glow `#ffe6a6`, sun `#ffe08a → #ffce5c`, sea `#a9e0ef → #1c7e96`. Light only, never a dark mode.
- **Ink.** Navy `#1f3a5f` for type and line art (the mascot is navy). Accents: teal `#2f9bb3` / `#1c7e96`, coral `#ff7a5c` / `#ef5a3a` for energy and drain, and sun `#ffce5c` for warmth.
- **Type.** Anton caps for headlines and supers. Hanken Grotesk for sub-lines and labels. Space Mono for numbers. Pacifico is reserved for postcard moments. All fonts are local, via `node_modules/@fontsource`.
- **Motion.** One hero move per shot. Camera moves use in-out cubic or quint eases; pops use outBack or a spring that crests like a wave. Transitions are wave wipes or hard cuts on the beat. Nothing moves without a reason.
- **Product truth.** UI on screen is the real plugin: plates, real CSS, the real bark pills and the real cursor glyphs. Every number is read from `src/scenes/data/run.js` (the captured run), never invented in a scene.
- **Safe area.** Keep text inside 96 px horizontal and 54 px vertical margins.

## Provenance

- **Battery readouts.** The live cockpit readouts come from a run on a scripted stand-in for the Battery Status API: a 1 % staircase at about 14 %/h, with the page's clock time-warped. The plugin's own loop and math computed every figure. It stands in for a real unplugged laptop. The dev-tools level slider can't do this, because it snaps to 5 % steps.
- **Sessions log.** It mixes that run with four seeded sessions, created through the plugin's own REST endpoint from realistic simulated discharge curves.
- **Site data.** The Playground site was staged for the shoot: title "Coastline Tech Notes", "Sample Page" renamed to "About", and "Hello world!" rewritten as a demo article.
- **Video page.** The bundled video page's third-party YouTube embed is covered by our own animated clip.
