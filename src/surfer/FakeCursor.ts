/**
 * A visible cursor the surf engine drives across the page. Synthetic
 * `mousemove` events alone move nothing on screen — `FidgetWiggle` and
 * `LingerImage` are taste features, so the visitor needs something to
 * actually see wandering. Painted once, by `DomMotor`, only while the engine
 * is running; a static page never gets one.
 */

import type { Rng } from './Rng';

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
 * Builds the cursor's DOM element. Static positioning, sizing and colour all
 * live in the course stylesheet under {@link CURSOR_CLASS}; this only ever
 * writes the element's `transform`.
 * @param doc
 */
const buildElement = ( doc: Document ): HTMLElement => {
	const el = doc.createElement( 'div' );
	el.className = CURSOR_CLASS;
	el.setAttribute( 'aria-hidden', 'true' );
	el.innerHTML =
		'<svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 2 L4 20 L9 16 L12 22 L15 20.5 L12 14.5 L18 14.5 Z"/></svg>';

	return el;
};

export class FakeCursor {
	private readonly doc: Document;
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
	 * Moves the cursor straight to `point` and dispatches a matching `mousemove`.
	 * @param point
	 */
	moveTo( point: Point ): void {
		this.point = point;
		this.paint();
		this.doc.dispatchEvent(
			new MouseEvent( 'mousemove', {
				bubbles: true,
				clientX: point.x,
				clientY: point.y,
			} )
		);
	}

	/**
	 * Glides from the current position to `target` over `frames` animation
	 * ticks, along a jittered quadratic-bezier curve rather than a straight
	 * line, with a small overshoot-and-settle once it arrives.
	 * @param target
	 * @param frames
	 * @param rng
	 */
	async travelTo( target: Point, frames: number, rng: Rng ): Promise< void > {
		const start = this.point;
		const control = jitteredControlPoint( start, target, rng );
		const steps = Math.max( 1, frames );

		for ( let i = 1; i <= steps; i++ ) {
			this.moveTo( bezierPoint( start, control, target, i / steps ) );
			await this.nextFrame();
		}

		await this.settle( target, rng );
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
