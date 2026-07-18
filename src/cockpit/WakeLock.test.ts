/**
 * Tests for the screen wake lock wrapper.
 *
 * The consumer is the store, which acquires a lock while a run is live and
 * releases it otherwise, relying on the wrapper to hold at most one lock, to
 * survive an unsupported/blocked request, and to forget a lock the browser drops
 * on its own so the next acquire re-requests.
 */

import { describe, it, expect, vi } from 'vitest';
import { ScreenWakeLock, type WakeLockSentinelLike } from '@/cockpit/WakeLock';

/** A fake sentinel whose `release` event can be fired. */
const fakeSentinel = () => {
	const listeners: Record< string, () => void > = {};
	const sentinel = {
		released: false,
		release: vi.fn( () => {
			sentinel.released = true;
			return Promise.resolve();
		} ),
		addEventListener: ( type: string, listener: () => void ) => {
			listeners[ type ] = listener;
		},
		removeEventListener: ( type: string ) => {
			delete listeners[ type ];
		},
		fire: ( type: string ) => listeners[ type ]?.(),
	};

	return sentinel;
};

describe( 'ScreenWakeLock', () => {
	it( 'acquires and holds a single lock', async () => {
		const sentinel = fakeSentinel();
		const request = vi.fn( () => Promise.resolve( sentinel ) );
		const lock = new ScreenWakeLock( { request } );

		await lock.acquire();

		expect( request ).toHaveBeenCalledTimes( 1 );
		expect( lock.held ).toBe( true );

		// Already held: a second acquire does not request another.
		await lock.acquire();
		expect( request ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'releases the held lock', async () => {
		const sentinel = fakeSentinel();
		const lock = new ScreenWakeLock( {
			request: () => Promise.resolve( sentinel ),
		} );

		await lock.acquire();
		await lock.release();

		expect( sentinel.release ).toHaveBeenCalledTimes( 1 );
		expect( lock.held ).toBe( false );
	} );

	it( 'gives up quietly when the request is unsupported or blocked', async () => {
		const lock = new ScreenWakeLock( {
			request: () => Promise.reject( new Error( 'NotAllowed' ) ),
		} );

		await expect( lock.acquire() ).resolves.toBeUndefined();
		expect( lock.held ).toBe( false );
	} );

	it( 'forgets a lock the browser drops, so the next acquire re-requests', async () => {
		const first = fakeSentinel();
		const second = fakeSentinel();
		const request = vi
			.fn< () => Promise< WakeLockSentinelLike > >()
			.mockResolvedValueOnce( first )
			.mockResolvedValueOnce( second );
		const lock = new ScreenWakeLock( { request } );

		await lock.acquire();
		expect( lock.held ).toBe( true );

		// The browser releases the lock (e.g. the tab was hidden).
		first.released = true;
		first.fire( 'release' );
		expect( lock.held ).toBe( false );

		// Re-acquiring requests a fresh lock rather than reusing the dropped one.
		await lock.acquire();
		expect( request ).toHaveBeenCalledTimes( 2 );
		expect( lock.held ).toBe( true );
	} );

	it( 'drops a lock that resolves after it is no longer wanted', async () => {
		const sentinel = fakeSentinel();
		let resolve!: ( s: WakeLockSentinelLike ) => void;
		const lock = new ScreenWakeLock( {
			request: () =>
				new Promise< WakeLockSentinelLike >( ( r ) => {
					resolve = r;
				} ),
		} );

		const acquiring = lock.acquire();
		// The run ends before the request settles.
		await lock.release();
		resolve( sentinel );
		await acquiring;

		// The late lock is released, not left dangling.
		expect( sentinel.release ).toHaveBeenCalledTimes( 1 );
		expect( lock.held ).toBe( false );
	} );
} );
