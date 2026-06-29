/**
 * Tests for the run lifecycle's persistence seam.
 *
 * `stopRun` is the single path every cause of a run ending funnels through, and
 * it now uploads the finished session. These tests assert that contract: ending
 * a run that recorded samples POSTs the session to the collection, and ending an
 * empty run (no samples, nothing to persist) does not. The drain/summary
 * freezing `stopRun` also performs is covered through the store in `view.test.ts`.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type CockpitContext } from './CockpitContext';
import { type InstanceState } from './RunInstance';
import { RunSession } from './RunSession';
import { ToastQueue } from './Toasts';

interface RestConfig {
	restUrl: string;
	restNonce: string;
}

const mocks = vi.hoisted( () => ( {
	config: {} as Partial< RestConfig >,
} ) );

vi.mock( '@wordpress/interactivity', () => ( {
	getConfig: () => mocks.config,
} ) );

import { stopRun } from './RunLifecycle';

/** A reactive-context double carrying only what `stopRun` reads and writes. */
const context = (): CockpitContext =>
	( {
		mode: 'duration',
		durationMinutes: 30,
		targetPercent: 70,
		soundEnabled: false,
		elapsed: 1800,
		running: true,
		ended: false,
		endReason: '',
		flipped: false,
		rate10: null,
		rateSession: null,
		secondsToEmpty: null,
		summaryBatteryStart: '',
		summaryBatteryEnd: '',
		summaryDropped: '',
		hasGraph: false,
		graphJson: '',
		toastKind: '',
		toastText: '',
		toastPhase: '',
		toastStrings: { error: 'Upload failed', notice: 'View only' },
	} ) as unknown as CockpitContext;

/**
 * A per-instance state double around a given session.
 *
 * @param session - The run session the instance carries.
 */
const instance = ( session: RunSession ): InstanceState =>
	( {
		session,
		lastReading: null,
		monitor: null,
		wakeLock: null,
		clock: null,
		chime: null,
		startedAtWall: Date.parse( '2026-06-23T10:00:00.000Z' ),
		idleFlipTimer: null,
		toasts: new ToastQueue(),
		toastTimer: null,
		noticeShownThisRun: false,
	} ) as InstanceState;

describe( 'stopRun persistence', () => {
	beforeEach( () => {
		mocks.config = {
			restUrl: 'https://wp.test/wp-json/wp/v2/bsb_session',
			restNonce: 'nonce-123',
		};
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue( { ok: true, status: 201 } as Response );
	} );

	afterEach( () => {
		vi.restoreAllMocks();
	} );

	it( 'uploads the session when the run recorded samples', () => {
		const session = new RunSession();
		session.start( 0 );
		session.record( 0, 0.82, false );
		session.record( 600000, 0.7, false );

		stopRun( context(), instance( session ), 'duration' );

		expect( globalThis.fetch ).toHaveBeenCalledWith(
			'https://wp.test/wp-json/wp/v2/bsb_session',
			expect.objectContaining( { method: 'POST' } )
		);
	} );

	it( 'does not upload when the run logged no samples', () => {
		stopRun( context(), instance( new RunSession() ), 'stopped' );

		expect( globalThis.fetch ).not.toHaveBeenCalled();
	} );

	it( 'raises an error toast when the upload fails', async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue( { ok: false, status: 503 } as Response );

		const session = new RunSession();
		session.start( 0 );
		session.record( 0, 0.82, false );
		session.record( 600000, 0.7, false );
		const ctx = context();

		stopRun( ctx, instance( session ), 'duration' );

		// The upload is fire-and-forget; let its promise settle.
		await vi.waitFor( () => expect( ctx.toastKind ).toBe( 'error' ) );
		expect( ctx.toastText ).toBe( 'Upload failed' );
		expect( ctx.toastPhase ).toBe( 'entering' );
	} );

	it( 'does not toast when the upload succeeds', async () => {
		const session = new RunSession();
		session.start( 0 );
		session.record( 0, 0.82, false );
		session.record( 600000, 0.7, false );
		const ctx = context();

		stopRun( ctx, instance( session ), 'duration' );

		await Promise.resolve();
		await Promise.resolve();
		expect( ctx.toastKind ).toBe( '' );
	} );
} );
