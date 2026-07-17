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
		currentLevel: number | null;
	};
	surf: {
		sterile: boolean;
		behaviorKey: string;
		remainingMs: number | null;
		affordances: {
			hasVideo: boolean;
			imageCount: number;
			textDensity: number;
		} | null;
		pageStep: { delta: -1 | 1; seq: number } | null;
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
	currentLevel: null,
} );

const defaultSurf = () => ( {
	sterile: false,
	behaviorKey: '',
	remainingMs: null,
	affordances: null,
	pageStep: null,
} );

beforeEach( () => {
	mocks.state = {
		devtools: {
			open: false,
			battery: { charging: null, level: null },
			sim: defaultSim(),
			surf: defaultSurf(),
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
	it( 'writes only open, battery and the Surf tool’s armed sterile flag to localStorage on devtoolsPersist — never the discharge sim or the Surf tool’s runtime fields', () => {
		mocks.state.devtools = {
			open: true,
			battery: { charging: true, level: 0.2 },
			sim: { ...defaultSim(), running: true, startedAt: 12345 },
			surf: {
				...defaultSurf(),
				sterile: true,
				behaviorKey: 'readPause',
				remainingMs: 4000,
			},
		};

		callbacks.devtoolsPersist();

		const stored: unknown = JSON.parse(
			window.localStorage.getItem( DEVTOOLS_STORAGE_KEY ) ?? 'null'
		);
		expect( stored ).toEqual( {
			open: true,
			battery: { charging: true, level: 0.2 },
			surf: { sterile: true },
		} );
	} );

	it( 'a running sim ticking never changes what gets persisted — the manual battery layer stays put', () => {
		mocks.state.devtools = {
			open: true,
			battery: { charging: null, level: null },
			sim: { ...defaultSim(), running: true, startedAt: 12345 },
			surf: defaultSurf(),
		};

		// Simulate several ticker writes to the sim's own output field — the
		// persisted `battery` must never move in response.
		for ( const level of [ 0.9, 0.7, 0.5, 0.3 ] ) {
			mocks.state.devtools.sim.currentLevel = level;
			callbacks.devtoolsPersist();

			const stored: unknown = JSON.parse(
				window.localStorage.getItem( DEVTOOLS_STORAGE_KEY ) ?? 'null'
			);
			expect( stored ).toEqual( {
				open: true,
				battery: { charging: null, level: null },
				surf: { sterile: false },
			} );
		}
	} );

	it( 'hydrates open, battery and the Surf tool’s armed sterile flag from a previously persisted slice', () => {
		window.localStorage.setItem(
			DEVTOOLS_STORAGE_KEY,
			JSON.stringify( {
				open: true,
				battery: { charging: false, level: 0.6 },
				surf: { sterile: true },
			} )
		);

		hydrateDevtools();

		expect( mocks.state.devtools.open ).toBe( true );
		expect( mocks.state.devtools.battery ).toEqual( {
			charging: false,
			level: 0.6,
		} );
		expect( mocks.state.devtools.surf.sterile ).toBe( true );
	} );

	it( 'never restores the discharge sim, even from a running sim left over in storage', () => {
		// The persisted shape no longer has a `sim` field at all, but a value
		// written before this change (or by another tab still on old code)
		// could still carry one — hydrate must not resurrect a "running" sim
		// from it under any circumstance.
		window.localStorage.setItem(
			DEVTOOLS_STORAGE_KEY,
			JSON.stringify( {
				open: true,
				battery: { charging: false, level: 0.6 },
				sim: { ...defaultSim(), running: true, startedAt: 12345 },
				surf: { sterile: false },
			} )
		);

		hydrateDevtools();

		expect( mocks.state.devtools.sim ).toEqual( defaultSim() );
	} );

	it( 'never restores the Surf tool’s runtime fields, even a running behavior left over in storage', () => {
		// The persisted shape only ever carries `surf.sterile` — a value
		// written before this change (or by another tab still on old code)
		// could still carry the runtime fields too, and hydrate must not
		// resurrect any of them.
		window.localStorage.setItem(
			DEVTOOLS_STORAGE_KEY,
			JSON.stringify( {
				open: true,
				battery: { charging: null, level: null },
				surf: {
					sterile: true,
					behaviorKey: 'readPause',
					remainingMs: 4000,
					affordances: {
						hasVideo: true,
						imageCount: 1,
						textDensity: 1,
					},
					pageStep: { delta: 1, seq: 3 },
				},
			} )
		);

		hydrateDevtools();

		expect( mocks.state.devtools.surf ).toEqual( {
			...defaultSurf(),
			sterile: true,
		} );
	} );

	it( 'leaves the default state untouched when nothing is stored', () => {
		hydrateDevtools();

		expect( mocks.state.devtools.open ).toBe( false );
		expect( mocks.state.devtools.battery ).toEqual( {
			charging: null,
			level: null,
		} );
		expect( mocks.state.devtools.sim ).toEqual( defaultSim() );
		expect( mocks.state.devtools.surf ).toEqual( defaultSurf() );
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

		// A stored value missing `battery` entirely is rejected too.
		window.localStorage.setItem(
			DEVTOOLS_STORAGE_KEY,
			JSON.stringify( { open: true } )
		);
		hydrateDevtools();
		expect( mocks.state.devtools.open ).toBe( false );

		// A stored value missing `surf` (or with a malformed `surf.sterile`) is
		// rejected too.
		window.localStorage.setItem(
			DEVTOOLS_STORAGE_KEY,
			JSON.stringify( {
				open: true,
				battery: { charging: null, level: null },
			} )
		);
		hydrateDevtools();
		expect( mocks.state.devtools.open ).toBe( false );

		window.localStorage.setItem(
			DEVTOOLS_STORAGE_KEY,
			JSON.stringify( {
				open: true,
				battery: { charging: null, level: null },
				surf: { sterile: 'yes' },
			} )
		);
		hydrateDevtools();
		expect( mocks.state.devtools.open ).toBe( false );
	} );

	it( 'ignores a value stored under the previous (pre-sterile-surf) v4 key', () => {
		// The v4 shape carried no `surf` field at all. The storage key bump
		// means it is simply never looked up again — the slice starts fresh at
		// its defaults, the sterile override never armed from it.
		window.localStorage.setItem(
			'bsb-devtools-v4',
			JSON.stringify( {
				open: true,
				battery: { charging: true, level: 0.9 },
			} )
		);

		hydrateDevtools();

		expect( DEVTOOLS_STORAGE_KEY ).toBe( 'bsb-devtools-v5' );
		expect( mocks.state.devtools ).toEqual( {
			open: false,
			battery: { charging: null, level: null },
			sim: defaultSim(),
			surf: defaultSurf(),
		} );
	} );

	it( 'ignores a value stored under the older (pre-Milestone-3) v3 key', () => {
		// The v3 shape carried a `sim` field the panel would resume a running
		// sim from. The storage key bump means it is simply never looked up
		// again — the slice starts fresh at its defaults, sim never included.
		window.localStorage.setItem(
			'bsb-devtools-v3',
			JSON.stringify( {
				open: true,
				battery: { charging: true, level: 0.9 },
				sim: { ...defaultSim(), running: true, startedAt: 12345 },
			} )
		);

		hydrateDevtools();

		expect( mocks.state.devtools ).toEqual( {
			open: false,
			battery: { charging: null, level: null },
			sim: defaultSim(),
			surf: defaultSurf(),
		} );
	} );

	it( 'ignores a value stored under the old (pre-Milestone-2) v2 key', () => {
		window.localStorage.setItem(
			'bsb-devtools-v2',
			JSON.stringify( {
				open: true,
				battery: { charging: true, level: 0.9 },
			} )
		);

		hydrateDevtools();

		expect( mocks.state.devtools ).toEqual( {
			open: false,
			battery: { charging: null, level: null },
			sim: defaultSim(),
			surf: defaultSurf(),
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
			surf: defaultSurf(),
		} );
	} );
} );
