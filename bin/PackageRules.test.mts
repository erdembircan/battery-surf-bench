/**
 * Tests for the plugin zip contract in `PackageRules.mts`.
 *
 * The rules read only entry names, so every case is a plain list shaped like
 * `unzip -Z1` output: no zip, no filesystem.
 */

import { describe, it, expect } from 'vitest';
import { findPackageViolations } from './PackageRules.mts';

/** Entry names of a clean `composer zip` of a checkout, without build output. */
const CHECKOUT_ZIP = [
	'LICENSE',
	'battery-surf-bench.php',
	'composer.json',
	'readme.txt',
	'assets/images/menu-icon.svg',
	'includes/Core/Config.php',
	'languages/battery-surf-bench.pot',
	'vendor/autoload.php',
];

/** Entry names of a clean release zip, with the compiled bundles. */
const RELEASE_ZIP = [ ...CHECKOUT_ZIP, 'build/cockpit/index.js' ];

describe( 'findPackageViolations', () => {
	it( 'accepts a checkout zip that ships only plugin files', () => {
		expect(
			findPackageViolations( CHECKOUT_ZIP, { release: false } )
		).toEqual( [] );
	} );

	it( 'accepts a release zip with the compiled bundles', () => {
		expect(
			findPackageViolations( RELEASE_ZIP, { release: true } )
		).toEqual( [] );
	} );

	it( 'accepts folder entries alongside file entries', () => {
		expect(
			findPackageViolations(
				[ ...CHECKOUT_ZIP, 'assets/', 'includes/Core/' ],
				{ release: false }
			)
		).toEqual( [] );
	} );

	it( 'flags each unexpected top-level entry once', () => {
		const violations = findPackageViolations(
			[
				...CHECKOUT_ZIP,
				'.github/workflows/checks.yml',
				'.github/actions/setup-php/action.yml',
				'bin/Release.sh',
				'.wordpress-org/icon-256x256.png',
			],
			{ release: false }
		);

		expect( violations ).toHaveLength( 3 );
		expect( violations ).toEqual(
			expect.arrayContaining( [
				expect.stringContaining( '".github"' ),
				expect.stringContaining( '"bin"' ),
				expect.stringContaining( '".wordpress-org"' ),
			] )
		);
	} );

	it( 'flags hidden files inside shipped folders', () => {
		const violations = findPackageViolations(
			[ ...CHECKOUT_ZIP, 'assets/.DS_Store', 'languages/.gitkeep' ],
			{ release: false }
		);

		expect( violations ).toHaveLength( 2 );
		expect( violations ).toEqual(
			expect.arrayContaining( [
				expect.stringContaining( 'assets/.DS_Store' ),
				expect.stringContaining( 'languages/.gitkeep' ),
			] )
		);
	} );

	it( 'flags a hidden folder inside a shipped folder once', () => {
		const violations = findPackageViolations(
			[
				...CHECKOUT_ZIP,
				'assets/.cache/one.png',
				'assets/.cache/two.png',
			],
			{ release: false }
		);

		expect( violations ).toEqual( [
			expect.stringContaining( '"assets/.cache"' ),
		] );
	} );

	it( 'leaves hidden files under vendor/ alone', () => {
		expect(
			findPackageViolations(
				[ ...CHECKOUT_ZIP, 'vendor/psr/container/.gitattributes' ],
				{ release: false }
			)
		).toEqual( [] );
	} );

	it( 'flags a missing required plugin file', () => {
		expect(
			findPackageViolations(
				CHECKOUT_ZIP.filter( ( entry ) => entry !== 'readme.txt' ),
				{ release: false }
			)
		).toEqual( [ 'Missing required entry "readme.txt".' ] );
	} );

	it( 'requires the compiled bundles and vendor/ in release mode', () => {
		const violations = findPackageViolations(
			CHECKOUT_ZIP.filter( ( entry ) => ! entry.startsWith( 'vendor/' ) ),
			{ release: true }
		);

		expect( violations ).toHaveLength( 2 );
		expect( violations ).toEqual(
			expect.arrayContaining( [
				'Missing required entry "build".',
				'Missing required entry "vendor".',
			] )
		);
	} );

	it( 'flags vendor/ shipped without composer.json', () => {
		const violations = findPackageViolations(
			CHECKOUT_ZIP.filter( ( entry ) => entry !== 'composer.json' ),
			{ release: false }
		);

		expect( violations ).toHaveLength( 1 );
		expect( violations[ 0 ] ).toContain( 'composer.json' );
	} );

	it( 'accepts stylesheets that ship with their right-to-left twins', () => {
		expect(
			findPackageViolations(
				[
					...RELEASE_ZIP,
					'build/style-cockpit-dashboard.css',
					'build/style-cockpit-dashboard-rtl.css',
				],
				{ release: true }
			)
		).toEqual( [] );
	} );

	it( 'flags a stylesheet shipped without its right-to-left twin', () => {
		const violations = findPackageViolations(
			[ ...RELEASE_ZIP, 'build/style-course.css' ],
			{ release: true }
		);

		expect( violations ).toHaveLength( 1 );
		expect( violations[ 0 ] ).toContain( '"build/style-course.css"' );
		expect( violations[ 0 ] ).toContain( '"build/style-course-rtl.css"' );
	} );

	it( 'leaves stylesheets under vendor/ alone', () => {
		expect(
			findPackageViolations(
				[ ...CHECKOUT_ZIP, 'vendor/acme/widget/style.css' ],
				{ release: false }
			)
		).toEqual( [] );
	} );
} );
