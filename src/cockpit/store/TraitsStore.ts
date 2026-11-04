/**
 * The surfer-traits slice of the cockpit store: the RPG "Surfer" profile that
 * shapes how the in-iframe engine behaves on a run. Owns the point-buy stat
 * vector — the class-preset chips, the per-stat sliders, the Reset and the
 * Customize disclosure — and the derived archetype cover-name. The trait domain
 * (point-buy maths, presets, classification) lives in the shared, unit-tested
 * {@link ../../shared/SurferStats} module so the cockpit and the engine read the
 * same rules; this slice only wires that domain to the reactive context.
 *
 * The trait vector is the single source of truth on the ROOT context — never a
 * nested `data-wp-context`. The Interactivity runtime builds each nested context
 * as a shallow copy, so writing the vector through a per-element child context
 * would update only that copy and desync the rest. Instead each slider/chip
 * carries a plain `data-index` / `data-class`, the actions read it via
 * `getElement` and write the root vector, and the per-element readouts are fixed
 * getters generated per stat index and per class (derived state cannot use
 * `getElement`).
 */

import { getContext, getElement } from '@wordpress/interactivity';
import { type CockpitContext } from '@/cockpit/CockpitContext';
import { type StorePart } from '@/cockpit/store/StoreParts';
import {
	CLASSES,
	MIN,
	MAX,
	STATS,
	classify,
	clampTrait,
	headroom,
	pointsLeft,
	FRESH,
} from '@/shared/SurferStats';

/** The root cockpit context — where the trait vector lives. */
const ctx = (): CockpitContext => getContext< CockpitContext >();

/**
 * Paints a slider track: accent fill, headroom tint, then dead track.
 * @param traits
 * @param index
 */
const trackGradient = ( traits: readonly number[], index: number ): string => {
	const value = traits[ index ] ?? 0;
	const ceil = headroom( traits, index );
	const filled = ( ( value - MIN ) / ( MAX - MIN ) ) * 100;
	const reach = ( ( ceil - MIN ) / ( MAX - MIN ) ) * 100;

	return `linear-gradient(90deg,var(--accent) 0 ${ filled }%,var(--accent-headroom) ${ filled }% ${ reach }%,var(--track) ${ reach }% 100%)`;
};

/**
 * The store getter name a class chip binds its active state to. The view derives
 * the same name from the chip's class key, so the two stay matched.
 * @param name The canonical archetype/class key.
 */
export const classGetter = ( name: string ): string =>
	`isClass${ name.replace( /[^a-zA-Z0-9]/g, '' ) }`;

// Built once: the fixed state getters. The shared ones plus a value/track getter
// per stat index and an active getter per class — all reading the root vector,
// so any edit re-runs every dependent binding.
const state: Record< string, unknown > = {
	/** The derived archetype cover-name, translated for display. */
	get archetypeLabel(): string {
		const { traits, archetypeLabels } = ctx();

		return archetypeLabels[ classify( traits ) ] ?? classify( traits );
	},

	/** Points still unspent against the budget. */
	get pointsLeftDisplay(): string {
		return String( pointsLeft( ctx().traits ) );
	},

	/** Whether the whole budget is spent — flags the readout. */
	get isBudgetEmpty(): boolean {
		return pointsLeft( ctx().traits ) === 0;
	},

	/** Whether the stat sliders are revealed. */
	get isCustomizeOpen(): boolean {
		return ctx().traitsOpen;
	},
};

STATS.forEach( ( _stat, index ) => {
	Object.defineProperty( state, `traitValue${ index }`, {
		enumerable: true,
		get(): number {
			return ctx().traits[ index ] ?? 0;
		},
	} );
	Object.defineProperty( state, `traitTrack${ index }`, {
		enumerable: true,
		get(): string {
			return trackGradient( ctx().traits, index );
		},
	} );
} );

( Object.keys( CLASSES ) as ( keyof typeof CLASSES )[] ).forEach( ( name ) => {
	Object.defineProperty( state, classGetter( name ), {
		enumerable: true,
		get(): boolean {
			return classify( ctx().traits ) === name;
		},
	} );
} );

/** The surfer-traits slice of the `battery-surf-bench/cockpit` store. */
export const traitsStore: StorePart = {
	state,
	actions: {
		/** Loads the preset vector named by the chip's `data-class`. */
		selectClass(): void {
			const { ref } = getElement();
			const key = ( ref as HTMLElement | null )?.dataset.class as
				| keyof typeof CLASSES
				| undefined;

			if ( key && CLASSES[ key ] ) {
				ctx().traits = [ ...CLASSES[ key ] ];
			}
		},

		/**
		 * Sets a stat from its slider, point-buy clamped so the total can never
		 * exceed the budget. Reads the stat index from the slider's `data-index`
		 * and the live value off the element, then reassigns the root vector so
		 * every dependent binding re-renders (correcting the input on a clamp).
		 */
		setTrait(): void {
			const { ref } = getElement();
			const el = ref as HTMLInputElement;
			const index = Number( el.dataset.index );
			const traits = ctx().traits;

			if (
				! Number.isInteger( index ) ||
				index < 0 ||
				index >= traits.length
			) {
				return;
			}

			const next = [ ...traits ];
			next[ index ] = clampTrait( next, index, Number( el.value ) );
			ctx().traits = next;

			// Snap the thumb to the clamped value. When the budget blocks the raise
			// the clamped value equals the current one, so the bound value never
			// changes and the runtime would skip the DOM update — leaving the thumb
			// where it was dragged. Setting it here forces the thumb back.
			el.value = String( next[ index ] );
		},

		/** Clears every stat to zero — a fresh, unspent slate. */
		resetTraits(): void {
			ctx().traits = FRESH();
		},

		/** Reveals or hides the stat sliders. */
		toggleCustomize(): void {
			const context = ctx();
			context.traitsOpen = ! context.traitsOpen;
		},
	},
};
