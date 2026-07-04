/**
 * Surfer personality stats — the shared, framework-free domain behind the
 * cockpit's "Surfer" profile and the in-iframe surf engine.
 *
 * A surfer is five stats, each 0–10, that the engine reads to decide how it
 * behaves on a page (tick cadence, scroll flick size, reading, media pull,
 * fidgeting). The stats are spent from a fixed point budget (raising one
 * forces lowering another), and an archetype "cover name" is DERIVED from the
 * vector by threshold rules — it is never stored or selected, only computed,
 * so the name is always a pure function of the current stats. Both the
 * cockpit (which edits the vector) and the engine (which consumes it) import
 * this one module so the two sides cannot drift.
 */

/** A surfer stat, in the fixed order the trait vector and presets use. */
export type StatKey = 'tempo' | 'endurance' | 'literacy' | 'allure' | 'fidget';

/** One surfer stat and the single simulation lever it drives. */
export interface Stat {
	key: StatKey;
	/** What the stat scales in the engine — used for the slider's helper line. */
	lever: string;
}

/**
 * The five stats in vector order. The trait vector is `number[]` indexed to
 * match this list, so the index of a stat here is its index everywhere.
 */
export const STATS: readonly Stat[] = [
	{
		key: 'tempo',
		lever: 'pace of every motion — lazy crawl to rapid flicks',
	},
	{
		key: 'endurance',
		lever: 'staying power — bounces fast to camps the page',
	},
	{ key: 'literacy', lever: 'pull of text — ignores it to stops and reads' },
	{ key: 'allure', lever: 'pull of media — skips it to sits and watches' },
	{ key: 'fidget', lever: 'restlessness — statue-still to squirmy' },
];

/** Number of stats in a trait vector. */
export const STAT_COUNT = STATS.length;

/** Smallest and largest value a single stat can take. */
export const MIN = 0;
export const MAX = 10;

/** Total points distributable across all stats — the point-buy budget. */
export const BUDGET = 25;

/**
 * A derived archetype name, or `'Custom'` when the vector matches no rule. These
 * are canonical keys; the cockpit maps them to translated labels for display.
 */
export type Archetype =
	| 'Balanced'
	| 'Scholar'
	| 'Binge-Watcher'
	| 'Doomscroller'
	| 'Skimmer'
	| 'Jitterbug'
	| 'Custom';

/**
 * Preset trait vectors a class chip loads. Each is a representative build that
 * classifies back to its own name; editing one re-derives the archetype.
 */
export const CLASSES: Readonly<
	Record< Exclude< Archetype, 'Custom' >, readonly number[] >
> = {
	//               tempo end lit allure fidget
	Balanced: [ 5, 5, 5, 5, 5 ],
	Scholar: [ 2, 8, 10, 2, 3 ],
	'Binge-Watcher': [ 3, 7, 2, 10, 3 ],
	Doomscroller: [ 10, 4, 2, 5, 4 ],
	Skimmer: [ 8, 3, 5, 4, 5 ],
	Jitterbug: [ 6, 4, 2, 3, 10 ],
};

/**
 * Sums a trait vector.
 * @param vec
 */
const sum = ( vec: readonly number[] ): number =>
	vec.reduce( ( total, value ) => total + value, 0 );

/** A blank trait slate — every stat at the minimum, the full budget unspent. */
export const FRESH = (): number[] => new Array( STAT_COUNT ).fill( MIN );

/**
 * Points still unspent for a vector — what's left of the budget to distribute.
 * @param vec
 */
export const pointsLeft = ( vec: readonly number[] ): number =>
	BUDGET - sum( vec );

/**
 * The highest value stat `index` could reach right now without breaking the
 * budget: its current value plus whatever points remain, capped at `MAX`. Drives
 * the slider's "headroom" zone.
 * @param vec
 * @param index
 */
export const headroom = ( vec: readonly number[], index: number ): number =>
	Math.min( MAX, ( vec[ index ] ?? 0 ) + pointsLeft( vec ) );

/**
 * Point-buy clamp: the value stat `index` may take given `want`, bounded to
 * `[MIN, MAX]` and to whatever the remaining budget can afford, so a raise can
 * never push the total over `BUDGET`.
 * @param vec
 * @param index
 * @param want
 */
export const clampTrait = (
	vec: readonly number[],
	index: number,
	want: number
): number => {
	const others = sum( vec ) - ( vec[ index ] ?? 0 );
	const affordable = Math.min( MAX, BUDGET - others );

	return Math.max( MIN, Math.min( affordable, Math.round( want ) ) );
};

/**
 * Normalizes an untrusted trait vector into a valid one: exactly `STAT_COUNT`
 * whole numbers, each within `[MIN, MAX]`, with the total never exceeding
 * `BUDGET` (later stats lose any overspend). A non-array falls back to the
 * Balanced preset. Mirrors the `normalize*` guards in RunConfig — the vector
 * crosses from client-seeded context and from the iframe URL, so a crafted value
 * is corrected before it drives the engine or is persisted.
 * @param value
 */
export const normalizeTraits = ( value: unknown ): number[] => {
	const raw = Array.isArray( value ) ? value : CLASSES.Balanced;
	const out: number[] = [];

	for ( let i = 0; i < STAT_COUNT; i++ ) {
		const n = Number( raw[ i ] );
		out[ i ] = clampTrait( out, i, Number.isFinite( n ) ? n : MIN );
	}

	return out;
};

/**
 * Derives the archetype cover-name from a trait vector by threshold rules, first
 * match wins. The rules are the archetype definitions — high Allure + low
 * Literacy reads as a Binge-Watcher, and so on; nothing matching is `'Custom'`.
 * @param vec
 */
export const classify = ( vec: readonly number[] ): Archetype => {
	const [ tempo = 0, endurance = 0, literacy = 0, allure = 0, fidget = 0 ] =
		vec;

	if ( allure >= 8 && literacy <= 3 ) {
		return 'Binge-Watcher';
	}
	if ( fidget >= 8 && literacy <= 4 ) {
		return 'Jitterbug';
	}
	if ( tempo >= 8 && literacy <= 3 ) {
		return 'Doomscroller';
	}
	if ( tempo >= 6 && endurance <= 4 ) {
		return 'Skimmer';
	}
	if ( literacy >= 8 && tempo <= 3 ) {
		return 'Scholar';
	}
	if (
		vec.length === STAT_COUNT &&
		vec.every( ( value ) => value >= 4 && value <= 6 )
	) {
		return 'Balanced';
	}

	return 'Custom';
};
