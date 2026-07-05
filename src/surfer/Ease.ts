/**
 * Shared easing curve for animated motion in the surf engine. `Motor.scrollBy`
 * and `FakeCursor.travelTo` each animate a value from 0 to 1 over time; both
 * ease through this one curve rather than each carrying its own copy of the
 * same math.
 */

/**
 * Eases progress with a quad in/out curve: slow at both ends, fastest through
 * the middle, so animated motion glides away from rest and back onto it
 * rather than starting or stopping abruptly.
 * @param t Progress, 0–1.
 */
export const easeInOutQuad = ( t: number ): number =>
	t < 0.5 ? 2 * t * t : 1 - Math.pow( -2 * t + 2, 2 ) / 2;
