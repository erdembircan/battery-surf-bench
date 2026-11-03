/**
 * Tests for the plugin zip contract in `PackageRules.mts`.
 *
 * The rules read only entry names, so every case is a plain list shaped like
 * `unzip -Z1` output: no zip, no filesystem.
 */

import { describe, it, expect } from 'vitest';
import { findPackageViolations, findSizeViolations } from './PackageRules.mts';

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
				'bin/Release.mts',
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

	it( 'flags a version-control folder inside vendor/ of a release zip', () => {
		expect(
			findPackageViolations(
				[ ...RELEASE_ZIP, 'vendor/psr/container/.git/HEAD' ],
				{ release: true }
			)
		).toEqual( [
			expect.stringContaining( '"vendor/psr/container/.git"' ),
		] );
	} );

	it( 'leaves a version-control folder inside vendor/ of a checkout zip alone', () => {
		expect(
			findPackageViolations(
				[ ...CHECKOUT_ZIP, 'vendor/psr/container/.git/HEAD' ],
				{ release: false }
			)
		).toEqual( [] );
	} );

	it( 'reports a version-control folder outside vendor/ as one, not also as hidden', () => {
		const violations = findPackageViolations(
			[ ...CHECKOUT_ZIP, 'includes/.svn/entries' ],
			{ release: false }
		);

		expect( violations ).toEqual( [
			expect.stringContaining( 'Version-control folder "includes/.svn"' ),
		] );
	} );

	it( 'flags a version-control folder entry', () => {
		expect(
			findPackageViolations( [ ...CHECKOUT_ZIP, 'assets/.hg/' ], {
				release: false,
			} )
		).toEqual( [
			expect.stringContaining( 'Version-control folder "assets/.hg"' ),
		] );
	} );

	it( 'flags archive and shell files, whatever their case', () => {
		const violations = findPackageViolations(
			[
				...RELEASE_ZIP,
				'includes/tools/setup.sh',
				'assets/archive.ZIP',
				'build/bundle.tar',
			],
			{ release: true }
		);

		expect( violations ).toEqual( [
			expect.stringContaining( 'contains a .sh file' ),
			expect.stringContaining( 'contains a .zip file' ),
			expect.stringContaining( 'contains a .tar file' ),
		] );
	} );

	it( 'flags a script under vendor/ in a release zip only', () => {
		const entries = [ ...CHECKOUT_ZIP, 'vendor/bin/install.sh' ];

		expect( findPackageViolations( entries, { release: true } ) ).toEqual(
			expect.arrayContaining( [
				expect.stringContaining( '"vendor/bin/install.sh"' ),
			] )
		);
		expect( findPackageViolations( entries, { release: false } ) ).toEqual(
			[]
		);
	} );

	it( 'judges a file by its last extension', () => {
		expect(
			findPackageViolations(
				[ ...CHECKOUT_ZIP, 'assets/notes.zip.txt' ],
				{
					release: false,
				}
			)
		).toEqual( [] );
	} );
} );

describe( 'findSizeViolations', () => {
	it( 'accepts a release zip under 10 MB', () => {
		expect( findSizeViolations( 9_999_999, { release: true } ) ).toEqual(
			[]
		);
	} );

	it( 'flags a release zip of 10 MB or more', () => {
		expect( findSizeViolations( 10_000_000, { release: true } ) ).toEqual( [
			expect.stringContaining( 'Zip is 10.0 MB' ),
		] );
	} );

	it( 'does not hold a checkout zip to the limit', () => {
		expect( findSizeViolations( 50_000_000, { release: false } ) ).toEqual(
			[]
		);
	} );
} );
