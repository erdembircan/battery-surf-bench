import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `EngineBoot` (`./index`) is a top-level script: importing it runs its boot
 * logic immediately, reading the current `window.location.search`. Each test
 * sets the URL first (via `history.pushState`, which jsdom applies without a
 * real navigation), resets the module registry so a fresh dynamic import
 * re-executes the boot logic, and stubs `SurfLoop`/`SterileHelm` so no real
 * tick loop or steer listener actually starts — this file only proves WHICH
 * engine gets constructed and started for a given URL, not either engine's
 * own behavior (covered by `SurfLoop.test.ts`/`SterileHelm.test.ts`).
 */

const mocks = vi.hoisted( () => ( {
	surfLoopCtor: vi.fn(),
	surfLoopStart: vi.fn(),
	sterileHelmCtor: vi.fn(),
	sterileHelmStart: vi.fn(),
} ) );

vi.mock( './SurfLoop', () => ( {
	SurfLoop: class {
		constructor( deps: unknown ) {
			mocks.surfLoopCtor( deps );
		}
		start(): void {
			mocks.surfLoopStart();
		}
	},
} ) );

vi.mock( './SterileHelm', () => ( {
	SterileHelm: class {
		constructor( deps: unknown ) {
			mocks.sterileHelmCtor( deps );
		}
		start(): void {
			mocks.sterileHelmStart();
		}
	},
} ) );

/**
 * Points `window.location` at the given search string without a real
 * navigation, so the freshly-imported boot script reads it off
 * `window.location.search`.
 * @param search
 */
const setUrl = ( search: string ): void => {
	window.history.pushState( {}, '', search );
};

beforeEach( () => {
	vi.resetModules();
	mocks.surfLoopCtor.mockClear();
	mocks.surfLoopStart.mockClear();
	mocks.sterileHelmCtor.mockClear();
	mocks.sterileHelmStart.mockClear();
} );

describe( 'EngineBoot', () => {
	it( 'boots nothing when bsbTraits is absent from the URL', async () => {
		setUrl( '?' );

		await import( './index' );

		expect( mocks.surfLoopCtor ).not.toHaveBeenCalled();
		expect( mocks.sterileHelmCtor ).not.toHaveBeenCalled();
	} );

	it( 'starts SurfLoop, and never constructs SterileHelm, when bsbSterile is absent', async () => {
		setUrl( '?bsbTraits=5,5,5,5,5' );

		await import( './index' );

		expect( mocks.surfLoopStart ).toHaveBeenCalledTimes( 1 );
		expect( mocks.sterileHelmCtor ).not.toHaveBeenCalled();
	} );

	it( 'starts SterileHelm, and never constructs (or starts) SurfLoop, when bsbSterile=1 — the auction never ticks', async () => {
		setUrl( '?bsbTraits=5,5,5,5,5&bsbSterile=1' );

		await import( './index' );

		expect( mocks.sterileHelmStart ).toHaveBeenCalledTimes( 1 );
		expect( mocks.surfLoopCtor ).not.toHaveBeenCalled();
		expect( mocks.surfLoopStart ).not.toHaveBeenCalled();
	} );

	it( 'treats any bsbSterile value other than "1" as a natural run', async () => {
		setUrl( '?bsbTraits=5,5,5,5,5&bsbSterile=0' );

		await import( './index' );

		expect( mocks.surfLoopStart ).toHaveBeenCalledTimes( 1 );
		expect( mocks.sterileHelmCtor ).not.toHaveBeenCalled();
	} );
} );
