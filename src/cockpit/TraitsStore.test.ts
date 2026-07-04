/**
 * Tests for the surfer-traits store slice.
 *
 * The slice's consumer is the Surfer field markup: chips bind their active state
 * to a per-class getter and click to load a preset, sliders bind their value and
 * track to a per-index getter and write the root vector on input, and the field
 * shows the derived archetype. The trait vector is the single source on the root
 * context (never a nested one). These stub the Interactivity runtime and drive
 * the getters/actions against a fake context and the triggering element.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

interface FakeContext {
	traits: number[];
	traitsOpen: boolean;
	archetypeLabels: Record< string, string >;
}

interface FakeElement {
	dataset: Record< string, string >;
	value: string;
}

const mocks = vi.hoisted( () => ( {
	context: undefined as unknown as FakeContext,
	element: { dataset: {}, value: '' } as FakeElement,
} ) );

vi.mock( '@wordpress/interactivity', () => ( {
	getContext: () => mocks.context,
	getElement: () => ( { ref: mocks.element } ),
} ) );

import { traitsStore, classGetter } from './TraitsStore';
import { CLASSES, FRESH } from '../shared/SurferStats';

const state = traitsStore.state as Record< string, unknown >;
const actions = traitsStore.actions as Record< string, () => void >;

const labels = (): Record< string, string > => ( {
	Balanced: 'Balanced',
	Scholar: 'Scholar',
	'Binge-Watcher': 'Binge-Watcher',
	Doomscroller: 'Doomscroller',
	Skimmer: 'Skimmer',
	Jitterbug: 'Jitterbug',
	Custom: 'Custom',
} );

beforeEach( () => {
	mocks.context = {
		traits: [ 5, 5, 5, 5, 5 ],
		traitsOpen: false,
		archetypeLabels: labels(),
	};
	mocks.element = { dataset: {}, value: '' };
} );

describe( 'traits store slice', () => {
	describe( 'derived archetype', () => {
		it( 'shows the translated cover-name for the current vector', () => {
			expect( state.archetypeLabel ).toBe( 'Balanced' );

			mocks.context.traits = [ ...CLASSES[ 'Binge-Watcher' ] ];
			expect( state.archetypeLabel ).toBe( 'Binge-Watcher' );
		} );

		it( 'falls back to the canonical key when no label is seeded', () => {
			mocks.context.archetypeLabels = {};
			mocks.context.traits = [ ...CLASSES.Scholar ];
			expect( state.archetypeLabel ).toBe( 'Scholar' );
		} );
	} );

	describe( 'point budget', () => {
		it( 'reports points left and flags an empty budget', () => {
			expect( state.pointsLeftDisplay ).toBe( '0' ); // balanced spends 25
			expect( state.isBudgetEmpty ).toBe( true );

			mocks.context.traits = FRESH();
			expect( state.pointsLeftDisplay ).toBe( '25' );
			expect( state.isBudgetEmpty ).toBe( false );
		} );
	} );

	describe( 'customize disclosure', () => {
		it( 'reflects and toggles open state', () => {
			expect( state.isCustomizeOpen ).toBe( false );
			actions.toggleCustomize();
			expect( mocks.context.traitsOpen ).toBe( true );
			expect( state.isCustomizeOpen ).toBe( true );
		} );
	} );

	describe( 'per-slider getters (fixed index)', () => {
		it( 'reads each stat by its own index getter', () => {
			mocks.context.traits = [ 1, 2, 3, 4, 5 ];
			expect( state.traitValue0 ).toBe( 1 );
			expect( state.traitValue2 ).toBe( 3 );
			expect( state.traitValue4 ).toBe( 5 );
		} );

		it( 'paints a track gradient with the accent fill and headroom', () => {
			expect( state.traitTrack0 ).toContain( 'linear-gradient' );
			expect( state.traitTrack0 ).toContain( 'var(--accent)' );
			expect( state.traitTrack0 ).toContain( 'var(--accent-headroom)' );
		} );
	} );

	describe( 'per-chip getters (fixed class)', () => {
		it( 'marks only the chip matching the derived archetype active', () => {
			mocks.context.traits = [ ...CLASSES.Scholar ];
			expect( state[ classGetter( 'Scholar' ) ] ).toBe( true );
			expect( state[ classGetter( 'Skimmer' ) ] ).toBe( false );
		} );

		it( 'derives a hyphen-free getter name', () => {
			expect( classGetter( 'Binge-Watcher' ) ).toBe(
				'isClassBingeWatcher'
			);
		} );
	} );

	describe( 'actions write the root vector', () => {
		it( 'loads a preset on chip selection (data-class)', () => {
			mocks.element.dataset.class = 'Doomscroller';
			actions.selectClass();
			expect( mocks.context.traits ).toEqual( CLASSES.Doomscroller );
		} );

		it( 'sets a stat from its slider (data-index), point-buy clamped', () => {
			mocks.context.traits = FRESH(); // all 0, full budget
			mocks.element.dataset.index = '0';
			mocks.element.value = '8';
			actions.setTrait();
			expect( mocks.context.traits[ 0 ] ).toBe( 8 );
		} );

		it( 'caps a raise at the remaining budget', () => {
			// 23 spent, 2 left; raising stat 0 (5) can reach only 7.
			mocks.context.traits = [ 5, 5, 6, 5, 2 ];
			mocks.element.dataset.index = '0';
			mocks.element.value = '10';
			actions.setTrait();
			expect( mocks.context.traits[ 0 ] ).toBe( 7 );
		} );

		it( 'ignores a slider with no valid index', () => {
			mocks.context.traits = FRESH();
			mocks.element.dataset.index = 'nope';
			mocks.element.value = '8';
			actions.setTrait();
			expect( mocks.context.traits ).toEqual( FRESH() );
		} );

		it( 'resets every stat to zero', () => {
			mocks.context.traits = [ ...CLASSES.Scholar ];
			actions.resetTraits();
			expect( mocks.context.traits ).toEqual( FRESH() );
		} );
	} );
} );
