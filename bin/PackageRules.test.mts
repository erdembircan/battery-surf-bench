/**
 * Tests for the plugin zip contract in `PackageRules.mts`.
 *
 * The rules read only entry names, so every case is a plain list shaped like
 * `unzip -Z1` output: no zip, no filesystem.
 */

import { describe, it, expect } from 'vitest';
import { findPackageViolations, findSizeViolations } from './PackageRules.mts';

/** The one top-level folder every entry of a well-formed zip sits in. */
const FOLDER = 'battery-surf-bench/';

/** Paths in a clean `composer zip` of a checkout, without build output, inside the plugin folder. */
const CHECKOUT_FILES = [
	'LICENSE',
	'battery-surf-bench.php',
	'composer.json',
	'readme.txt',
	'includes/Core/Config.php',
	'languages/battery-surf-bench-fr_FR.l10n.php',
	'vendor/autoload.php',
];

/** Paths in a clean release zip, with the compiled bundles, inside the plugin folder. */
const RELEASE_FILES = [ ...CHECKOUT_FILES, 'build/cockpit/index.js' ];

/**
 * Returns the zip entry names for paths inside the plugin folder.
 *
 * @param paths - Paths relative to the plugin folder, such as `includes/Plugin.php`.
 * @return The entry names as `unzip -Z1` lists them.
 */
function packed( paths: readonly string[] ): string[] {
	return paths.map( ( path ) => `${ FOLDER }${ path }` );
}

describe( 'findPackageViolations', () => {
	it( 'accepts a checkout zip that ships only plugin files', () => {
		expect(
			findPackageViolations( packed( CHECKOUT_FILES ), {
				release: false,
			} )
		).toEqual( [] );
	} );

	it( 'accepts a release zip with the compiled bundles', () => {
		expect(
			findPackageViolations( packed( RELEASE_FILES ), { release: true } )
		).toEqual( [] );
	} );

	it( 'accepts folder entries alongside file entries', () => {
		expect(
			findPackageViolations(
				[
					FOLDER,
					...packed( [
						...CHECKOUT_FILES,
						'languages/',
						'includes/Core/',
					] ),
				],
				{ release: false }
			)
		).toEqual( [] );
	} );

	it( 'flags each entry outside the plugin folder once, by its top-level name', () => {
		const violations = findPackageViolations(
			[
				...packed( CHECKOUT_FILES ),
				'readme.txt',
				'__MACOSX/battery-surf-bench/._LICENSE',
				'__MACOSX/._battery-surf-bench',
			],
			{ release: false }
		);

		expect( violations ).toHaveLength( 2 );
		expect( violations ).toEqual(
			expect.arrayContaining( [
				expect.stringContaining(
					'Entry "readme.txt" is outside the "battery-surf-bench/" folder'
				),
				expect.stringContaining(
					'Entry "__MACOSX" is outside the "battery-surf-bench/" folder'
				),
			] )
		);
	} );

	it( 'flags a zip with the plugin files at its root by its outside entries alone', () => {
		const violations = findPackageViolations( CHECKOUT_FILES, {
			release: true,
		} );

		expect( violations ).toHaveLength( 7 );
		expect( violations ).toEqual(
			expect.arrayContaining( [
				expect.stringContaining(
					'Entry "battery-surf-bench.php" is outside'
				),
				expect.stringContaining( 'Entry "includes" is outside' ),
				expect.stringContaining( 'Entry "vendor" is outside' ),
			] )
		);
		expect( violations.join( '\n' ) ).not.toContain(
			'Missing required entry'
		);
	} );

	it( 'flags a plugin folder with another name', () => {
		const violations = findPackageViolations(
			CHECKOUT_FILES.map(
				( path ) => `battery-surf-bench-main/${ path }`
			),
			{ release: false }
		);

		expect( violations ).toEqual( [
			expect.stringContaining(
				'Entry "battery-surf-bench-main" is outside the "battery-surf-bench/" folder'
			),
		] );
	} );

	it( 'flags each unexpected entry in the plugin folder once', () => {
		const violations = findPackageViolations(
			packed( [
				...CHECKOUT_FILES,
				'.github/workflows/checks.yml',
				'.github/actions/setup-php/action.yml',
				'bin/Release.mts',
				'.wordpress-org/icon-256x256.png',
			] ),
			{ release: false }
		);

		expect( violations ).toHaveLength( 3 );
		expect( violations ).toEqual(
			expect.arrayContaining( [
				expect.stringContaining(
					'Unexpected entry ".github" in the plugin folder'
				),
				expect.stringContaining(
					'Unexpected entry "bin" in the plugin folder'
				),
				expect.stringContaining(
					'Unexpected entry ".wordpress-org" in the plugin folder'
				),
			] )
		);
	} );

	it( 'flags hidden files inside shipped folders', () => {
		const violations = findPackageViolations(
			packed( [
				...CHECKOUT_FILES,
				'includes/.DS_Store',
				'languages/.gitkeep',
			] ),
			{ release: false }
		);

		expect( violations ).toHaveLength( 2 );
		expect( violations ).toEqual(
			expect.arrayContaining( [
				expect.stringContaining( '"includes/.DS_Store"' ),
				expect.stringContaining( '"languages/.gitkeep"' ),
			] )
		);
	} );

	it( 'flags a hidden folder inside a shipped folder once', () => {
		const violations = findPackageViolations(
			packed( [
				...CHECKOUT_FILES,
				'includes/.cache/one.php',
				'includes/.cache/two.php',
			] ),
			{ release: false }
		);

		expect( violations ).toEqual( [
			expect.stringContaining( '"includes/.cache"' ),
		] );
	} );

	it( 'leaves hidden files under vendor/ alone', () => {
		expect(
			findPackageViolations(
				packed( [
					...CHECKOUT_FILES,
					'vendor/psr/container/.gitattributes',
				] ),
				{ release: false }
			)
		).toEqual( [] );
	} );

	it( 'flags a missing required plugin file', () => {
		expect(
			findPackageViolations(
				packed(
					CHECKOUT_FILES.filter( ( path ) => path !== 'readme.txt' )
				),
				{ release: false }
			)
		).toEqual( [ 'Missing required entry "readme.txt".' ] );
	} );

	it( 'requires the compiled bundles and vendor/ in release mode', () => {
		const violations = findPackageViolations(
			packed(
				CHECKOUT_FILES.filter(
					( path ) => ! path.startsWith( 'vendor/' )
				)
			),
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
			packed(
				CHECKOUT_FILES.filter( ( path ) => path !== 'composer.json' )
			),
			{ release: false }
		);

		expect( violations ).toHaveLength( 1 );
		expect( violations[ 0 ] ).toContain( 'composer.json' );
	} );

	it( 'flags a version-control folder inside vendor/ of a release zip', () => {
		expect(
			findPackageViolations(
				packed( [
					...RELEASE_FILES,
					'vendor/psr/container/.git/HEAD',
				] ),
				{ release: true }
			)
		).toEqual( [
			expect.stringContaining( '"vendor/psr/container/.git"' ),
		] );
	} );

	it( 'leaves a version-control folder inside vendor/ of a checkout zip alone', () => {
		expect(
			findPackageViolations(
				packed( [
					...CHECKOUT_FILES,
					'vendor/psr/container/.git/HEAD',
				] ),
				{ release: false }
			)
		).toEqual( [] );
	} );

	it( 'reports a version-control folder outside vendor/ as one, not also as hidden', () => {
		const violations = findPackageViolations(
			packed( [ ...CHECKOUT_FILES, 'includes/.svn/entries' ] ),
			{ release: false }
		);

		expect( violations ).toEqual( [
			expect.stringContaining( 'Version-control folder "includes/.svn"' ),
		] );
	} );

	it( 'flags a version-control folder entry', () => {
		expect(
			findPackageViolations(
				packed( [ ...CHECKOUT_FILES, 'languages/.hg/' ] ),
				{ release: false }
			)
		).toEqual( [
			expect.stringContaining( 'Version-control folder "languages/.hg"' ),
		] );
	} );

	it( 'flags archive and shell files, whatever their case', () => {
		const violations = findPackageViolations(
			packed( [
				...RELEASE_FILES,
				'includes/tools/setup.sh',
				'includes/archive.ZIP',
				'build/bundle.tar',
			] ),
			{ release: true }
		);

		expect( violations ).toEqual( [
			expect.stringContaining( 'contains a .sh file' ),
			expect.stringContaining( 'contains a .zip file' ),
			expect.stringContaining( 'contains a .tar file' ),
		] );
	} );

	it( 'flags a script under vendor/ in a release zip only', () => {
		const entries = packed( [
			...CHECKOUT_FILES,
			'vendor/bin/install.sh',
		] );

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
				packed( [ ...CHECKOUT_FILES, 'includes/notes.zip.txt' ] ),
				{ release: false }
			)
		).toEqual( [] );
	} );

	it( 'flags assets/, whose images the stylesheets inline', () => {
		expect(
			findPackageViolations(
				packed( [ ...CHECKOUT_FILES, 'assets/images/menu-icon.svg' ] ),
				{ release: false }
			)
		).toEqual( [
			expect.stringContaining(
				'Unexpected entry "assets" in the plugin folder'
			),
		] );
	} );

	it( 'flags every dev-tools file', () => {
		const devTools = [
			'includes/DevTools/DevTools.php',
			'includes/DevTools/Views/Templates/DevToolsPanel.php',
			'build/devtools/view.js',
			'build/devtools.js',
			'build/devtools.asset.php',
			'build/style-devtools.css',
		];
		const violations = findPackageViolations(
			packed( [ ...RELEASE_FILES, ...devTools ] ),
			{ release: true }
		);

		expect( violations ).toEqual(
			devTools.map( ( path ) =>
				expect.stringContaining(
					`Unneeded file "${ path }": the dev-tools panel only runs in local and development environments`
				)
			)
		);
	} );

	it( 'flags translation sources but keeps the compiled translations', () => {
		const violations = findPackageViolations(
			packed( [
				...CHECKOUT_FILES,
				'languages/battery-surf-bench-fr_FR.po',
				'languages/battery-surf-bench.pot',
			] ),
			{ release: false }
		);

		expect( violations ).toEqual( [
			expect.stringContaining(
				'Unneeded file "languages/battery-surf-bench-fr_FR.po"'
			),
			expect.stringContaining(
				'Unneeded file "languages/battery-surf-bench.pot"'
			),
		] );
	} );

	it( 'keeps files whose names only start like the dev tools', () => {
		expect(
			findPackageViolations(
				packed( [
					...RELEASE_FILES,
					'includes/DevToolsHelper.php',
					'build/devtoolsish.js',
				] ),
				{ release: true }
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
