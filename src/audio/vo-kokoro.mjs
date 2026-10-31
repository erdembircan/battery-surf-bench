// Final VO: the approved lines voiced by Kokoro-82M (hexgrad), female voice af_heart.
// kokoro/make-takes.sh synthesizes every line at several speeds into
// work/audio/vo-kokoro/ (Python 3.12 venv, see README.md) and tunes two of them:
// S16's sign-off is voiced as two sentences whose final words get a Praat (PSOLA)
// falling contour (kokoro/shape_signoff.py), so "Battery Surf Bench." closes like
// a statement; S11's pitch and energy are edited inside Kokoro before its vocoder
// runs (kokoro/accent.py), so "Start" carries the accent instead of trailing off.
// Per line, this picks the most natural take (1.05× preferred, then 1.0×, then
// faster) that ends ≥ 0.3 s before its cut, allowing the line to start up to
// 0.15 s earlier than the animatic offset, and writes vo-dry.wav, vo-proc.wav and
// lines.json to work/audio/vo/ for mix.mjs and qc.mjs.
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { SR, LEN, WORK, TIMING, ffmpeg, readWav, writeWav } from './lib.mjs';

const DIR = `${ WORK }/vo`;
const KDIR = `${ WORK }/vo-kokoro`;
mkdirSync( DIR, { recursive: true } );
const VOICE = 'af_heart';
const SPEEDS = [ '1.05', '1.00', '1.10', '1.15', '1.20' ];
const MARGIN = 0.3; // line must end this long before its cut
const NUDGE = [ 0, -0.05, -0.1, -0.15 ]; // allowed start shifts (s)
// Per-line sync bias: S12's callouts land on its phrases (Kokoro reads faster than the animatic voice).
const BIAS = { S12: 0.3 };

/** Trims leading/trailing silence relative to the take's own peak, with short fades. */
function trim( x ) {
	const win = Math.round( 0.005 * SR );
	const env = [];
	let peak = 1e-9;
	for ( let i = 0; i < x.length; i += win ) {
		let s = 0;
		for ( let j = i; j < Math.min( x.length, i + win ); j++ ) s += x[ j ] * x[ j ];
		const rms = Math.sqrt( s / win );
		env.push( rms );
		peak = Math.max( peak, rms );
	}
	const db = ( v ) => 20 * Math.log10( v / peak + 1e-12 );
	let a = env.findIndex( ( v ) => db( v ) > -38 );
	let b = env.length - 1 - [ ...env ].reverse().findIndex( ( v ) => db( v ) > -44 );
	a = Math.max( 0, a * win - Math.round( 0.015 * SR ) );
	b = Math.min( x.length, ( b + 1 ) * win + Math.round( 0.06 * SR ) );
	const y = x.slice( a, b );
	const fi = Math.round( 0.005 * SR ), fo = Math.round( 0.03 * SR );
	for ( let i = 0; i < fi; i++ ) y[ i ] *= i / fi;
	for ( let i = 0; i < fo; i++ ) y[ y.length - 1 - i ] *= 0.5 - 0.5 * Math.cos( ( Math.PI * i ) / fo );
	return y;
}
/** Active-speech RMS (frames above -40 dB of peak). */
function activeRms( x ) {
	const win = Math.round( 0.02 * SR );
	const frames = [];
	for ( let i = 0; i + win <= x.length; i += win ) {
		let s = 0;
		for ( let j = i; j < i + win; j++ ) s += x[ j ] * x[ j ];
		frames.push( s / win );
	}
	const pk = Math.max( ...frames );
	const act = frames.filter( ( f ) => f > pk * 1e-4 );
	return Math.sqrt( act.reduce( ( a, b ) => a + b, 0 ) / act.length );
}
/** Loads a 24 kHz Kokoro take, resampled to the project rate. */
function load( file ) {
	const out = file.replace( /\.wav$/, '-48k.wav' );
	ffmpeg( [ '-i', file, '-af', `aresample=${ SR }:filter_size=64:phase_shift=12:cutoff=0.96:linear_interp=1`, '-ac', '1', '-c:a', 'pcm_f32le', out ] );
	return trim( readWav( out ).ch[ 0 ] );
}

const placed = new Float32Array( LEN );
const lines = [];
let prevEnd = 0;
for ( const s of TIMING.shots ) {
	const cut = s.f1 / TIMING.FPS;
	let chosen = null;
	const tried = [];
	for ( const sp of SPEEDS ) {
		const file = `${ KDIR }/${ s.id.toLowerCase() }-${ VOICE }-${ sp }.wav`;
		if ( ! existsSync( file ) ) continue;
		const y = load( file );
		const dur = y.length / SR;
		for ( const n of NUDGE ) {
			const t0 = Math.max( s.start + 0.05, s.start + s.voAt + ( BIAS[ s.id ] ?? 0 ) + n );
			tried.push( `${ sp }@${ n }:${ dur.toFixed( 2 ) }` );
			if ( t0 + dur <= cut - MARGIN && t0 >= prevEnd + 0.25 ) {
				chosen = { y, dur, sp, t0 };
				break;
			}
		}
		if ( chosen ) break;
	}
	if ( ! chosen ) {
		throw new Error( `${ s.id }: no Kokoro take fits before ${ cut.toFixed( 2 ) } s (tried ${ tried.join( ', ' ) })` );
	}
	// Level-match to −20 dBFS active RMS.
	const g = Math.pow( 10, -20 / 20 ) / activeRms( chosen.y );
	const i0 = Math.round( chosen.t0 * SR );
	for ( let i = 0; i < chosen.y.length; i++ ) placed[ i0 + i ] += chosen.y[ i ] * g;
	prevEnd = chosen.t0 + chosen.dur;
	lines.push( { id: s.id, text: s.vo, voice: VOICE, speed: Number( chosen.sp ), start: +chosen.t0.toFixed( 4 ), end: +prevEnd.toFixed( 4 ), dur: +chosen.dur.toFixed( 3 ), shift: +( chosen.t0 - ( s.start + s.voAt ) ).toFixed( 3 ), cut: +cut.toFixed( 4 ), margin: +( cut - prevEnd ).toFixed( 3 ), tried } );
}
writeWav( `${ DIR }/vo-dry.wav`, [ placed ], { float: true } );
// Light chain: Kokoro is already clean and bright. HPF, a touch of low-mid
// clean-up, gentle presence, soft de-ess, gentle compression.
ffmpeg( [
	'-i', `${ DIR }/vo-dry.wav`,
	'-af', [
		'highpass=f=70:p=2',
		'equalizer=f=260:t=q:w=1.2:g=-1.2',
		'equalizer=f=3200:t=q:w=1.1:g=1.2',
		'deesser=i=0.3:m=0.5:f=0.5:s=o',
		'acompressor=threshold=0.1:ratio=2.5:attack=8:release=140:knee=4:makeup=1.2',
	].join( ',' ),
	'-c:a', 'pcm_f32le', '-ar', String( SR ), `${ DIR }/vo-proc.wav`,
] );
writeFileSync( `${ DIR }/lines.json`, JSON.stringify( lines, null, 1 ) );
console.table( lines.map( ( { id, speed, dur, shift, margin } ) => ( { id, speed, dur, shift, margin } ) ) );
