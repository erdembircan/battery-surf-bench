/**
 * Tests for the run-length-encoded sample log.
 *
 * The consumer is the run session, which records readings and reads back the
 * collapsed plateaus as regression input. These tests verify the encoding: a
 * plateau collapses to one record stamped at its leading edge with a growing
 * count, and a level or charging change opens a new record.
 */

import { describe, it, expect } from 'vitest';
import { SampleLog } from './SampleLog';

describe( 'SampleLog', () => {
	it( 'collapses a repeated level into one record at its leading edge', () => {
		const log = new SampleLog();
		log.record( 0, 0.8, false );
		log.record( 5_000, 0.8, false );
		log.record( 10_000, 0.8, false );

		expect( log.size ).toBe( 1 );
		expect( log.all() ).toEqual( [
			{ t: 0, level: 0.8, charging: false, count: 3 },
		] );
	} );

	it( 'opens a new record when the level steps', () => {
		const log = new SampleLog();
		log.record( 0, 0.8, false );
		log.record( 5_000, 0.79, false );

		expect( log.size ).toBe( 2 );
		expect( log.all() ).toEqual( [
			{ t: 0, level: 0.8, charging: false, count: 1 },
			{ t: 5_000, level: 0.79, charging: false, count: 1 },
		] );
	} );

	it( 'opens a new record when the charging state flips at the same level', () => {
		const log = new SampleLog();
		log.record( 0, 0.8, false );
		log.record( 5_000, 0.8, true );

		expect( log.size ).toBe( 2 );
		expect( log.latest() ).toEqual( {
			t: 5_000,
			level: 0.8,
			charging: true,
			count: 1,
		} );
	} );

	it( 'reports the latest plateau, or null when empty', () => {
		const log = new SampleLog();
		expect( log.latest() ).toBeNull();

		log.record( 0, 0.8, false );
		log.record( 1_000, 0.7, false );
		expect( log.latest()?.level ).toBe( 0.7 );
	} );

	it( 'clears every recorded plateau for a fresh run', () => {
		const log = new SampleLog();
		log.record( 0, 0.8, false );
		log.record( 1_000, 0.7, false );

		log.clear();

		expect( log.size ).toBe( 0 );
		expect( log.all() ).toEqual( [] );
		expect( log.latest() ).toBeNull();
	} );
} );
