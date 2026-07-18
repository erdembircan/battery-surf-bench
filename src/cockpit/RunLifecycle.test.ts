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
import { type CockpitContext } from '@/cockpit/CockpitContext';
import { type InstanceState } from '@/cockpit/RunInstance';
import { RunSession } from '@/cockpit/RunSession';
import { ToastQueue } from '@/cockpit/Toasts';

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

import { stopRun } from '@/cockpit/RunLifecycle';

/** A reactive-context double carrying only what `stopRun` reads and writes. */
const context = (): CockpitContext =>
	( {
		mode: 'duration',
		durationMinutes: 30,
		targetPercent: 70,
		soundEnabled: false,
		elapsed: 1800,
		running: true,
		sterile: false,
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
		barkBehavior: '',
		barkText: '',
		barkDurationMs: 0,
		barkPhase: '',
		barkStrings: {},
		sharkSwimming: false,
		sharkStartPct: 0,
		sharkEndPct: 0,
		sharkTotalMs: 0,
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
		pendingBark: null,
		pendingDurationMs: null,
		barkDurationTimer: null,
		barkLeaveTimer: null,
		loadWatchdog: null,
		sterilePageStepSeq: null,
		sharkTimer: null,
		konamiProgress: 0,
		konamiLastKeyAt: null,
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

	it( 'never uploads a sterile run, even one that recorded samples — a sterilized test run is not a benchmark', () => {
		const session = new RunSession();
		session.start( 0 );
		session.record( 0, 0.82, false );
		session.record( 600000, 0.7, false );
		const ctx = { ...context(), sterile: true };

		stopRun( ctx, instance( session ), 'stopped' );

		expect( globalThis.fetch ).not.toHaveBeenCalled();
	} );

	it( 'still uploads a natural (non-sterile) run that recorded samples', () => {
		const session = new RunSession();
		session.start( 0 );
		session.record( 0, 0.82, false );
		session.record( 600000, 0.7, false );
		const ctx = { ...context(), sterile: false };

		stopRun( ctx, instance( session ), 'stopped' );

		expect( globalThis.fetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'uploads a run the viewport load guard cut short, same as any other reason', () => {
		const session = new RunSession();
		session.start( 0 );
		session.record( 0, 0.82, false );
		session.record( 600000, 0.7, false );

		stopRun( context(), instance( session ), 'loadError' );

		expect( globalThis.fetch ).toHaveBeenCalledTimes( 1 );
		expect( globalThis.fetch ).toHaveBeenCalledWith(
			'https://wp.test/wp-json/wp/v2/bsb_session',
			expect.objectContaining( { method: 'POST' } )
		);
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

	it( 'clears an active bark (and any queued one) when the run stops', () => {
		const ctx = context();
		ctx.barkBehavior = 'readPause';
		ctx.barkText = 'Deep in the good words…';
		ctx.barkDurationMs = 8000;
		ctx.barkPhase = 'entering';
		const inst = instance( new RunSession() );
		inst.pendingBark = 'lingerImage';
		inst.pendingDurationMs = 2000;
		inst.barkDurationTimer = setTimeout(
			() => undefined,
			8000
		) as unknown as number;

		stopRun( ctx, inst, 'stopped' );

		expect( ctx.barkBehavior ).toBe( '' );
		expect( ctx.barkText ).toBe( '' );
		expect( ctx.barkDurationMs ).toBe( 0 );
		expect( ctx.barkPhase ).toBe( '' );
		expect( inst.pendingBark ).toBeNull();
		expect( inst.pendingDurationMs ).toBeNull();
		expect( inst.barkDurationTimer ).toBeNull();
		expect( inst.barkLeaveTimer ).toBeNull();
	} );

	it( 'clears a swimming shark (and its timer/Konami progress) when the run stops', () => {
		const ctx = context();
		ctx.sharkSwimming = true;
		ctx.sharkStartPct = 12;
		ctx.sharkEndPct = 88;
		ctx.sharkTotalMs = 5000;
		const inst = instance( new RunSession() );
		inst.konamiProgress = 4;
		inst.konamiLastKeyAt = 1000;
		inst.sharkTimer = setTimeout( () => undefined, 5000 ) as unknown as
			| number
			| null;

		stopRun( ctx, inst, 'stopped' );

		expect( ctx.sharkSwimming ).toBe( false );
		expect( ctx.sharkStartPct ).toBe( 0 );
		expect( ctx.sharkEndPct ).toBe( 0 );
		expect( ctx.sharkTotalMs ).toBe( 0 );
		expect( inst.sharkTimer ).toBeNull();
		expect( inst.konamiProgress ).toBe( 0 );
		expect( inst.konamiLastKeyAt ).toBeNull();
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
