/**
 * Run configuration — the single source of truth for run bounds, plus the
 * normalizers that keep tampered values from reaching the calculations.
 *
 * The run mode, duration and speed live in client-seeded context, so a crafted
 * page could set any value — a 300-minute run past the 240-minute ceiling, an
 * unsupported speed, a bogus mode. Every value that crosses into the calculation
 * logic is therefore normalized here against the same limits the controls use,
 * so the UI and the math always agree and a casual tamper is corrected on the
 * spot. The same constants will back the server-side guard when the run is
 * eventually persisted, so the two sides cannot drift.
 */

/** Which quantity a benchmark run is bounded by. */
export type RunMode = 'duration' | 'targetDrop';

/** Smallest and largest run duration, in minutes, and the step it snaps to. */
export const DURATION_MIN = 5;
export const DURATION_MAX = 240;
export const DURATION_STEP = 5;

/** The surf speeds the deck offers. */
export const SPEEDS = [ 1, 4, 10 ] as const;

/** A supported surf speed. */
export type Speed = ( typeof SPEEDS )[ number ];

/**
 * Normalizes a run duration to the allowed range and step: clamped to
 * `[DURATION_MIN, DURATION_MAX]` and snapped to the nearest multiple of
 * `DURATION_STEP`. A non-finite value falls back to the minimum.
 * @param value
 */
export const normalizeDuration = ( value: number ): number => {
	if ( ! Number.isFinite( value ) ) {
		return DURATION_MIN;
	}

	const clamped = Math.min( DURATION_MAX, Math.max( DURATION_MIN, value ) );

	return Math.round( clamped / DURATION_STEP ) * DURATION_STEP;
};

/**
 * Normalizes a surf speed to a supported value, falling back to the slowest
 * (1×) for anything off the list.
 * @param value
 */
export const normalizeSpeed = ( value: number ): Speed =>
	( SPEEDS as readonly number[] ).includes( value )
		? ( value as Speed )
		: SPEEDS[ 0 ];

/**
 * Normalizes a run mode, falling back to `duration` for anything unrecognized.
 * @param value
 */
export const normalizeMode = ( value: unknown ): RunMode =>
	value === 'targetDrop' ? 'targetDrop' : 'duration';
