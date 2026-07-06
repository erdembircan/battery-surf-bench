/**
 * The discharge-simulation sub-tool's pure model: linearly interpolates a
 * battery level between a start and end percentage over a chosen duration.
 * Kept free of any store/DOM dependency so the maths can be unit-tested in
 * isolation — the store slice ({@link ./DischargeSimStore}) only evaluates
 * this against a live clock and writes the result into the battery-override
 * seam; it holds no simulation logic of its own.
 *
 * The simulated level is a pure function of `(config, elapsed)` — never of
 * wall-clock time directly — so a page reload can recompute exactly where the
 * sim should be from the persisted `startedAt` timestamp, with no drift and no
 * dependency on the ticker having kept running.
 */

/** The sim's configurable shape: a discharge from one level to a lower one. */
export interface DischargeSimConfig {
	/** Starting battery percentage (0–100). */
	fromPercent: number;
	/** Ending battery percentage (0–100); a valid run requires this below `fromPercent`. */
	toPercent: number;
	/** Duration of the run, in minutes. */
	minutes: number;
}

/** The sim's full persisted state: its config plus whether (and since when) it is running. */
export interface DischargeSimState extends DischargeSimConfig {
	/** Whether the ticker is currently driving the level override. */
	running: boolean;
	/** Wall-clock start time (ms since epoch), or null while not running. */
	startedAt: number | null;
	/**
	 * The sim's own live output — the level (0–1) its ticker last computed, or
	 * null while not running. This is the sim's own layer, entirely separate
	 * from the manual battery override's `level` field: the sim never writes
	 * to that field, so stopping or completing a run never leaves a manual
	 * override behind. See `EffectiveBatteryOverride` for how the two layers
	 * combine into the single override the cockpit acts on.
	 */
	currentLevel: number | null;
}

/**
 * The sim's default, pre-hydration state. Frozen: every consumer (the store's
 * own `DEFAULT_STATE`, a reset restoring the steppers) must read from a copy
 * of this object, never hold onto the object itself — freezing turns a
 * write-through regression into a thrown error instead of silently
 * corrupting the shared defaults.
 */
export const DEFAULT_SIM: DischargeSimState = Object.freeze( {
	fromPercent: 90,
	toPercent: 20,
	minutes: 30,
	running: false,
	startedAt: null,
	currentLevel: null,
} );

/**
 * The run's total duration in milliseconds.
 *
 * @param config The sim's configuration.
 * @return The duration, in milliseconds.
 */
export const simDurationMs = ( config: DischargeSimConfig ): number =>
	config.minutes * 60_000;

/**
 * How far through the run a given elapsed time sits, clamped to 0–1. A
 * non-positive duration (should never occur — minutes is bounded well above
 * zero — but guarded regardless) reads as complete rather than dividing by
 * zero.
 *
 * @param config    The sim's configuration.
 * @param elapsedMs Milliseconds since the run started.
 * @return The run's progress, 0 (just started) to 1 (finished).
 */
export const simProgress = (
	config: DischargeSimConfig,
	elapsedMs: number
): number => {
	const duration = simDurationMs( config );

	if ( duration <= 0 ) {
		return 1;
	}

	return Math.min( 1, Math.max( 0, elapsedMs / duration ) );
};

/**
 * The interpolated battery level at a given elapsed time, as a 0–1 fraction —
 * ready to assign directly to the battery-override seam's `level` field.
 * Exactly `fromPercent` at (or before) the start, exactly `toPercent` at (or
 * after) the end, linear in between.
 *
 * @param config    The sim's configuration.
 * @param elapsedMs Milliseconds since the run started.
 * @return The simulated level, 0–1.
 */
export const simulatedLevel = (
	config: DischargeSimConfig,
	elapsedMs: number
): number => {
	const progress = simProgress( config, elapsedMs );
	const percent =
		config.fromPercent +
		( config.toPercent - config.fromPercent ) * progress;

	return percent / 100;
};

/**
 * Whether the run has reached its end at a given elapsed time.
 *
 * @param config    The sim's configuration.
 * @param elapsedMs Milliseconds since the run started.
 * @return Whether the run is complete.
 */
export const isSimComplete = (
	config: DischargeSimConfig,
	elapsedMs: number
): boolean => simProgress( config, elapsedMs ) >= 1;
