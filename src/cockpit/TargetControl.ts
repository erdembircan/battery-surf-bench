/**
 * Target-drop control — the math behind the battery slider that picks a
 * stop-at level.
 *
 * A target-drop run stops once the battery falls to a chosen level. You cannot
 * target a level above the battery you currently have, so every value is both
 * stepped to the slider's grid and capped at the current level. Keeping this
 * pure (a percentage in, a percentage out) lets the store stay a thin wiring
 * layer and lets the stepping/capping rules be tested without a DOM.
 */

/** Smallest and largest target battery percentage the slider allows. */
export const TARGET_MIN = 5;
export const TARGET_MAX = 95;

/** Step the battery slider snaps to, in percent. */
export const TARGET_STEP = 5;

/**
 * The highest stop-at level the slider allows: the largest step strictly below
 * the current battery level, since a target equal to (or above) the current
 * level would be a zero drop. So at 65% the cap is 60, not 65. Falls back to the
 * nominal max until the level is known.
 * @param batteryLevel Current level as a 0..100 percentage, or null when unknown.
 */
export const targetCap = ( batteryLevel: number | null ): number => {
	if ( batteryLevel === null ) {
		return TARGET_MAX;
	}

	return Math.max(
		TARGET_MIN,
		Math.floor( ( batteryLevel - 1 ) / TARGET_STEP ) * TARGET_STEP
	);
};

/**
 * Clamps a percentage to the slider's stepped range, bounded above by `max`.
 * @param value
 * @param max
 */
export const clampTarget = (
	value: number,
	max: number = TARGET_MAX
): number =>
	Math.min(
		max,
		Math.max( TARGET_MIN, Math.round( value / TARGET_STEP ) * TARGET_STEP )
	);

/**
 * Maps a pointer x within the battery element to a stepped percentage, capped.
 * @param clientX
 * @param el
 * @param max
 */
export const targetFromPointer = (
	clientX: number,
	el: HTMLElement,
	max: number
): number => {
	const rect = el.getBoundingClientRect();
	const ratio = rect.width ? ( clientX - rect.left ) / rect.width : 0;

	return clampTarget( ratio * 100, max );
};

/**
 * The fill colour for a target level: green at high levels grading to red at low
 * ones, so a deeper drain target reads hotter.
 * @param percent
 */
export const targetColor = ( percent: number ): string => {
	const hue = Math.round( ( percent / 100 ) * 120 );

	return `hsl(${ hue }, 72%, 45%)`;
};
