"""Synthesizes the spot's VO lines with Kokoro-82M (hexgrad) in a female voice.

Usage: python kokoro_vo.py <shots.json> <out_dir> [voice] [speeds]
Writes <id>-<voice>-<speed>.wav (24 kHz float) per line and speed; vo-kokoro.mjs
trims, picks and places the takes. make-takes.sh runs this, then tunes S16 and S11.
"""
import json
import sys
import types

import numpy as np
import soundfile as sf
import torch

# The bundled espeak-ng (OOV fallback only) exits on a hard-coded build path on
# macOS. Every word in these lines is in misaki's lexicon (checked), so stub the
# fallback out; KPipeline then runs lexicon-only.
_stub = types.ModuleType('misaki.espeak')


class _Disabled:
    def __init__(self, *a, **k):
        raise RuntimeError('espeak fallback disabled')


_stub.EspeakFallback = _Disabled
_stub.EspeakG2P = _Disabled
sys.modules['misaki.espeak'] = _stub
import misaki  # noqa: E402

misaki.espeak = _stub
from kokoro import KPipeline  # noqa: E402

shots = json.load(open(sys.argv[1], encoding='utf-8'))['shots']
lines = [{'id': s['id'], 'text': s['vo']} for s in shots]
out = sys.argv[2]
voice = sys.argv[3] if len(sys.argv) > 3 else 'af_heart'
speeds = [float(s) for s in (sys.argv[4] if len(sys.argv) > 4 else '1.0,1.05,1.1,1.15,1.2').split(',')]

pipe = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')  # American English
for ln in lines:
    durs = {}
    for sp in speeds:
        parts = []
        # Kokoro's vocoder draws random noise and phase: seed each take so a rebuild matches.
        torch.manual_seed(0)
        for result in pipe(ln['text'], voice=voice, speed=sp, split_pattern=None):
            audio = result.audio
            parts.append(audio.numpy() if hasattr(audio, 'numpy') else np.asarray(audio))
        y = np.concatenate(parts).astype(np.float32)
        sf.write(f"{out}/{ln['id'].lower()}-{voice}-{sp:.2f}.wav", y, 24000, subtype='FLOAT')
        durs[f'{sp:.2f}'] = round(len(y) / 24000, 3)
    print(ln['id'], durs, flush=True)
