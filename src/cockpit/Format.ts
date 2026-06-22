/**
 * Display formatters for the cockpit's readouts.
 *
 * Pure string/number formatting shared by the store's getters and the duration
 * odometer: clocks, the time-to-empty projection, and the per-digit breakdown
 * the odometer wheels animate to. Kept apart from the store so the formats can
 * be verified directly.
 */

/** The em dash shown for a readout whose value is not yet known. */
export const EM_DASH = '—';

/**
 * Formats a number of seconds as a `MM:SS` clock, clamped at zero.
 * @param totalSeconds
 */
export const formatClock = ( totalSeconds: number ): string => {
	const safe = Math.max( 0, totalSeconds );
	const pad = ( value: number ): string => String( value ).padStart( 2, '0' );

	return `${ pad( Math.floor( safe / 60 ) ) }:${ pad( safe % 60 ) }`;
};

/**
 * Formats a projected time-to-empty (in seconds) as an `H:MM` string, or the em
 * dash when there is nothing meaningful to show — unknown, non-finite, or not
 * draining (zero or negative).
 * @param seconds
 */
export const formatTimeToEmpty = ( seconds: number | null ): string => {
	if ( seconds === null || ! Number.isFinite( seconds ) || seconds <= 0 ) {
		return EM_DASH;
	}

	const hours = Math.floor( seconds / 3600 );
	const minutes = Math.floor( ( seconds % 3600 ) / 60 );

	return `${ hours }:${ String( minutes ).padStart( 2, '0' ) }`;
};

/**
 * Formats a drain rate (percentage points per hour) for display, or the em dash
 * when it is not yet known.
 * @param pctPerHour
 */
export const formatRate = ( pctPerHour: number | null ): string =>
	pctPerHour === null ? EM_DASH : String( pctPerHour );

/**
 * The hundreds, tens and units digits of a duration, for the odometer wheels.
 * @param minutes
 */
export const durationDigits = ( minutes: number ): number[] => [
	Math.floor( minutes / 100 ) % 10,
	Math.floor( minutes / 10 ) % 10,
	minutes % 10,
];
