// Shared DSP for the spot's soundtrack: WAV I/O, filters, oscillators, plucks,
// envelopes, and a synthesized convolution-reverb impulse response. Everything
// is deterministic (seeded noise) so a re-run reproduces the same audio.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

export const SR = 48000;
export const DUR = 60;
export const LEN = SR * DUR;
// The project root, the audio work dir (intermediates; $BSB_VIDEO_WORK moves all of
// work/) and the deliverables folder.
export const ROOT = new URL( '../../', import.meta.url ).pathname;
export const WORK = `${ process.env.BSB_VIDEO_WORK ?? `${ ROOT }work` }/audio`;
export const FINAL = `${ ROOT }final`;
mkdirSync( WORK, { recursive: true } );
export const TIMING = JSON.parse( readFileSync( `${ ROOT }src/shots.json`, 'utf8' ) );

export const ffmpeg = ( args ) => execFileSync( 'ffmpeg', [ '-v', 'error', '-y', ...args ], { stdio: [ 'ignore', 'inherit', 'inherit' ] } );

// ── Randomness ───────────────────────────────────────────────────────────────
export function rng( seed ) {
	return function () {
		seed |= 0;
		seed = ( seed + 0x6d2b79f5 ) | 0;
		let t = Math.imul( seed ^ ( seed >>> 15 ), 1 | seed );
		t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
	};
}

// ── Buses ────────────────────────────────────────────────────────────────────
export const bus = ( len = LEN ) => [ new Float32Array( len ), new Float32Array( len ) ];
/** Equal-power pan gains for p in [-1, 1]. */
export const pan = ( p ) => [ Math.cos( ( ( p + 1 ) * Math.PI ) / 4 ), Math.sin( ( ( p + 1 ) * Math.PI ) / 4 ) ];
/** Mixes a mono buffer into a stereo bus at time t0 (s). */
export function place( b, t0, mono, gain = 1, p = 0 ) {
	const [ gl, gr ] = pan( p );
	const s = Math.round( t0 * SR );
	const n = Math.min( mono.length, b[ 0 ].length - s );
	for ( let i = Math.max( 0, -s ); i < n; i++ ) {
		b[ 0 ][ s + i ] += mono[ i ] * gain * gl;
		b[ 1 ][ s + i ] += mono[ i ] * gain * gr;
	}
}
/** Mixes a stereo pair into a bus at t0. */
export function placeStereo( b, t0, L, R, gain = 1 ) {
	const s = Math.round( t0 * SR );
	const n = Math.min( L.length, b[ 0 ].length - s );
	for ( let i = Math.max( 0, -s ); i < n; i++ ) {
		b[ 0 ][ s + i ] += L[ i ] * gain;
		b[ 1 ][ s + i ] += R[ i ] * gain;
	}
}
export const seg = ( seconds ) => new Float32Array( Math.max( 1, Math.round( seconds * SR ) ) );

// ── Filters ──────────────────────────────────────────────────────────────────
/** RBJ biquad; returns a stateful sample processor. type: lp hp bp peak lowshelf highshelf notch */
export function biquad( type, f0, q = 0.707, gainDb = 0 ) {
	const A = Math.pow( 10, gainDb / 40 );
	const w = ( 2 * Math.PI * Math.min( f0, SR * 0.45 ) ) / SR;
	const c = Math.cos( w ), s = Math.sin( w ), a = s / ( 2 * q );
	let b0, b1, b2, a0, a1, a2;
	switch ( type ) {
		case 'lp': [ b0, b1, b2, a0, a1, a2 ] = [ ( 1 - c ) / 2, 1 - c, ( 1 - c ) / 2, 1 + a, -2 * c, 1 - a ]; break;
		case 'hp': [ b0, b1, b2, a0, a1, a2 ] = [ ( 1 + c ) / 2, -( 1 + c ), ( 1 + c ) / 2, 1 + a, -2 * c, 1 - a ]; break;
		case 'bp': [ b0, b1, b2, a0, a1, a2 ] = [ a, 0, -a, 1 + a, -2 * c, 1 - a ]; break;
		case 'notch': [ b0, b1, b2, a0, a1, a2 ] = [ 1, -2 * c, 1, 1 + a, -2 * c, 1 - a ]; break;
		case 'peak': [ b0, b1, b2, a0, a1, a2 ] = [ 1 + a * A, -2 * c, 1 - a * A, 1 + a / A, -2 * c, 1 - a / A ]; break;
		case 'lowshelf': {
			const sq = 2 * Math.sqrt( A ) * a;
			[ b0, b1, b2, a0, a1, a2 ] = [ A * ( ( A + 1 ) - ( A - 1 ) * c + sq ), 2 * A * ( ( A - 1 ) - ( A + 1 ) * c ), A * ( ( A + 1 ) - ( A - 1 ) * c - sq ), ( A + 1 ) + ( A - 1 ) * c + sq, -2 * ( ( A - 1 ) + ( A + 1 ) * c ), ( A + 1 ) + ( A - 1 ) * c - sq ];
			break;
		}
		case 'highshelf': {
			const sq = 2 * Math.sqrt( A ) * a;
			[ b0, b1, b2, a0, a1, a2 ] = [ A * ( ( A + 1 ) + ( A - 1 ) * c + sq ), -2 * A * ( ( A - 1 ) + ( A + 1 ) * c ), A * ( ( A + 1 ) + ( A - 1 ) * c - sq ), ( A + 1 ) - ( A - 1 ) * c + sq, 2 * ( ( A - 1 ) - ( A + 1 ) * c ), ( A + 1 ) - ( A - 1 ) * c - sq ];
			break;
		}
		default: throw new Error( type );
	}
	b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
	let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
	return ( x ) => {
		const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
		x2 = x1; x1 = x; y2 = y1; y1 = y;
		return y;
	};
}
/** Runs a chain of sample processors over a buffer in place. */
export function run( buf, ...procs ) {
	for ( let i = 0; i < buf.length; i++ ) {
		let v = buf[ i ];
		for ( const p of procs ) v = p( v );
		buf[ i ] = v;
	}
	return buf;
}
/** One-pole lowpass with a per-sample cutoff function (for sweeps). */
export function sweepLP( buf, cutoffAt ) {
	let y = 0;
	for ( let i = 0; i < buf.length; i++ ) {
		const fc = cutoffAt( i / SR );
		const a = 1 - Math.exp( ( -2 * Math.PI * fc ) / SR );
		y += a * ( buf[ i ] - y );
		buf[ i ] = y;
	}
	return buf;
}
/** State-variable band-pass with per-sample centre/q (for whoosh sweeps). */
export function sweepBP( buf, fAt, q = 1.2 ) {
	let lp = 0, bp = 0;
	for ( let i = 0; i < buf.length; i++ ) {
		const f = 2 * Math.sin( ( Math.PI * Math.min( fAt( i / SR ), SR * 0.2 ) ) / SR );
		const hp = buf[ i ] - lp - bp / q;
		bp += f * hp;
		lp += f * bp;
		buf[ i ] = bp;
	}
	return buf;
}

// ── Sources ──────────────────────────────────────────────────────────────────
export function white( n, r ) {
	const out = new Float32Array( n );
	for ( let i = 0; i < n; i++ ) out[ i ] = r() * 2 - 1;
	return out;
}
/** Pink-ish noise (Paul Kellet's economy filter). */
export function pink( n, r ) {
	const out = new Float32Array( n );
	let b0 = 0, b1 = 0, b2 = 0;
	for ( let i = 0; i < n; i++ ) {
		const w = r() * 2 - 1;
		b0 = 0.99765 * b0 + w * 0.099046;
		b1 = 0.963 * b1 + w * 0.2965164;
		b2 = 0.57 * b2 + w * 1.0526913;
		out[ i ] = ( b0 + b1 + b2 + w * 0.1848 ) * 0.25;
	}
	return out;
}
export const midi = ( m ) => 440 * Math.pow( 2, ( m - 69 ) / 12 );

/**
 * Karplus–Strong plucked string: fractional delay tuned for the averaging loop
 * filter's half-sample delay, a lowpassed noise excitation shaped by a
 * pick-position comb. Returns a mono buffer.
 */
export function ks( freq, dur, r, { decay = 0.996, bright = 0.5, pickPos = 0.18 } = {} ) {
	const n = Math.round( dur * SR );
	const out = new Float32Array( n );
	const D = SR / freq - 0.5;
	const L = Math.ceil( D ) + 4;
	const line = new Float32Array( L );
	const P = Math.max( 2, Math.round( SR / freq ) );
	const exc = new Float32Array( P );
	let lp = 0;
	const a = 0.12 + 0.8 * bright;
	for ( let i = 0; i < P; i++ ) {
		lp += a * ( r() * 2 - 1 - lp );
		exc[ i ] = lp;
	}
	const pk = Math.max( 1, Math.round( P * pickPos ) );
	let w = 0, prev = 0;
	for ( let i = 0; i < n; i++ ) {
		let rp = w - D;
		while ( rp < 0 ) rp += L;
		const i0 = Math.floor( rp ), fr = rp - i0;
		const s0 = line[ i0 % L ], s1 = line[ ( i0 + 1 ) % L ];
		const delayed = s0 + ( s1 - s0 ) * fr;
		const lf = decay * 0.5 * ( delayed + prev );
		prev = delayed;
		const e = i < P ? exc[ i ] - ( i >= pk ? exc[ i - pk ] : 0 ) : 0;
		const x = e + lf;
		line[ w ] = x;
		w = ( w + 1 ) % L;
		out[ i ] = x;
	}
	let dc = 0;
	for ( let i = 0; i < n; i++ ) {
		dc += 0.0008 * ( out[ i ] - dc );
		out[ i ] -= dc;
	}
	const fade = Math.min( n, Math.round( 0.03 * SR ) );
	for ( let i = 0; i < fade; i++ ) out[ n - 1 - i ] *= i / fade;
	return out;
}

/** Exponential decay envelope multiplier (time constant tau, s). */
export const expEnv = ( t, attack, tau ) => ( t < attack ? t / attack : Math.exp( -( t - attack ) / tau ) );

// ── WAV I/O ─────────────────────────────────────────────────────────────────
/** Reads a PCM16/24/32 or float32 WAV into Float32Array channels. */
export function readWav( path ) {
	const b = readFileSync( path );
	let p = 12, fmt, data;
	while ( p < b.length ) {
		const id = b.toString( 'ascii', p, p + 4 );
		const size = b.readUInt32LE( p + 4 );
		if ( id === 'fmt ' ) fmt = { format: b.readUInt16LE( p + 8 ), ch: b.readUInt16LE( p + 10 ), sr: b.readUInt32LE( p + 12 ), bits: b.readUInt16LE( p + 22 ) };
		if ( id === 'data' ) data = { off: p + 8, size };
		p += 8 + size + ( size & 1 );
	}
	const { ch, bits, format } = fmt;
	const bps = bits / 8;
	const frames = Math.floor( data.size / ( bps * ch ) );
	const out = Array.from( { length: ch }, () => new Float32Array( frames ) );
	for ( let i = 0; i < frames; i++ ) {
		for ( let c = 0; c < ch; c++ ) {
			const o = data.off + ( i * ch + c ) * bps;
			let v;
			if ( format === 3 ) v = b.readFloatLE( o );
			else if ( bits === 16 ) v = b.readInt16LE( o ) / 32768;
			else if ( bits === 24 ) v = ( b.readIntLE( o, 3 ) ) / 8388608;
			else v = b.readInt32LE( o ) / 2147483648;
			out[ c ][ i ] = v;
		}
	}
	return { sr: fmt.sr, ch: out };
}
/** Writes channels as 24-bit PCM (default) or 32-bit float WAV. */
export function writeWav( path, chans, { float = false, sr = SR } = {} ) {
	const ch = chans.length, n = chans[ 0 ].length;
	const bps = float ? 4 : 3;
	const data = Buffer.alloc( n * ch * bps );
	for ( let i = 0; i < n; i++ ) {
		for ( let c = 0; c < ch; c++ ) {
			const o = ( i * ch + c ) * bps;
			const v = chans[ c ][ i ];
			if ( float ) data.writeFloatLE( v, o );
			else data.writeIntLE( Math.max( -8388608, Math.min( 8388607, Math.round( v * 8388607 ) ) ), o, 3 );
		}
	}
	const h = Buffer.alloc( 44 );
	h.write( 'RIFF', 0 ); h.writeUInt32LE( 36 + data.length, 4 ); h.write( 'WAVE', 8 );
	h.write( 'fmt ', 12 ); h.writeUInt32LE( 16, 16 ); h.writeUInt16LE( float ? 3 : 1, 20 ); h.writeUInt16LE( ch, 22 );
	h.writeUInt32LE( sr, 24 ); h.writeUInt32LE( sr * ch * bps, 28 ); h.writeUInt16LE( ch * bps, 32 ); h.writeUInt16LE( bps * 8, 34 );
	h.write( 'data', 36 ); h.writeUInt32LE( data.length, 40 );
	writeFileSync( path, Buffer.concat( [ h, data ] ) );
}

// ── Reverb ───────────────────────────────────────────────────────────────────
/**
 * Synthesizes a stereo impulse response: sparse early reflections plus a
 * decorrelated noise tail with RT60 `rt` seconds whose highs die faster.
 */
export function makeIR( path, { rt = 1.4, pre = 0.012, hfDamp = 0.55, seed = 7, early = 8 } = {} ) {
	const r = rng( seed );
	const n = Math.round( ( rt * 1.1 + pre ) * SR );
	const L = new Float32Array( n ), R = new Float32Array( n );
	const k = Math.log( 1000 ) / rt; // amplitude falls 60 dB over rt
	for ( const [ ch, off ] of [ [ L, 0 ], [ R, 1 ] ] ) {
		const rr = rng( seed * 31 + off * 977 );
		// Early reflections.
		for ( let e = 0; e < early; e++ ) {
			const t = pre + 0.004 + rr() * 0.045;
			const i = Math.round( t * SR );
			if ( i < n ) ch[ i ] += ( rr() < 0.5 ? -1 : 1 ) * ( 0.55 - e * 0.04 );
		}
		// Diffuse tail with time-varying lowpass (highs decay faster).
		let lp = 0;
		const start = Math.round( ( pre + 0.02 ) * SR );
		for ( let i = start; i < n; i++ ) {
			const t = ( i - start ) / SR;
			const fc = 9000 * Math.exp( -t * hfDamp * 3 ) + 900;
			const a = 1 - Math.exp( ( -2 * Math.PI * fc ) / SR );
			lp += a * ( ( rr() * 2 - 1 ) - lp );
			const fadeIn = Math.min( 1, t / 0.03 );
			ch[ i ] += lp * Math.exp( -k * t ) * 0.5 * fadeIn;
		}
	}
	void r;
	// Normalize energy.
	let e = 0;
	for ( let i = 0; i < n; i++ ) e += L[ i ] * L[ i ] + R[ i ] * R[ i ];
	const g = 1 / Math.sqrt( e / 2 );
	for ( let i = 0; i < n; i++ ) {
		L[ i ] *= g;
		R[ i ] *= g;
	}
	writeWav( path, [ L, R ], { float: true } );
}
/** Convolves a stereo float WAV with a stereo IR via ffmpeg afir (wet only). */
export function convolve( dryPath, irPath, outPath ) {
	ffmpeg( [ '-i', dryPath, '-i', irPath, '-filter_complex', '[0:a][1:a]afir=dry=0:wet=1:irnorm=-1:gtype=none[o]', '-map', '[o]', '-c:a', 'pcm_f32le', '-ar', String( SR ), outPath ] );
}

// ── Analysis ─────────────────────────────────────────────────────────────────
/** Integrated loudness (LUFS) and true peak (dBTP) via ffmpeg ebur128. */
export function loudness( path ) {
	const r = spawnSync( 'ffmpeg', [ '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-' ], { encoding: 'utf8' } );
	return parseEbur( `${ r.stderr ?? '' }${ r.stdout ?? '' }` );
}
export function parseEbur( text ) {
	const sum = text.slice( text.lastIndexOf( 'Summary:' ) );
	const I = Number( ( sum.match( /I:\s+(-?[\d.]+) LUFS/ ) || [] )[ 1 ] );
	const TP = Number( ( sum.match( /Peak:\s+(-?[\d.inf]+) dBFS/ ) || [] )[ 1 ] );
	const LRA = Number( ( sum.match( /LRA:\s+(-?[\d.]+) LU/ ) || [] )[ 1 ] );
	return { I, TP, LRA };
}
