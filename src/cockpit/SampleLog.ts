/**
 * Run-length-encoded battery sample log.
 *
 * Battery level is a quantized step signal, so storing every raw reading would
 * record the same percentage many times over while the level sits on a plateau.
 * More points on a plateau add no information to a least-squares fit of a step
 * signal — they only bias it toward the flat tail. So each plateau is collapsed
 * into a single record stamped at the moment the level was first reached (the
 * step's leading edge, which is the meaningful transition point for the fit),
 * carrying a `count` of how many raw readings it absorbed. That count lets a
 * caller see how often a level was re-observed — useful when a race repeats a
 * reading, or when a future higher-rate sampling mode lands many readings per
 * plateau — without distorting the regression, which uses one point per step.
 */

import type { Sample } from '@/cockpit/DrainRate';

/** A collapsed plateau: a {@link Sample} plus how many raw readings it absorbed. */
export interface RleSample extends Sample {
	/** Number of raw readings collapsed into this plateau. */
	count: number;
}

/**
 * Collects raw battery readings and stores them run-length-encoded — one record
 * per level/charging plateau, stamped at the plateau's leading edge. The stored
 * records double as regression input, since {@link RleSample} is a
 * {@link Sample}.
 */
export class SampleLog {
	/** The collapsed plateaus, in observation order. */
	private readonly samples: RleSample[] = [];

	/**
	 * Records a raw reading. If it continues the current plateau (same level and
	 * charging state), it is folded into that record's count and the record's
	 * leading-edge timestamp is kept. Otherwise it opens a new plateau.
	 * @param t        Elapsed milliseconds since the run started.
	 * @param level    Battery level as a 0..1 fraction.
	 * @param charging Whether the device was charging when the level was read.
	 */
	record( t: number, level: number, charging: boolean ): void {
		const last = this.samples[ this.samples.length - 1 ];

		if ( last && last.level === level && last.charging === charging ) {
			last.count += 1;
			return;
		}

		this.samples.push( { t, level, charging, count: 1 } );
	}

	/** The collapsed plateaus, in observation order. */
	all(): readonly RleSample[] {
		return this.samples;
	}

	/** The most recently recorded plateau, or null when nothing has been logged. */
	latest(): RleSample | null {
		return this.samples[ this.samples.length - 1 ] ?? null;
	}

	/** How many plateaus have been recorded. */
	get size(): number {
		return this.samples.length;
	}

	/** Discards every recorded plateau, readying the log for a fresh run. */
	clear(): void {
		this.samples.length = 0;
	}
}
