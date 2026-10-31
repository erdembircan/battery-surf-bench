// Encodes the rendered frames and the mastered soundtrack into the deliverables
// in final/: the master (H.264 High, CRF 16, AAC 320 kb/s), a lighter review copy
// (CRF 25, AAC 160 kb/s) and the two thumbnails. BSB_VIDEO_SCALE=2 encodes the 4K
// frames from work/frames-4k/ into the -4k master and review copy instead, and the
// encode stops if the frames aren't the size that scale renders.
// The JPEG frames are BT.601 full range; they're converted to BT.709 limited
// range and the stream is tagged BT.709, so players show the colours as rendered.
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { HEIGHT, SCALE, SUFFIX, WIDTH } from './output.mjs';

const ROOT = new URL( '../../', import.meta.url ).pathname;
const T = JSON.parse( readFileSync( `${ ROOT }src/shots.json`, 'utf8' ) );
const FRAMES = process.env.FRAMES_DIR ?? `${ process.env.BSB_VIDEO_WORK ?? `${ ROOT }work` }/frames${ SUFFIX }`;
const FINAL = `${ ROOT }final`;
const TOTAL = T.scenes.at( -1 ).f1;
const NAME = `battery-surf-bench-spot-60s${ SUFFIX }`;
const frame = ( i ) => `${ FRAMES }/${ String( i ).padStart( 4, '0' ) }.jpg`;

const missing = Array.from( { length: TOTAL }, ( _, i ) => i ).filter( ( i ) => ! existsSync( frame( i ) ) );
if ( missing.length ) {
	throw new Error( `${ missing.length } of ${ TOTAL } frames are missing in ${ FRAMES } (first: ${ missing[ 0 ] }); render them first` );
}
const sizes = execFileSync( 'magick', [ 'identify', '-ping', '-format', '%wx%h\n', ...Array.from( { length: TOTAL }, ( _, i ) => frame( i ) ) ], { encoding: 'utf8' } ).trim().split( '\n' );
const wrong = sizes.flatMap( ( s, i ) => ( s === `${ WIDTH }x${ HEIGHT }` ? [] : [ `${ String( i ).padStart( 4, '0' ) }.jpg is ${ s.replace( 'x', '×' ) }` ] ) );
if ( wrong.length ) {
	throw new Error( `${ wrong.length } of ${ TOTAL } frames in ${ FRAMES } aren't ${ WIDTH }×${ HEIGHT } (first: ${ wrong[ 0 ] }); render them with BSB_VIDEO_SCALE=${ SCALE } first` );
}
if ( ! existsSync( `${ FINAL }/audio/mix-master.wav` ) ) {
	throw new Error( 'final/audio/mix-master.wav is missing; run the audio steps first' );
}

const VF = 'scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv,format=yuv420p';
const BSF = 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0';
const encode = ( out, video, audioKbps ) => promisify( execFile )( 'ffmpeg', [
	'-v', 'error', '-y',
	'-framerate', String( T.FPS ), '-i', `${ FRAMES }/%04d.jpg`,
	'-i', `${ FINAL }/audio/mix-master.wav`,
	'-map', '0:v', '-map', '1:a', '-vf', VF,
	'-c:v', 'libx264', '-profile:v', 'high', ...video, '-bsf:v', BSF, '-r', String( T.FPS ),
	'-c:a', 'aac', '-b:a', `${ audioKbps }k`, '-ar', '48000',
	'-movflags', '+faststart', '-t', String( TOTAL / T.FPS ), `${ FINAL }/${ out }`,
] );

await Promise.all( [
	encode( `${ NAME }.mp4`, [ '-preset', 'slow', '-crf', '16', '-g', '60', '-bf', '2' ], 320 ),
	encode( `${ NAME }-review.mp4`, [ '-preset', 'medium', '-crf', '25' ], 160 ),
] );
// Thumbnails: the logo with its tagline (S03), and the end-card lockup.
execFileSync( 'magick', [ frame( 384 ), '-resize', '1280x720', '-strip', `${ FINAL }/thumbnail-1280x720.png` ] );
execFileSync( 'magick', [ frame( TOTAL - 1 ), '-resize', '1280x720', '-strip', `${ FINAL }/thumbnail-alt-endcard-1280x720.png` ] );
console.log( `encoded ${ TOTAL } frames at ${ WIDTH }×${ HEIGHT } → final/${ NAME }.mp4 (+ review copy, thumbnails)` );
