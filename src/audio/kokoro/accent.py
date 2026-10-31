"""Voices a line with Kokoro-82M (af_heart) and moves its pitch accent inside the model.

Kokoro reads "Unplug, press Start." with the peak on "press" and a low,
flat "Start" that turns up at the end, so the words sound recorded one by one.
This script runs Kokoro's own inference step by step and edits the predicted
pitch curve (F0) before the vocoder renders it. The vocoder voices the new
contour itself, so there is no resynthesis artifact as with PSOLA.

Edits work on each word's sonorant core: its vowels plus the sonorant
consonants (r, l, m, n, w, y) touching them, trimmed to the voiced frames. They are semitone offsets that
keep the model's own micro-movement. Each edit is held a few frames past its
core and the combined offset is smoothed over ~50 ms, so the curve never jumps
between words:
  --level WORD:ST            shift the core evenly
  --tail  WORD:FRAC:ST       ease in a shift from FRAC of the core to ST at its end
  --peak  WORD:ON:END        make the core a fall from ON to END semitones
                             (re 100 Hz): a nuclear accent
  --energy WORD:ON:END       raise the predicted energy (Kokoro's N curve, roughly
                             natural-log power: +1 ≈ +4 dB) from ON to END across
                             the core, so an accented word isn't voiced as a murmur

Usage: python accent.py "<text>" <speed> <out.wav> [edits...] [--report out.json] [--dump]
Prints each word's contour before and after; --dump also prints the predicted
pitch frame by frame (12.5 ms steps; '|' brackets the core), to tune the edits.
"""
import argparse
import json
import sys
import types

import numpy as np
import soundfile as sf
import torch

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
from misaki.en import STRESSES, VOWELS  # noqa: E402

SR = 24000
HOP = 300  # samples per F0 frame (half a duration frame)
SONORANTS = set('ɹlmnŋwj')
VOICED_HZ = 80.0


def st(hz):
    return 12 * np.log2(np.maximum(hz, 1e-6) / 100.0)


def hz(semi):
    return 100.0 * 2 ** (np.asarray(semi) / 12)


def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument('text')
    ap.add_argument('speed', type=float)
    ap.add_argument('out')
    ap.add_argument('--level', action='append', default=[])
    ap.add_argument('--tail', action='append', default=[])
    ap.add_argument('--peak', action='append', default=[])
    ap.add_argument('--energy', action='append', default=[])
    ap.add_argument('--report')
    ap.add_argument('--dump', action='store_true')
    return ap.parse_args()


def word_spans(tokens):
    """(word, phonemes, first input id) per word, in Kokoro's layout (input id 0 is <bos>)."""
    spans, i = [], 1
    for t in tokens:
        ps = t.phonemes or ''
        w = t.text.strip('.,!?;:"“”')
        if w and ps:
            spans.append((w, ps, i))
        i += len(ps) + (1 if t.whitespace else 0)
    return spans


def core(ps):
    """Phoneme index range [a, b) of the sonorant core: first vowel to last vowel,
    widened over touching sonorants and stress marks."""
    vow = [k for k, p in enumerate(ps) if p in VOWELS]
    a, b = vow[0], vow[-1] + 1
    while a > 0 and (ps[a - 1] in SONORANTS or ps[a - 1] in STRESSES):
        a -= 1
    while b < len(ps) and ps[b] in SONORANTS:
        b += 1
    return a, b


def describe(f0, a, b):
    s = st(f0[a:b])
    k = max(1, len(s) // 5)
    return {'from': round(float(np.median(s[:k])), 1), 'to': round(float(np.median(s[-k:])), 1),
            'peak': round(float(np.max(s)), 1), 'median': round(float(np.median(s)), 1)}


def main():
    args = parse_args()
    pipe = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')
    model = pipe.model
    pack = pipe.load_voice('af_heart')
    _, tokens = pipe.g2p(args.text)
    chunks = list(pipe.en_tokenize(tokens))
    assert len(chunks) == 1, 'one phrase per call'
    _, ps, tks = chunks[0]
    ids = [model.vocab.get(p) for p in ps]
    assert None not in ids, f'phoneme outside the vocab in {ps!r}'
    input_ids = torch.LongTensor([[0, *ids, 0]])
    ref_s = pack[len(ps) - 1]

    # Kokoro's vocoder draws random noise and phase; seed it so a rebuild matches.
    torch.manual_seed(0)
    with torch.no_grad():
        # Kokoro's KModel.forward_with_tokens, unrolled so the pitch curve can be edited.
        n = input_ids.shape[-1]
        lengths = torch.full((1,), n, dtype=torch.long)
        mask = torch.gt(torch.arange(n).unsqueeze(0) + 1, lengths.unsqueeze(1))
        bert = model.bert(input_ids, attention_mask=(~mask).int())
        d_en = model.bert_encoder(bert).transpose(-1, -2)
        s = ref_s[:, 128:]
        d = model.predictor.text_encoder(d_en, s, lengths, mask)
        x, _ = model.predictor.lstm(d)
        dur = torch.sigmoid(model.predictor.duration_proj(x)).sum(axis=-1) / args.speed
        pred_dur = torch.round(dur).clamp(min=1).long().squeeze()
        idx = torch.repeat_interleave(torch.arange(n), pred_dur)
        aln = torch.zeros((n, idx.shape[0]))
        aln[idx, torch.arange(idx.shape[0])] = 1
        aln = aln.unsqueeze(0)
        en = d.transpose(-1, -2) @ aln
        F0, N = model.predictor.F0Ntrain(en, s)
        t_en = model.text_encoder(input_ids, lengths, mask)
        asr = t_en @ aln

        # F0 runs at twice the duration frame rate: input id k spans F0 frames [cum[k], cum[k+1]).
        cum = (np.concatenate([[0], np.cumsum(pred_dur.numpy())]) * 2).astype(int)
        f0 = F0.squeeze(0).numpy().astype(np.float64)
        words = {}
        for w, wps, i0 in word_spans(tks):
            a, b = core(wps)
            ca, cb = cum[i0 + a], cum[i0 + b]
            # The predictor's curve runs on through voiceless consonants and drops to ~0 Hz
            # in closures and silence: keep the core to its voiced run.
            v = np.nonzero(f0[ca:cb] > VOICED_HZ)[0]
            words[w] = {'span': (cum[i0], cum[i0 + len(wps)]), 'core': (ca + v[0], ca + v[-1] + 1)}

        nrg = N.squeeze(0).numpy().astype(np.float64)
        if args.dump:
            for w, v in words.items():
                (a, b), (ca, cb) = v['span'], v['core']
                cells = [('|' if k == ca else ' ') + f'{st(f0[k]):5.1f}' + ('|' if k == cb - 1 else '') for k in range(a, b)]
                print(f'{w:8s} F0', ''.join(cells))
                cells = [('|' if k == ca else ' ') + f'{nrg[k]:5.2f}' + ('|' if k == cb - 1 else '') for k in range(a, b)]
                print(f'{w:8s} N ', ''.join(cells))

        HOLD = 3  # frames each edit is held past its core, into the neighbouring consonants

        def add(offset, a, b, values):
            """Adds an edit over [a, b) and holds its edge values HOLD frames outwards,
            so the smoothing below blends in the consonants, not in the vowel."""
            values = np.broadcast_to(np.asarray(values, dtype=np.float64), (b - a,))
            offset[a:b] += values
            offset[max(0, a - HOLD):a] += values[0]
            offset[b:b + HOLD] += values[-1]

        offset = np.zeros_like(f0)
        for spec in args.level:
            w, d0 = spec.split(':')
            a, b = words[w]['core']
            add(offset, a, b, float(d0))
        for spec in args.tail:
            w, frac, d1 = spec.split(':')
            a, b = words[w]['core']
            k0 = a + int(round(float(frac) * (b - a)))
            q = np.linspace(0, 1, b - k0)
            ramp = np.concatenate([np.zeros(k0 - a), float(d1) * (1 - np.cos(np.pi * q)) / 2])
            add(offset, a, b, ramp)
        for spec in args.peak:
            w, on, end = spec.split(':')
            a, b = words[w]['core']
            seg = st(f0[a:b])
            q = np.linspace(0, 1, b - a)
            k = max(1, (b - a) // 5)
            trend = np.median(seg[:k]) + (np.median(seg[-k:]) - np.median(seg[:k])) * q
            target = float(on) - (float(on) - float(end)) * (1 - (1 - q) ** 1.6)
            add(offset, a, b, target - trend)
        boost = np.zeros_like(nrg)
        for spec in args.energy:
            w, on, end = spec.split(':')
            a, b = words[w]['core']
            add(boost, a, b, np.linspace(float(on), float(end), b - a))
        # Smooth both offsets (Hann, ~50 ms) so edits blend instead of stepping.
        win = np.hanning(5)
        win /= win.sum()
        offset = np.convolve(np.pad(offset, 2, mode='edge'), win, mode='valid')
        boost = np.convolve(np.pad(boost, 2, mode='edge'), win, mode='valid')
        new = hz(st(f0) + offset)

        F0e = torch.from_numpy(new.astype(np.float32)).unsqueeze(0)
        Ne = torch.from_numpy((nrg + boost).astype(np.float32)).unsqueeze(0)
        audio = model.decoder(asr, F0e, Ne, ref_s[:, :128]).squeeze().numpy()

    sf.write(args.out, audio.astype(np.float32), SR, subtype='FLOAT')
    report = {'text': args.text, 'speed': args.speed, 'phonemes': ps, 'dur': round(len(audio) / SR, 3), 'edits': {'level': args.level, 'tail': args.tail, 'peak': args.peak, 'energy': args.energy}, 'words': []}
    for w, v in words.items():
        a, b = v['core']
        report['words'].append({'w': w, 'core_s': [round(a * HOP / SR, 3), round(b * HOP / SR, 3)], 'model': describe(f0, a, b), 'edited': describe(new, a, b)})
    for row in report['words']:
        print(f"{row['w']:8s} core {row['core_s'][0]:.2f}-{row['core_s'][1]:.2f}s  model {row['model']}  →  edited {row['edited']}")
    print(f"wrote {args.out} ({report['dur']} s)")
    if args.report:
        json.dump(report, open(args.report, 'w'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
