/**
 * Tests for the finish chime and its on/off preference.
 *
 * The consumer is the store, which remembers the preference across visits and
 * sounds the chime at a natural finish. These tests verify the storage
 * round-trip with a tolerant default, and that playing synthesises the triad
 * through an injected audio context — resuming a suspended one and building it
 * only once across plays.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
	FinishChime,
	readStoredSound,
	writeStoredSound,
	type AudioContextLike,
} from '@/cockpit/FinishChime';

/**
 * A recording stand-in for a Web Audio context.
 * @param state - The context's initial state ('running' or 'suspended').
 */
const mockContext = ( state = 'running' ) => {
	const oscillators: Array< {
		frequency: number;
		started: number | null;
		stopped: number | null;
	} > = [];
	const resume = vi.fn();
	const context = {
		currentTime: 0,
		state,
		destination: { connect: ( node: unknown ) => node },
		resume,
		createOscillator() {
			const record = {
				frequency: 0,
				started: null as number | null,
				stopped: null as number | null,
			};
			oscillators.push( record );
			return {
				type: '',
				frequency: {
					set value( hz: number ) {
						record.frequency = hz;
					},
				},
				connect: ( node: unknown ) => node,
				start: ( when: number ) => {
					record.started = when;
				},
				stop: ( when: number ) => {
					record.stopped = when;
				},
			};
		},
		createGain() {
			return {
				gain: {
					setValueAtTime: vi.fn(),
					linearRampToValueAtTime: vi.fn(),
					exponentialRampToValueAtTime: vi.fn(),
				},
				connect: ( node: unknown ) => node,
			};
		},
	} as unknown as AudioContextLike;

	return { context, oscillators, resume };
};

afterEach( () => {
	window.localStorage.clear();
} );

describe( 'stored finish-sound preference', () => {
	it( 'round-trips a written choice', () => {
		writeStoredSound( false );
		expect( readStoredSound() ).toBe( false );

		writeStoredSound( true );
		expect( readStoredSound() ).toBe( true );
	} );

	it( 'defaults to on when nothing is stored', () => {
		expect( readStoredSound() ).toBe( true );
	} );

	it( 'treats only an explicit off as disabled', () => {
		window.localStorage.setItem( 'bsbench-cockpit-sound', 'anything' );
		expect( readStoredSound() ).toBe( true );

		window.localStorage.setItem( 'bsbench-cockpit-sound', 'off' );
		expect( readStoredSound() ).toBe( false );
	} );
} );

describe( 'FinishChime', () => {
	it( 'sounds three notes — a rising triad — when played', () => {
		const { context, oscillators } = mockContext();
		const chime = new FinishChime( () => context );

		chime.play();

		expect( oscillators ).toHaveLength( 3 );
		expect( oscillators.map( ( o ) => o.frequency ) ).toEqual( [
			880, 1108.73, 1318.51,
		] );
		// Each note is scheduled to start and to stop.
		oscillators.forEach( ( o ) => {
			expect( o.started ).not.toBeNull();
			expect( o.stopped ).not.toBeNull();
		} );
		// The notes arpeggiate: each starts after the previous one.
		expect( oscillators[ 1 ]!.started! ).toBeGreaterThan(
			oscillators[ 0 ]!.started!
		);
		expect( oscillators[ 2 ]!.started! ).toBeGreaterThan(
			oscillators[ 1 ]!.started!
		);
	} );

	it( 'resumes a suspended context before sounding', () => {
		const { context, resume } = mockContext( 'suspended' );
		const chime = new FinishChime( () => context );

		chime.play();

		expect( resume ).toHaveBeenCalled();
	} );

	it( 'builds the context once across prime and repeated plays', () => {
		const { context } = mockContext();
		const make = vi.fn( () => context );
		const chime = new FinishChime( make );

		chime.prime();
		chime.play();
		chime.play();

		expect( make ).toHaveBeenCalledTimes( 1 );
	} );
} );
