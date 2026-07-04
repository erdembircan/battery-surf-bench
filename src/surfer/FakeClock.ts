import type { Clock } from './Clock';

/**
 * Test double for {@link Clock}: resolves every wait immediately and records
 * the requested duration, so a test can assert on timing without sleeping.
 */
export class FakeClock implements Clock {
	readonly waits: number[] = [];

	wait( ms: number ): Promise< void > {
		this.waits.push( ms );
		return Promise.resolve();
	}
}
