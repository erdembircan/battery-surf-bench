// Computed QC for the soundtrack deliverables.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { SR, WORK, FINAL, readWav, loudness } from './lib.mjs';
import { CHIME, chimeNote } from './sfx-chime.mjs';

const F = FINAL;
const dur = ( p ) => Number( execFileSync( 'ffprobe', [ '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p ], { encoding: 'utf8' } ).trim() );
const files = [ 'audio/mix-master.wav', 'audio/mix-master.m4a', 'stems/vo.wav', 'stems/music.wav', 'stems/sfx.wav' ];
const durations = Object.fromEntries( files.map( ( f ) => [ f, dur( `${ F }/${ f }` ) ] ) );
const master = loudness( `${ F }/audio/mix-master.wav` );
const m4a = loudness( `${ F }/audio/mix-master.m4a` );

// VO margins.
const lines = JSON.parse( readFileSync( `${ WORK }/vo/lines.json`, 'utf8' ) );
const margins = lines.map( ( l ) => [ l.id, l.margin ] );

// Chime: compare the SFX stem (24-bit) and the float SFX bus to the formula.
const cues = JSON.parse( readFileSync( `${ WORK }/sfx-cues.json`, 'utf8' ) );
const at = cues.chimeSample;
const span = Math.round( ( 2 * CHIME.STAGGER + CHIME.STOP ) * SR );
const expected = new Float64Array( span );
CHIME.NOTES.forEach( ( f, k ) => {
	const o = Math.round( k * CHIME.STAGGER * SR );
	for ( let i = 0; i < span - o; i++ ) expected[ o + i ] += chimeNote( f, i );
} );
const diff = ( ch ) => {
	let m = 0;
	for ( let i = 0; i < span; i++ ) m = Math.max( m, Math.abs( ch[ at + i ] - expected[ i ] ) );
	return m;
};
const stem = readWav( `${ F }/stems/sfx.wav` ).ch;
const bus = readWav( `${ WORK }/sfx.wav` ).ch;
const chime = {
	startSeconds: at / SR,
	maxAbsDiff_floatBus: Math.max( diff( bus[ 0 ] ), diff( bus[ 1 ] ) ),
	maxAbsDiff_24bitStem: Math.max( diff( stem[ 0 ] ), diff( stem[ 1 ] ) ),
	lsb24: 1 / 8388607,
	peakExpected: Math.max( ...expected.map( Math.abs ) ),
};

// Captions.
const srt = readFileSync( `${ F }/captions.en.srt`, 'utf8' ).trim().split( /\n\n/ );
const toS = ( s ) => {
	const [ h, m, rest ] = s.split( ':' );
	const [ sec, ms ] = rest.split( ',' );
	return +h * 3600 + +m * 60 + +sec + +ms / 1000;
};
const cueTimes = srt.map( ( b ) => b.split( '\n' )[ 1 ].split( ' --> ' ).map( toS ) );
const srtOk = cueTimes.every( ( [ a, b ], i ) => b > a && ( i === 0 || a >= cueTimes[ i - 1 ][ 1 ] ) ) && srt.length === lines.length;

const report = { durations, master, m4a, margins, minMargin: Math.min( ...lines.map( ( l ) => l.margin ) ), chime, captions: { cues: srt.length, ordered_non_overlapping: srtOk } };
writeFileSync( `${ WORK }/qc-report.json`, JSON.stringify( report, null, 1 ) );
console.log( JSON.stringify( report, null, 1 ) );
