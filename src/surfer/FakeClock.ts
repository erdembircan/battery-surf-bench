import type { Clock } from './Clock';

/**
 * Test double for {@link Clock}: resolves every wait immediately and records
 * the requested duration, so a test can assert on timing without sleeping. A
 * coherent virtual clock: `now()` reports the accumulated total of every
 * `wait()` so far, rather than a fixed or real-time value, so time-on-page
 * bookkeeping (e.g. `SurfLoop`'s `elapsedMs`) advances exactly as far as the
 * ticks the test observed.
 */
export class FakeClock implements Clock {
	readonly waits: number[] = [];
	private elapsed = 0;

	wait( ms: number ): Promise< void > {
		this.waits.push( ms );
		this.elapsed += ms;
		return Promise.resolve();
	}

	now(): number {
		return this.elapsed;
	}
}
