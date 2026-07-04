/**
 * Satiation bookkeeping. Running a behavior consumes its
 * novelty; it recovers a little every tick. This is what keeps a strong trait
 * from looping the same action forever — the bid stays high, but appetite
 * drags it back down until something else gets a turn.
 */

/** Fraction of appetite left after a behavior runs. */
const SATIATION = 0.5;

/** Appetite regained per tick, toward the ceiling of 1. */
const RECOVERY = 0.02;

/** Per-behavior satiation, keyed by `Behavior.key`. Unseen keys start full. */
export class Appetite {
	private readonly values = new Map< string, number >();

	/**
	 * Current appetite (0–1) for `key`; full until it has run at least once.
	 * @param key
	 */
	valueFor( key: string ): number {
		return this.values.get( key ) ?? 1;
	}

	/**
	 * Applies satiation to `key` after its behavior has run.
	 * @param key
	 */
	consume( key: string ): void {
		this.values.set( key, this.valueFor( key ) * SATIATION );
	}

	/** Recovers every tracked behavior's appetite a step, capped at 1. */
	recoverTick(): void {
		for ( const [ key, value ] of this.values ) {
			this.values.set( key, Math.min( 1, value + RECOVERY ) );
		}
	}
}
