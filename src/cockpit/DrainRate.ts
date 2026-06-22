/**
 * Drain-rate regression — the pure math behind the cockpit's readouts.
 *
 * Battery level is a quantized step signal (Chrome reports it at 1% granularity
 * on macOS), so the rate at which it drains is recovered with an ordinary
 * least-squares fit of level against time rather than a naive end-to-end delta.
 * Everything here is pure: it takes plain samples and returns numbers, with no
 * knowledge of the Battery Status API, the Interactivity store, or the DOM, so
 * the equations can be tested in isolation and reused server-side later.
 */

/**
 * One point the regression fits over: a battery level at an elapsed time. The
 * run-length-encoded sample in the log is a superset of this, so the log's
 * records feed the regression directly.
 */
export interface Sample {
	/** Elapsed milliseconds since the run started. */
	t: number;
	/** Battery level as a 0..1 fraction. */
	level: number;
	/** Whether the device was charging when the level was observed. */
	charging: boolean;
}

/** A computed drain rate and the number of samples it was derived from. */
export interface DrainRateResult {
	/** Drain in percentage points per hour, positive when discharging; null when it cannot be computed. */
	pctPerHour: number | null;
	/** How many samples the fit considered. */
	samples: number;
}

/** Milliseconds in one hour, the per-ms → per-hour conversion factor. */
const MS_PER_HOUR = 3_600_000;

/** Default trailing window for the responsive "current" rate: ten minutes. */
export const WINDOW_MS = 10 * 60_000;

/**
 * The number of distinct level values present in a set of samples. Until at
 * least two distinct levels have been seen, the battery has not stepped and no
 * slope exists — this gates the "calibrating" state.
 * @param samples
 */
export const distinctLevelCount = ( samples: readonly Sample[] ): number =>
	new Set( samples.map( ( s ) => s.level ) ).size;

/**
 * The drain rate over the given samples, as an ordinary least-squares slope of
 * level against time converted to percentage points per hour (positive when
 * discharging). Charging samples are excluded — they do not describe a drain.
 *
 * Returns a null rate when it cannot be fit: fewer than two discharging
 * samples, fewer than two distinct levels (a flat series has no slope), or a
 * degenerate fit where every timestamp is identical.
 * @param samples
 */
export const drainRate = ( samples: readonly Sample[] ): DrainRateResult => {
	const usable = samples.filter( ( s ) => ! s.charging );
	const n = usable.length;

	if ( n < 2 || distinctLevelCount( usable ) < 2 ) {
		return { pctPerHour: null, samples: n };
	}

	let sumT = 0;
	let sumL = 0;
	let sumTT = 0;
	let sumTL = 0;
	for ( const s of usable ) {
		sumT += s.t;
		sumL += s.level;
		sumTT += s.t * s.t;
		sumTL += s.t * s.level;
	}

	const denom = n * sumTT - sumT * sumT;
	if ( denom === 0 ) {
		return { pctPerHour: null, samples: n };
	}

	// Slope of level (0..1) per millisecond; drain is the negative slope, scaled
	// to percentage points (×100) per hour (×3_600_000 ms).
	const slopePerMs = ( n * sumTL - sumT * sumL ) / denom;
	const pctPerHour = -slopePerMs * 100 * MS_PER_HOUR;

	return { pctPerHour, samples: n };
};

/**
 * The drain rate restricted to a trailing window anchored on the most recent
 * sample — the responsive "current" rate. Same least-squares fit as
 * {@link drainRate}, over only the samples within `windowMs` of the latest.
 * @param samples
 * @param windowMs
 */
export const windowDrainRate = (
	samples: readonly Sample[],
	windowMs: number = WINDOW_MS
): DrainRateResult => {
	if ( samples.length === 0 ) {
		return { pctPerHour: null, samples: 0 };
	}

	const cutoff = samples[ samples.length - 1 ]!.t - windowMs;

	return drainRate( samples.filter( ( s ) => s.t >= cutoff ) );
};

/**
 * Projected minutes for the battery to fall from `currentLevel` to
 * `targetLevel` at the given rate, both levels as 0..1 fractions. Returns null
 * when the rate is unknown or non-positive (not draining), or when the target
 * is already at or above the current level (no drop to wait for).
 * @param currentLevel
 * @param targetLevel
 * @param pctPerHour
 */
export const minutesToLevel = (
	currentLevel: number,
	targetLevel: number,
	pctPerHour: number | null
): number | null => {
	if ( pctPerHour === null || pctPerHour <= 0 ) {
		return null;
	}

	const dropPct = ( currentLevel - targetLevel ) * 100;
	if ( dropPct <= 0 ) {
		return null;
	}

	return ( dropPct / pctPerHour ) * 60;
};
