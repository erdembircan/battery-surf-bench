/**
 * Tests for the dev-tools panel's shared shell: panel open/closed and the
 * persisted slice's read/write/hydrate plumbing. Sub-tool-specific behavior
 * (the battery override, the discharge sim) is tested in their own files.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

interface MockDevtoolsState {
	open: boolean;
	battery: { charging: boolean | null; level: number | null };
	sim: {
		fromPercent: number;
		toPercent: number;
		minutes: number;
		running: boolean;
		startedAt: number | null;
	};
}

const mocks = vi.hoisted( () => ( {
	state: undefined as unknown as { devtools: MockDevtoolsState },
} ) );

vi.mock( '@wordpress/interactivity', () => ( {
	store: () => ( { state: mocks.state } ),
} ) );

import {
	devtoolsShellStore,
	hydrateDevtools,
	DEVTOOLS_STORAGE_KEY,
} from './DevtoolsStore';

const actions = devtoolsShellStore.actions as unknown as {
	devtoolsToggleOpen: () => void;
};
const callbacks = devtoolsShellStore.callbacks as unknown as {
	devtoolsPersist: () => void;
};

const defaultSim = () => ( {
	fromPercent: 90,
	toPercent: 20,
	minutes: 30,
	running: false,
	startedAt: null,
} );

beforeEach( () => {
	mocks.state = {
		devtools: {
			open: false,
			battery: { charging: null, level: null },
			sim: defaultSim(),
		},
	};
	window.localStorage.clear();
} );

describe( 'devtoolsShellStore actions', () => {
	it( 'toggles the panel open state', () => {
		actions.devtoolsToggleOpen();
		expect( mocks.state.devtools.open ).toBe( true );

		actions.devtoolsToggleOpen();
		expect( mocks.state.devtools.open ).toBe( false );
	} );
} );

describe( 'persistence', () => {
	it( 'writes the whole slice — battery and sim — to localStorage on devtoolsPersist', () => {
		mocks.state.devtools = {
			open: true,
			battery: { charging: true, level: 0.2 },
			sim: { ...defaultSim(), running: true, startedAt: 12345 },
		};

		callbacks.devtoolsPersist();

		const stored: unknown = JSON.parse(
			window.localStorage.getItem( DEVTOOLS_STORAGE_KEY ) ?? 'null'
		);
		expect( stored ).toEqual( mocks.state.devtools );
	} );

	it( 'hydrates the shared state from a previously persisted slice', () => {
		window.localStorage.setItem(
			DEVTOOLS_STORAGE_KEY,
			JSON.stringify( {
				open: true,
				battery: { charging: false, level: 0.6 },
				sim: { ...defaultSim(), fromPercent: 80, toPercent: 10 },
			} )
		);

		hydrateDevtools();

		expect( mocks.state.devtools ).toEqual( {
			open: true,
			battery: { charging: false, level: 0.6 },
			sim: { ...defaultSim(), fromPercent: 80, toPercent: 10 },
		} );
	} );

	it( 'leaves the default state untouched when nothing is stored', () => {
		hydrateDevtools();

		expect( mocks.state.devtools.open ).toBe( false );
		expect( mocks.state.devtools.sim ).toEqual( defaultSim() );
	} );

	it( 'ignores a corrupted or stale-shape stored value', () => {
		window.localStorage.setItem(
			DEVTOOLS_STORAGE_KEY,
			JSON.stringify( { nonsense: true } )
		);
		hydrateDevtools();
		expect( mocks.state.devtools.open ).toBe( false );

		window.localStorage.setItem( DEVTOOLS_STORAGE_KEY, '{not json' );
		hydrateDevtools();
		expect( mocks.state.devtools.open ).toBe( false );

		// A stored value missing the (now required) `sim` shape is rejected too.
		window.localStorage.setItem(
			DEVTOOLS_STORAGE_KEY,
			JSON.stringify( {
				open: true,
				battery: { charging: null, level: null },
			} )
		);
		hydrateDevtools();
		expect( mocks.state.devtools.open ).toBe( false );
	} );

	it( 'ignores a value stored under the old (pre-Milestone-2) v2 key', () => {
		// The v2 shape had no `sim` field at all. The storage key bump means it
		// is simply never looked up again — the slice starts fresh at its
		// defaults instead of inheriting a shape with no sim to resume.
		window.localStorage.setItem(
			'bsb-devtools-v2',
			JSON.stringify( {
				open: true,
				battery: { charging: true, level: 0.9 },
			} )
		);

		hydrateDevtools();

		expect( DEVTOOLS_STORAGE_KEY ).toBe( 'bsb-devtools-v3' );
		expect( mocks.state.devtools ).toEqual( {
			open: false,
			battery: { charging: null, level: null },
			sim: defaultSim(),
		} );
	} );

	it( 'ignores a value stored under the original (pre-redesign) v1 key', () => {
		window.localStorage.setItem(
			'bsb-devtools-v1',
			JSON.stringify( {
				open: true,
				battery: { enabled: true, charging: true, level: 0.9 },
			} )
		);

		hydrateDevtools();

		expect( mocks.state.devtools ).toEqual( {
			open: false,
			battery: { charging: null, level: null },
			sim: defaultSim(),
		} );
	} );
} );
