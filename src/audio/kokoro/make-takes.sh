#!/bin/sh
# Synthesizes every Kokoro take into work/audio/vo-kokoro/, then tunes the two
# lines Kokoro reads poorly. Run from anywhere; needs the Python 3.12 venv from
# README.md ($PYTHON overrides .venv/bin/python, $BSB_VIDEO_WORK moves work/).
set -eu
cd "$(dirname "$0")/../../.."
PY=${PYTHON:-.venv/bin/python}
OUT=${BSB_VIDEO_WORK:-work}/audio/vo-kokoro
mkdir -p "$OUT"

# Every line at five speeds; vo-kokoro.mjs picks the one that fits its shot.
"$PY" src/audio/kokoro/kokoro_vo.py src/shots.json "$OUT"

# S16: "Battery Surf Bench." and "Unplug, and find out." as two statements whose
# final words fall (Praat PSOLA). vo-kokoro.mjs uses the 1.05× take.
"$PY" src/audio/kokoro/shape_signoff.py "$OUT/s16-af_heart-1.05.wav" "$OUT/s16-signoff.json"

# S11: move the pitch accent onto "Start" and voice it at full strength.
for SP in 1.00 1.05 1.10 1.15 1.20; do
	"$PY" src/audio/kokoro/accent.py "Unplug, press Start." "$SP" "$OUT/s11-af_heart-$SP.wav" \
		--level press:-1.5 --peak Start:14.5:7 --energy Start:2.6:1.8 --report "$OUT/s11-accent-$SP.json"
done
