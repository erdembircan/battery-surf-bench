/**
 * Tiny easing/interpolation helpers shared by the scroller and the cursor so
 * their motion matches. Pure functions, kept apart from the DOM so the motion
 * maths can be unit-tested on its own.
 */

/**
 * Quadratic ease-in-out over a normalized `t` in [0, 1] — the wheel-flick feel
 * the scroll bursts and cursor glides use.
 * @param t Progress in [0, 1].
 */
export const easeInOutQuad = ( t: number ): number =>
	t < 0.5 ? 2 * t * t : 1 - Math.pow( -2 * t + 2, 2 ) / 2;

/**
 * Linear interpolation from `a` to `b` at progress `t`.
 * @param a Start value.
 * @param b End value.
 * @param t Progress in [0, 1].
 */
export const lerp = ( a: number, b: number, t: number ): number =>
	a + ( b - a ) * t;
