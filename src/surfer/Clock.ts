/**
 * The engine's time seam. `SurfLoop` waits between ticks through this
 * interface rather than calling `setTimeout` directly, so tests can swap in a
 * fake that resolves instantly instead of sleeping through jittered,
 * multi-second durations. `now()` gives `SurfLoop` a way to measure elapsed
 * engine time through the same seam, so a fake clock's time-on-page
 * bookkeeping stays coherent with the waits it resolves.
 */
export interface Clock {
	wait: ( ms: number ) => Promise< void >;
	/** Current time, in milliseconds, from an arbitrary but consistent origin. */
	now: () => number;
}

/** Production clock: waits for real wall-clock time. */
export class RealClock implements Clock {
	wait( ms: number ): Promise< void > {
		return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
	}

	now(): number {
		return performance.now();
	}
}
