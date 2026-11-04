/**
 * Tests for the dev-tools composition root.
 *
 * A thin registration module: the individual behaviors it wires together
 * (merging store parts, hydration and persistence, the battery-override and
 * discharge-sim actions/getters) are unit-tested on their own
 * ({@link ./store/DevtoolsStore}, {@link ./store/BatteryOverrideStore},
 * {@link ./store/DischargeSimStore}, {@link ../cockpit/store/StoreParts}). This file only
 * proves the join itself — that importing the module registers the
 * `battery-surf-bench/cockpit` namespace with the whole `devtools` slice folded in.
 */

import { describe, it, expect, vi } from 'vitest';

interface CapturedConfig {
	state: {
		devtools?: {
			open: boolean;
			battery: object;
			sim: object;
			surf: object;
			shark: object;
		};
	};
	actions: Record< string, unknown >;
	callbacks: Record< string, unknown >;
}

const mocks = vi.hoisted( () => ( {
	namespace: undefined as string | undefined,
	config: undefined as CapturedConfig | undefined,
} ) );

vi.mock( '@wordpress/interactivity', () => ( {
	// `hydrateDevtools()` re-fetches the store by namespace right after
	// registration (no second argument); only overwrite the captured config
	// when one is actually supplied, so that re-fetch reads back the same
	// config instead of wiping it.
	store: ( namespace: string, config?: CapturedConfig ) => {
		mocks.namespace = namespace;

		if ( config !== undefined ) {
			mocks.config = config;
		}

		return mocks.config;
	},
} ) );

describe( 'devtools view', () => {
	it( 'joins the battery-surf-bench/cockpit namespace with the devtools slice folded in', async () => {
		await import( '@/devtools/view' );

		expect( mocks.namespace ).toBe( 'battery-surf-bench/cockpit' );
		expect( mocks.config?.state.devtools ).toEqual( {
			open: false,
			battery: { charging: null, level: null },
			sim: {
				fromPercent: 90,
				toPercent: 20,
				minutes: 30,
				running: false,
				startedAt: null,
				currentLevel: null,
				remainingMs: null,
			},
			surf: {
				sterile: false,
				behaviorKey: '',
				remainingMs: null,
				affordances: null,
				pageStep: null,
				runLive: false,
				pageIndex: null,
			},
			shark: {
				launch: null,
				launchable: false,
			},
		} );
		expect( mocks.config?.actions ).toMatchObject( {
			devtoolsToggleOpen: expect.any( Function ),
			devtoolsSetCharging: expect.any( Function ),
			devtoolsSetLevel: expect.any( Function ),
			devtoolsResetLevel: expect.any( Function ),
			devtoolsStepSim: expect.any( Function ),
			devtoolsToggleSim: expect.any( Function ),
			devtoolsSurfSetMode: expect.any( Function ),
			devtoolsSurfSteer: expect.any( Function ),
			devtoolsSurfStep: expect.any( Function ),
			devtoolsReleaseShark: expect.any( Function ),
			devtoolsReset: expect.any( Function ),
		} );
		expect( mocks.config?.callbacks ).toMatchObject( {
			devtoolsPersist: expect.any( Function ),
			devtoolsInitSurf: expect.any( Function ),
		} );
	} );
} );
