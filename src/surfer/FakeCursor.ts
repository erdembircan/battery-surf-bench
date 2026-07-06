/**
 * A visible cursor the surf engine drives across the page. Synthetic
 * `mousemove` events alone move nothing on screen — `FidgetWiggle` and
 * `LingerImage` are taste features, so the visitor needs something to
 * actually see wandering. Painted once, by `DomMotor`, only while the engine
 * is running; a static page never gets one.
 */

import type { Rng } from './Rng';
import { easeInOutQuad } from './Ease';

/** A viewport position, in CSS pixels. */
export interface Point {
	x: number;
	y: number;
}

/** Class the document root carries while the engine drives, hiding the real cursor. */
export const SURFING_CLASS = 'bsb-surfing';

/** Stylesheet hook for the cursor element itself (styled in `src/course/style.scss`). */
const CURSOR_CLASS = 'bsb-surf-cursor';

/** How far the cursor overshoots past a target before settling onto it, in px. */
const OVERSHOOT_PX = 6;

/**
 * Kept clear of the viewport edge when clamping a painted position, in px —
 * both endpoints of a travelled leg can sit safely on-screen while the
 * jittered bezier control point (bend up to 80px) or the overshoot still
 * bows the curve past the edge partway through.
 */
const EDGE_MARGIN_PX = 4;

/** Minimum leg distance, in px, that still gets an overshoot-and-settle; short nudges land directly. */
const OVERSHOOT_DISTANCE_THRESHOLD_PX = 200;

/** How many px of travel distance a single animation frame covers, for {@link framesForDistance}. */
const TRAVEL_PX_PER_FRAME = 10;

/** Frame-count clamp band for a travelled leg, however far it goes. */
const TRAVEL_MIN_FRAMES = 8;
const TRAVEL_MAX_FRAMES = 60;

/**
 * The frame count a leg of `distance` px should take: proportional to
 * distance, so a short nudge is quick and a long sweep is unhurried, clamped
 * so neither collapses to an instant jump nor drags on indefinitely.
 * @param distance
 */
export const framesForDistance = ( distance: number ): number =>
	Math.min(
		TRAVEL_MAX_FRAMES,
		Math.max(
			TRAVEL_MIN_FRAMES,
			Math.round( distance / TRAVEL_PX_PER_FRAME )
		)
	);

/**
 * The quadratic-bezier point at progress `t` (0–1), from `a` through control
 * point `c` to `b`.
 * @param a
 * @param c
 * @param b
 * @param t
 */
const bezierPoint = ( a: Point, c: Point, b: Point, t: number ): Point => {
	const ab1 = { x: a.x + ( c.x - a.x ) * t, y: a.y + ( c.y - a.y ) * t };
	const ab2 = { x: c.x + ( b.x - c.x ) * t, y: c.y + ( b.y - c.y ) * t };

	return {
		x: ab1.x + ( ab2.x - ab1.x ) * t,
		y: ab1.y + ( ab2.y - ab1.y ) * t,
	};
};

/**
 * A control point off the straight line between `a` and `b`, so a travelled
 * curve bends instead of reading as a robotic straight-line glide.
 * @param a
 * @param b
 * @param rng
 */
const jitteredControlPoint = ( a: Point, b: Point, rng: Rng ): Point => {
	const mid = { x: ( a.x + b.x ) / 2, y: ( a.y + b.y ) / 2 };
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.hypot( dx, dy ) || 1;
	const bend = ( rng() * 2 - 1 ) * Math.min( 80, len / 2 );

	return {
		x: mid.x + ( -dy / len ) * bend,
		y: mid.y + ( dx / len ) * bend,
	};
};

/**
 * Clamps `point` inside `view`'s viewport, kept back from the edge by
 * {@link EDGE_MARGIN_PX}, so a painted position can never land off-screen.
 * @param point
 * @param view
 */
const clampToViewport = ( point: Point, view: Window ): Point => ( {
	x: Math.min(
		Math.max( point.x, EDGE_MARGIN_PX ),
		view.innerWidth - EDGE_MARGIN_PX
	),
	y: Math.min(
		Math.max( point.y, EDGE_MARGIN_PX ),
		view.innerHeight - EDGE_MARGIN_PX
	),
} );

/**
 * Builds the cursor's DOM element. Static positioning, sizing, colour and the
 * arrow-pointer glyph itself (a CSS background painted via
 * `theme.icon-cursor()`) all live in the course stylesheet under
 * {@link CURSOR_CLASS}; this only ever writes the element's `transform`.
 * @param doc
 */
const buildElement = ( doc: Document ): HTMLElement => {
	const el = doc.createElement( 'div' );
	el.className = CURSOR_CLASS;
	el.setAttribute( 'aria-hidden', 'true' );

	return el;
};

export class FakeCursor {
	private readonly doc: Document;
	private readonly view: Window;
	private readonly el: HTMLElement;
	private readonly nextFrame: () => Promise< void >;
	private point: Point;

	/**
	 * Injects the cursor element and flags the document as engine-driven.
	 * @param doc
	 * @param start
	 * @param nextFrame Animation tick source; a test injects an instant one.
	 */
	constructor(
		doc: Document,
		start: Point,
		nextFrame: () => Promise< void >
	) {
		this.doc = doc;
		// `defaultView`, not a global `window`, so a test's own document can
		// control the viewport dimensions clamping is measured against.
		this.view = doc.defaultView ?? window;
		this.point = start;
		this.nextFrame = nextFrame;
		this.el = buildElement( doc );

		doc.documentElement.classList.add( SURFING_CLASS );
		doc.body.appendChild( this.el );
		this.paint();
	}

	/** The cursor's current position. */
	get position(): Point {
		return this.point;
	}

	/**
	 * Moves the cursor straight to `point` — clamped inside the viewport, the
	 * one choke point every paint and dispatched `mousemove` goes through, so
	 * neither a jittered curve nor an overshoot can ever land off-screen.
	 * @param point
	 */
	moveTo( point: Point ): void {
		this.point = clampToViewport( point, this.view );
		this.paint();
		this.doc.dispatchEvent(
			new MouseEvent( 'mousemove', {
				bubbles: true,
				clientX: this.point.x,
				clientY: this.point.y,
			} )
		);
	}

	/**
	 * Glides from the current position to `target` along a jittered
	 * quadratic-bezier curve rather than a straight line, easing in and out
	 * of the move rather than travelling at constant speed. The frame count
	 * scales with travel distance ({@link framesForDistance}) unless `frames`
	 * overrides it; only a long-enough leg gets a small overshoot-and-settle
	 * once it arrives — a short nudge lands directly on `target`.
	 * @param target
	 * @param rng
	 * @param frames Overrides the distance-derived frame count when given.
	 */
	async travelTo(
		target: Point,
		rng: Rng,
		frames?: number
	): Promise< void > {
		const start = this.point;
		const control = jitteredControlPoint( start, target, rng );
		const distance = Math.hypot( target.x - start.x, target.y - start.y );
		const steps = Math.max( 1, frames ?? framesForDistance( distance ) );

		for ( let i = 1; i <= steps; i++ ) {
			const progress = easeInOutQuad( i / steps );
			this.moveTo( bezierPoint( start, control, target, progress ) );
			await this.nextFrame();
		}

		if ( distance > OVERSHOOT_DISTANCE_THRESHOLD_PX ) {
			await this.settle( target, rng );
		}
	}

	/**
	 * A brief overshoot past `target`, then a small settle back onto it.
	 * @param target
	 * @param rng
	 */
	private async settle( target: Point, rng: Rng ): Promise< void > {
		this.moveTo( {
			x: target.x + ( rng() * 2 - 1 ) * OVERSHOOT_PX,
			y: target.y + ( rng() * 2 - 1 ) * OVERSHOOT_PX,
		} );
		await this.nextFrame();
		this.moveTo( target );
	}

	private paint(): void {
		this.el.style.transform = `translate(${ this.point.x }px, ${ this.point.y }px)`;
	}
}
