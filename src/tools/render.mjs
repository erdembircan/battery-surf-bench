// Renders one scene (src/scenes/<name>.html) frame by frame.
//   node src/tools/render.mjs <scene>                 → all frames, globally numbered
//   node src/tools/render.mjs <scene> --preview 0,1.5 → stills at local times (seconds)
// Frames go to work/frames/ ($FRAMES_DIR overrides it, $BSB_VIDEO_WORK moves all of
// work/); each scene owns a disjoint global frame range from shots.json, so scenes
// can render in parallel. BSB_VIDEO_SCALE=2 renders 3840×2160 frames into
// work/frames-4k/ (previews into work/previews-4k/); see output.mjs.
//
// A scene that pushes a camera across live DOM can ask for supersampling with
// <meta name="supersample" content="4">: it renders at that device scale and is
// box-filtered down to the output size. Chrome snaps glyphs to whole device pixels,
// so at 1× a slow zoom makes static text hop ~1 px between frames; at 4× the hops
// shrink to about a quarter of a pixel and average out. A 4K build captures the same
// 4× surface and filters it down by 2 instead of 4. Scenes that don't ask, or ask
// for no more than the output's own scale, are captured directly at that scale.
//
// A 4× frame is a 7680×4320 surface, and Chrome sometimes hands over the screenshot
// before every tile is painted, so parts of the frame are silently missing (it
// happens under memory pressure). Every supersampled frame is therefore checked
// against a 1× render of the same instant: at 240×135 the two agree within ~40 grey
// levels, while a missing tile or layer differs by 120+. A frame that fails is
// captured again, and the render stops if it can't get a complete one.
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { HEIGHT, SCALE, SUFFIX, WIDTH } from './output.mjs';

const ROOT = new URL( '../../', import.meta.url ).pathname;
const SRC = `${ ROOT }src/`;
const T = JSON.parse( readFileSync( `${ SRC }shots.json`, 'utf8' ) );
const WORK = process.env.BSB_VIDEO_WORK ?? `${ ROOT }work`;
const FRAMES = process.env.FRAMES_DIR ?? `${ WORK }/frames${ SUFFIX }/`;
const PREVIEWS = `${ WORK }/previews${ SUFFIX }/`;
const MAX_CELL_DIFF = 64;
const ATTEMPTS = 3;

const [ name, ...rest ] = process.argv.slice( 2 );
const pi = rest.indexOf( '--preview' );
const preview = pi >= 0 ? rest[ pi + 1 ].split( ',' ).map( Number ) : null;
// Scratch scenes (not in shots.json) can still be previewed.
const sc = T.scenes.find( ( s ) => s.name === name ) ?? ( preview ? { name, start: 0, frames: 300, f0: 0, f1: 300 } : null );
if ( ! sc ) {
	throw new Error( `unknown scene ${ name }` );
}
mkdirSync( preview ? PREVIEWS : FRAMES, { recursive: true } );
const html = readFileSync( `${ SRC }scenes/${ name }.html`, 'utf8' );
const SS = Number( html.match( /<meta name="supersample" content="(\d+)">/ )?.[ 1 ] ?? 1 );
// Capture at the scene's supersample scale or the output scale, whichever is
// higher; a capture above the output scale is box-filtered down and checked.
const DSF = Math.max( SS, SCALE );
const SUPER = DSF > SCALE;
const BIG = `${ WORK }/ss-${ name }${ SUFFIX }/`;
const run = promisify( execFile );
const pending = new Set();
const failures = [];
const incomplete = [];

/**
 * Renders the scene at time `t` on every open page.
 *
 * @param {number} t Scene-local time in seconds.
 */
const renderAt = ( t ) => Promise.all( pages.map( ( p ) => p.evaluate( ( tt ) => window.SCENE.render( tt ), t ) ) );

/**
 * Downscales a supersampled capture into its output JPEG and compares it with the
 * 1× reference of the same instant.
 *
 * @param {string} big  Supersampled PNG capture.
 * @param {string} ref  1× PNG capture.
 * @param {string} path Output JPEG path.
 * @return {Promise<number>} The largest difference between the two at 240×135, in grey levels.
 */
async function finish( big, ref, path ) {
	const gray = [ '-resize', '240x135!', '-colorspace', 'gray', '-depth', '8', 'gray:-' ];
	const opts = { encoding: 'buffer', maxBuffer: 1 << 20 };
	const [ a, b ] = await Promise.all( [
		run( 'magick', [ big, '-filter', 'Box', '-resize', `${ WIDTH }x${ HEIGHT }!`, '-strip', '-quality', '95', '-write', path, ...gray ], opts ),
		run( 'magick', [ ref, '-filter', 'Box', ...gray ], opts ),
	] );
	let max = 0;
	for ( let i = 0; i < a.stdout.length; i++ ) {
		max = Math.max( max, Math.abs( a.stdout[ i ] - b.stdout[ i ] ) );
	}
	return max;
}

/**
 * Captures the supersampled frame and its 1× reference to temporary PNGs.
 *
 * @param {string} path Output JPEG path the captures belong to.
 * @return {Promise<string[]>} The big and reference PNG paths.
 */
async function grab( path ) {
	const base = `${ BIG }${ path.split( '/' ).pop() }`;
	await ref.screenshot( { path: `${ base }.ref.png`, type: 'png' } );
	// Big lossless captures can stall under memory pressure; give them room.
	await page.screenshot( { path: `${ base }.png`, type: 'png', timeout: 180000 } );
	return [ `${ base }.png`, `${ base }.ref.png` ];
}

/**
 * Captures the current frame to `path` (JPEG). Supersampled frames are captured
 * losslessly, then downscaled and checked in the background.
 *
 * @param {string} path Output JPEG path.
 * @param {number} t    Scene-local time of the frame, for a re-capture.
 */
async function capture( path, t ) {
	if ( ! SUPER ) {
		await page.screenshot( { path, type: 'jpeg', quality: 95 } );
		return;
	}
	const files = await grab( path );
	while ( pending.size >= 2 ) {
		await Promise.race( pending );
	}
	const job = finish( ...files, path )
		.then( ( diff ) => diff > MAX_CELL_DIFF && incomplete.push( { path, t, diff } ) )
		.catch( ( e ) => failures.push( e ) )
		.finally( () => {
			files.forEach( ( f ) => rmSync( f, { force: true } ) );
			pending.delete( job );
		} );
	pending.add( job );
}

/** Waits for the background downscales and fails loudly if any of them failed. */
async function settle() {
	await Promise.all( pending );
	if ( failures.length ) {
		throw failures[ 0 ];
	}
}

/** Captures incomplete frames again until each matches its 1× reference. */
async function repair() {
	for ( const f of incomplete.splice( 0 ) ) {
		let diff = f.diff;
		for ( let attempt = 0; attempt < ATTEMPTS && diff > MAX_CELL_DIFF; attempt++ ) {
			await renderAt( f.t );
			await page.evaluate( () => new Promise( ( r ) => requestAnimationFrame( () => requestAnimationFrame( r ) ) ) );
			const files = await grab( f.path );
			diff = await finish( ...files, f.path );
			files.forEach( ( p ) => rmSync( p, { force: true } ) );
		}
		if ( diff > MAX_CELL_DIFF ) {
			rmSync( f.path, { force: true } );
			throw new Error( `${ f.path }: still incomplete after ${ ATTEMPTS } more captures (differs from 1× by ${ diff })` );
		}
		console.log( `${ name }: re-captured ${ f.path.split( '/' ).pop() } (the first capture was incomplete)` );
	}
}

if ( SUPER ) {
	mkdirSync( BIG, { recursive: true } );
}
const browser = await chromium.launch( { args: [ '--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none' ] } );
const viewport = { width: 1920, height: 1080 };
const page = await browser.newPage( { viewport, deviceScaleFactor: DSF } );
const ref = SUPER ? await browser.newPage( { viewport, deviceScaleFactor: 1 } ) : null;
const pages = [ page, ref ].filter( Boolean );
const errors = [];
page.on( 'pageerror', ( e ) => errors.push( e.message ) );
page.on( 'console', ( m ) => m.type() === 'error' && errors.push( m.text() ) );
for ( const p of pages ) {
	await p.goto( `file://${ SRC }scenes/${ name }.html?t0=${ sc.start }&dur=${ sc.frames / T.FPS }` );
	await p.waitForFunction( () => window.SCENE_READY === true, null, { timeout: 90000 } );
}

const t0 = Date.now();
if ( preview ) {
	for ( const t of preview ) {
		await renderAt( t );
		await capture( `${ PREVIEWS }${ name }-${ t.toFixed( 2 ) }.jpg`, t );
	}
	await settle();
	await repair();
	console.log( `${ name }: ${ preview.length } previews at ${ WIDTH }×${ HEIGHT }` );
} else {
	for ( let i = 0; i < sc.frames; i++ ) {
		await renderAt( i / T.FPS );
		await capture( `${ FRAMES }${ String( sc.f0 + i ).padStart( 4, '0' ) }.jpg`, i / T.FPS );
	}
	await settle();
	await repair();
	console.log( `${ name }: frames ${ sc.f0 }–${ sc.f1 - 1 } at ${ WIDTH }×${ HEIGHT }${ SUPER ? `, ${ DSF }× supersampled and checked against 1×` : '' } in ${ ( ( Date.now() - t0 ) / 1000 ).toFixed( 1 ) } s` );
}
if ( SUPER ) {
	rmSync( BIG, { recursive: true, force: true } );
}
if ( errors.length ) {
	console.log( `${ name } page errors:`, errors );
}
await browser.close();
