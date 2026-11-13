/**
 * Tests for the release version check in `ReleaseVersion.mts`.
 *
 * The check reads only file contents, so every case is a string shaped like the
 * real plugin header and readme: no filesystem.
 */

import { describe, it, expect } from 'vitest';
import { findReleaseVersion } from './ReleaseVersion.mts';

/**
 * Builds a main plugin file with the given header version.
 *
 * @param version - The `Version:` value, or null to leave the field out.
 * @return The plugin file's contents.
 */
function pluginFile( version: string | null ): string {
	return [
		'<?php',
		'/**',
		' * Plugin Name:       Battery Surf Bench',
		...( version === null ? [] : [ ` * Version:           ${ version }` ] ),
		' * Requires at least: 7.0',
		' */',
	].join( '\n' );
}

/**
 * Builds a readme with the given stable tag.
 *
 * @param stableTag - The `Stable tag:` value, or null to leave the field out.
 * @return The readme's contents.
 */
function readme( stableTag: string | null ): string {
	return [
		'=== Battery Surf Bench ===',
		'Tested up to: 7.1',
		...( stableTag === null ? [] : [ `Stable tag: ${ stableTag }` ] ),
		'',
		'== Changelog ==',
		'= 1.0.0 =',
	].join( '\n' );
}

describe( 'findReleaseVersion', () => {
	it( 'returns the version when the header, readme and tag agree', () => {
		expect(
			findReleaseVersion(
				pluginFile( '1.2.0' ),
				readme( '1.2.0' ),
				'1.2.0'
			)
		).toEqual( { version: '1.2.0' } );
	} );

	it( 'returns the version without a tag when the header and readme agree', () => {
		expect(
			findReleaseVersion( pluginFile( '1.2.0' ), readme( '1.2.0' ), null )
		).toEqual( { version: '1.2.0' } );
	} );

	it( 'rejects a tag that differs from the header version', () => {
		const result = findReleaseVersion(
			pluginFile( '1.2.0' ),
			readme( '1.2.0' ),
			'1.3.0'
		);

		expect( result ).toEqual( {
			errors: [ expect.stringContaining( 'The tag "1.3.0"' ) ],
		} );
	} );

	it( 'rejects a tag with a "v" prefix', () => {
		const result = findReleaseVersion(
			pluginFile( '1.2.0' ),
			readme( '1.2.0' ),
			'v1.2.0'
		);

		expect( result ).toEqual( {
			errors: [ expect.stringContaining( 'The tag "v1.2.0"' ) ],
		} );
	} );

	it( 'rejects a stable tag that differs from the header version', () => {
		const result = findReleaseVersion(
			pluginFile( '1.2.0' ),
			readme( '1.1.0' ),
			'1.2.0'
		);

		expect( result ).toEqual( {
			errors: [ expect.stringContaining( 'Stable tag: 1.1.0' ) ],
		} );
	} );

	it( 'reports every problem at once', () => {
		const result = findReleaseVersion(
			pluginFile( '1.2.0' ),
			readme( '1.1.0' ),
			'1.3.0'
		);

		expect( 'errors' in result && result.errors ).toHaveLength( 2 );
	} );

	it( 'rejects a plugin file without a version', () => {
		const result = findReleaseVersion(
			pluginFile( null ),
			readme( '1.2.0' ),
			null
		);

		expect( result ).toEqual( {
			errors: [ expect.stringContaining( '"Version:"' ) ],
		} );
	} );

	it( 'rejects a readme without a stable tag', () => {
		const result = findReleaseVersion(
			pluginFile( '1.2.0' ),
			readme( null ),
			null
		);

		expect( result ).toEqual( {
			errors: [ expect.stringContaining( '"Stable tag:"' ) ],
		} );
	} );

	it( 'does not read a version from a field that only ends in "Version"', () => {
		const file = [
			'<?php',
			'/**',
			' * Requires PHP Version: 8.1',
			' */',
		].join( '\n' );

		expect(
			'errors' in findReleaseVersion( file, readme( '8.1' ), null )
		).toBe( true );
	} );
} );
