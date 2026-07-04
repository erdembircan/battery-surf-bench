/**
 * The engine's time seam. `SurfLoop` waits between ticks through this
 * interface rather than calling `setTimeout` directly, so tests can swap in a
 * fake that resolves instantly instead of sleeping through jittered,
 * multi-second durations.
 */
export interface Clock {
	wait: ( ms: number ) => Promise< void >;
}

/** Production clock: waits for real wall-clock time. */
export class RealClock implements Clock {
	wait( ms: number ): Promise< void > {
		return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
	}
}
