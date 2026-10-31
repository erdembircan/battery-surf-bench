// Original score for the 60 s spot — 120 BPM, A major (the key of the plugin's
// finish chime). Synthesized from scratch: Karplus–Strong uke strums with body
// EQ, a marimba hook, sub + mid bass with kick sidechain, kick/clap/shaker/hat,
// detuned pads, risers, and a synthesized convolution reverb.
// Sections follow shots.json MUSIC: intro (0–10), drop on the logo (10.0),
// tape-stop into a stiff drone for the timer gag (13–17), groove (17–43),
// breakdown under the math shot (43–48), groove (48–58), final A hit (58.0).
// Bar 24 (48–50) sits on A with no hook so the real chime at 49.10 lands clean.
import { SR, LEN, WORK, bus, place, seg, biquad, run, sweepLP, sweepBP, white, pink, ks, midi, rng, writeWav, makeIR, convolve, readWav } from './lib.mjs';

const R = rng( 2026 );
const BEAT = 0.5, BAR = 2, E8 = 0.25;

// ── Harmony ─────────────────────────────────────────────────────────────────
const CH = {
	A: { bass: 45, v: [ 57, 61, 64, 69 ], add: 71 },
	E_Gs: { bass: 44, v: [ 56, 59, 64, 68 ], add: 66 },
	Fsm7: { bass: 42, v: [ 57, 61, 64, 66 ], add: 69 },
	D: { bass: 38, v: [ 57, 62, 66, 69 ], add: 64 },
	Dmaj9: { bass: 38, v: [ 57, 61, 64, 66 ], add: 69 },
	E: { bass: 40, v: [ 56, 59, 64, 68 ], add: 71 },
	Esus: { bass: 40, v: [ 57, 59, 64, 69 ], add: 71 },
};
const BARS = [
	'A', 'E_Gs', 'Fsm7', 'Dmaj9', 'Esus', // intro 0–10
	'A', 'E_Gs', 'A', 'E', // drop 10–13, drone 13–17, pickup E 17–18
	'A', 'E_Gs', 'Fsm7', 'D', 'A', 'E_Gs', 'Fsm7', 'D', 'A', 'E_Gs', 'Fsm7', 'D', // groove 18–42
	'A', 'Fsm7', 'Dmaj9', // 42–48 (breakdown from 43)
	'A', 'E_Gs', 'Fsm7', 'D', 'E', // groove 48–58
	'A', // final 58–60
];
const chordAt = ( t ) => CH[ BARS[ Math.min( BARS.length - 1, Math.floor( t / BAR ) ) ] ];

// ── Buses ────────────────────────────────────────────────────────────────────
const pre = bus(); // everything before the tape stop (0–13.4); gets the tape-stop transform
const post = bus(); // everything from the timer drone on
const verbSend = bus(); // plate reverb send (music)
const kickTimes = [];

// ── Instruments ──────────────────────────────────────────────────────────────
const uBody = () => [ biquad( 'hp', 110 ), biquad( 'peak', 240, 1.1, 4 ), biquad( 'peak', 2400, 1.4, 2.5 ), biquad( 'lp', 6500 ) ];
/** One strum: strings in order with a spread, KS with body EQ, Haas double for width. */
function strum( b, t, chord, { dir = 'down', vel = 1, len = 0.9, strings = 4, add = false, send = 0.12 } = {} ) {
	let notes = chord.v.slice( 0, strings );
	if ( add ) notes = [ ...notes, chord.add + 12 > 76 ? chord.add : chord.add + 12 ].slice( -strings - 1 );
	if ( dir === 'up' ) notes = notes.slice( -3 ).reverse();
	const spread = dir === 'up' ? 0.009 : 0.013;
	notes.forEach( ( m, k ) => {
		const y = ks( midi( m ) * ( 1 + ( R() - 0.5 ) * 0.0012 ), len, R, { decay: 0.9935, bright: dir === 'up' ? 0.62 : 0.55, pickPos: 0.17 + R() * 0.06 } );
		run( y, ...uBody() );
		const g = 0.16 * vel * ( dir === 'up' ? 0.7 : 1 ) * ( 0.9 + R() * 0.2 );
		const tt = t + k * spread + ( R() - 0.5 ) * 0.004;
		place( b, tt, y, g, -0.32 );
		place( b, tt + 0.014, y, g * 0.55, 0.45 );
		place( verbSend, tt, y, g * send, 0 );
	} );
}
/** Marimba: modal partials (1, 3.93, 9.24) + mallet transient. */
function marimba( b, t, m, { vel = 1, len = 1.2, p = 0.28, send = 0.22 } = {} ) {
	const f = midi( m );
	const y = seg( len );
	const tau = 0.62 * Math.pow( 440 / f, 0.35 );
	for ( let i = 0; i < y.length; i++ ) {
		const tt = i / SR;
		const a = Math.min( 1, tt / 0.002 );
		y[ i ] = a * ( Math.sin( 2 * Math.PI * f * tt ) * Math.exp( -tt / tau ) + 0.32 * Math.sin( 2 * Math.PI * f * 3.93 * tt ) * Math.exp( -tt / ( tau * 0.22 ) ) + 0.1 * Math.sin( 2 * Math.PI * f * 9.24 * tt ) * Math.exp( -tt / ( tau * 0.07 ) ) );
	}
	const mal = white( Math.round( 0.004 * SR ), R );
	run( mal, biquad( 'bp', f * 2.2, 1.2 ) );
	for ( let i = 0; i < mal.length; i++ ) y[ i ] += mal[ i ] * 0.6 * ( 1 - i / mal.length );
	const fo = Math.round( 0.02 * SR );
	for ( let i = 0; i < fo; i++ ) y[ y.length - 1 - i ] *= i / fo;
	place( b, t, y, 0.2 * vel, p );
	place( verbSend, t, y, 0.2 * vel * send, p );
}
/** Glockenspiel sparkle (for lifts): bright inharmonic bell, short. */
function glock( b, t, m, vel = 1 ) {
	const f = midi( m );
	const y = seg( 0.9 );
	for ( let i = 0; i < y.length; i++ ) {
		const tt = i / SR;
		y[ i ] = Math.min( 1, tt / 0.001 ) * ( Math.sin( 2 * Math.PI * f * tt ) * Math.exp( -tt / 0.32 ) + 0.4 * Math.sin( 2 * Math.PI * f * 2.76 * tt ) * Math.exp( -tt / 0.09 ) + 0.18 * Math.sin( 2 * Math.PI * f * 5.4 * tt ) * Math.exp( -tt / 0.04 ) );
	}
	place( b, t, y, 0.06 * vel, 0.4 );
	place( verbSend, t, y, 0.06 * vel * 0.35, 0.4 );
}
/** Bass note: sub sine + filtered saw mid, short release. */
function bass( b, t, m, dur, vel = 1 ) {
	const f = midi( m );
	const y = seg( dur + 0.08 );
	const lp = biquad( 'lp', 700, 0.8 );
	let ph = 0;
	for ( let i = 0; i < y.length; i++ ) {
		const tt = i / SR;
		ph += f / SR;
		const saw = 2 * ( ph % 1 ) - 1;
		const env = Math.min( 1, tt / 0.004 ) * ( tt < dur ? 0.65 + 0.35 * Math.exp( -tt / 0.12 ) : ( 0.65 ) * Math.exp( -( tt - dur ) / 0.025 ) );
		y[ i ] = env * ( 0.9 * Math.sin( 2 * Math.PI * ph ) + 0.35 * lp( saw ) );
	}
	run( y, ( v ) => Math.tanh( v * 1.3 ) / 1.3 );
	place( b, t, y, 0.33 * vel, 0 );
}
function kick( b, t, vel = 1 ) {
	const y = seg( 0.42 );
	let ph = 0;
	for ( let i = 0; i < y.length; i++ ) {
		const tt = i / SR;
		ph += ( 47 + 118 * Math.exp( -tt / 0.032 ) ) / SR;
		y[ i ] = Math.sin( 2 * Math.PI * ph ) * Math.min( 1, tt / 0.001 ) * Math.exp( -tt / 0.26 );
	}
	const click = white( Math.round( 0.003 * SR ), R );
	run( click, biquad( 'hp', 2500 ) );
	for ( let i = 0; i < click.length; i++ ) y[ i ] += click[ i ] * 0.35 * ( 1 - i / click.length );
	run( y, ( v ) => Math.tanh( v * 1.6 ) / Math.tanh( 1.6 ) );
	place( b, t, y, 0.55 * vel, 0 );
	kickTimes.push( t );
}
function clap( b, t, vel = 1 ) {
	const n = Math.round( 0.32 * SR );
	const y = white( n, R );
	const bp = biquad( 'bp', 1350, 0.9 );
	for ( let i = 0; i < n; i++ ) {
		const tt = i / SR;
		const bursts = [ 0, 0.009, 0.019 ].reduce( ( a, o ) => a + ( tt >= o ? Math.exp( -( tt - o ) / 0.006 ) : 0 ), 0 );
		const tail = tt >= 0.024 ? Math.exp( -( tt - 0.024 ) / 0.11 ) * 0.7 : 0;
		y[ i ] = bp( y[ i ] ) * ( bursts + tail );
		y[ i ] += 0.25 * Math.sin( 2 * Math.PI * 190 * tt ) * Math.exp( -tt / 0.05 );
	}
	place( b, t, y, 0.3 * vel, 0.06 );
	place( verbSend, t, y, 0.3 * vel * 0.3, 0.06 );
}
function shaker( b, t, vel = 1 ) {
	const n = Math.round( 0.09 * SR );
	const y = white( n, R );
	const bp = biquad( 'bp', 7200, 0.8 );
	for ( let i = 0; i < n; i++ ) {
		const tt = i / SR;
		y[ i ] = bp( y[ i ] ) * Math.min( 1, tt / 0.006 ) * Math.exp( -tt / 0.04 );
	}
	place( b, t, y, 0.11 * vel, 0.38 );
}
function hat( b, t, vel = 1, open = false ) {
	const n = Math.round( ( open ? 0.35 : 0.08 ) * SR );
	const y = white( n, R );
	const hp = biquad( 'hp', 7800, 0.9 );
	for ( let i = 0; i < n; i++ ) y[ i ] = hp( y[ i ] ) * Math.exp( -( i / SR ) / ( open ? 0.16 : 0.03 ) );
	place( b, t, y, ( open ? 0.075 : 0.06 ) * vel, -0.3 );
}
function crash( b, t, vel = 1 ) {
	const n = Math.round( 2.2 * SR );
	const y = white( n, R );
	const hp = biquad( 'hp', 3800, 0.7 ), lp = biquad( 'lp', 12500 );
	for ( let i = 0; i < n; i++ ) {
		const tt = i / SR;
		y[ i ] = lp( hp( y[ i ] ) ) * Math.min( 1, tt / 0.003 ) * Math.exp( -tt / 0.7 );
		y[ i ] += 0.05 * ( Math.sin( 2 * Math.PI * 3150 * tt ) + Math.sin( 2 * Math.PI * 4720 * tt ) ) * Math.exp( -tt / 0.5 );
	}
	place( b, t, y, 0.13 * vel, -0.15 );
	place( b, t + 0.011, y, 0.09 * vel, 0.5 );
	place( verbSend, t, y, 0.06 * vel, 0 );
}
/** Sub "boom" for impacts. */
function boom( b, t, vel = 1 ) {
	const y = seg( 1.4 );
	let ph = 0;
	for ( let i = 0; i < y.length; i++ ) {
		const tt = i / SR;
		ph += ( 38 + 40 * Math.exp( -tt / 0.08 ) ) / SR;
		y[ i ] = Math.sin( 2 * Math.PI * ph ) * Math.min( 1, tt / 0.004 ) * Math.exp( -tt / 0.45 );
	}
	place( b, t, y, 0.45 * vel, 0 );
}
/** Detuned triangle/saw pad over [t, t+dur]. */
function pad( b, t, dur, notes, { vel = 1, cutoff = 1600, attack = 0.45, release = 0.6, wobble = 0.12 } = {} ) {
	const n = Math.round( ( dur + release ) * SR );
	notes.forEach( ( m, k ) => {
		for ( const det of [ -0.006, 0, 0.0065 ] ) {
			const f = midi( m ) * ( 1 + det );
			const y = new Float32Array( n );
			let ph = R();
			for ( let i = 0; i < n; i++ ) {
				const tt = i / SR;
				ph += f / SR;
				const tri = 4 * Math.abs( ( ph % 1 ) - 0.5 ) - 1;
				const saw = 2 * ( ph % 1 ) - 1;
				const env = Math.min( 1, tt / attack ) * ( tt < dur ? 1 : Math.exp( -( tt - dur ) / ( release / 3 ) ) );
				y[ i ] = env * ( 0.7 * tri + 0.3 * saw );
			}
			sweepLP( y, ( tt ) => cutoff * ( 1 + wobble * Math.sin( 2 * Math.PI * 0.21 * ( t + tt ) + k ) ) );
			const p = ( ( k / Math.max( 1, notes.length - 1 ) ) - 0.5 ) * 0.9 + det * 40;
			place( b, t, y, 0.028 * vel, Math.max( -1, Math.min( 1, p ) ) );
			place( verbSend, t, y, 0.028 * vel * 0.25, 0 );
		}
	} );
}
/** Noise riser into a hit at `end`. */
function riser( b, start, end, vel = 1 ) {
	const n = Math.round( ( end - start ) * SR );
	const y = pink( n, R );
	sweepBP( y, ( tt ) => 400 * Math.pow( 18, tt / ( end - start ) ), 1.4 );
	for ( let i = 0; i < n; i++ ) y[ i ] *= Math.pow( i / n, 2.2 );
	place( b, start, y, 0.5 * vel, -0.2 );
	place( b, start + 0.007, y, 0.4 * vel, 0.3 );
}
/** Reverse-swell (reversed decaying noise + pad tone) into `end`. */
function swell( b, start, end, notes, vel = 1 ) {
	const n = Math.round( ( end - start ) * SR );
	const y = pink( n, R );
	run( y, biquad( 'bp', 2400, 0.7 ) );
	for ( let i = 0; i < n; i++ ) y[ i ] *= Math.pow( i / n, 3 );
	place( b, start, y, 0.35 * vel, 0 );
	pad( b, start, end - start, notes, { vel: 0.9 * vel, attack: end - start, release: 0.05, cutoff: 2600 } );
}

// ── Patterns ─────────────────────────────────────────────────────────────────
const STRUM = [ [ 0, 'down', 1 ], [ 2, 'down', 0.7 ], [ 3, 'up', 0.55 ], [ 5, 'up', 0.6 ], [ 6, 'down', 0.75 ], [ 7, 'up', 0.5 ] ];
function grooveBar( b, t0, from, to, { hook = false, lift = false, strumAdd = false, drums = true } = {} ) {
	const ch = chordAt( t0 + 0.01 );
	for ( const [ slot, dir, v ] of STRUM ) {
		const t = t0 + slot * E8;
		if ( t >= from && t < to ) strum( b, t, ch, { dir, vel: v, add: strumAdd } );
	}
	// Bass: 1, "and" of 2, 3, 4-and approach.
	const bassPat = [ [ 0, 0, 0.6 ], [ 3, 0, 0.22 ], [ 4, 0, 0.45 ], [ 7, 7, 0.2 ] ];
	for ( const [ slot, iv, d ] of bassPat ) {
		const t = t0 + slot * E8;
		if ( t >= from && t < to ) bass( b, t, ch.bass + iv, d, slot === 0 ? 1 : 0.85 );
	}
	if ( drums ) {
		for ( let s = 0; s < 8; s++ ) {
			const t = t0 + s * E8;
			if ( t < from || t >= to ) continue;
			if ( s === 0 || s === 4 ) kick( b, t, s === 0 ? 1 : 0.9 );
			if ( s === 7 && lift ) kick( b, t, 0.55 );
			if ( s === 2 || s === 6 ) clap( b, t, 1 );
			if ( lift && s % 2 === 1 ) hat( b, t, 1, true );
		}
		for ( let s = 0; s < 16; s++ ) {
			const t = t0 + s * 0.125;
			if ( t >= from && t < to ) shaker( b, t, [ 0.5, 0.25, 0.85, 0.3 ][ s % 4 ] * ( 0.9 + R() * 0.2 ) );
		}
	}
	void hook;
}
// Hook (original), 32 eighths over A | E/G# | F#m7 | D. [eighth, midi, lenEighths]
const HOOK = [
	[ 0, 76, 1 ], [ 2, 73, 1 ], [ 3, 76, 1 ], [ 4, 78, 2 ], [ 6, 76, 1 ], [ 7, 73, 1 ],
	[ 8, 71, 3 ], [ 11, 73, 1 ], [ 12, 76, 4 ],
	[ 16, 73, 1 ], [ 18, 69, 1 ], [ 19, 73, 1 ], [ 20, 76, 2 ], [ 22, 73, 1 ], [ 23, 71, 1 ],
	[ 24, 69, 2 ], [ 26, 66, 1 ], [ 27, 69, 1 ], [ 28, 71, 2 ], [ 30, 73, 1 ], [ 31, 76, 1 ],
];
const HOOK_SPARSE = [ [ 0, 76, 2 ], [ 4, 78, 2 ], [ 6, 76, 2 ], [ 8, 71, 6 ], [ 16, 73, 2 ], [ 20, 76, 4 ], [ 24, 69, 4 ], [ 28, 71, 2 ], [ 30, 73, 1 ], [ 31, 76, 1 ] ];
// Over A | E/G# | F#m7 | E for the last phrase, resolving to A at 58.0.
const HOOK_END = [ ...HOOK.filter( ( [ e ] ) => e < 24 ), [ 24, 71, 2 ], [ 26, 68, 1 ], [ 27, 71, 1 ], [ 28, 73, 2 ], [ 30, 74, 1 ], [ 31, 76, 1 ] ];
function hook( b, t0, notes, { vel = 1, glockDouble = false } = {} ) {
	for ( const [ e, m, l ] of notes ) {
		const t = t0 + e * E8;
		marimba( b, t, m, { vel: vel * ( e % 8 === 0 ? 1 : 0.85 ), len: Math.max( 0.5, l * E8 + 0.5 ) } );
		if ( glockDouble ) glock( b, t + 0.004, m + 12, vel * 0.9 );
	}
}
/** The plugin's chime arpeggio, voiced on marimba/glock as the sonic logo. */
function sonicLogo( b, t, vel = 1 ) {
	[ 81, 85, 88 ].forEach( ( m, k ) => {
		marimba( b, t + k * 0.12, m - 12, { vel: 0.8 * vel, len: 1.4, p: 0.1 + k * 0.12 } );
		glock( b, t + k * 0.12, m, 0.8 * vel );
	} );
}

// ── Arrangement ──────────────────────────────────────────────────────────────
// Intro 0–10: arpeggiated plucks, pad from 4.0, soft pulse from 6.0, riser to 10.
for ( let bar = 0; bar < 5; bar++ ) {
	const t0 = bar * BAR;
	const ch = chordAt( t0 + 0.01 );
	const arp = [ ch.v[ 0 ], ch.v[ 1 ], ch.v[ 2 ], ch.v[ 3 ], ch.add, ch.v[ 3 ], ch.v[ 2 ], ch.v[ 1 ] ];
	const step = bar === 4 ? E8 / 2 : BEAT;
	for ( let k = 0; t0 + k * step < t0 + BAR - 1e-6; k++ ) {
		const m = arp[ k % arp.length ] + 12 * ( bar === 4 && k >= 8 ? 1 : 0 );
		const y = ks( midi( m ), 1.6, R, { decay: 0.9965, bright: 0.38, pickPos: 0.22 } );
		run( y, ...uBody() );
		const v = ( bar === 4 ? 0.55 + 0.45 * ( k / 16 ) : 0.75 ) * ( k % 4 === 0 ? 1 : 0.8 );
		place( pre, t0 + k * step, y, 0.14 * v, ( ( k % 4 ) - 1.5 ) / 4 );
		place( verbSend, t0 + k * step, y, 0.14 * v * 0.4, 0 );
	}
	if ( bar >= 2 ) pad( pre, t0, BAR, [ ch.v[ 0 ] - 12, ...ch.v.slice( 1 ) ], { vel: bar >= 3 ? 1 : 0.7, cutoff: 1100 + bar * 250 } );
	if ( bar >= 3 ) {
		for ( let s = 0; s < 4; s++ ) {
			const t = t0 + s * BEAT;
			const thump = seg( 0.25 );
			let ph = 0;
			for ( let i = 0; i < thump.length; i++ ) {
				const tt = i / SR;
				ph += ( 50 + 60 * Math.exp( -tt / 0.03 ) ) / SR;
				thump[ i ] = Math.sin( 2 * Math.PI * ph ) * Math.exp( -tt / 0.16 );
			}
			if ( s % 2 === 0 ) place( pre, t, thump, 0.22 * ( bar === 4 ? 1.2 : 0.8 ), 0 );
			for ( let h = 0; h < 2; h++ ) shaker( pre, t + h * E8, ( h ? 0.45 : 0.25 ) * ( bar === 4 ? 1 : 0.6 ) );
		}
	}
}
riser( pre, 8.3, 10.0, 0.9 );

// Drop 10.0: impact + sonic logo + groove until the tape stop at 13.0.
boom( pre, 10.0, 1 );
crash( pre, 10.0, 1 );
sonicLogo( pre, 10.02, 1 );
grooveBar( pre, 10, 10, 13.4, { strumAdd: true, lift: true } );
grooveBar( pre, 12, 10, 13.4, { strumAdd: true, lift: true } );

// Timer 13–17: stiff static drone, then a reverse swell back into the groove.
pad( post, 13.0, 3.9, [ 45, 52, 59 ], { vel: 0.55, cutoff: 650, attack: 0.25, release: 0.2, wobble: 0 } );
swell( post, 16.35, 17.0, [ 52, 56, 59, 64 ], 0.9 );

// Groove 17–43 (from beat 3 of bar 8). Hook phrases at 18, 26 (sparse), 34 (sparse).
grooveBar( post, 16, 17.0, 18 );
for ( let bar = 9; bar <= 21; bar++ ) {
	const t0 = bar * BAR;
	grooveBar( post, t0, t0, Math.min( t0 + BAR, 43.0 ), { lift: bar >= 17 } );
}
hook( post, 18.0, HOOK, { vel: 1 } );
hook( post, 26.0, HOOK_SPARSE, { vel: 0.85 } );
hook( post, 34.0, HOOK_SPARSE, { vel: 0.8 } );
// Little fill into the bar-13 phrase and the bar-17 lift.
for ( const t of [ 25.5, 33.5 ] ) {
	clap( post, t + 0.125, 0.5 );
	clap( post, t + 0.25, 0.7 );
	clap( post, t + 0.375, 0.9 );
}

// Breakdown 43–48: drums out; pad + sparse marimba "data points"; riser into 48.
pad( post, 43.0, 1.0, [ 45, 61, 64, 71 ], { vel: 0.8, cutoff: 1300 } );
pad( post, 44.0, 2.0, [ 42, 57, 61, 64 ], { vel: 0.85, cutoff: 1300 } );
pad( post, 46.0, 1.0, [ 38, 57, 61, 66 ], { vel: 0.85, cutoff: 1400 } );
pad( post, 47.0, 1.0, [ 40, 57, 59, 64 ], { vel: 0.9, cutoff: 1600 } );
bass( post, 44.0, 42, 1.6, 0.6 );
bass( post, 46.0, 38, 0.9, 0.6 );
bass( post, 47.0, 40, 0.9, 0.6 );
for ( const [ t, m ] of [ [ 43.5, 76 ], [ 44.75, 73 ], [ 45.25, 69 ], [ 46.25, 73 ], [ 46.75, 71 ] ] ) marimba( post, t, m, { vel: 0.55, len: 1.6, send: 0.45 } );
riser( post, 46.6, 48.0, 0.8 );

// Groove 48–58 with lift; bar 24 (48–50) has no hook (chime at 49.10).
crash( post, 48.0, 0.8 );
for ( let bar = 24; bar <= 28; bar++ ) {
	const t0 = bar * BAR;
	grooveBar( post, t0, t0, t0 + BAR, { lift: true, strumAdd: bar !== 24 } );
}
hook( post, 50.0, HOOK_END, { vel: 1, glockDouble: true } );
riser( post, 56.8, 58.0, 0.6 );

// Final hit 58.0: A(add9) strum, sub, crash, sonic logo; rings to 60.
kick( post, 58.0, 1.1 );
boom( post, 58.0, 0.8 );
crash( post, 58.0, 1.0 );
strum( post, 58.0, CH.A, { len: 1.95, add: true, vel: 1.1 } );
bass( post, 58.0, 33, 1.7, 1 );
bass( post, 58.0, 45, 1.7, 0.6 );
pad( post, 58.0, 1.6, [ 45, 57, 61, 64, 71 ], { vel: 1, cutoff: 2000, attack: 0.03, release: 0.4 } );
sonicLogo( post, 58.06, 0.9 );

// ── Tape stop at 13.0 on the pre bus ─────────────────────────────────────────
{
	const s0 = Math.round( 13.0 * SR ), stopLen = Math.round( 0.38 * SR );
	for ( const ch of pre ) {
		const src = ch.slice( s0, s0 + Math.round( 0.6 * SR ) );
		let pos = 0;
		for ( let i = 0; i < stopLen; i++ ) {
			const p = i / stopLen;
			const rate = Math.pow( 1 - p, 1.6 );
			const i0 = Math.floor( pos ), fr = pos - i0;
			const v = ( src[ i0 ] ?? 0 ) + ( ( src[ i0 + 1 ] ?? 0 ) - ( src[ i0 ] ?? 0 ) ) * fr;
			ch[ s0 + i ] = v * ( 1 - Math.pow( p, 3 ) );
			pos += rate;
		}
		ch.fill( 0, s0 + stopLen, Math.round( 17.0 * SR ) );
	}
	// The reverb send also stops there (no tails of the stopped groove).
	for ( const ch of verbSend ) {
		for ( let i = Math.round( 13.05 * SR ); i < Math.round( 16.3 * SR ); i++ ) ch[ i ] *= 0.15;
	}
}

// ── Kick → bass/strum sidechain (gentle pump) ────────────────────────────────
// Applied to the whole music bus except the kicks themselves would need stems;
// a light global pump keeps the groove breathing without audible artifacts.
const music = bus();
for ( let c = 0; c < 2; c++ ) for ( let i = 0; i < LEN; i++ ) music[ c ][ i ] = pre[ c ][ i ] + post[ c ][ i ];
{
	const pump = new Float32Array( LEN ).fill( 1 );
	for ( const t of kickTimes ) {
		const s = Math.round( t * SR );
		for ( let i = 0; i < Math.round( 0.22 * SR ) && s + i < LEN; i++ ) {
			const g = 1 - 0.22 * Math.exp( -( i / SR ) / 0.07 ) * Math.min( 1, i / ( 0.004 * SR ) );
			pump[ s + i ] = Math.min( pump[ s + i ], g );
		}
	}
	// Kicks themselves were placed into the buses; re-add them un-pumped by
	// compensating the pump at the kick onsets only (pump starts at 1 → dips after attack).
	for ( let c = 0; c < 2; c++ ) for ( let i = 0; i < LEN; i++ ) music[ c ][ i ] *= pump[ i ];
}

// ── Reverb ───────────────────────────────────────────────────────────────────
const irPath = `${ WORK }/ir-plate.wav`;
makeIR( irPath, { rt: 1.7, pre: 0.018, hfDamp: 0.6, seed: 11, early: 10 } );
writeWav( `${ WORK }/music-send.wav`, verbSend, { float: true } );
convolve( `${ WORK }/music-send.wav`, irPath, `${ WORK }/music-wet.wav` );
const wet = readWav( `${ WORK }/music-wet.wav` ).ch;
for ( let c = 0; c < 2; c++ ) for ( let i = 0; i < LEN; i++ ) music[ c ][ i ] += ( wet[ c ][ i ] ?? 0 ) * 0.55;

// Master-of-stem polish: low-cut, gentle tilt, end fade 59.3–60.0.
for ( let c = 0; c < 2; c++ ) {
	run( music[ c ], biquad( 'hp', 30, 0.7 ), biquad( 'lowshelf', 110, 0.7, -1.5 ), biquad( 'highshelf', 9000, 0.7, 1.0 ) );
	const f0 = Math.round( 59.3 * SR );
	for ( let i = f0; i < LEN; i++ ) music[ c ][ i ] *= 0.5 + 0.5 * Math.cos( ( Math.PI * ( i - f0 ) ) / ( LEN - f0 ) );
}
let peak = 0;
for ( let c = 0; c < 2; c++ ) for ( let i = 0; i < LEN; i++ ) peak = Math.max( peak, Math.abs( music[ c ][ i ] ) );
const g = 0.5 / peak; // −6 dBFS peak; the mix sets the real level
for ( let c = 0; c < 2; c++ ) for ( let i = 0; i < LEN; i++ ) music[ c ][ i ] *= g;
writeWav( `${ WORK }/music.wav`, music, { float: true } );
console.log( 'music.wav written; raw peak', peak.toFixed( 3 ), 'kicks', kickTimes.length );
