/**
 * Run session — the cockpit's calculation domain model.
 *
 * Owns the battery samples gathered during a single benchmark run and derives
 * the readouts the deck shows: the responsive ten-minute drain rate, the
 * whole-run drain rate, and the projected time to empty. It sits between the
 * battery source and the store: the store starts a session when a run begins,
 * feeds it readings, and reads back derived values to bind onto the markup. All
 * timekeeping is passed in (the caller supplies the clock), so the model stays
 * pure and the projections can be tested with explicit timestamps.
 */

import {
	drainRate,
	windowDrainRate,
	minutesToLevel,
	type DrainRateResult,
} from './DrainRate';
import { SampleLog } from './SampleLog';

/** The derived values the deck binds onto its readout labels. */
export interface Readouts {
	/** Drain rate over the last ten minutes (%/h), or null until known. */
	rate10: number | null;
	/** Drain rate over the whole run (%/h), or null until known. */
	rateSession: number | null;
	/** Projected full-charge runtime in seconds (100% to empty at the whole-run rate), or null until known. */
	secondsToEmpty: number | null;
}

/** A readout set with nothing computed yet. */
const EMPTY_READOUTS: Readouts = {
	rate10: null,
	rateSession: null,
	secondsToEmpty: null,
};

/**
 * Rounds a drain rate to one decimal place, preserving null.
 * @param rate
 */
const roundRate = ( rate: number | null ): number | null =>
	rate === null ? null : Math.round( rate * 10 ) / 10;

/**
 * Accumulates a run's battery samples and derives its drain readouts. Start a
 * session when a run begins, record each reading, and read the readouts to bind
 * the derived values.
 */
export class RunSession {
	/** Run-length-encoded samples for the active run. */
	private readonly log = new SampleLog();
	/** Clock value at run start; null between runs. */
	private startedAt: number | null = null;

	/**
	 * Begins a fresh run: discards any prior samples and anchors the clock so
	 * subsequent readings are stamped relative to this moment.
	 * @param now A monotonic clock value (e.g. `performance.now()`).
	 */
	start( now: number ): void {
		this.log.clear();
		this.startedAt = now;
	}

	/** Whether a run is currently accumulating samples. */
	get active(): boolean {
		return this.startedAt !== null;
	}

	/**
	 * Records a battery reading against the active run, stamped at its elapsed
	 * time. A no-op when no run is active.
	 * @param now      A monotonic clock value (e.g. `performance.now()`).
	 * @param level    Battery level as a 0..1 fraction.
	 * @param charging Whether the device was charging when the level was read.
	 */
	record( now: number, level: number, charging: boolean ): void {
		if ( this.startedAt === null ) {
			return;
		}

		this.log.record( now - this.startedAt, level, charging );
	}

	/**
	 * The current derived readouts: the ten-minute and whole-run drain rates
	 * (rounded to a tenth of a percent per hour) and the projected full-charge
	 * runtime — how long a full battery (100%) would last at the whole-run rate,
	 * a device-level figure that does not depend on the charge the run started
	 * from. Values are null until enough has been observed to compute them.
	 */
	readouts(): Readouts {
		const latest = this.log.latest();

		if ( ! latest ) {
			return EMPTY_READOUTS;
		}

		const samples = this.log.all();
		const session: DrainRateResult = drainRate( samples );
		const window: DrainRateResult = windowDrainRate( samples );
		// Full-charge runtime: project from a full battery (100%) to empty, so the
		// figure is comparable across runs and devices rather than tied to the
		// charge this run happened to start at.
		const minutes = minutesToLevel( 1, 0, session.pctPerHour );

		return {
			rate10: roundRate( window.pctPerHour ),
			rateSession: roundRate( session.pctPerHour ),
			secondsToEmpty:
				minutes === null ? null : Math.round( minutes * 60 ),
		};
	}

	/** Ends the run; the recorded samples remain readable until the next start. */
	stop(): void {
		this.startedAt = null;
	}
}
