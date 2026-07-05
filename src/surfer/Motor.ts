/**
 * Motion primitives the surfer's behaviors act through. `DomMotor` is the
 * only thing in the engine that writes to the real DOM — every behavior goes
 * through this interface instead of touching `window`/`document` directly, so
 * tests can swap in a recording fake and assert on commands instead of pixels.
 */

import type { Rng } from './Rng';
import { FakeCursor, framesForDistance, type Point } from './FakeCursor';
import { easeInOutQuad } from './Ease';

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

/** Radius band each `pointerDrift` wander leg's random offset is drawn from, in px. */
const WANDER_RADIUS_MIN_PX = 80;
const WANDER_RADIUS_MAX_PX = 280;

/** Kept clear of the viewport edge, so a wander target never aims off-screen, in px. */
const WANDER_EDGE_MARGIN_PX = 20;

/** Micro-pause between wander legs, in ms, so drift reads as wander-pause-wander. */
const WANDER_PAUSE_MS_MIN = 100;
const WANDER_PAUSE_MS_MAX = 350;

/**
 * A wander target offset from `from` by a random distance in
 * [{@link WANDER_RADIUS_MIN_PX}, {@link WANDER_RADIUS_MAX_PX}] at a random
 * angle, clamped inside the viewport so a leg never aims off-screen.
 * @param from
 * @param rng
 */
const wanderTarget = ( from: Point, rng: Rng ): Point => {
	const angle = rng() * Math.PI * 2;
	const radius =
		WANDER_RADIUS_MIN_PX +
		rng() * ( WANDER_RADIUS_MAX_PX - WANDER_RADIUS_MIN_PX );
	const maxX = Math.max(
		WANDER_EDGE_MARGIN_PX,
		window.innerWidth - WANDER_EDGE_MARGIN_PX
	);
	const maxY = Math.max(
		WANDER_EDGE_MARGIN_PX,
		window.innerHeight - WANDER_EDGE_MARGIN_PX
	);

	return {
		x: Math.min(
			maxX,
			Math.max(
				WANDER_EDGE_MARGIN_PX,
				from.x + Math.cos( angle ) * radius
			)
		),
		y: Math.min(
			maxY,
			Math.max(
				WANDER_EDGE_MARGIN_PX,
				from.y + Math.sin( angle ) * radius
			)
		),
	};
};

/**
 * Whether `el` sits inside the current viewport — at least the horizontal
 * line `selectSnippet`'s cursor sweep would follow across it. An offscreen
 * candidate's rect is viewport-relative (negative `top`, or `top` past
 * `innerHeight`), which would otherwise send the cursor travelling off-screen
 * to "reach" it.
 * @param el
 */
const isInViewport = ( el: Element ): boolean => {
	const rect = el.getBoundingClientRect();

	return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0;
};

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
			const from = this.cursor.position;
			const target = wanderTarget( from, this.rng );
			const distance = Math.hypot( target.x - from.x, target.y - from.y );
			const legFrames = Math.min(
				framesLeft,
				framesForDistance( distance )
			);

			await this.cursor.travelTo( target, this.rng, legFrames );
			framesLeft -= legFrames;

			if ( framesLeft <= 0 ) {
				break;
			}

			const pauseFrames = Math.min(
				framesLeft,
				msToFrames(
					WANDER_PAUSE_MS_MIN +
						this.rng() *
							( WANDER_PAUSE_MS_MAX - WANDER_PAUSE_MS_MIN )
				)
			);

			for ( let i = 0; i < pauseFrames; i++ ) {
				await this.nextFrameFn();
			}

			framesLeft -= pauseFrames;
		}
	}

	async selectSnippet(): Promise< void > {
		const candidates = Array.from(
			document.querySelectorAll( 'p, li, blockquote' )
		).filter(
			( el ) =>
				( el.textContent ?? '' ).trim().length > 20 &&
				isInViewport( el )
		);

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
			this.rng,
			msToFrames( SNIPPET_APPROACH_MS )
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
