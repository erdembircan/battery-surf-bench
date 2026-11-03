/**
 * A visible cursor the surf engine drives across the page. Synthetic
 * `mousemove` events alone move nothing on screen — `FidgetWiggle` and
 * `LingerImage` are taste features, so the visitor needs something to
 * actually see wandering. Painted once, by `DomMotor`, only while the engine
 * is running; a static page never gets one.
 */

import type { Rng } from '@/surfer/Rng';
import { easeInOutQuad } from '@/surfer/Ease';
import type { FramePacer } from '@/surfer/FramePacer';

/** A viewport position, in CSS pixels. */
export interface Point {
	x: number;
	y: number;
}

/** Class the document root carries while the engine drives, hiding the real cursor. */
export const SURFING_CLASS = 'bsb-surfing';

/** Stylesheet hook for the cursor element itself (styled in `src/styles/course/style.scss`). */
const CURSOR_CLASS = 'bsb-surf-cursor';

/** Stylesheet hook for the cursor's inner glyph layer — the element the click squash animates, kept free of the positioning transform. */
const GLYPH_CLASS = 'bsb-surf-cursor__glyph';

/**
 * The glyph the cursor currently wears: the default arrow, the I-beam caret
 * it reads and highlights text with, or the pointing hand it clicks video
 * players with.
 */
export type CursorMode = 'arrow' | 'caret' | 'hand';

/** Modifier classes {@link CursorMode}'s non-default modes map onto. */
const MODE_CLASSES: Record< Exclude< CursorMode, 'arrow' >, string > = {
	caret: 'bsb-surf-cursor--caret',
	hand: 'bsb-surf-cursor--hand',
};

/** Modifier class carried while a click's press animation plays. */
const PRESSING_CLASS = 'bsb-surf-cursor--pressing';

/** Class of the transient ripple element a click spawns. */
const RIPPLE_CLASS = 'bsb-surf-click-ripple';

/**
 * How long a click's press-and-ripple moment holds, in ms — the length of
 * the ripple's own animation in the course stylesheet, so the ring finishes
 * fading before it is removed.
 */
const CLICK_MS = 400;

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

/**
 * How long the cursor rests past its target before settling back onto it,
 * in ms — a blink, just long enough to register as an overshoot.
 */
const OVERSHOOT_HOLD_MS = 16;

/** How long each px of travel distance takes, in ms, for {@link travelMsForDistance}. */
const TRAVEL_MS_PER_PX = 1.6;

/** Duration clamp band for a travelled leg, in ms, however far it goes. */
const TRAVEL_MIN_MS = 128;
const TRAVEL_MAX_MS = 960;

/**
 * How long a leg of `distance` px should take, in ms: proportional to
 * distance, so a short nudge is quick and a long sweep is unhurried, clamped
 * so neither collapses to an instant jump nor drags on indefinitely.
 * @param distance
 */
export const travelMsForDistance = ( distance: number ): number =>
	Math.min(
		TRAVEL_MAX_MS,
		Math.max( TRAVEL_MIN_MS, distance * TRAVEL_MS_PER_PX )
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
 * Builds the cursor's DOM: a positioned wrapper (this is the element whose
 * `transform` the engine writes) holding an inner glyph layer that paints
 * the actual pointer via CSS background. The split exists for the click
 * squash — a scale animated on the wrapper would compose with the inline
 * translate and visibly drag the cursor toward the viewport origin, so the
 * squash animates the glyph layer instead. All styling lives in the course
 * stylesheet under {@link CURSOR_CLASS}/{@link GLYPH_CLASS}.
 * @param doc
 */
const buildElement = ( doc: Document ): HTMLElement => {
	const el = doc.createElement( 'div' );
	el.className = CURSOR_CLASS;
	el.setAttribute( 'aria-hidden', 'true' );

	const glyph = doc.createElement( 'div' );
	glyph.className = GLYPH_CLASS;
	el.appendChild( glyph );

	return el;
};

export class FakeCursor {
	private readonly doc: Document;
	private readonly view: Window;
	private readonly el: HTMLElement;
	private readonly pacer: FramePacer;
	private point: Point;
	private currentMode: CursorMode = 'arrow';

	/**
	 * Injects the cursor element and flags the document as engine-driven.
	 * @param doc
	 * @param start
	 * @param pacer Paces every travel, settle and click; shared with the motor.
	 */
	constructor( doc: Document, start: Point, pacer: FramePacer ) {
		this.doc = doc;
		// `defaultView`, not a global `window`, so a test's own document can
		// control the viewport dimensions clamping is measured against.
		this.view = doc.defaultView ?? window;
		this.point = start;
		this.pacer = pacer;
		this.el = buildElement( doc );

		doc.documentElement.classList.add( SURFING_CLASS );
		doc.body.appendChild( this.el );
		this.paint();
	}

	/** The cursor's current position. */
	get position(): Point {
		return this.point;
	}

	/** The glyph mode the cursor currently wears. */
	get mode(): CursorMode {
		return this.currentMode;
	}

	/**
	 * Swaps the cursor's glyph. The glyph itself is pure stylesheet — this
	 * only toggles the modifier class, so the course stylesheet stays the
	 * single owner of what each mode looks like (and where its hotspot
	 * sits).
	 * @param mode
	 */
	setMode( mode: CursorMode ): void {
		this.el.classList.remove( MODE_CLASSES.caret, MODE_CLASSES.hand );

		if ( mode !== 'arrow' ) {
			this.el.classList.add( MODE_CLASSES[ mode ] );
		}

		this.currentMode = mode;
	}

	/**
	 * A brief press-and-ripple click at the current position: the glyph
	 * squashes while a ring expands from the point and fades. Resolves once
	 * the moment has played out; the ripple element is removed here, after
	 * {@link CLICK_MS} of frame time, never via `animationend` — a test's
	 * stepped frames would otherwise leak it.
	 */
	async click(): Promise< void > {
		this.el.classList.add( PRESSING_CLASS );

		const ripple = this.doc.createElement( 'div' );
		ripple.className = RIPPLE_CLASS;
		ripple.setAttribute( 'aria-hidden', 'true' );
		ripple.style.left = `${ this.point.x }px`;
		ripple.style.top = `${ this.point.y }px`;
		this.doc.body.appendChild( ripple );

		await this.pacer.hold( CLICK_MS );

		ripple.remove();
		this.el.classList.remove( PRESSING_CLASS );
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
	 * of the move rather than travelling at constant speed. The duration
	 * scales with travel distance ({@link travelMsForDistance}) unless `ms`
	 * overrides it; only a long-enough leg gets a small overshoot-and-settle
	 * once it arrives — a short nudge lands directly on `target`.
	 * @param target
	 * @param rng
	 * @param ms     Overrides the distance-derived duration when given.
	 */
	async travelTo( target: Point, rng: Rng, ms?: number ): Promise< void > {
		const start = this.point;
		const control = jitteredControlPoint( start, target, rng );
		const distance = Math.hypot( target.x - start.x, target.y - start.y );
		const duration = ms ?? travelMsForDistance( distance );

		await this.pacer.animate( duration, ( progress ) =>
			this.moveTo(
				bezierPoint( start, control, target, easeInOutQuad( progress ) )
			)
		);

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
		await this.pacer.hold( OVERSHOOT_HOLD_MS );
		this.moveTo( target );
	}

	private paint(): void {
		this.el.style.transform = `translate(${ this.point.x }px, ${ this.point.y }px)`;
	}
}
