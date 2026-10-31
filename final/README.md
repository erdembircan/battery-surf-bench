# Battery Surf Bench: 60 s listing spot (final)

This folder receives the deliverables when you build (`pnpm build`, or `pnpm build:4k` for the 4K master; see `../README.md`). They are gitignored; only this description is committed.

## Deliverables

| File | What it is |
| --- | --- |
| `battery-surf-bench-spot-60s-4k.mp4` | **Upload master** for YouTube (`pnpm build:4k`). 3840×2160, 30 fps, H.264 High (CRF 16), BT.709 tagged; AAC 320 kb/s, −14.0 LUFS, true peak ≤ −1 dBTP; 60.000 s, 1,800 frames. |
| `battery-surf-bench-spot-60s-4k-review.mp4` | Lighter copy of the 4K master for review (CRF 25, AAC 160 kb/s). |
| `battery-surf-bench-spot-60s.mp4` | 1080p master (`pnpm build`). 1920×1080, 30 fps, H.264 High (CRF 16), BT.709 tagged; AAC 320 kb/s, −14.0 LUFS, true peak ≤ −1 dBTP; 60.000 s, 1,800 frames. |
| `battery-surf-bench-spot-60s-review.mp4` | Lighter copy of the 1080p master for review (CRF 25, AAC 160 kb/s). |
| `captions.en.srt` | English captions, one cue per voice-over line. Upload them to YouTube for sound-off viewers. |
| `thumbnail-1280x720.png` | YouTube custom thumbnail: the logo with the tagline. |
| `thumbnail-alt-endcard-1280x720.png` | Alternate thumbnail: the end-card lockup. |
| `audio/mix-master.wav` / `.m4a` | Mastered soundtrack: 48 kHz / 24-bit, −14 LUFS, true peak ≤ −1 dBTP. |
| `stems/vo.wav`, `stems/music.wav`, `stems/sfx.wav` | 48 kHz / 24-bit stems, aligned at 0:00, 60.000 s each. Before the master limiter, they sum to the mix. |

## Swapping in a human voice-over

Record the 16 lines in `captions.en.srt` to the same timings. Each line must end at least 0.3 s before its cut; the line lengths are in `../src/shots.json`. Place the recording on the timeline as a mono 48 kHz WAV at `../work/audio/vo/vo-proc.wav`, then run `node ../src/audio/mix.mjs` and `node ../src/audio/qc.mjs`. Don't run `pnpm audio` afterwards: its VO step rebuilds `vo-proc.wav` from the Kokoro takes. The music ducking and loudness targets are already set up in the mix.

## Provenance

What is real and what is staged:

- **Real plugin UI.** Every product shot shows the actual Battery Surf Bench plugin (the build at plugin commit `8e5b0b3`) running in a throwaway WordPress Playground: the cockpit, bark pills, cursor glyphs, deck, Settings, Sessions and summary postcard. The finish chime is byte-exact from the plugin's `src/cockpit/FinishChime.ts`.
- **Live readouts (S02, S12, S13): simulated battery.** These come from a run on a scripted stand-in for the Battery Status API. It steps down 1 % about every 4 minutes, which is ≈ 14 %/h, and the page's clock was time-warped so 17 run-minutes passed quickly. The plugin's own run loop and least-squares math produced every figure: 84 → 83 %, 13.5 → 13 %/h over 10 min, 14.3 → 13.9 %/h for the session, and 100 % → 0 % in 7:00 → 7:11. A real unplugged laptop would produce its own numbers. To re-shoot these, swap `../plates/cockpit-*.png`.
- **Sessions log and postcard (S14): simulated sessions.** The four sessions were seeded through the plugin's own REST endpoint from realistic simulated discharge curves.
- **Staged site.** The Playground site was titled "Coastline Tech Notes", "Sample Page" was renamed "About", and "Hello world!" was rewritten as "Ten Ways to Squeeze More Life From Your Laptop". None of this was saved anywhere else.
- **Our own video clip (S06).** The bundled video page embeds a third-party YouTube video. In the shot, our own animated "power path" clip covers it.
- **Real-brand headlines (S08).** The link hub's fictional headlines name real brands, so a tilt-shift blur keeps them unreadable.
- **Audio.** The score is original and synthesized: 120 BPM, A major. All SFX are synthesized. The voice-over is Kokoro-82M (hexgrad, Apache-2.0) neural TTS with the female voice `af_heart` at 1.05× speed. It is fitted to the cuts by `../src/audio/vo-kokoro.mjs`; every line ends at least 0.44 s before its cut. Kokoro read the sign-off's "Bench" with a rising, mid-sentence pitch. So "Battery Surf Bench." and "Unplug, and find out." are voiced as separate sentences, and the last word of each is pitch-edited with Praat (PSOLA) to fall to the phrase's lowest note. "Bench" goes 12.3 → 8.0 semitones, falling 3.9 within the word (`../src/audio/kokoro/shape_signoff.py`). Kokoro also read S11's line with the stress on "press" and a low "Start" about 11 dB quieter than "Unplug", so the words sounded spliced together. The line is now "Unplug, press Start." with a comma instead of a full stop. `../src/audio/kokoro/accent.py` edits Kokoro's own predicted pitch and energy before its vocoder runs. "Start" now falls from about 14 to 10 semitones at full voice. Because the vocoder renders the new contour, there is no resynthesis artifact.

## Rebuilding

The sources are in `../src`. See `../README.md` for setup, the build steps, the pipeline and the art direction.
