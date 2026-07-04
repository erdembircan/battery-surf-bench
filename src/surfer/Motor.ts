/**
 * Motion primitives the surfer's behaviors act through. `DomMotor` is the
 * only thing in the engine that writes to the real DOM — every behavior goes
 * through this interface instead of touching `window`/`document` directly, so
 * tests can swap in a recording fake and assert on commands instead of pixels.
 */

import type { Rng } from './Rng';
import { FakeCursor } from './FakeCursor';

/** A motion primitive the surfer can perform. */
export interface Motor {
	/** Scrolls the page by `px` (negative scrolls up), eased over `ms`. */
	scrollBy: ( px: number, ms: number ) => Promise< void >;
	/** Drifts the pointer along an aimless path for `ms`. */
	pointerDrift: ( ms: number ) => Promise< void >;
	/** Briefly selects a snippet of page text, then clears the selection. */
	selectSnippet: () => Promise< void >;
	/** Plays the page's video, if one is present. */
	playVideo: () => Promise< void >;
	/** Waits `ms` without acting — the surfer's own idle/reading time. */
	idle: ( ms: number ) => Promise< void >;
}

/**
 * Eases progress with a quad in/out curve.
 * @param t Progress, 0–1.
 */
const easeInOutQuad = ( t: number ): number =>
	t < 0.5 ? 2 * t * t : 1 - Math.pow( -2 * t + 2, 2 ) / 2;

/**
 * Waits for the next animation frame, falling back to a short timeout where
 * `requestAnimationFrame` is unavailable (e.g. a backgrounded iframe tab).
 */
const nextFrame = (): Promise< void > =>
	new Promise( ( resolve ) =>
		typeof requestAnimationFrame === 'function'
			? requestAnimationFrame( () => resolve() )
			: setTimeout( resolve, 16 )
	);

/** Assumed animation-frame length, for converting a duration to a frame count. */
const FRAME_MS = 16;

/**
 * Converts a duration to a frame count at {@link FRAME_MS} per frame, never
 * fewer than one so a zero/negative duration still completes.
 * @param ms
 */
const msToFrames = ( ms: number ): number =>
	Math.max( 1, Math.round( ms / FRAME_MS ) );

/** Shortest and longest single wander leg, in frames, for `pointerDrift`. */
const DRIFT_LEG_FRAMES_MIN = 15;
const DRIFT_LEG_FRAMES_MAX = 30;

/** How long the cursor travels to a snippet before the selection sweep starts. */
const SNIPPET_APPROACH_MS = 500;

/** How long the progressive selection sweep takes to cover the snippet. */
const SNIPPET_SWEEP_MS = 700;

/** How long the finished selection is held before it is cleared. */
const SNIPPET_HOLD_MS = 600;

/** Production motor: performs real, eased DOM motion. */
export class DomMotor implements Motor {
	private readonly rng: Rng;
	private readonly nextFrameFn: () => Promise< void >;
	private readonly cursor: FakeCursor;

	/**
	 * @param rng
	 * @param nextFrameFn Animation tick source the cursor advances on.
	 */
	constructor( rng: Rng, nextFrameFn: () => Promise< void > = nextFrame ) {
		this.rng = rng;
		this.nextFrameFn = nextFrameFn;
		this.cursor = new FakeCursor(
			document,
			{ x: window.innerWidth / 2, y: window.innerHeight / 2 },
			nextFrameFn
		);
	}

	async scrollBy( px: number, ms: number ): Promise< void > {
		const start = performance.now();
		let moved = 0;
		let t = 0;

		while ( t < 1 ) {
			const elapsed = performance.now() - start;
			t = ms > 0 ? Math.min( 1, elapsed / ms ) : 1;
			const target = px * easeInOutQuad( t );
			window.scrollBy( 0, target - moved );
			moved = target;

			if ( t < 1 ) {
				await nextFrame();
			}
		}
	}

	async pointerDrift( ms: number ): Promise< void > {
		let framesLeft = msToFrames( ms );

		while ( framesLeft > 0 ) {
			const legFrames = Math.min(
				framesLeft,
				DRIFT_LEG_FRAMES_MIN +
					Math.floor(
						this.rng() *
							( DRIFT_LEG_FRAMES_MAX - DRIFT_LEG_FRAMES_MIN )
					)
			);
			const target = {
				x: this.rng() * window.innerWidth,
				y: this.rng() * window.innerHeight,
			};

			await this.cursor.travelTo( target, legFrames, this.rng );
			framesLeft -= legFrames;
		}
	}

	async selectSnippet(): Promise< void > {
		const candidates = Array.from(
			document.querySelectorAll( 'p, li, blockquote' )
		).filter( ( el ) => ( el.textContent ?? '' ).trim().length > 20 );

		if ( candidates.length === 0 ) {
			return;
		}

		const el = candidates[ Math.floor( this.rng() * candidates.length ) ];
		const textNode = Array.from( el.childNodes ).find(
			( node ): node is Text =>
				node.nodeType === Node.TEXT_NODE &&
				( node.textContent ?? '' ).trim().length > 0
		);
		const selection = el.ownerDocument.defaultView?.getSelection();

		if ( ! textNode || ! selection ) {
			return;
		}

		const text = textNode.textContent ?? '';
		const rect = el.getBoundingClientRect();

		await this.cursor.travelTo(
			{ x: rect.left, y: rect.top + rect.height / 2 },
			msToFrames( SNIPPET_APPROACH_MS ),
			this.rng
		);

		const range = el.ownerDocument.createRange();
		range.setStart( textNode, 0 );
		range.setEnd( textNode, 0 );
		selection.removeAllRanges();
		selection.addRange( range );

		// Extends the selection and sweeps the cursor across the snippet in
		// lockstep, frame by frame, rather than selecting the whole thing at once.
		const sweepFrames = msToFrames( SNIPPET_SWEEP_MS );

		for ( let i = 1; i <= sweepFrames; i++ ) {
			const t = i / sweepFrames;
			range.setEnd( textNode, Math.floor( text.length * t ) );
			this.cursor.moveTo( {
				x: rect.left + rect.width * t,
				y: rect.top + rect.height / 2,
			} );
			await this.nextFrameFn();
		}

		for ( let i = 0; i < msToFrames( SNIPPET_HOLD_MS ); i++ ) {
			await this.nextFrameFn();
		}

		selection.removeAllRanges();
	}

	async playVideo(): Promise< void > {
		const video = document.querySelector( 'video' );

		if ( ! video ) {
			return;
		}

		try {
			await video.play();
		} catch {
			// Autoplay with sound is blocked without a user gesture; muted
			// autoplay is allowed, so retry muted rather than staying paused.
			video.muted = true;
			await video.play().catch( () => undefined );
		}
	}

	idle( ms: number ): Promise< void > {
		return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
	}
}
