/**
 * Motion primitives the surfer's behaviors act through. `DomMotor` is the
 * only thing in the engine that writes to the real DOM — every behavior goes
 * through this interface instead of touching `window`/`document` directly, so
 * tests can swap in a recording fake and assert on commands instead of pixels.
 */

import type { Rng } from './Rng';
import { FakeCursor, framesForDistance, type Point } from './FakeCursor';
import { easeInOutQuad } from './Ease';
import { contentRoot, VIDEO_EMBED_SELECTOR } from './Affordances';
import { createVideoControl, type VideoControl } from './VideoControl';

/** A motion primitive the surfer can perform. */
export interface Motor {
	/** Scrolls the page by `px` (negative scrolls up), eased over `ms`. */
	scrollBy: ( px: number, ms: number ) => Promise< void >;
	/** Drifts the pointer along an aimless path for `ms`. */
	pointerDrift: ( ms: number ) => Promise< void >;
	/** Briefly selects a snippet of page text, then clears the selection. */
	selectSnippet: () => Promise< void >;
	/**
	 * Attends (scrolls into view, approaches with the cursor, once) and
	 * starts the page's video or video-host embed, if one is present.
	 * Disposes any previously active control first, so replaying this on a
	 * new watch cycle never leaks a stale listener. Subscribes the started
	 * control's `onEnded` to replay itself for as long as it stays active —
	 * a video that ends mid-watch rewatches itself with no polling involved.
	 */
	playVideo: () => Promise< void >;
	/**
	 * Fully stops (unsubscribes the `onEnded` auto-replay, stops, then
	 * disposes) whatever `playVideo` last started, if anything. A safe
	 * no-op when nothing was started (never called, or the page had no
	 * video).
	 */
	stopVideo: () => Promise< void >;
	/**
	 * Attends a content image: scrolls it into view if needed, travels the
	 * cursor onto it, and dwells there for the remainder of `ms`. Falls back
	 * to an aimless drift when the page offers no image to linger on.
	 */
	lingerImage: ( ms: number ) => Promise< void >;
	/**
	 * Follows the prose with the cursor like a reader tracking lines: sweeps
	 * across a visible text block line by line for up to `ms`, then rests.
	 * Falls back to a still idle when no readable block is in view.
	 */
	readTrace: ( ms: number ) => Promise< void >;
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

/**
 * Whether `el` has any vertical overlap with the viewport — reachable
 * without scrolling, even if only partially visible. Looser than
 * {@link isInViewport} (which requires the whole element on-screen): picking
 * a lingerImage/playVideo candidate only needs "in reach", not "fully shown".
 * @param el
 */
const hasViewportOverlap = ( el: Element ): boolean => {
	const rect = el.getBoundingClientRect();

	return rect.bottom > 0 && rect.top < window.innerHeight;
};

/** How long the cursor travels to a snippet before the selection sweep starts. */
const SNIPPET_APPROACH_MS = 500;

/** How long the progressive selection sweep takes to cover the snippet. */
const SNIPPET_SWEEP_MS = 700;

/** How long the finished selection is held before it is cleared. */
const SNIPPET_HOLD_MS = 600;

/** How long scrolling a target's centre to the viewport middle takes, in ms. */
const SCROLL_TO_MIDDLE_MS = 600;

/** Minimum rendered size (both dimensions), in px, for an image to be worth lingering on — never fixates an emoji-sized or icon image. */
const MIN_IMAGE_SIZE_PX = 40;

/** How far a resting point on a target may jitter from its centre, as a fraction of the target's own dimensions. */
const TARGET_JITTER_FRACTION = 0.2;

/**
 * Fallback line height, in px, for `readTrace`'s line-count estimate when the
 * computed style isn't a resolved pixel length (e.g. jsdom's default
 * `"normal"`, which carries no usable number).
 */
const DEFAULT_LINE_HEIGHT_PX = 24;

/**
 * Nominal duration a single line's left-to-right sweep takes in `readTrace`,
 * jittered per line by {@link TRACE_LINE_JITTER_FRACTION} — a reading pace,
 * distinctly slower than `selectSnippet`'s quick sweep.
 */
const TRACE_LINE_MS = 1500;

/** Fractional jitter band applied to each line's sweep duration in `readTrace`. */
const TRACE_LINE_JITTER_FRACTION = 0.2;

/** Small jitter, in px, on `readTrace`'s approach point to the first line's start. */
const TRACE_START_JITTER_PX = 6;

/**
 * The line height `readTrace` paces its sweep by: the computed style's
 * `line-height` when it resolved to a plain pixel length, else
 * {@link DEFAULT_LINE_HEIGHT_PX}. The DOM has no line-count API, so this
 * (rect height ÷ line height) is the cheapest signal available to estimate
 * how many lines a text block renders as, without laying out its runs by hand.
 * @param el
 */
const lineHeightOf = ( el: Element ): number => {
	const raw = getComputedStyle( el ).lineHeight;

	return raw.endsWith( 'px' ) ? parseFloat( raw ) : DEFAULT_LINE_HEIGHT_PX;
};

/** Production motor: performs real, eased DOM motion. */
export class DomMotor implements Motor {
	private readonly rng: Rng;
	private readonly nextFrameFn: () => Promise< void >;
	private readonly cursor: FakeCursor;
	/** The control `playVideo` last started, so `stopVideo` stops the same element. */
	private activeVideo: VideoControl | null = null;
	/** Unsubscribes `activeVideo`'s `onEnded` auto-replay; cleared alongside it. */
	private activeVideoEndedUnsubscribe: ( () => void ) | null = null;

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
		const root = contentRoot( document );
		const target: Element | null =
			root.querySelector( 'video' ) ??
			root.querySelector( VIDEO_EMBED_SELECTOR );

		if ( ! target ) {
			return;
		}

		if ( ! isInViewport( target ) ) {
			await this.scrollToMiddle( target.getBoundingClientRect() );
		}

		await this.cursor.travelTo(
			this.jitteredPointOn( target.getBoundingClientRect() ),
			this.rng
		);

		// Unsubscribe and dispose any control from a prior watch cycle before
		// replacing it — otherwise its message listener (for a YouTube embed)
		// and its auto-replay subscription would both leak.
		this.activeVideoEndedUnsubscribe?.();
		this.activeVideo?.dispose();

		const control = createVideoControl( target );
		this.activeVideo = control;
		// Subscribed for as long as this control stays active: the player's
		// own 'ended' event replays it, so a video shorter than the watch
		// window rewatches itself with no polling from this Motor at all.
		this.activeVideoEndedUnsubscribe = control.onEnded( () => {
			void control.play();
		} );
		await control.play();
	}

	async stopVideo(): Promise< void > {
		const control = this.activeVideo;
		const unsubscribe = this.activeVideoEndedUnsubscribe;
		this.activeVideo = null;
		this.activeVideoEndedUnsubscribe = null;

		// Unsubscribe FIRST so a replay can never race the stop.
		unsubscribe?.();

		if ( null !== control ) {
			await control.stop();
			control.dispose();
		}
	}

	async lingerImage( ms: number ): Promise< void > {
		const root = contentRoot( document );
		const candidates = Array.from(
			root.querySelectorAll( 'img, figure svg' )
		).filter( ( el ) => {
			const rect = el.getBoundingClientRect();

			return (
				rect.width >= MIN_IMAGE_SIZE_PX &&
				rect.height >= MIN_IMAGE_SIZE_PX
			);
		} );

		if ( candidates.length === 0 ) {
			await this.pointerDrift( ms );
			return;
		}

		let framesLeft = msToFrames( ms );
		const inView = candidates.filter( hasViewportOverlap );
		const pool = inView.length > 0 ? inView : candidates;
		const el = pool[ Math.floor( this.rng() * pool.length ) ];
		let rect = el.getBoundingClientRect();

		if ( inView.length === 0 ) {
			const scrollFrames = Math.min(
				framesLeft,
				msToFrames( SCROLL_TO_MIDDLE_MS )
			);
			await this.scrollToMiddle( rect );
			framesLeft -= scrollFrames;
			// Scrolling moved the page, so the image's rect has changed.
			rect = el.getBoundingClientRect();
		}

		const target = this.jitteredPointOn( rect );
		const distance = Math.hypot(
			target.x - this.cursor.position.x,
			target.y - this.cursor.position.y
		);
		const travelFrames = Math.min(
			framesLeft,
			framesForDistance( distance )
		);
		await this.cursor.travelTo( target, this.rng, travelFrames );
		framesLeft -= travelFrames;

		// Dwells on the image for whatever budget remains, frame by frame —
		// the same style as selectSnippet's hold.
		for ( let i = 0; i < framesLeft; i++ ) {
			await this.nextFrameFn();
		}
	}

	async readTrace( ms: number ): Promise< void > {
		const root = contentRoot( document );
		const candidates = Array.from(
			root.querySelectorAll( 'p, li, blockquote' )
		).filter(
			( el ) =>
				( el.textContent ?? '' ).trim().length > 20 &&
				isInViewport( el )
		);

		if ( candidates.length === 0 ) {
			await this.idle( ms );
			return;
		}

		const el = candidates[ Math.floor( this.rng() * candidates.length ) ];
		const rect = el.getBoundingClientRect();
		const lineHeight = lineHeightOf( el );
		// The block's rect height is the only signal cheap enough to sample
		// every tick without laying out its text runs by hand — see
		// lineHeightOf's doc for why a resolved pixel line height matters here.
		const lines = Math.max( 1, Math.round( rect.height / lineHeight ) );

		await this.cursor.travelTo(
			{
				x: rect.left + ( this.rng() * 2 - 1 ) * TRACE_START_JITTER_PX,
				y:
					rect.top +
					lineHeight / 2 +
					( this.rng() * 2 - 1 ) * TRACE_START_JITTER_PX,
			},
			this.rng
		);

		let framesLeft = msToFrames( ms );

		for ( let line = 0; line < lines && framesLeft > 0; line++ ) {
			const y = rect.top + lineHeight * ( line + 0.5 );
			const lineMs =
				TRACE_LINE_MS *
				( 1 + ( this.rng() * 2 - 1 ) * TRACE_LINE_JITTER_FRACTION );
			// `t` is a fraction of the line's full nominal duration, not of
			// however many frames the remaining budget actually grants — so
			// a line cut short by the budget stops partway across its width
			// instead of always reaching the far edge in fewer, larger jumps.
			const nominalLineFrames = msToFrames( lineMs );
			const lineFrames = Math.min( framesLeft, nominalLineFrames );

			for ( let i = 1; i <= lineFrames; i++ ) {
				const t = i / nominalLineFrames;
				this.cursor.moveTo( { x: rect.left + rect.width * t, y } );
				await this.nextFrameFn();
			}

			framesLeft -= lineFrames;
		}

		// The visible block ran out before the time budget did — the reader
		// finished it and is resting/thinking; hold position for whatever
		// budget remains rather than sweeping nothing.
		for ( let i = 0; i < framesLeft; i++ ) {
			await this.nextFrameFn();
		}
	}

	idle( ms: number ): Promise< void > {
		return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
	}

	/**
	 * Scrolls the page so `rect`'s vertical centre lands at the viewport's
	 * middle — the shared "approach" step both `lingerImage` and `playVideo`
	 * use to bring an off-screen target within reach before travelling the
	 * cursor onto it.
	 * @param rect
	 */
	private scrollToMiddle( rect: DOMRect ): Promise< void > {
		const delta = rect.top + rect.height / 2 - window.innerHeight / 2;

		return this.scrollBy( delta, SCROLL_TO_MIDDLE_MS );
	}

	/**
	 * A point on `rect` — its centre, jittered by up to
	 * {@link TARGET_JITTER_FRACTION} of its own dimensions, so the cursor
	 * doesn't fixate the exact same pixel every time. Shared by `lingerImage`
	 * and `playVideo`'s cursor approach.
	 * @param rect
	 */
	private jitteredPointOn( rect: DOMRect ): Point {
		return {
			x:
				rect.left +
				rect.width / 2 +
				( this.rng() * 2 - 1 ) * rect.width * TARGET_JITTER_FRACTION,
			y:
				rect.top +
				rect.height / 2 +
				( this.rng() * 2 - 1 ) * rect.height * TARGET_JITTER_FRACTION,
		};
	}
}
