/**
 * Tests for the listing's seeded sessions: that they are deterministic, that
 * the cockpit's own run model reads their drain rate back, and that the REST
 * body mirror produces exactly what the cockpit's `buildSessionPayload` does.
 */

import { describe, expect, it, vi } from 'vitest';
import { buildSessionPayload } from '../../src/cockpit/SessionUpload.ts';
import {
	LISTING_SESSIONS,
	simulateRun,
	toSessionBody,
} from './SeededSessions.mts';

// The upload module loads the Interactivity API at import time, which needs a
// browser page; the payload builder under test never calls it.
vi.mock( '@wordpress/interactivity', () => ( { getConfig: () => ( {} ) } ) );

describe( 'LISTING_SESSIONS', () => {
	it.each( LISTING_SESSIONS.map( ( run, index ) => [ index + 1, run ] ) )(
		'session #%i: the REST body matches the cockpit upload builder',
		( _number, run ) => {
			const input = simulateRun( run );

			expect( toSessionBody( input ) ).toEqual(
				buildSessionPayload( input )
			);
		}
	);

	it.each( LISTING_SESSIONS.map( ( run, index ) => [ index + 1, run ] ) )(
		'session #%i: simulating it twice gives the same session',
		( _number, run ) => {
			expect( simulateRun( run ) ).toEqual( simulateRun( run ) );
		}
	);

	it.each( LISTING_SESSIONS.map( ( run, index ) => [ index + 1, run ] ) )(
		'session #%i: the run model reads its drain rate back to within 2 % an hour',
		( _number, run ) => {
			const rate = simulateRun( run ).summary?.rateSession;

			expect( rate ).not.toBeNull();
			expect(
				Math.abs( ( rate ?? 0 ) - run.drainPctPerHour )
			).toBeLessThan( 2 );
		}
	);

	it( 'ends the target-drop run exactly when the drop reaches its target', () => {
		const run = LISTING_SESSIONS.find(
			( candidate ) => candidate.config.mode === 'targetDrop'
		);
		const input = simulateRun( run! );
		const lastSample = input.samples[ input.samples.length - 1 ];

		expect( Math.round( input.summary?.droppedPct ?? 0 ) ).toBe(
			run!.config.targetPercent
		);
		expect( input.elapsedSeconds ).toBe(
			Math.round( lastSample.t / 1000 )
		);
	} );

	it( 'lasts the configured length in every run that ends by duration', () => {
		const durationRuns = LISTING_SESSIONS.filter(
			( run ) => run.reason === 'duration'
		);

		expect( durationRuns.length ).toBeGreaterThan( 0 );
		for ( const run of durationRuns ) {
			expect( simulateRun( run ).elapsedSeconds ).toBe(
				run.config.durationMinutes * 60
			);
		}
	} );
} );
