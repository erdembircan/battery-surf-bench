/**
 * Tests for the session upload module.
 *
 * The module's consumer is the run lifecycle: when a run ends it builds a REST
 * body from the frozen run and POSTs it to the session post type's collection.
 * These tests pin the pure payload shaping (status/mode mapping, the meta
 * record, the unmeasurable-to-zero statistics) and the gated transport (URL, nonce
 * header, no-op without config, swallowed failures), stubbing the Interactivity
 * config and the network.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	statusFor,
	modeFor,
	buildSessionPayload,
	postSession,
	type SessionUploadInput,
	type SessionPayload,
} from './SessionUpload';
import { type RunSummary } from './RunSession';
import { type RleSample } from './SampleLog';

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

/**
 * A complete end-of-run summary fixture.
 *
 * @param overrides - Fields to override on the default summary.
 */
const summary = ( overrides: Partial< RunSummary > = {} ): RunSummary => ( {
	startLevel: 0.82,
	endLevel: 0.7,
	droppedPct: 12,
	rate10: 24.5,
	rateSession: 22.1,
	secondsToEmpty: 14400,
	...overrides,
} );

/** A two-plateau sample log fixture. */
const samples = (): RleSample[] => [
	{ t: 0, level: 0.82, charging: false, count: 1 },
	{ t: 60000, level: 0.7, charging: false, count: 3 },
];

/**
 * A full upload input, overridable per test.
 *
 * @param overrides - Fields to override on the default input.
 */
const input = (
	overrides: Partial< SessionUploadInput > = {}
): SessionUploadInput => ( {
	summary: summary(),
	reason: 'duration',
	config: {
		mode: 'duration',
		durationMinutes: 30,
		targetPercent: 70,
	},
	samples: samples(),
	elapsedSeconds: 1500,
	startedAtWall: Date.parse( '2026-06-23T10:00:00.000Z' ),
	endedAtWall: Date.parse( '2026-06-23T10:30:00.000Z' ),
	uaBrowser: 'Chrome',
	uaVersion: '149',
	uaOs: 'macOS',
	...overrides,
} );

describe( 'statusFor', () => {
	it( 'maps a natural finish to finished', () => {
		expect( statusFor( 'duration' ) ).toBe( 'finished' );
		expect( statusFor( 'targetDrop' ) ).toBe( 'finished' );
	} );

	it( 'maps a charger interrupt to aborted', () => {
		expect( statusFor( 'plugged' ) ).toBe( 'aborted' );
	} );

	it( 'maps a hand stop (and anything unknown) to stopped', () => {
		expect( statusFor( 'stopped' ) ).toBe( 'stopped' );
		expect( statusFor( '' ) ).toBe( 'stopped' );
	} );
} );

describe( 'modeFor', () => {
	it( 'follows the timing mode', () => {
		expect(
			modeFor( {
				mode: 'duration',
				durationMinutes: 30,
				targetPercent: 70,
			} )
		).toBe( 'duration' );
		expect(
			modeFor( {
				mode: 'targetDrop',
				durationMinutes: 30,
				targetPercent: 70,
			} )
		).toBe( 'target' );
	} );
} );

describe( 'buildSessionPayload', () => {
	it( 'returns null when the run logged no summary', () => {
		expect( buildSessionPayload( input( { summary: null } ) ) ).toBeNull();
	} );

	it( 'maps the frozen run onto the session meta record', () => {
		const payload = buildSessionPayload( input() );

		expect( payload ).not.toBeNull();
		const { meta } = payload as SessionPayload;
		expect( ( payload as SessionPayload ).status ).toBe( 'publish' );
		expect( meta.bsb_status ).toBe( 'finished' );
		expect( meta.bsb_mode ).toBe( 'duration' );
		expect( meta.bsb_started_at ).toBe( '2026-06-23T10:00:00.000Z' );
		expect( meta.bsb_ended_at ).toBe( '2026-06-23T10:30:00.000Z' );
		expect( meta.bsb_start_level ).toBe( 0.82 );
		expect( meta.bsb_end_level ).toBe( 0.7 );
		expect( meta.bsb_dropped_pct ).toBe( 12 );
		expect( meta.bsb_elapsed ).toBe( 1500 );
		expect( meta.bsb_rate_10 ).toBe( 24.5 );
		expect( meta.bsb_rate_session ).toBe( 22.1 );
		expect( meta.bsb_time_to_empty ).toBe( 14400 );
		expect( meta.bsb_config_mode ).toBe( 'duration' );
		expect( meta.bsb_ua_browser ).toBe( 'Chrome' );
		expect( meta.bsb_ua_version ).toBe( '149' );
		expect( meta.bsb_ua_os ).toBe( 'macOS' );
		expect( meta.bsb_samples ).toEqual( samples() );
	} );

	it( 'persists only the goal that bounds the run', () => {
		const duration = buildSessionPayload(
			input( {
				config: {
					mode: 'duration',
					durationMinutes: 30,
					targetPercent: 70,
				},
			} )
		) as SessionPayload;
		expect( duration.meta.bsb_config_duration ).toBe( 1800 );
		expect( duration.meta.bsb_config_target_percent ).toBeUndefined();

		const target = buildSessionPayload(
			input( {
				config: {
					mode: 'targetDrop',
					durationMinutes: 30,
					targetPercent: 70,
				},
			} )
		) as SessionPayload;
		expect( target.meta.bsb_config_target_percent ).toBe( 70 );
		expect( target.meta.bsb_config_duration ).toBeUndefined();
	} );

	it( 'stores zero for statistics a short run could not compute', () => {
		const payload = buildSessionPayload(
			input( {
				summary: summary( {
					rate10: null,
					rateSession: null,
					secondsToEmpty: null,
				} ),
			} )
		) as SessionPayload;

		expect( payload.meta.bsb_rate_10 ).toBe( 0 );
		expect( payload.meta.bsb_rate_session ).toBe( 0 );
		expect( payload.meta.bsb_time_to_empty ).toBe( 0 );
	} );

	it( 'falls back to the end time when the start stamp is missing', () => {
		const payload = buildSessionPayload(
			input( { startedAtWall: null } )
		) as SessionPayload;

		expect( payload.meta.bsb_started_at ).toBe(
			'2026-06-23T10:30:00.000Z'
		);
	} );
} );

describe( 'postSession', () => {
	const payload: SessionPayload = {
		status: 'publish',
		meta: { bsb_status: 'finished' },
	};

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

	it( 'POSTs to the collection with the nonce header and JSON body', async () => {
		await postSession( payload );

		expect( globalThis.fetch ).toHaveBeenCalledWith(
			'https://wp.test/wp-json/wp/v2/bsb_session',
			expect.objectContaining( {
				method: 'POST',
				credentials: 'same-origin',
				headers: expect.objectContaining( {
					'Content-Type': 'application/json',
					'X-WP-Nonce': 'nonce-123',
				} ),
				body: JSON.stringify( payload ),
			} )
		);
	} );

	it( 'no-ops when the REST config is absent', async () => {
		mocks.config = {};

		await postSession( payload );

		expect( globalThis.fetch ).not.toHaveBeenCalled();
	} );

	it( 'reports failure (not a throw) on a network error', async () => {
		globalThis.fetch = vi.fn().mockRejectedValue( new Error( 'offline' ) );
		const error = vi
			.spyOn( console, 'error' )
			.mockImplementation( () => undefined );

		await expect( postSession( payload ) ).resolves.toBe( false );
		expect( error ).toHaveBeenCalled();
	} );

	it( 'logs an unsuccessful HTTP response', async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue( { ok: false, status: 403 } as Response );
		const error = vi
			.spyOn( console, 'error' )
			.mockImplementation( () => undefined );

		await postSession( payload );

		expect( error ).toHaveBeenCalled();
	} );
} );
