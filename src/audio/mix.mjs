// Mix & master. VO is king: music is ducked under VO with a look-ahead envelope
// and lifts in the gaps (the logo drop and the final hit punch through). The SFX
// bus sits at unity so its stem carries the finish chime's exact samples.
// Stems (vo/music/sfx) are written level-matched: their sum is the pre-master
// mix. The master applies one gain plus a 4×-oversampled true-peak limiter,
// iterated until −14.0 LUFS integrated at ≤ −1 dBTP (YouTube spec).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SR, LEN, WORK, FINAL, ffmpeg, readWav, writeWav, loudness, biquad, run } from './lib.mjs';

mkdirSync( `${ FINAL }/audio`, { recursive: true } );
mkdirSync( `${ FINAL }/stems`, { recursive: true } );
const fit = ( a ) => {
	const o = new Float32Array( LEN );
	o.set( a.subarray( 0, LEN ) );
	return o;
};
const voMono = fit( readWav( `${ WORK }/vo/vo-proc.wav` ).ch[ 0 ] );
const music = readWav( `${ WORK }/music.wav` ).ch.map( fit );
const sfx = readWav( `${ WORK }/sfx.wav` ).ch.map( fit );
const db = ( g ) => 20 * Math.log10( g );
const lin = ( d ) => Math.pow( 10, d / 20 );
const measure = ( chans, name ) => {
	const p = `${ WORK }/_m-${ name }.wav`;
	writeWav( p, chans, { float: true } );
	return loudness( p );
};

// ── Ducker (look-ahead) ──────────────────────────────────────────────────────
const FR = Math.round( 0.01 * SR );
const frames = Math.ceil( LEN / FR );
const act = new Float32Array( frames );
for ( let f = 0; f < frames; f++ ) {
	let s = 0;
	for ( let i = f * FR; i < Math.min( LEN, ( f + 1 ) * FR ); i++ ) s += voMono[ i ] * voMono[ i ];
	act[ f ] = 10 * Math.log10( s / FR + 1e-12 ) > -45 ? 1 : 0;
}
const dil = new Float32Array( frames );
const PRE = 12, POST = 18; // frames (120 ms look-ahead, 180 ms hang)
for ( let f = 0; f < frames; f++ ) if ( act[ f ] ) for ( let k = f - PRE; k <= f + POST; k++ ) if ( k >= 0 && k < frames ) dil[ k ] = 1;
const duck = new Float32Array( LEN );
const actEnv = new Float32Array( LEN );
{
	let e = 0;
	const atk = 1 - Math.exp( -1 / ( 0.06 * SR ) ), rel = 1 - Math.exp( -1 / ( 0.35 * SR ) );
	for ( let i = 0; i < LEN; i++ ) {
		const target = dil[ Math.floor( i / FR ) ];
		e += ( target - e ) * ( target > e ? atk : rel );
		const t = i / SR;
		const depth = t >= 9.95 && t < 10.3 ? -7 : t >= 57.95 && t < 58.45 ? -8 : -11.5;
		duck[ i ] = lin( depth * e );
		actEnv[ i ] = e;
	}
}
// Spectral duck: a broad −4 dB dip at 2.5 kHz in the music, faded in with VO activity.
const musicDucked = music.map( ( ch ) => {
	const eq = run( ch.slice(), biquad( 'peak', 2500, 0.7, -4 ) );
	return ch.map( ( v, i ) => ( v * ( 1 - actEnv[ i ] ) + eq[ i ] * actEnv[ i ] ) * duck[ i ] );
} );

// ── Balance ─────────────────────────────────────────────────────────────────
const VO_TARGET = -16.0, MUSIC_TARGET = -23.0;
const voL = measure( [ voMono, voMono ], 'vo' ).I;
const gV = lin( VO_TARGET - voL );
const muL = measure( musicDucked, 'mu' ).I;
const gM = lin( MUSIC_TARGET - muL );
let stemVO = [ voMono.map( ( v ) => v * gV ), voMono.map( ( v ) => v * gV ) ];
const stemMU = musicDucked.map( ( ch ) => ch.map( ( v ) => v * gM ) );
const stemFX = sfx; // unity
const pre = [ 0, 1 ].map( ( c ) => {
	const o = new Float32Array( LEN );
	for ( let i = 0; i < LEN; i++ ) o[ i ] = stemVO[ c ][ i ] + stemMU[ c ][ i ] + stemFX[ c ][ i ];
	return o;
} );
const preL = measure( pre, 'pre' );

// ── True-peak limiter ────────────────────────────────────────────────────────
const TAPS = 12;
const PHASES = [ 0.25, 0.5, 0.75 ].map( ( fr ) => {
	const c = [];
	for ( let j = -TAPS + 1; j <= TAPS; j++ ) {
		const x = j - fr;
		const sinc = Math.abs( x ) < 1e-9 ? 1 : Math.sin( Math.PI * x ) / ( Math.PI * x );
		const w = 0.5 + 0.5 * Math.cos( ( Math.PI * x ) / ( TAPS + 1 ) );
		c.push( [ j, sinc * w ] );
	}
	return c;
} );
function truePeakEnvelope( chans ) {
	const pk = new Float32Array( LEN );
	for ( const x of chans ) {
		for ( let n = 0; n < LEN; n++ ) {
			let m = Math.abs( x[ n ] );
			for ( const ph of PHASES ) {
				let s = 0;
				for ( const [ j, c ] of ph ) {
					const k = n + j;
					if ( k >= 0 && k < LEN ) s += x[ k ] * c;
				}
				m = Math.max( m, Math.abs( s ) );
			}
			if ( m > pk[ n ] ) pk[ n ] = m;
		}
	}
	return pk;
}
function limit( chans, gain, ceilDb ) {
	const ceil = lin( ceilDb );
	const x = chans.map( ( ch ) => ch.map( ( v ) => v * gain ) );
	const pk = truePeakEnvelope( x );
	const W = Math.round( 0.002 * SR );
	const req = new Float32Array( LEN );
	for ( let n = 0; n < LEN; n++ ) req[ n ] = Math.min( 1, ceil / Math.max( pk[ n ], 1e-12 ) );
	// Symmetric sliding minimum over ±W.
	const g1 = new Float32Array( LEN );
	const dq = [];
	let head = 0;
	for ( let n = 0; n < LEN + W; n++ ) {
		if ( n < LEN ) {
			while ( dq.length > head && req[ dq[ dq.length - 1 ] ] >= req[ n ] ) dq.pop();
			dq.push( n );
		}
		const c = n - W;
		if ( c >= 0 ) {
			while ( dq[ head ] < c - W ) head++;
			g1[ c ] = req[ dq[ head ] ];
		}
	}
	// Triangular smoothing (box ×2), then slow release.
	const box = ( a, L ) => {
		const o = new Float32Array( LEN );
		let s = 0;
		for ( let n = 0; n < LEN; n++ ) {
			s += a[ n ];
			if ( n >= L ) s -= a[ n - L ];
			o[ n ] = s / Math.min( n + 1, L );
		}
		// Re-centre the box (shift left by L/2) so smoothing stays symmetric.
		const h = Math.floor( L / 2 );
		const c = new Float32Array( LEN );
		for ( let n = 0; n < LEN; n++ ) c[ n ] = o[ Math.min( LEN - 1, n + h ) ];
		return c;
	};
	const g2 = box( box( g1, W + 1 ), W + 1 );
	const rel = 1 - Math.exp( -1 / ( 0.08 * SR ) );
	let g = 1, reductions = 0;
	for ( let n = 0; n < LEN; n++ ) {
		const target = Math.min( g2[ n ], g1[ n ] );
		g = target < g ? target : g + ( target - g ) * rel;
		if ( g < 0.999 ) reductions++;
		x[ 0 ][ n ] *= g;
		x[ 1 ][ n ] *= g;
	}
	return { x, reducedPct: ( 100 * reductions ) / LEN };
}

// VO peak control (hard glottal onsets): −3 dBFS ceiling on the VO stem.
{
	const { x, reducedPct: voPct } = limit( stemVO, 1, -3.0 );
	stemVO = x;
	for ( let c = 0; c < 2; c++ ) for ( let i = 0; i < LEN; i++ ) pre[ c ][ i ] = stemVO[ c ][ i ] + stemMU[ c ][ i ] + stemFX[ c ][ i ];
	console.log( `VO peak limiter touched ${ voPct.toFixed( 2 ) }% of samples` );
}
const preL2 = measure( pre, 'pre2' );
// Gain search to −14.0 LUFS integrated, ≤ −1 dBTP.
let G = lin( -14 - preL2.I );
let master, m, reducedPct;
for ( let it = 0; it < 6; it++ ) {
	( { x: master, reducedPct } = limit( pre, G, -1.3 ) );
	m = measure( master, 'master' );
	console.log( `iter ${ it }: gain ${ db( G ).toFixed( 2 ) } dB → I ${ m.I } LUFS, TP ${ m.TP } dBTP, limiting ${ reducedPct.toFixed( 2 ) }% of samples` );
	if ( Math.abs( m.I + 14 ) <= 0.05 && m.TP <= -1.0 ) break;
	G *= lin( -14 - m.I );
}

// ── Write deliverables ───────────────────────────────────────────────────────
writeWav( `${ FINAL }/audio/mix-master.wav`, master );
ffmpeg( [ '-i', `${ FINAL }/audio/mix-master.wav`, '-c:a', 'aac', '-b:a', '320k', '-ar', String( SR ), '-movflags', '+faststart', `${ FINAL }/audio/mix-master.m4a` ] );
writeWav( `${ FINAL }/stems/vo.wav`, stemVO );
writeWav( `${ FINAL }/stems/music.wav`, stemMU );
writeWav( `${ FINAL }/stems/sfx.wav`, stemFX );

// Captions: one cue per VO line, end = line end + 0.2 s, never into the next cue.
const lines = JSON.parse( readFileSync( `${ WORK }/vo/lines.json`, 'utf8' ) );
const ts = ( s ) => {
	const ms = Math.round( s * 1000 );
	const p = ( n, w = 2 ) => String( n ).padStart( w, '0' );
	return `${ p( Math.floor( ms / 3600000 ) ) }:${ p( Math.floor( ms / 60000 ) % 60 ) }:${ p( Math.floor( ms / 1000 ) % 60 ) },${ p( ms % 1000, 3 ) }`;
};
const srt = lines.map( ( l, i ) => {
	const next = lines[ i + 1 ];
	const end = Math.min( l.end + 0.2, next ? next.start - 0.001 : 60 );
	return `${ i + 1 }\n${ ts( l.start ) } --> ${ ts( end ) }\n${ l.text }\n`;
} ).join( '\n' );
writeFileSync( `${ FINAL }/captions.en.srt`, srt );

const report = {
	gains_dB: { vo: +db( gV ).toFixed( 2 ), music: +db( gM ).toFixed( 2 ), sfx: 0, master: +db( G ).toFixed( 2 ) },
	stemsLUFS: { vo: measure( stemVO, 'svo' ).I, music: measure( stemMU, 'smu' ).I, sfx: measure( stemFX, 'sfx' ).I },
	preMaster: preL2,
	master: m,
	limitingPctOfSamples: +reducedPct.toFixed( 3 ),
	duckDepth_dB: { normal: -11.5, logoDrop: -7, finalHit: -8, spectral: '−4 dB @ 2.5 kHz under VO' },
};
writeFileSync( `${ WORK }/mix-report.json`, JSON.stringify( report, null, 1 ) );
console.log( JSON.stringify( report, null, 1 ) );
