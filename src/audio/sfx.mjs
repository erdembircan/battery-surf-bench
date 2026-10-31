// Designed, synthesized SFX for every cue in shots.json. All cues get a short
// room send except the finish chime, which is generated sample-exact from
// src/cockpit/FinishChime.ts and placed dry at unity gain (the SFX stem sits at
// unity in the mix, so the stem carries the chime's exact samples).
import { writeFileSync } from 'node:fs';
import { CHIME, chimeNote } from './sfx-chime.mjs';
import { SR, LEN, WORK, TIMING, bus, pan, place, seg, biquad, run, sweepBP, sweepLP, white, pink, rng, writeWav, makeIR, convolve, readWav } from './lib.mjs';

const R = rng( 404 );
const sfx = bus();
const send = bus();
const log = [];
function out( t, y, gain, p = 0, verb = 0.18 ) {
	place( sfx, t, y, gain, p );
	if ( verb ) place( send, t, y, gain * verb, p );
}
/** Places a mono buffer with a per-sample pan path. */
function outMoving( t, y, gain, panAt, verb = 0.18 ) {
	const s = Math.round( t * SR );
	for ( let i = 0; i < y.length && s + i < LEN; i++ ) {
		if ( s + i < 0 ) continue;
		const [ l, r ] = pan( panAt( i / y.length ) );
		sfx[ 0 ][ s + i ] += y[ i ] * gain * l;
		sfx[ 1 ][ s + i ] += y[ i ] * gain * r;
		send[ 0 ][ s + i ] += y[ i ] * gain * verb * l;
		send[ 1 ][ s + i ] += y[ i ] * gain * verb * r;
	}
}
const tone = ( f, dur, tau, attack = 0.001, f1 = f, glide = 0.01 ) => {
	const y = seg( dur );
	let ph = 0;
	for ( let i = 0; i < y.length; i++ ) {
		const tt = i / SR;
		const ff = f1 === f ? f : f + ( f1 - f ) * ( 1 - Math.exp( -tt / glide ) );
		ph += ff / SR;
		y[ i ] = Math.sin( 2 * Math.PI * ph ) * Math.min( 1, tt / attack ) * Math.exp( -tt / tau );
	}
	return y;
};
const burst = ( dur, tau, filt ) => {
	const y = white( Math.round( dur * SR ), R );
	run( y, ...filt );
	for ( let i = 0; i < y.length; i++ ) y[ i ] *= Math.exp( -( i / SR ) / tau );
	return y;
};
const mix = ( ...parts ) => {
	const n = Math.max( ...parts.map( ( [ y ] ) => y.length ) );
	const o = new Float32Array( n );
	for ( const [ y, g = 1, off = 0 ] of parts ) {
		const s = Math.round( off * SR );
		for ( let i = 0; i < y.length && s + i < n; i++ ) o[ s + i ] += y[ i ] * g;
	}
	return o;
};

// ── Sound designs ────────────────────────────────────────────────────────────
const mouseClick = ( t, level = 1, p = 0.1 ) => {
	const press = mix( [ burst( 0.004, 0.0012, [ biquad( 'bp', 3600, 1.4 ) ] ), 1 ], [ tone( 2150, 0.03, 0.004 ), 0.5 ], [ tone( 430, 0.04, 0.008 ), 0.35 ] );
	const rel = mix( [ burst( 0.003, 0.001, [ biquad( 'bp', 4200, 1.6 ) ] ), 0.6 ], [ tone( 2500, 0.02, 0.003 ), 0.3 ] );
	out( t, press, 0.12 * level, p, 0.08 );
	out( t + 0.072, rel, 0.12 * level, p, 0.08 );
};
const swish = ( t, dur, f0, f1, level, p0 = -0.3, p1 = 0.3 ) => {
	const y = pink( Math.round( dur * SR ), R );
	sweepBP( y, ( tt ) => f0 * Math.pow( f1 / f0, tt / dur ), 1.1 );
	for ( let i = 0; i < y.length; i++ ) y[ i ] *= Math.pow( Math.sin( ( Math.PI * i ) / y.length ), 1.5 );
	outMoving( t, y, level, ( q ) => p0 + ( p1 - p0 ) * q, 0.12 );
};
const whoosh = ( t, dur, fPath, level, panPath, { air = 0.3, tonal = 0 } = {} ) => {
	const n = Math.round( dur * SR );
	const y = pink( n, R );
	const h = white( n, R );
	sweepBP( y, ( tt ) => fPath( tt / dur ), 0.9 );
	run( h, biquad( 'hp', 5000 ) );
	let ph = 0;
	for ( let i = 0; i < n; i++ ) {
		const q = i / n;
		const env = Math.pow( Math.sin( Math.PI * Math.min( 1, q * 1.08 ) ), 1.6 );
		ph += ( fPath( q ) * 0.25 ) / SR;
		y[ i ] = ( y[ i ] + h[ i ] * air * 0.25 + tonal * 0.15 * Math.sin( 2 * Math.PI * ph ) ) * env;
	}
	outMoving( t, y, level, panPath, 0.2 );
};
const ticks = ( t, n, spacing, level ) => {
	for ( let k = 0; k < n; k++ ) out( t + k * spacing, burst( 0.004, 0.0009, [ biquad( 'hp', 3000 ) ] ), level * ( 1 - k * 0.15 ), 0.15, 0.05 );
};
const uiTick = ( t, f, level ) => out( t, mix( [ tone( f, 0.04, 0.007 ), 1 ], [ tone( f * 2, 0.03, 0.004 ), 0.3 ] ), level, 0.05, 0.1 );
const waveWash = ( t, dur, level, p0, p1 ) => {
	const n = Math.round( dur * SR );
	for ( const [ side, off ] of [ [ 0, 0 ], [ 1, 0.013 ] ] ) {
		const y = pink( n, rng( 77 + side ) );
		sweepLP( y, ( tt ) => 700 + 2800 * Math.sin( Math.PI * Math.min( 1, tt / dur ) ) );
		const fizz = white( n, rng( 99 + side ) );
		run( fizz, biquad( 'hp', 5200 ) );
		for ( let i = 0; i < n; i++ ) {
			const q = i / n;
			const env = q < 0.4 ? Math.pow( q / 0.4, 1.6 ) : Math.pow( 1 - ( q - 0.4 ) / 0.6, 1.3 );
			const grain = 0.5 + 0.5 * Math.sin( i * 0.0021 + Math.sin( i * 0.00037 ) * 4 );
			y[ i ] = ( y[ i ] * 2.2 + fizz[ i ] * 0.18 * grain ) * env;
		}
		outMoving( t + off, y, level * 0.7, ( q ) => ( side ? 0.4 : -0.4 ) + ( p1 - p0 ) * ( q - 0.5 ), 0.25 );
	}
};
const droplets = ( t, n, spread, level, r = R ) => {
	for ( let k = 0; k < n; k++ ) {
		const f = 700 + r() * 1400;
		out( t + r() * spread, tone( f, 0.06, 0.022, 0.002, f * 1.4, 0.012 ), level * ( 0.5 + r() * 0.5 ), ( r() - 0.5 ) * 0.8, 0.3 );
	}
};
const splash = ( t, level ) => {
	out( t, burst( 0.35, 0.09, [ biquad( 'hp', 900 ), biquad( 'lp', 9000 ) ] ), level, 0, 0.35 );
	out( t, tone( 110, 0.12, 0.04, 0.003 ), level * 0.6, 0, 0.2 );
	droplets( t + 0.02, 9, 0.35, level * 0.35 );
};
const woodblock = ( t, accent ) => {
	const k = accent ? 1.03 : 1;
	const y = mix( [ tone( 1080 * k, 0.12, 0.022 ), 1 ], [ tone( 2730 * k, 0.06, 0.009 ), 0.45 ], [ tone( 4150 * k, 0.03, 0.004 ), 0.2 ], [ burst( 0.003, 0.0008, [ biquad( 'bp', 3000, 1 ) ] ), 0.5 ] );
	out( t, y, accent ? 0.2 : 0.14, 0, 0 );
};
const pageFlip = ( t, level ) => {
	const n = Math.round( 0.17 * SR );
	const y = pink( n, R );
	run( y, biquad( 'bp', 3200, 0.7 ) );
	for ( let i = 0; i < n; i++ ) {
		const q = i / n;
		y[ i ] *= ( 0.55 + 0.45 * Math.sin( 2 * Math.PI * 35 * ( i / SR ) ) ) * Math.sin( Math.PI * q ) * 2.5;
	}
	out( t, y, level * 0.8, -0.1, 0.1 );
	out( t + 0.12, mix( [ tone( 140, 0.08, 0.03, 0.002 ), 1 ], [ burst( 0.04, 0.012, [ biquad( 'lp', 400 ) ] ), 0.8 ] ), level, -0.1, 0.1 );
};
const bubblePop = ( t, f0, f1, level, p = 0 ) => {
	const y = mix( [ tone( f0, 0.16, 0.035, 0.003, f1, 0.015 ), 1 ], [ tone( f0 * 2, 0.08, 0.015, 0.003, f1 * 2, 0.015 ), 0.18 ], [ burst( 0.002, 0.0006, [ biquad( 'hp', 2000 ) ] ), 0.4 ] );
	out( t, y, level, p, 0.22 );
};
const shimmer = ( t, level ) => {
	const r = rng( 8 );
	for ( let k = 0; k < 9; k++ ) {
		const f = 2400 + r() * 4000;
		out( t + r() * 0.5, tone( f, 0.4, 0.12 + r() * 0.13, 0.002 ), level * ( 0.4 + r() * 0.6 ), ( r() - 0.5 ) * 1.4, 0.4 );
	}
	const air = white( Math.round( 0.7 * SR ), r );
	run( air, biquad( 'hp', 6000 ) );
	for ( let i = 0; i < air.length; i++ ) air[ i ] *= Math.sin( ( Math.PI * i ) / air.length ) * 0.5;
	out( t, air, level * 0.5, 0, 0.3 );
};
const chipTap = ( t, level ) => out( t, mix( [ burst( 0.002, 0.0007, [ biquad( 'bp', 2600, 1.2 ) ] ), 0.8 ], [ tone( 950, 0.05, 0.018 ), 1 ] ), level, -0.15, 0.1 );
const plugOut = ( t ) => {
	out( t, mix( [ burst( 0.002, 0.0006, [ biquad( 'hp', 4000 ) ] ), 1 ], [ tone( 2800, 0.06, 0.02 ), 0.25 ], [ tone( 95, 0.12, 0.055, 0.003 ), 0.9 ], [ burst( 0.035, 0.012, [ biquad( 'lp', 1500 ) ] ), 0.5, 0.004 ] ), 0.17, -0.2, 0.12 );
};
const buttonClick = ( t ) => out( t, mix( [ burst( 0.002, 0.0007, [ biquad( 'bp', 3000, 1 ) ] ), 0.9 ], [ tone( 620, 0.07, 0.025 ), 0.8 ], [ tone( 120, 0.08, 0.03, 0.002 ), 0.7 ] ), 0.14, 0, 0.12 );
const sampleTick = ( t, k ) => {
	const notes = [ 1318.51, 1108.73, 987.77, 880, 739.99, 659.25 ]; // descending A-major pentatonic
	out( t, mix( [ tone( notes[ k % 6 ], 0.25, 0.06, 0.0015 ), 1 ], [ tone( notes[ k % 6 ] * 3, 0.05, 0.008 ), 0.15 ] ), 0.085, -0.2 + k * 0.08, 0.25 );
};
const snap = ( t ) => {
	out( t, mix( [ burst( 0.004, 0.0012, [ biquad( 'bp', 2200, 2 ) ] ), 1.2 ], [ tone( 1760, 0.06, 0.025 ), 0.35 ], [ tone( 880, 0.18, 0.06 ), 0.45 ], [ tone( 150, 0.06, 0.03, 0.002 ), 0.6 ] ), 0.17, 0, 0.2 );
};
const paperFlip = ( t ) => {
	const n = Math.round( 0.28 * SR );
	const y = pink( n, R );
	run( y, biquad( 'bp', 2800, 0.6 ) );
	for ( let i = 0; i < n; i++ ) {
		const q = i / n;
		const env = q < 0.4 ? q / 0.4 : 1 - ( q - 0.4 ) / 0.6;
		y[ i ] *= ( 0.5 + 0.5 * Math.sin( 2 * Math.PI * 28 * ( i / SR ) ) ) * env * 2.4;
	}
	outMoving( t, y, 0.13, ( q ) => -0.3 + 0.6 * q, 0.15 );
	whoosh( t, 0.3, ( q ) => 500 + 600 * Math.sin( Math.PI * q ), 0.05, () => 0 );
};
const stampThud = ( t ) => {
	out( t, mix( [ tone( 85, 0.2, 0.05, 0.002 ), 1 ], [ tone( 320, 0.06, 0.025 ), 0.4 ], [ burst( 0.03, 0.009, [ biquad( 'lp', 2500 ) ] ), 0.7 ] ), 0.22, 0.1, 0.12 );
};
const finishChime = ( t ) => {
	CHIME.NOTES.forEach( ( f, k ) => {
		const y = seg( CHIME.STOP );
		for ( let i = 0; i < y.length; i++ ) y[ i ] = chimeNote( f, i );
		const s = Math.round( ( t + k * CHIME.STAGGER ) * SR );
		for ( let i = 0; i < y.length; i++ ) {
			sfx[ 0 ][ s + i ] += y[ i ];
			sfx[ 1 ][ s + i ] += y[ i ];
		}
	} );
	return Math.round( t * SR );
};
const chipPop = ( t, k ) => bubblePop( t, 480 + 80 * k, 1000 + 150 * k, 0.13, -0.4 + 0.4 * k );
const swell = ( t, dur, level ) => waveWash( t, dur, level, -0.5, 0.5 );

// ── Cue placement ────────────────────────────────────────────────────────────
let chimeAt = null;
const flipTimes = [];
for ( const s of TIMING.shots ) {
	for ( const [ off, label ] of s.sfx ) {
		const t = s.start + off;
		const L = label.toLowerCase();
		if ( L.startsWith( 'soft mouse click' ) ) mouseClick( t, 0.9 );
		else if ( L.startsWith( 'highlight swish' ) ) swish( t, 0.32, 1800, 6000, 0.05, -0.1, 0.2 );
		else if ( L.startsWith( 'scroll tick' ) ) ticks( t, 4, 0.038, 0.06 );
		else if ( L.startsWith( 'whoosh (pull back)' ) ) whoosh( t, 1.0, ( q ) => 2200 * Math.pow( 0.12, q ), 0.2, ( q ) => 0.3 * Math.sin( Math.PI * 2 * q ), { air: 0.45, tonal: 0.2 } );
		else if ( L.startsWith( 'ui tick' ) ) uiTick( t, 2200, 0.06 );
		else if ( L.startsWith( 'wave whoosh' ) ) waveWash( t, 1.1, 0.17, -0.9, 0.9 );
		else if ( L.startsWith( 'splash' ) ) splash( t, 0.17 );
		else if ( L.startsWith( 'metronome' ) ) {
			for ( let k = 0; t + k * 0.5 < s.end - 0.2; k++ ) woodblock( t + k * 0.5, Math.abs( ( ( t + k * 0.5 ) / 2 ) % 1 ) < 1e-6 );
		} else if ( L.startsWith( 'page flip clunk' ) ) {
			for ( let k = 0; k < 4; k++ ) {
				pageFlip( t + k * 1.0, 0.13 );
				flipTimes.push( +( t + k * 1.0 ).toFixed( 2 ) );
			}
		} else if ( L.startsWith( 'bark pop' ) ) bubblePop( t, 420, 980, 0.14, 0 );
		else if ( L === 'click' ) mouseClick( t, 0.85, 0 );
		else if ( L.startsWith( 'shimmer' ) ) shimmer( t, 0.05 );
		else if ( L.startsWith( 'whip whoosh' ) ) whoosh( t, 0.3, ( q ) => 600 * Math.pow( 8, q ), 0.22, ( q ) => -0.8 + 1.6 * q, { air: 0.6 } );
		else if ( L.startsWith( 'chip tap' ) ) chipTap( t, 0.1 );
		else if ( L.startsWith( 'slider swish' ) ) swish( t, 0.26, 1500, 4200, 0.06, -0.3, 0.2 );
		else if ( L.startsWith( 'click (add)' ) ) mouseClick( t, 0.9, 0.2 );
		else if ( L.startsWith( 'drag swish' ) ) swish( t, 0.36, 1000, 3000, 0.07, 0.3, -0.1 );
		else if ( L.startsWith( 'plug-out' ) ) plugOut( t );
		else if ( L.startsWith( 'button click' ) ) buttonClick( t );
		else if ( L.startsWith( 'run-start whoosh' ) ) whoosh( t, 0.62, ( q ) => 300 * Math.pow( 8, q ), 0.14, ( q ) => -0.2 + 0.5 * q, { air: 0.4, tonal: 0.5 } );
		else if ( L.startsWith( 'digital tick' ) ) uiTick( t, 2000 + 200 * ( ( s.sfx.findIndex( ( x ) => x[ 0 ] === off ) ) % 3 ), 0.05 );
		else if ( L.startsWith( 'sample ticks' ) ) for ( let k = 0; k < 6; k++ ) sampleTick( t + k * 0.3, k );
		else if ( L.startsWith( 'snap' ) ) snap( t );
		else if ( L.startsWith( 'paper flip' ) ) paperFlip( t );
		else if ( L.startsWith( 'stamp thud' ) ) stampThud( t );
		else if ( L.startsWith( 'finish chime' ) ) chimeAt = finishChime( t );
		else if ( L === 'pop' ) chipPop( t, log.filter( ( x ) => x.label === 'Pop' ).length );
		else if ( L.startsWith( 'wave swell' ) ) swell( t, 1.8, 0.13 );
		else if ( L.startsWith( 'tiny splash' ) ) {
			out( t, burst( 0.18, 0.06, [ biquad( 'hp', 1500 ) ] ), 0.07, 0.5, 0.3 );
			droplets( t, 4, 0.18, 0.05, rng( 31 ) );
		} else throw new Error( `unmapped sfx: ${ label }` );
		log.push( { t: +t.toFixed( 3 ), label, shot: s.id } );
	}
}

// Short room for everything but the chime.
const ir = `${ WORK }/ir-room.wav`;
makeIR( ir, { rt: 0.5, pre: 0.006, hfDamp: 1.1, seed: 5, early: 6 } );
writeWav( `${ WORK }/sfx-send.wav`, send, { float: true } );
convolve( `${ WORK }/sfx-send.wav`, ir, `${ WORK }/sfx-wet.wav` );
const wet = readWav( `${ WORK }/sfx-wet.wav` ).ch;
const chimeEnd = chimeAt + Math.round( ( 2 * CHIME.STAGGER + CHIME.STOP ) * SR );
for ( let c = 0; c < 2; c++ ) {
	for ( let i = 0; i < LEN; i++ ) {
		// Keep the chime's window dry so its samples stay exact.
		if ( i >= chimeAt && i < chimeEnd ) continue;
		sfx[ c ][ i ] += ( wet[ c ][ i ] ?? 0 ) * 0.5;
	}
}
writeWav( `${ WORK }/sfx.wav`, sfx, { float: true } );
writeFileSync( `${ WORK }/sfx-cues.json`, JSON.stringify( { cues: log, chimeSample: chimeAt, chimeSeconds: chimeAt / SR, metronome: '0.5 s grid from 13.0, accents on bar downbeats (14.0, 16.0)', pageFlips: flipTimes }, null, 1 ) );
console.log( 'sfx.wav written;', log.length, 'cues; chime at', chimeAt / SR, 's; page flips', flipTimes.join( ', ' ) );
