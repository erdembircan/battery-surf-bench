"""Builds the S16 take with a conclusive sign-off: Kokoro af_heart reads
"Battery Surf Bench." and "Unplug, and find out." as separate sentences; Praat
(PSOLA) reshapes only the final word of each sentence so it falls to the
phrase's lowest point instead of rising. Everything else is untouched.

Usage: python shape_signoff.py <out_wav> <report_json>
"""
import json
import sys
import types

import numpy as np
import parselmouth
import soundfile as sf
import torch
from parselmouth.praat import call

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

SR = 24000
FLOOR, CEIL = 120, 420
pipe = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')


def st(hz):
    return 12 * np.log2(np.asarray(hz) / 100.0)


def hz(s):
    return 100.0 * 2 ** (np.asarray(s) / 12)


def synth(text, speed):
    y, toks = [], []
    off = 0.0
    torch.manual_seed(0)  # Kokoro's vocoder draws random noise and phase; keep rebuilds identical.
    for r in pipe(text, voice='af_heart', speed=speed, split_pattern=None):
        a = np.asarray(r.audio, dtype=np.float32)
        for tk in r.tokens or []:
            if tk.start_ts is not None:
                toks.append((tk.text.strip('.,!'), tk.start_ts + off, tk.end_ts + off))
        y.append(a)
        off += len(a) / SR
    return np.concatenate(y), [t for t in toks if t[0]]


def cut(y, toks, first, last, tail=0.14):
    a = next(s for (w, s, e) in toks if w == first)
    b = next(e for (w, s, e) in toks if w == last)
    base = max(0.0, a - 0.02)
    seg = y[int(base * SR):min(len(y), int((b + tail) * SR))]
    return seg, {w: (s - base, e - base) for (w, s, e) in toks if s >= a - 1e-6 and e <= b + 1e-6}


def word_medians(y, spans):
    p = parselmouth.Sound(y.astype(np.float64), SR).to_pitch_ac(time_step=0.005, pitch_floor=FLOOR, pitch_ceiling=CEIL)
    t, f = p.xs(), p.selected_array['frequency']
    out = {}
    for w, (a, b) in spans.items():
        m = (t >= a) & (t <= b) & (f > 0)
        out[w] = (float(np.median(st(f[m]))) if m.any() else float('nan'), t[m], f[m])
    return out


def fall_within(tf):
    t, f = tf
    if len(f) < 7:
        return float('nan')
    k = max(3, len(f) // 5)
    return float(np.median(st(f[-k:])) - np.median(st(f[:k])))


def shape_final(y, spans, last, prev, start_drop=0.4, total_fall=4.5):
    """Replaces the pitch of the last word with a smooth fall that starts just
    under the previous word's median and drops `total_fall` semitones."""
    med = word_medians(y, spans)
    a, b = spans[last]
    voiced_t = med[last][1]
    v0, v1 = float(voiced_t[0]), float(voiced_t[-1])
    s0 = med[prev][0] - start_drop
    snd = parselmouth.Sound(y.astype(np.float64), SR)
    man = call(snd, 'To Manipulation', 0.005, FLOOR, CEIL)
    tier = call(man, 'Extract pitch tier')
    call(tier, 'Remove points between', v0 - 0.005, v1 + 0.03)
    n = 9
    for i in range(n):
        q = i / (n - 1)
        # Ease-out fall: most of the drop early in the vowel, settling at the end.
        drop = total_fall * (1 - (1 - q) ** 1.8)
        call(tier, 'Add point', v0 + q * (v1 - v0), float(hz(s0 - drop)))
    call([tier, man], 'Replace pitch tier')
    out = call(man, 'Get resynthesis (overlap-add)')
    return np.asarray(out.values[0], dtype=np.float32)


report = {}
# Sentence 1: the name.
y1, t1 = synth('Battery Surf Bench.', 1.0)
s1, sp1 = cut(y1, t1, 'Battery', 'Bench')
before1 = word_medians(s1, sp1)
s1b = shape_final(s1, sp1, 'Bench', 'Surf')
after1 = word_medians(s1b, sp1)
# Sentence 2: the call to action.
y2, t2 = synth('Unplug, and find out.', 1.05)
s2, sp2 = cut(y2, t2, 'Unplug', 'out')
before2 = word_medians(s2, sp2)
need2 = not ( before2['out'][0] < before2['find'][0] - 0.5 and fall_within( before2['out'][1:] ) < -1.0 )
s2b = shape_final(s2, sp2, 'out', 'find', start_drop=0.3, total_fall=3.5) if need2 else s2
after2 = word_medians(s2b, sp2)
for label, b, a in (('Battery Surf Bench.', before1, after1), ('Unplug, and find out.', before2, after2)):
    row = {w: {'before_st': round(b[w][0], 1), 'after_st': round(a[w][0], 1)} for w in b}
    last = list(b)[-1]
    row['_last_word_fall_st'] = {'before': round(fall_within(b[last][1:]), 1), 'after': round(fall_within(a[last][1:]), 1)}
    report[label] = row
    print(label, json.dumps(row), flush=True)
print('reshaped CTA:', need2)

gap = np.zeros(int(0.5 * SR), np.float32)
pad = np.zeros(int(0.3 * SR), np.float32)
sf.write(sys.argv[1], np.concatenate([pad, s1b, gap, s2b, pad]), SR, subtype='FLOAT')
json.dump(report, open(sys.argv[2], 'w'), indent=1)
print('wrote', sys.argv[1])
