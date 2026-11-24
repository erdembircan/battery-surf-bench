/**
 * Tests for the agent playground's seed: the runs it creates are the ones an
 * agent can be asked about, and the PHP it runs creates what the playground
 * promises.
 */

import { describe, it, expect } from 'vitest';
import { agentSeedPhp, seedRuns } from './AgentSeed.mts';

describe( 'seedRuns', () => {
	it( 'parses a table row into a typed run', () => {
		expect( seedRuns[ 3 ] ).toEqual( {
			n: 4,
			daysAgo: 24,
			status: 'finished',
			configMode: 'targetDrop',
			amount: 70,
			elapsed: 4320,
			start: 0.85,
			end: 0.7,
			rateSession: 12.5,
			rate10: 12.9,
			tte: 28800,
			browser: 'Opera',
			version: '124',
			os: 'Windows',
		} );
	} );

	it( 'has 24 runs, numbered in insertion order', () => {
		expect( seedRuns.map( ( run ) => run.n ) ).toEqual(
			Array.from( { length: 24 }, ( _, index ) => index + 1 )
		);
	} );

	it( 'inserts the run that started earlier last, so insertion is not start order', () => {
		const last = seedRuns[ seedRuns.length - 1 ];
		const before = seedRuns[ seedRuns.length - 2 ];

		expect( last.daysAgo ).toBeGreaterThan( before.daysAgo );
	} );

	it( 'covers every status and both modes', () => {
		expect( new Set( seedRuns.map( ( run ) => run.status ) ) ).toEqual(
			new Set( [ 'finished', 'stopped', 'aborted', 'failed' ] )
		);
		expect( new Set( seedRuns.map( ( run ) => run.configMode ) ) ).toEqual(
			new Set( [ 'duration', 'targetDrop' ] )
		);
	} );

	it( 'spreads the runs over three browsers and four operating systems', () => {
		expect( new Set( seedRuns.map( ( run ) => run.browser ) ).size ).toBe(
			3
		);
		expect( new Set( seedRuns.map( ( run ) => run.os ) ) ).toEqual(
			new Set( [ 'macOS', 'Windows', 'Linux', 'ChromeOS' ] )
		);
	} );

	it( 'has unmeasured runs, each with all three figures at zero', () => {
		const unmeasured = seedRuns.filter( ( run ) => run.rateSession === 0 );

		expect( unmeasured.length ).toBeGreaterThan( 0 );

		for ( const run of unmeasured ) {
			expect( run.rate10 ).toBe( 0 );
			expect( run.tte ).toBe( 0 );
		}
	} );

	it( 'has one clearly fastest drain, run 13', () => {
		const fastest = [ ...seedRuns ].sort(
			( a, b ) => b.rateSession - a.rateSession
		)[ 0 ];

		expect( fastest.n ).toBe( 13 );
		expect( fastest.rateSession ).toBe( 22.2 );
	} );

	it( 'never ends a run above the level it started at', () => {
		for ( const run of seedRuns ) {
			expect( run.end ).toBeLessThanOrEqual( run.start );
		}
	} );
} );

describe( 'agentSeedPhp', () => {
	it( 'creates every run through the plugin REST collection and fails loudly on an error', () => {
		expect( agentSeedPhp ).toContain( "'/wp/v2/bsbench_session'" );
		expect( agentSeedPhp ).toContain( 'rest_do_request' );
		expect( agentSeedPhp ).toContain( 'throw new RuntimeException' );
	} );

	it( 'carries the 24 runs as data', () => {
		const rows = /json_decode\( '(.*)', true \)/.exec( agentSeedPhp );

		expect( rows ).not.toBeNull();
		expect( JSON.parse( rows?.[ 1 ] ?? '[]' ) ).toHaveLength( 24 );
		expect( agentSeedPhp ).not.toContain( '__ROWS__' );
	} );

	it( 'creates the pages and posts the course and its refusals need', () => {
		for ( const title of [
			'About',
			'Contact',
			'Pricing',
			'Team Notes',
			'Battery Myths, Busted',
			'Coming Soon: Our Spring Tour',
		] ) {
			expect( agentSeedPhp ).toContain( `'${ title }'` );
		}

		expect( agentSeedPhp ).toContain( "'post_status' => 'draft'" );
		expect( agentSeedPhp ).toContain( "'post_status' => 'private'" );
		expect( agentSeedPhp ).toContain( "'post_status'   => 'future'" );
	} );

	it( 'saves a course of the bundled pages with the Contact page last', () => {
		expect( agentSeedPhp ).toContain(
			"update_option(\n\t'bsbench_course_order'"
		);
		expect( agentSeedPhp ).toContain(
			"array( 'kind' => 'user', 'id' => $bsb_contact )"
		);
	} );

	it( 'creates an application password and hands its credentials to the host', () => {
		expect( agentSeedPhp ).toContain(
			"create_new_application_password( $bsb_admin->ID, array( 'name' => 'Agent playground' ) )"
		);
		expect( agentSeedPhp ).toContain( "'/agent/credentials.json'" );
		expect( agentSeedPhp ).toContain( "'username' => 'admin'" );
	} );

	it( 'never stores a run with both a duration and a target', () => {
		expect( agentSeedPhp ).toContain( "'duration' === $row['configMode']" );
		expect( agentSeedPhp ).toContain( 'bsbench_config_duration' );
		expect( agentSeedPhp ).toContain( 'bsbench_config_target_percent' );
	} );
} );
