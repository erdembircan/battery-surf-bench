/**
 * Tests for the shark-release sub-tool: the dev-tools panel header's shark
 * button. Its consumer is the panel's own shark button markup, which binds
 * its `disabled` attribute to `devtoolsSharkDisabled` and its click to
 * `devtoolsReleaseShark`. These stub the Interactivity runtime's shared
 * `battery-surf-bench/cockpit` state, mirroring `./DevtoolsStore.test.ts`'s own mocking
 * setup.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

interface MockSharkState {
	launch: { seq: number } | null;
	launchable: boolean;
}

const mocks = vi.hoisted( () => ( {
	state: undefined as unknown as { devtools: { shark: MockSharkState } },
} ) );

vi.mock( '@wordpress/interactivity', () => ( {
	store: () => ( { state: mocks.state } ),
} ) );

import { sharkReleaseStore } from '@/devtools/store/SharkReleaseStore';

const state = sharkReleaseStore.state as Record< string, unknown >;
const actions = sharkReleaseStore.actions as unknown as {
	devtoolsReleaseShark: () => void;
};

beforeEach( () => {
	mocks.state = {
		devtools: {
			shark: { launch: null, launchable: false },
		},
	};
} );

describe( 'sharkReleaseStore', () => {
	describe( 'devtoolsSharkDisabled', () => {
		it( 'is true while not launchable', () => {
			mocks.state.devtools.shark.launchable = false;

			expect( state.devtoolsSharkDisabled ).toBe( true );
		} );

		it( 'is false while launchable', () => {
			mocks.state.devtools.shark.launchable = true;

			expect( state.devtoolsSharkDisabled ).toBe( false );
		} );
	} );

	describe( 'devtoolsReleaseShark', () => {
		it( 'is a no-op while not launchable — launch stays null', () => {
			mocks.state.devtools.shark.launchable = false;

			actions.devtoolsReleaseShark();

			expect( mocks.state.devtools.shark.launch ).toBeNull();
		} );

		it( 'writes a launch command with a numeric seq while launchable', () => {
			mocks.state.devtools.shark.launchable = true;

			actions.devtoolsReleaseShark();

			expect( mocks.state.devtools.shark.launch ).not.toBeNull();
			expect( typeof mocks.state.devtools.shark.launch?.seq ).toBe(
				'number'
			);
		} );

		it( 'a second release writes a strictly greater seq than the first', () => {
			mocks.state.devtools.shark.launchable = true;

			actions.devtoolsReleaseShark();
			const first = mocks.state.devtools.shark.launch?.seq;

			actions.devtoolsReleaseShark();
			const second = mocks.state.devtools.shark.launch?.seq;

			expect( first ).toBeDefined();
			expect( second ).toBeDefined();
			expect( second as number ).toBeGreaterThan( first as number );
		} );
	} );
} );
